// Chapter registry. Each chapter is a folder: src/chapters/<nn>-<slug>/
//   index.svx   frontmatter (number, title, summary) + prose + chart tags
//   data/       CSVs written by julia/chNN.jl, imported by the chapter
//   charts/     (optional) one-off components for this chapter
import type { Component } from 'svelte';

// The site is published as a series of essays ("Part One", "Part Two", …).
// Folders, routes and code still say "chapter"; readers see PART.
export const PART = 'Part';

export const BOOK = {
	title: 'Normally Abnormal',
	subtitle: 'Why Real-World Data So Rarely Follow a Bell Curve',
	author: 'Matt Helm'
};

export interface Chapter {
	/** folder name, e.g. "01-average-millionaire" */
	folder: string;
	/** URL slug, e.g. "average-millionaire" */
	slug: string;
	number: number;
	title: string;
	summary: string;
	/** `status: coming-soon` in the frontmatter: a placeholder in production builds (see build/drafts.js) */
	comingSoon: boolean;
}

const metadata = import.meta.glob<Record<string, any>>('/src/chapters/*/index.svx', {
	eager: true,
	import: 'metadata'
});
const bodies = import.meta.glob<{ default: Component }>('/src/chapters/*/index.svx');

const folderOf = (path: string) => path.split('/').at(-2)!;

export const chapters: Chapter[] = Object.entries(metadata)
	.map(([path, m]) => {
		const folder = folderOf(path);
		return {
			folder,
			slug: folder.replace(/^\d+-/, ''),
			number: m.number ?? Number.parseInt(folder, 10),
			title: m.title ?? folder,
			summary: m.summary ?? '',
			comingSoon: import.meta.env.PROD && m.status === 'coming-soon'
		};
	})
	.sort((a, b) => a.number - b.number);

export const loadBody = async (folder: string) =>
	(await bodies[`/src/chapters/${folder}/index.svx`]?.())?.default;

const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
export const chapterWord = (n: number) => WORDS[n] ?? String(n);
