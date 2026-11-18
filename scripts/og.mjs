// Social preview images (Open Graph): one 1200 × 630 PNG per essay plus one for
// the home page, written to static/og/ and committed with the site.
//
//     npm run og
//
// Rerun after changing an essay's title, summary or number, or the thumbnails in
// src/lib/thumbs.ts. Needs Playwright (npm i -D playwright && npx playwright
// install chromium) and Node 22.18+ (it imports thumbs.ts directly).
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'static', 'og');
// Fonts are inlined as data: URLs (a page set with setContent can't load file: URLs).
const font = async (f) =>
	`data:font/woff2;base64,${(await readFile(join(ROOT, 'src', 'lib', 'assets', 'fonts', f))).toString('base64')}`;
const FONT = { playfair: await font('playfair.woff2'), garamondItalic: await font('garamond-italic.woff2'), typewriter: await font('typewriter.woff2') };
const { THUMBS } = await import(pathToFileURL(join(ROOT, 'src', 'lib', 'thumbs.ts')).href);

const SERIES = { title: 'Normally Abnormal', subtitle: 'Why Real-World Data So Rarely Follow a Bell Curve', author: 'Matt Helm' };
const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The essays, from their frontmatter. */
async function essays() {
	const dir = join(ROOT, 'src', 'chapters');
	const out = [];
	for (const folder of (await readdir(dir)).sort()) {
		const src = await readFile(join(dir, folder, 'index.svx'), 'utf8').catch(() => null);
		const fm = src?.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
		if (!fm) continue;
		const get = (k) => fm.match(new RegExp(`^${k}:\\s*"?(.*?)"?\\s*$`, 'm'))?.[1];
		out.push({ slug: folder.replace(/^\d+-/, ''), number: Number(get('number')), title: get('title'), summary: get('summary') ?? '' });
	}
	return out;
}

/** An SVG curve (hatched fill + ink line + baseline) for a thumbnail's points, in a w × h box. */
function curve(points, w, h, stroke = 4) {
	const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
	const x0 = Math.min(...xs), x1 = Math.max(...xs), y1 = Math.max(...ys) || 1;
	const pts = points.map(([x, y]) => `${(((x - x0) / (x1 - x0)) * w).toFixed(1)},${(h - (y / y1) * (h - 6)).toFixed(1)}`);
	return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="overflow:visible">
		<defs><pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
			<line x1="0" y1="0" x2="0" y2="9" stroke="#26221c" stroke-width="2" opacity=".55"/></pattern></defs>
		<path d="M0,${h}L${pts.join('L')}L${w},${h}Z" fill="url(#hatch)"/>
		<path d="M${pts.join('L')}" fill="none" stroke="#26221c" stroke-width="${stroke}" stroke-linejoin="round"/>
		<line x1="0" y1="${h}" x2="${w}" y2="${h}" stroke="#26221c" stroke-width="2.5"/></svg>`;
}

const page = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>
	@font-face { font-family: Playfair; src: url('${FONT.playfair}'); font-weight: 400 900; }
	@font-face { font-family: Garamond; src: url('${FONT.garamondItalic}'); font-style: italic; }
	@font-face { font-family: Typewriter; src: url('${FONT.typewriter}'); }
	* { box-sizing: border-box; margin: 0; }
	body { width: 1200px; height: 630px; background: #f5f1e7; color: #26221c; overflow: hidden; }
	.frame { position: absolute; inset: 34px; border-top: 6px solid #26221c; border-bottom: 2px solid #26221c; padding: 46px 8px 0; display: flex; gap: 56px; }
	.text { flex: 1; display: flex; flex-direction: column; }
	.kicker { font-family: Typewriter, monospace; font-size: 25px; letter-spacing: .14em; text-transform: uppercase; color: #8e3b33; margin-bottom: 22px; }
	h1 { font-family: Playfair, serif; font-weight: 900; font-size: 84px; line-height: 1.02; text-wrap: balance; }
	.sub { font-family: Garamond, serif; font-style: italic; font-size: 36px; line-height: 1.25; color: #5a5348; margin-top: 22px; text-wrap: balance; }
	.by { margin-top: auto; padding-bottom: 30px; font-family: Typewriter, monospace; font-size: 24px; letter-spacing: .12em; text-transform: uppercase; color: #6f675b; }
	.art { display: flex; align-items: center; padding-bottom: 60px; }
	.row { display: flex; gap: 40px; align-items: flex-end; margin-top: 46px; }
</style></head><body>${body}</body></html>`;

function essayCard(e) {
	const t = THUMBS[e.number];
	return page(`<div class="frame">
		<div class="text">
			<p class="kicker">${esc(SERIES.title)} · Part ${WORDS[e.number] ?? e.number}</p>
			<h1>${esc(e.title)}</h1>
			<p class="sub">${esc(e.summary)}</p>
			<p class="by">${esc(SERIES.author)}</p>
		</div>
		${t ? `<div class="art">${curve(t.points, 330, 200)}</div>` : ''}
	</div>`);
}

function homeCard(list) {
	const curves = list.map((e) => THUMBS[e.number]).filter(Boolean).map((t) => curve(t.points, 190, 110, 3.5)).join('');
	return page(`<div class="frame"><div class="text">
		<p class="kicker">An essay series</p>
		<h1>${esc(SERIES.title)}</h1>
		<p class="sub">${esc(SERIES.subtitle)}</p>
		<div class="row">${curves}</div>
		<p class="by">${esc(SERIES.author)}</p>
	</div></div>`);
}

let chromium;
try {
	({ chromium } = await import('playwright'));
} catch {
	throw new Error('Preview images need Playwright: npm i -D playwright && npx playwright install chromium');
}
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1200, height: 630 } });
const list = await essays();
for (const [name, html] of [['home', homeCard(list)], ...list.map((e) => [e.slug, essayCard(e)])]) {
	await tab.setContent(html, { waitUntil: 'load' });
	await tab.evaluate(() => document.fonts.ready);
	await tab.screenshot({ path: join(OUT, `${name}.png`) });
	console.log(`wrote static/og/${name}.png`);
}
await browser.close();
