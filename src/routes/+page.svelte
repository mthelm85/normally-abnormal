<script lang="ts">
	import { BOOK, chapters, chapterWord } from '#lib/chapters.js';
</script>

<svelte:head>
	<title>{BOOK.title}</title>
	<meta name="description" content={BOOK.subtitle} />
</svelte:head>

<main class="page">
	<header class="title-page">
		<h1>{BOOK.title}</h1>
		<p class="subtitle">{BOOK.subtitle}</p>
		<hr class="rule-double" />
		<p class="author smallcaps">{BOOK.author}</p>
	</header>

	<section class="contents" aria-labelledby="contents">
		<h2 id="contents" class="smallcaps">Contents</h2>
		<ol>
			{#each chapters as ch (ch.folder)}
				<li>
					<a href="/{ch.slug}">
						<span class="num typewriter">Chapter {chapterWord(ch.number)}</span>
						<span class="t">{ch.title}</span>
						{#if ch.summary}<span class="summary">{ch.summary}</span>{/if}
					</a>
				</li>
			{/each}
		</ol>
	</section>
</main>

<style>
	.page {
		max-width: calc(var(--measure) + 2 * var(--gutter));
		margin: 0 auto;
		padding: 3rem var(--gutter) 0;
	}
	.title-page {
		text-align: center;
		margin-bottom: 3rem;
	}
	h1 {
		font-family: var(--font-head);
		font-weight: 900;
		font-size: clamp(2.6rem, 8vw, 4.6rem);
		line-height: 1;
		text-wrap: balance;
		margin-bottom: 0.5rem;
	}
	.subtitle {
		font-style: italic;
		font-size: 1.3rem;
		color: var(--ink-soft);
		text-wrap: balance;
		margin-bottom: 1.4rem;
	}
	.author {
		margin-top: 1rem;
		font-size: 1.15rem;
	}
	.contents h2 {
		text-align: center;
		font-family: var(--font-head);
		font-size: 1.3rem;
		margin-bottom: 1.2rem;
	}
	ol {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	li {
		border-top: 1px solid var(--rule);
	}
	li:last-child {
		border-bottom: 1px solid var(--rule);
	}
	li a {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.9rem 0;
		text-decoration: none;
	}
	.num {
		font-size: 0.85rem;
		color: var(--ink-faded);
	}
	.t {
		font-family: var(--font-head);
		font-weight: 700;
		font-size: 1.35rem;
		line-height: 1.15;
	}
	.summary {
		font-style: italic;
		color: var(--ink-soft);
		font-size: 1.05rem;
	}
	li a:hover .t {
		color: var(--accent);
	}
</style>
