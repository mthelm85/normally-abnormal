// Svelte preprocessor: keeps unfinished essays out of the published site.
//
// An essay whose frontmatter has `status: coming-soon` is published as its
// frontmatter alone (title, number, summary): none of its prose, charts or data
// ship in a production build (`npm run build`). `npm run dev` still shows the
// whole draft, so writing carries on as usual. Remove the line to publish it.
//
// Runs first, before figure numbering, math and mdsvex.

/** @returns {import('svelte/compiler').PreprocessorGroup} */
export default function drafts() {
	const production = process.env.NODE_ENV === 'production';
	return {
		name: 'drafts',
		markup({ content, filename }) {
			if (!production || !filename?.endsWith('.svx')) return;
			const fm = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
			if (!fm || !/^status:\s*["']?coming-soon["']?\s*$/m.test(fm[0])) return;
			return { code: fm[0] };
		}
	};
}
