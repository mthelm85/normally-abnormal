// Svelte preprocessor: numbers an essay's figures at build time.
//
// The site is a series of essays, so numbering restarts in each one: its charts are
// Figure 1, 2, 3 ..., and its tables Table 1, 2, .... To refer to a chart in the
// text, give it an id and use <Fig>:
//
//   <RunningAverage id="kicks" ... />
//   ... as <Fig ref="kicks" /> shows ...     →   ... as Figure 2 shows ...
//
// References work before or after the chart, and every number updates itself when
// charts are added or moved. An unknown ref stops the build with a clear message.
// To leave one chart unnumbered, add numbered={false} to it.
//
// Field Guide cards (<FieldGuide>) carry the essay's part number instead
// ("Field Guide 2" in Part Two), since each essay has at most one and readers refer
// to them across the series; an essay with several gets 2.1, 2.2, ....
// <Fig ref="..." /> links to them too. (The print edition, scripts/print.mjs, still
// numbers book-style.)
// Components that draw a <Figure>. Add new chart components here.
const FIGURE_TAGS = [
	'Figure',
	'AppliedGuide',
	'BarChart',
	'Density',
	'Donut',
	'DrawStrips',
	'Dumbbell',
	'HistogramPanels',
	'LineChart',
	'LogChart',
	'Radar',
	'RunningAverage',
	'ScaleMorph',
	'Scatter'
];

/**
 * Index just past the end of the opening tag that starts at `start`, skipping over
 * quoted strings and {expressions} (which may contain ">" as in arrow functions).
 * @param {string} s @param {number} start
 * @returns {{ end: number, selfClosing: boolean }}
 */
function tagEnd(s, start) {
	let depth = 0;
	/** @type {string | null} */
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

/** @param {string} filename @param {string} msg @returns {never} */
const fail = (filename, msg) => {
	throw new Error(`Figure numbering in ${filename}: ${msg}`);
};

/** @returns {import('svelte/compiler').PreprocessorGroup} */
export default function figures() {
	return {
		name: 'figures',
		markup({ content, filename }) {
			if (!filename?.endsWith('.svx')) return;

			const chapter = content.match(/^---[\s\S]*?^number:\s*(\d+)/m)?.[1];
			if (!chapter) return;

			// Leave <script> and <style> blocks untouched.
			const parts = content.split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>)/);
						const open = new RegExp(`<(${FIGURE_TAGS.join('|')})(?=[\\s/>])`, 'g');

			/** @type {Map<string, { label: string, n: string, anchor: string }>} */
			const ids = new Map();
			let count = 0;
			let guides = 0;
			/** @param {string} key @param {{ label: string, n: string, anchor: string }} v */
			const register = (key, v) => {
				if (ids.has(key)) fail(filename, `two figures or field guides have id="${key}"`);
				ids.set(key, v);
			};

			// Pass 1: number the figures and wrap each one.
			for (let p = 0; p < parts.length; p += 2) {
				let text = parts[p];
				let out = '';
				let last = 0;
				open.lastIndex = 0;
				let m;
				while ((m = open.exec(text))) {
					const start = m.index;
					const { end: openEnd, selfClosing } = tagEnd(text, start);
					let end = openEnd;
					if (!selfClosing) {
						const close = text.indexOf(`</${m[1]}>`, openEnd);
						if (close < 0) fail(filename, `<${m[1]}> is never closed`);
						end = close + m[1].length + 3;
					}
					let tag = text.slice(start, end);
					open.lastIndex = end;
					if (/\snumbered=\{false\}/.test(tag.slice(0, openEnd - start))) continue;

					const n = `${++count}`;
					const idMatch = tag.slice(0, openEnd - start).match(/\s+id="([\w-]+)"/);
					const key = idMatch?.[1];
					const anchor = `fig-${key ?? n.replace('.', '-')}`;
					if (key) {
						register(key, { label: 'Figure', n, anchor });
						tag = tag.replace(idMatch[0], '');
					}
					out += text.slice(last, start) + `<NumberedFigure n="${n}" id="${anchor}">\n${tag}\n</NumberedFigure>`;
					last = end;
				}
				parts[p] = out + text.slice(last);
			}

			// Pass 1b: number the Field Guide cards; the number goes in as props.
			const guideTotal = parts
				.filter((_, p) => p % 2 === 0)
				.reduce((k, t) => k + (t.match(/<FieldGuide(?=[\s>])/g)?.length ?? 0), 0);
			for (let p = 0; p < parts.length; p += 2) {
				parts[p] = parts[p].replace(/<FieldGuide(?=[\s>])([^>]*?)>/g, (whole, attrs) => {
					++guides;
					const n = guideTotal === 1 ? chapter : `${chapter}.${guides}`;
					const idMatch = attrs.match(/\s+id="([\w-]+)"/);
					const key = idMatch?.[1];
					const anchor = `guide-${key ?? n.replace('.', '-')}`;
					if (key) register(key, { label: 'Field Guide', n, anchor });
					const rest = key ? attrs.replace(idMatch[0], '') : attrs;
					return `<FieldGuide number="${n}" anchor="${anchor}"${rest}>`;
				});
			}

			// Pass 1c: number the tables (<DataTable>) in their own sequence, as props.
			let tables = 0;
			for (let p = 0; p < parts.length; p += 2) {
				let text = parts[p];
				let out = '';
				let last = 0;
				const re = /<DataTable(?=[\s/>])/g;
				let m;
				while ((m = re.exec(text))) {
					const { end } = tagEnd(text, m.index);
					const tag = text.slice(m.index, end);
					const n = `${++tables}`;
					const idMatch = tag.match(/\s+id="([\w-]+)"/);
					const key = idMatch?.[1];
					const anchor = `table-${key ?? n.replace('.', '-')}`;
					if (key) register(key, { label: 'Table', n, anchor });
					const rest = (key ? tag.replace(idMatch[0], '') : tag).slice('<DataTable'.length);
					out += text.slice(last, m.index) + `<DataTable number="${n}" anchor="${anchor}"${rest}`;
					last = end;
					re.lastIndex = end;
				}
				parts[p] = out + text.slice(last);
			}

			// Pass 2: turn <Fig ref="..." /> into "Figure N" / "Field Guide N" / "Table N" links.
			for (let p = 0; p < parts.length; p += 2) {
				parts[p] = parts[p].replace(/<Fig\s+ref="([\w-]+)"\s*\/>/g, (_, key) => {
					const v = ids.get(key);
					if (!v) fail(filename, `<Fig ref="${key}" /> doesn't match any chart's or field guide's id`);
					return `<a class="figref" href="#${v.anchor}">${v.label.replace(' ', '&nbsp;')}&nbsp;${v.n}</a>`;
				});
			}

			let code = parts.join('');
			if (count > 0) {
				const imp = `import NumberedFigure from '#lib/charts/FigureNumber.svelte';`;
				code = /<script(?![^>]*context=)(?![^>]*\bmodule\b)[^>]*>/.test(code)
					? code.replace(/<script(?![^>]*context=)(?![^>]*\bmodule\b)[^>]*>/, (s) => `${s}\n\t${imp}`)
					: code.replace(/^(---[\s\S]*?---\s*)?/, (fm) => `${fm}<script>\n\t${imp}\n</script>\n\n`);
			}
			return { code };
		}
	};
}
