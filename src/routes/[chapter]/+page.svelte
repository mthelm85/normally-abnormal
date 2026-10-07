<script lang="ts">
	import { BOOK, chapterWord } from '#lib/chapters.js';
	import { NotesScope } from '#lib/notes/index.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const { chapter, Body, prev, next } = $derived(data);
</script>

<svelte:head>
	<title>{chapter.title} · {BOOK.title}</title>
	{#if chapter.summary}<meta name="description" content={chapter.summary} />{/if}
</svelte:head>

<main class="page">
	<header class="head">
		<p class="num typewriter">Chapter {chapterWord(chapter.number)}</p>
		<h1>{chapter.title}</h1>
		<hr class="rule-double" />
	</header>

	{#key chapter.slug}
		<NotesScope>
			<article class="prose">
				{#if Body}<Body />{/if}
			</article>
		</NotesScope>
	{/key}

	<nav class="more">
		{#if prev}
			<a href="/{prev.slug}" class="prev">
				<span class="label typewriter">☜ Chapter {chapterWord(prev.number)}</span>
				<span class="t">{prev.title}</span>
			</a>
		{:else}
			<a href="/" class="prev">
				<span class="label typewriter">☜ Contents</span>
				<span class="t">{BOOK.title}</span>
			</a>
		{/if}
		{#if next}
			<a href="/{next.slug}" class="next">
				<span class="label typewriter">Chapter {chapterWord(next.number)} ☞</span>
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
</style>
