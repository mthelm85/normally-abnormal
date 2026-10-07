// Svelte preprocessor: typesets LaTeX in chapter files at build time with KaTeX.
//
//   inline:   the mean \( \bar{x} \) of a sample
//   display:  \[ \bar{x} = \frac{1}{n} \sum_{i=1}^{n} x_i \]
//
// It runs before mdsvex, because Markdown would otherwise eat the backslashes.
// The output is plain HTML with braces escaped, so Svelte doesn't read them as
// code. Dollar signs are left alone, so prices like $1 million stay prices.
import katex from 'katex';

const DISPLAY = /\\\[([\s\S]+?)\\\]/g;
const INLINE = /\\\(([\s\S]+?)\\\)/g;

/** @param {string} tex @param {boolean} displayMode @param {string} filename */
function render(tex, displayMode, filename) {
	try {
		const html = katex.renderToString(tex.trim(), { displayMode, throwOnError: true, output: 'html' });
		// Plain HTML, with braces escaped so Svelte doesn't read them as code.
		return html.replaceAll('{', '&#123;').replaceAll('}', '&#125;');
	} catch (e) {
		throw new Error(`LaTeX error in ${filename}: ${/** @type {Error} */ (e).message}\n  in: ${tex.trim()}`);
	}
}

/** @returns {import('svelte/compiler').PreprocessorGroup} */
export default function math() {
	return {
		name: 'math',
		markup({ content, filename }) {
			if (!filename?.endsWith('.svx')) return;
			// Leave <script> and <style> blocks untouched.
			const parts = content.split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>)/);
			const code = parts
				.map((part, i) =>
					i % 2 === 1
						? part
						: part
								.replace(DISPLAY, (_, tex) => render(tex, true, filename))
								.replace(INLINE, (_, tex) => render(tex, false, filename))
				)
				.join('');
			return { code };
		}
	};
}
