import { error } from '@sveltejs/kit';
import { chapters, loadBody } from '#lib/chapters.js';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => chapters.map(({ slug }) => ({ chapter: slug }));

export const load: PageLoad = async ({ params }) => {
	const i = chapters.findIndex((c) => c.slug === params.chapter);
	if (i < 0) error(404, 'No such chapter');
	const Body = chapters[i].comingSoon ? undefined : await loadBody(chapters[i].folder);
	return {
		chapter: chapters[i],
		Body,
		prev: chapters[i - 1] ?? null,
		next: chapters[i + 1] ?? null
	};
};
