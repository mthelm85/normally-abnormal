// Svelte preprocessor: numbers a chapter's figures at build time.
//
// Every chart in a chapter is numbered in order, chapter-dot-figure (1.1, 1.2, ...),
// and its caption shows "Figure 1.2". To refer to a chart in the text, give it an id
// and use <Fig>:
//
//   <RunningAverage id="kicks" ... />
//   ... as <Fig ref="kicks" /> shows ...     →   ... as Figure 1.2 shows ...
//
// References work before or after the chart, and every number updates itself when
// charts are added or moved. An unknown ref stops the build with a clear message.
// To leave one chart unnumbered, add numbered={false} to it.
// Components that draw a <Figure>. Add new chart components here.
const FIGURE_TAGS = [
	'Figure',
	'BarChart',
	'Density',
	'Donut',
	'Dumbbell',
	'HistogramPanels',
	'LineChart',
	'Radar',
	'RunningAverage',
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

/** @param {string} filename @param {string} msg */
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

			/** @type {Map<string, string>} */
			const ids = new Map();
			let count = 0;

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

					const n = `${chapter}.${++count}`;
					const idMatch = tag.slice(0, openEnd - start).match(/\s+id="([\w-]+)"/);
					const key = idMatch?.[1];
					if (key) {
						if (ids.has(key)) fail(filename, `two figures have id="${key}"`);
						ids.set(key, n);
						tag = tag.replace(idMatch[0], '');
					}
					const anchor = `fig-${key ?? n.replace('.', '-')}`;
					out += text.slice(last, start) + `<NumberedFigure n="${n}" id="${anchor}">\n${tag}\n</NumberedFigure>`;
					last = end;
				}
				parts[p] = out + text.slice(last);
			}

			// Pass 2: turn <Fig ref="..." /> into "Figure N.M" links.
			for (let p = 0; p < parts.length; p += 2) {
				parts[p] = parts[p].replace(/<Fig\s+ref="([\w-]+)"\s*\/>/g, (_, key) => {
					const n = ids.get(key);
					if (!n) fail(filename, `<Fig ref="${key}" /> doesn't match any chart's id`);
					return `<a class="figref" href="#fig-${key}">Figure&nbsp;${n}</a>`;
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
