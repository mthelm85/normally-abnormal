// Exports the book for print: each chapter's .svx becomes a LaTeX file, and each
// chart becomes a vector PDF, ready for print/main.tex (compile with XeLaTeX).
//
//   npm run print               chapters and figures
//   npm run print -- --text     chapters only (fast; no browser needed)
//
// The .svx files stay the only source. Everything this script writes is
// regenerated on every run, so edit the .svx, never print/chapters/*.tex.
// print/main.tex is written once and then belongs to you.
//
// Output:
//   print/chapters/01-average-millionaire.tex …   one per chapter
//   print/chapters/all.tex                         the \include list main.tex reads
//   print/figures/1-1-net-worth.pdf …              one per chart, at the text width
//
// A component this script doesn't know stops it with a message naming the
// component, so nothing goes missing from the print edition silently.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { csvParseRows } from 'd3-dsv';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHAPTERS = join(ROOT, 'src/chapters');
const OUT = join(ROOT, 'print');

// Width of the text block in print/main.tex: 5.5in paper minus 0.85in inner and
// 0.675in outer margins. Charts are drawn at exactly this width, so their
// labels print at the same size they have on screen (12px ≈ 9pt). Keep in sync
// with the geometry in main.tex.
const TEXT_WIDTH_IN = 3.975;

// Components that draw a chart (exported as a PDF), mirroring figures.js.
const CHARTS = [
	'Figure',
	'BarChart',
	'Density',
	'Donut',
	'DrawStrips',
	'Dumbbell',
	'HistogramPanels',
	'LineChart',
	'Radar',
	'RunningAverage',
	'ScaleMorph',
	'Scatter'
];

// ——————————————————————————————————————————————————————————— parsing

/** End of the opening tag at `start`, skipping quoted strings and {expressions}. */
function tagEnd(s, start) {
	let depth = 0;
	let quote = null;
	for (let i = start; i < s.length; i++) {
		const c = s[i];
		if (quote) {
			if (c === quote && s[i - 1] !== '\\') quote = null;
		} else if (depth > 0) {
			if (c === '"' || c === "'" || c === '`') quote = c;
			else if (c === '{') depth++;
			else if (c === '}') depth--;
		} else if (c === '{') depth++;
		else if (c === '"' || c === "'") quote = c;
		else if (c === '>') return { end: i + 1, selfClosing: s[i - 1] === '/' };
	}
	throw new Error('unclosed tag');
}

/** Index just past the `</name>` that closes the tag opened before `from`. */
function closeOf(s, name, from) {
	const open = new RegExp(`<${name}(?=[\\s/>])`, 'g');
	const close = `</${name}>`;
	let depth = 1;
	let i = from;
	while (depth > 0) {
		const c = s.indexOf(close, i);
		if (c < 0) throw new Error(`<${name}> is never closed`);
		open.lastIndex = i;
		let m;
		while ((m = open.exec(s)) && m.index < c) {
			const { end, selfClosing } = tagEnd(s, m.index);
			if (!selfClosing) depth++;
			open.lastIndex = end;
		}
		depth--;
		i = c + close.length;
	}
	return { inner: s.slice(from, i - close.length), end: i };
}

/** Plain string attributes: name="value". Expressions ({...}) are left out. */
function attrs(tag) {
	const out = {};
	for (const m of tag.matchAll(/\s([\w-]+)="([^"]*)"/g)) out[m[1]] = m[2];
	return out;
}

/** Splits HTML-ish content into text and tag nodes (one level; children kept raw). */
function nodes(s) {
	const out = [];
	const re = /<([A-Za-z][\w]*)(?=[\s/>])/g;
	let last = 0;
	let m;
	while ((m = re.exec(s))) {
		const name = m[1];
		const { end, selfClosing } = tagEnd(s, m.index);
		if (m.index > last) out.push({ text: s.slice(last, m.index) });
		const open = s.slice(m.index, end);
		if (selfClosing) {
			out.push({ name, open, inner: '' });
			last = end;
		} else {
			const c = closeOf(s, name, end);
			out.push({ name, open, inner: c.inner });
			last = c.end;
		}
		re.lastIndex = last;
	}
	if (last < s.length) out.push({ text: s.slice(last) });
	return out;
}

