<script lang="ts">
	import { resolve } from '$app/paths';
	import { BOOK, PART, chapterWord, longDate, pageUrl } from '#lib/chapters.js';
	import Seo from '#lib/seo/Seo.svelte';
	import { NotesScope } from '#lib/notes/index.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const { chapter, Body, prev, next } = $derived(data);

	const url = $derived(pageUrl(chapter.slug));
	const image = $derived(pageUrl(`og/${chapter.slug}.png`));
	const label = $derived(`${PART} ${chapterWord(chapter.number)}`);
	const jsonld = $derived({
		'@context': 'https://schema.org',
		'@type': 'Article',
		headline: chapter.title,
		alternativeHeadline: `${BOOK.title}, ${label}`,
		description: chapter.summary,
		url,
		mainEntityOfPage: url,
		image,
		inLanguage: 'en',
		author: { '@type': 'Person', name: BOOK.author, url: BOOK.authorUrl },
		...(chapter.date && { datePublished: chapter.date, dateModified: chapter.updated ?? chapter.date }),
		isPartOf: { '@type': 'CreativeWorkSeries', name: BOOK.title, url: pageUrl() },
		position: chapter.number
	});
</script>

<Seo
	title="{chapter.title} · {BOOK.title}"
	description={chapter.summary || BOOK.subtitle}
	{url}
	{image}
	imageAlt="{BOOK.title}, {label}: {chapter.title}"
	type="article"
	published={chapter.date}
	modified={chapter.updated ?? chapter.date}
	noindex={chapter.comingSoon}
	jsonld={chapter.comingSoon ? undefined : jsonld}
/>

<main class="page">
	<header class="head">
		<p class="num typewriter">{PART} {chapterWord(chapter.number)}</p>
		<h1>{chapter.title}</h1>
		{#if chapter.date && !chapter.comingSoon}
			<p class="date typewriter">
				<time datetime={chapter.date}>{longDate(chapter.date)}</time>
				{#if chapter.updated && chapter.updated !== chapter.date}
					· updated <time datetime={chapter.updated}>{longDate(chapter.updated)}</time>
				{/if}
			</p>
		{/if}
		<hr class="rule-double" />
	</header>

	{#key chapter.slug}
		<NotesScope>
			<article class="prose">
				{#if chapter.comingSoon}
					<p class="soon">Coming soon.</p>
				{:else if Body}<Body />{/if}
			</article>
		</NotesScope>
	{/key}

	<nav class="more">
		{#if prev}
			<a href={resolve('/[chapter]', { chapter: prev.slug })} class="prev">
				<span class="label typewriter">← {PART} {chapterWord(prev.number)}</span>
				<span class="t">{prev.title}</span>
			</a>
		{:else}
			<a href={resolve('/')} class="prev">
				<span class="label typewriter">← Contents</span>
				<span class="t">{BOOK.title}</span>
			</a>
		{/if}
		{#if next}
			<a href={resolve('/[chapter]', { chapter: next.slug })} class="next">
				<span class="label typewriter">{PART} {chapterWord(next.number)} →</span>
				<span class="t">{next.title}</span>
			</a>
		{/if}
	</nav>
</main>

<style>
	.page {
		max-width: calc(var(--measure) + 2 * var(--gutter));
		margin: 0 auto;
		padding: 2rem var(--gutter) 0;
	}
	.head {
		text-align: center;
		margin-bottom: 1.8rem;
	}
	.num {
		margin-bottom: 0.4rem;
		font-size: 0.95rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-faded);
	}
	h1 {
		font-family: var(--font-head);
		font-weight: 900;
		font-size: clamp(2.1rem, 5.5vw, 3.4rem);
		line-height: 1.04;
		text-wrap: balance;
		margin-bottom: 0.8rem;
	}
	.more {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		margin-top: 2.5rem;
		padding-top: 1rem;
		border-top: 3px solid var(--rule);
	}
	.more a {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		text-decoration: none;
	}
	.next {
		grid-column: 2;
		text-align: right;
	}
	.label {
		font-size: 0.85rem;
		color: var(--ink-faded);
	}
	.t {
		font-family: var(--font-head);
		font-weight: 700;
		line-height: 1.15;
	}
	.more a:hover .t {
		color: var(--accent);
	}
	.soon {
		text-align: center;
		font-style: italic;
		font-size: 1.3rem;
		color: var(--ink-soft);
		margin: 3rem 0;
	}
	.date {
		margin: 0 0 0.9rem;
		font-size: 0.8rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-faded);
	}
</style>
