// rehype plugin: marks up the first letter of each chapter for its drop cap.
//
// CSS ::first-letter always swallows a leading quotation mark, which blows the
// mark up to drop-cap size. Books set an opening quote at text size beside the
// large letter instead, so this wraps them explicitly:
//   <p><span class="dropcap"><span class="dropcap-q">“</span>H</span>ey, Matt…
const LEAD = /^(\s*)([“"‘'(\[«]*)(\p{L}|\p{N})/u;

/** @returns {(tree: any) => void} */
export default function dropcap() {
	return (tree) => {
		const p = (tree.children ?? []).find((/** @type {any} */ n) => n.type === 'element' && n.tagName === 'p');
		if (!p) return;
		const first = p.children?.[0];
		if (!first || first.type !== 'text') return;
		const m = first.value.match(LEAD);
		if (!m) return;
		const [whole, space, quote, letter] = m;
		const cap = {
			type: 'element',
			tagName: 'span',
			properties: { className: ['dropcap'] },
			children: [
				...(quote
					? [{ type: 'element', tagName: 'span', properties: { className: ['dropcap-q'] }, children: [{ type: 'text', value: quote }] }]
					: []),
				{ type: 'text', value: letter }
			]
		};
		const rest = { type: 'text', value: first.value.slice(whole.length) };
		p.children.splice(0, 1, ...(space ? [{ type: 'text', value: space }] : []), cap, rest);
	};
}