// ——————————————————————————————————————————————————————————— inline text

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': '\u00a0' };

/** LaTeX special characters in plain text. */
const escape = (s) =>
	s
		.replace(/\\/g, '\u0001')
		.replace(/([{}$&%#_])/g, '\\$1')
		.replace(/\^/g, '\\^{}')
		.replace(/~/g, '\\textasciitilde{}')
		.replace(/\u0001/g, '\\textbackslash{}')
		.replace(/\u00a0/g, '~');

/** Curly quotes and ellipses, as smartypants does on the web. Dashes stay -- and ---. */
function smart(s) {
	return s
		.replace(/\.\.\./g, '…')
		.replace(/(^|[\s(\[{\u2014\u2013-])"/g, '$1“')
		.replace(/"/g, '”')
		.replace(/(^|[\s(\[{\u2014\u2013-])'/g, '$1‘')
		.replace(/'/g, '’');
}

/**
 * Converts a run of inline content (Markdown emphasis, inline HTML, <Note>,
 * <Fig>, \( math \)) to LaTeX.
 */
function inline(src, ctx) {
	const held = [];
	const hold = (latex) => `\u0002${held.push(latex) - 1}\u0003`;
	let s = src;

	// Math passes through untouched.
	s = s.replace(/\\\(([\s\S]+?)\\\)/g, (_, t) => hold(`\\(${t.trim()}\\)`));
	s = s.replace(/\\\[([\s\S]+?)\\\]/g, (_, t) => hold(`\\[${t.trim()}\\]`));

	// Components and HTML tags.
	s = nodes(s)
		.map((n) => {
			if (n.text !== undefined) return n.text;
			const a = attrs(n.open);
			switch (n.name) {
				case 'Note':
					return hold(`\\footnote{${inline(n.inner.trim(), ctx)}}`);
				case 'Fig': {
					const ref = ctx.refs.get(a.ref);
					if (!ref) throw new Error(`<Fig ref="${a.ref}" /> doesn't match any chart or field guide`);
					return hold(`${ref.label}~\\ref{${ref.key}}`);
				}
				case 'em':
				case 'i':
					return hold(`\\emph{${inline(n.inner, ctx)}}`);
				case 'strong':
				case 'b':
					return hold(`\\textbf{${inline(n.inner, ctx)}}`);
				case 'code':
					return hold(`\\texttt{${escape(n.inner)}}`);
				case 'a':
					return hold(`\\href{${a.href}}{${inline(n.inner, ctx)}}`);
				case 'br':
					return hold('\\\\');
				case 'span':
					return n.inner;
				default:
					throw new Error(`<${n.name}> inside a paragraph has no print version yet`);
			}
		})
		.join('');

	// Markdown links and code, then entities.
	s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => hold(`\\href{${u}}{${inline(t, ctx)}}`));
	s = s.replace(/`([^`]+)`/g, (_, t) => hold(`\\texttt{${escape(t)}}`));
	s = s.replace(/&[#\w]+;/g, (e) => ENTITIES[e] ?? e);

	// Plain text: quotes, escapes, then emphasis (asterisks survive escaping).
	s = escape(smart(s));
	s = s.replace(/\*\*([^*]+?)\*\*/g, '\\textbf{$1}');
	s = s.replace(/\*([^*\s][^*]*?)\*/g, '\\emph{$1}');
	if (/(^|[^\\])\*/.test(s.replace(/\u0002\d+\u0003/g, ''))) {
		throw new Error(`unmatched * in: ${src.slice(0, 80)}…`);
	}

	// Restore held pieces (they may nest).
	for (let k = 0; k < 4; k++) s = s.replace(/\u0002(\d+)\u0003/g, (_, i) => held[+i]);
	return s.replace(/[ \t]+\n/g, '\n').trim();
}

// ——————————————————————————————————————————————————————————— blocks

/** Markdown blocks: headings, lists, quotes, paragraphs. */
function markdown(text, ctx) {
	const out = [];
	for (const block of text.split(/\n\s*\n/)) {
		const b = block.trim();
		if (!b) continue;
		let m;
		if ((m = b.match(/^(#{2,4})\s+(.*)$/))) {
			const cmd = ['section', 'subsection', 'subsubsection'][m[1].length - 2];
			out.push(`\\${cmd}{${inline(m[2], ctx)}}`);
		} else if (/^[-*]\s/.test(b)) {
			const items = b.split(/\n(?=[-*]\s)/).map((i) => `\t\\item ${inline(i.replace(/^[-*]\s+/, ''), ctx)}`);
			out.push(`\\begin{itemize}\n${items.join('\n')}\n\\end{itemize}`);
		} else if (/^\d+\.\s/.test(b)) {
			const items = b.split(/\n(?=\d+\.\s)/).map((i) => `\t\\item ${inline(i.replace(/^\d+\.\s+/, ''), ctx)}`);
			out.push(`\\begin{enumerate}\n${items.join('\n')}\n\\end{enumerate}`);
		} else if (/^>/.test(b)) {
			out.push(`\\begin{quote}\n${inline(b.replace(/^>\s?/gm, ''), ctx)}\n\\end{quote}`);
		} else {
			const d = ctx.dropcap && dropcap(b, ctx);
			if (d) {
				ctx.dropcap = false;
				out.push(d.cap + (/^\s/.test(d.rest) ? ' ' : '') + inline(d.rest, ctx));
			} else out.push(inline(b, ctx));
		}
	}
	return out;
}

/** The chapter's first letter as a \lettrine, with any opening quote beside it. */
function dropcap(p, ctx) {
	const m = p.match(/^([“"‘'(]*)(\p{L}|\p{N})([^\s<]*)/u);
	if (!m) return null;
	const [whole, quote, letter, rest] = m;
	const q = quote ? `[ante=${smart(quote)}]` : '';
	return { cap: `\\lettrine${q}{${letter}}{${rest ? inline(rest, ctx) : ''}}`, rest: p.slice(whole.length) };
}

/** Field Guide cards (FieldGuide in the text, AppliedGuide as a figure). */
function guideBody(inner, ctx) {
	const out = [];
	for (const n of nodes(inner)) {
		if (n.text !== undefined) {
			if (n.text.trim()) out.push(inline(n.text, ctx));
			continue;
		}
		const a = attrs(n.open);
		switch (n.name) {
			case 'Section':
				out.push(`\\guidesection{${inline(a.title ?? '', ctx)}}`);
				out.push(...guideBody(n.inner, ctx));
				break;
			case 'Check':
				out.push(`\\guidecheck{${inline(a.label ?? '', ctx)}}{${inline(n.inner, ctx)}}`);
				break;
			case 'Step':
				out.push(`\\guidestep{${inline(a.label ?? '', ctx)}}{${inline(n.inner, ctx)}}`);
				break;
			case 'Verdict':
				out.push(`\\guideverdict{${a.result ?? 'pass'}}{${inline(a.label ?? '', ctx)}}{${inline(n.inner, ctx)}}`);
				break;
			case 'p':
				out.push(`\\guidepara{${inline(n.inner, ctx)}}`);
				break;
			default:
				throw new Error(`<${n.name}> inside a Field Guide has no print version yet`);
		}
	}
	return out;
}

/** A <DataTable>: its CSV (already formatted for display) as a booktabs table. */
function table(b, a, ctx, imports, dir) {
	const name = b.open.match(/\sdata=\{(\w+)\}/)?.[1];
	const file = name && imports.get(name);
	if (!file) throw new Error(`<DataTable> needs data={…} naming a CSV the chapter imports`);
	const rows = csvParseRows(readFileSync(join(CHAPTERS, dir, file), 'utf8').replace(/\r\n/g, '\n').trim());
	const [head, ...body] = rows;
	const summary = /\ssummary(?=[\s/>]|=\{true\})/.test(b.open);
	const cell = (v) => inline(String(v), ctx);
	const line = (r, italic) => '\t\t' + r.map((v) => (italic ? `\\textit{${cell(v)}}` : cell(v))).join(' & ') + ' \\\\';
	const source = [a.source, a.period].filter(Boolean).join(', ');
	return [
		'\\begin{booktable}',
		`\t\\caption{${inline(a.title ?? '', ctx)}}\\label{${b.key}}`,
		`\t\\begin{tabular*}{\\linewidth}{@{}l@{\\extracolsep{\\fill}}${'r'.repeat(head.length - 1)}@{}}`,
		'\t\t\\toprule',
		'\t\t' + head.map((h) => `\\tablehead{${cell(h)}}`).join(' & ') + ' \\\\',
		'\t\t\\midrule',
		...body.map((r, i) => (summary && i === body.length - 1 ? '\t\t\\midrule\n' + line(r, true) : line(r, false))),
		'\t\t\\bottomrule',
		'\t\\end{tabular*}',
		`\t\\figurenote{${source ? inline(source, ctx) : ''}}{${a.note ? inline(a.note, ctx) : ''}}`,
		'\\end{booktable}'
	];
}

// ——————————————————————————————————————————————————————————— chapters

function chapters() {
	return readdirSync(CHAPTERS, { withFileTypes: true })
		.filter((d) => d.isDirectory() && existsSync(join(CHAPTERS, d.name, 'index.svx')))
		.map((d) => d.name)
		.sort();
}

/** Converts one chapter. Returns its LaTeX and the charts to export. */
function convert(dir) {
	const raw = readFileSync(join(CHAPTERS, dir, 'index.svx'), 'utf8').replace(/\r\n/g, '\n');
	const fm = raw.match(/^---\n([\s\S]*?)\n---\n/);
	if (!fm) throw new Error(`${dir}: no frontmatter`);
	const meta = Object.fromEntries(
		[...fm[1].matchAll(/^(\w+):\s*(.*)$/gm)].map(([, k, v]) => [k, v.replace(/^["']|["']$/g, '').trim()])
	);
	const number = +meta.number;
	const slug = dir.replace(/^\d+-/, '');
	// CSV files the chapter imports (name → path), for tables.
	const imports = new Map(
		[...raw.matchAll(/import\s+(\w+)\s+from\s+['"](\.\/data\/[\w.-]+\.csv)['"]/g)].map((m) => [m[1], m[2]])
	);
	let body = raw
		.slice(fm[0].length)
		.replace(/<script[\s\S]*?<\/script>/g, '')
		.replace(/<style[\s\S]*?<\/style>/g, '')
		.replace(/<!--[\s\S]*?-->/g, '');

	// Top-level components: any capitalized tag that starts a line.
	const blocks = [];
	// (<Fig> and <Note> are inline, even when a paragraph starts with one.)
	const re = /^<(?!(?:Fig|Note)[\s/>])([A-Z]\w*)(?=[\s/>])/gm;
	let last = 0;
	let m;
	while ((m = re.exec(body))) {
		const { end, selfClosing } = tagEnd(body, m.index);
		const c = selfClosing ? { inner: '', end } : closeOf(body, m[1], end);
		blocks.push({ text: body.slice(last, m.index) });
		blocks.push({ name: m[1], open: body.slice(m.index, end), inner: c.inner });
		last = c.end;
		re.lastIndex = last;
	}
	blocks.push({ text: body.slice(last) });

	// Number figures and field guides first, so references can point forward.
	const refs = new Map();
	const charts = [];
	let figs = 0;
	let guides = 0;
	let tables = 0;
	for (const b of blocks) {
		if (!b.name) continue;
		const a = attrs(b.open);
		if (/\snumbered=\{false\}/.test(b.open)) continue;
		if (CHARTS.includes(b.name) || b.name === 'AppliedGuide') {
			const n = `${number}.${++figs}`;
			const anchor = `fig-${a.id ?? n.replace('.', '-')}`;
			b.key = `fig:${a.id ?? `${number}-${figs}`}`;
			b.n = n;
			if (a.id) refs.set(a.id, { label: 'Figure', key: b.key });
			if (b.name !== 'AppliedGuide') {
				b.file = `${number}-${figs}-${a.id ?? 'figure'}`;
				charts.push({ anchor, file: b.file, slug });
			}
		} else if (b.name === 'DataTable') {
			b.key = `tab:${a.id ?? `${number}-${++tables}`}`;
			if (a.id) refs.set(a.id, { label: 'Table', key: b.key });
		} else if (b.name === 'FieldGuide') {
			b.key = `guide:${a.id ?? `${number}-${guides + 1}`}`;
			guides++;
			if (a.id) refs.set(a.id, { label: 'Field Guide', key: b.key });
		}
	}

	const ctx = { refs, dropcap: true };
	const out = [
		`% ${meta.title} — generated from src/chapters/${dir}/index.svx by scripts/print.mjs.`,
		'% Do not edit: changes here are overwritten on the next export.',
		'',
		`\\chapter{${inline(meta.title, ctx)}}`,
		`\\label{ch:${slug}}`,
		''
	];
	for (const b of blocks) {
		if (!b.name) {
			out.push(...markdown(b.text, ctx).flatMap((x) => [x, '']));
			continue;
		}
		const a = attrs(b.open);
		if (CHARTS.includes(b.name)) {
			const source = [a.source, a.period].filter(Boolean).join(', ');
			out.push(
				'\\begin{bookfigure}',
				`\t\\caption{${inline(a.title ?? '', ctx)}}\\label{${b.key}}`,
				`\t\\includegraphics[width=\\textwidth]{figures/${b.file}.pdf}`,
				`\t\\figurenote{${source ? inline(source, ctx) : ''}}{${a.note ? inline(a.note, ctx) : ''}}`,
				'\\end{bookfigure}',
				''
			);
		} else if (b.name === 'AppliedGuide') {
			out.push(
				'\\begin{bookfigure}',
				`\t\\caption{${inline(a.title ?? '', ctx)}}\\label{${b.key}}`,
				'\t\\begin{appliedguide}',
				...guideBody(b.inner, ctx).map((l) => `\t\t${l}`),
				'\t\\end{appliedguide}',
				'\\end{bookfigure}',
				''
			);
		} else if (b.name === 'DataTable') {
			out.push(...table(b, a, ctx, imports, dir), '');
		} else if (b.name === 'FieldGuide') {
			out.push(
				`\\begin{fieldguide}{${inline(a.title ?? '', ctx)}}{${b.key}}`,
				...guideBody(b.inner, ctx).map((l) => `\t${l}`),
				'\\end{fieldguide}',
				''
			);
		} else {
			throw new Error(`<${b.name}> has no print version yet (add it to scripts/print.mjs)`);
		}
	}
	return { tex: out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n', charts };
}

// ——————————————————————————————————————————————————————————— figures

async function exportFigures(charts) {
	let chromium;
	try {
		({ chromium } = await import('playwright'));
	} catch {
		throw new Error('Figures need Playwright: npm i -D playwright && npx playwright install chromium');
	}
	const { createBuilder, preview } = await import('vite');
	console.log('building the site…');
	// buildApp runs every build SvelteKit needs (client and server), as `vite build` does.
	await (await createBuilder({ root: ROOT, logLevel: 'error' })).buildApp();
	const server = await preview({ root: ROOT, preview: { port: 4199, strictPort: false }, logLevel: 'warn' });
	const base = server.resolvedUrls.local[0].replace(/\/$/, '');
	const width = Math.round(TEXT_WIDTH_IN * 96);
	const PAD = 10;

	const browser = await chromium.launch(
		process.env.PRINT_CHROMIUM ? { executablePath: process.env.PRINT_CHROMIUM } : {}
	);
	try {
		const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
		await page.emulateMedia({ media: 'screen', reducedMotion: 'reduce' });
		for (const c of charts) {
			await page.goto(`${base}/${c.slug}?print`, { waitUntil: 'networkidle' });
			await page.evaluate(() => document.fonts.ready);
			const height = await page.evaluate(
				({ anchor, width, PAD }) => {
					const fig = document.getElementById(anchor);
					if (!fig) throw new Error(`no element #${anchor} on the page`);
					// The chart alone, on a blank page, at the print width: the
					// caption, source line and any controls are set by LaTeX instead.
					const style = document.createElement('style');
					style.textContent = `
						/* white paper: label halos and marker fills take the page colour */
						:root { --paper: #fff !important; }
						html, body { background: none !important; margin: 0 !important; padding: 0 !important; }
						#print-figure { position: relative; }
						body::before, body::after { display: none !important; }
						body > :not(#print-figure) { display: none !important; }
						/* flow-root keeps margins inside the box we measure; the side padding
						   leaves room for labels that hang past the plot's edges. */
						#print-figure { display: flow-root; box-sizing: border-box; width: ${width}px; padding: 0 ${PAD}px; }
						#print-figure > figure { margin: 0 !important; padding: 0 !important; border: 0 !important; }
						#print-figure figcaption.head, #print-figure .source,
						#print-figure .controls, #print-figure .hit { display: none !important; }
					`;
					document.head.append(style);
					const holder = document.createElement('div');
					holder.id = 'print-figure';
					document.body.append(holder);
					holder.append(fig);
					// The shared pattern defs (the hatching) live in the page layout, which
					// is hidden below; move them in, since hidden defs don't paint.
					for (const defs of document.querySelectorAll('svg defs')) {
						const svg = defs.ownerSVGElement;
						if (!svg || holder.contains(svg)) continue;
						svg.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;overflow:hidden';
						holder.append(svg);
					}
					return null;
				},
				{ anchor: c.anchor, width, PAD }
			);
			// Let the chart redraw at the new width.
			await page.waitForTimeout(400);
			const h = await page.evaluate(() => Math.ceil(document.getElementById('print-figure').getBoundingClientRect().height));
			await page.pdf({
				path: join(OUT, 'figures', `${c.file}.pdf`),
				width: `${width}px`,
				height: `${h + 2}px`,
				printBackground: false,
				margin: { top: 0, right: 0, bottom: 0, left: 0 }
			});
			console.log(`  figures/${c.file}.pdf`);
			void height;
		}
	} finally {
		await browser.close();
		server.httpServer.close();
	}
}

// ——————————————————————————————————————————————————————————— main

const textOnly = process.argv.includes('--text');
mkdirSync(join(OUT, 'chapters'), { recursive: true });
mkdirSync(join(OUT, 'figures'), { recursive: true });

const all = [];
const charts = [];
for (const dir of chapters()) {
	let r;
	try {
		r = convert(dir);
	} catch (e) {
		console.error(`\n${dir}: ${e.message}\n`);
		process.exit(1);
	}
	writeFileSync(join(OUT, 'chapters', `${dir}.tex`), r.tex);
	all.push(`\\include{chapters/${dir}}`);
	charts.push(...r.charts);
	console.log(`chapters/${dir}.tex (${r.charts.length} charts)`);
}
writeFileSync(
	join(OUT, 'chapters', 'all.tex'),
	`% Generated by scripts/print.mjs: every chapter, in order.\n${all.join('\n')}\n`
);

if (!textOnly) {
	for (const f of readdirSync(join(OUT, 'figures'))) if (f.endsWith('.pdf')) rmSync(join(OUT, 'figures', f));
	await exportFigures(charts);
}
console.log('done: compile print/main.tex with XeLaTeX');
