<script lang="ts">
	import { onMount } from 'svelte';
	import { BOOK, chapters, chapterWord } from '#lib/chapters.js';

	const KEY = 'na-book-open';
	let open = $state(false);

	onMount(() => {
		try {
			if (sessionStorage.getItem(KEY)) open = true;
		} catch {
			/* storage unavailable: start closed */
		}
	});

	function toggle() {
		open = !open;
		delete document.documentElement.dataset.bookOpen;
		try {
			if (open) sessionStorage.setItem(KEY, '1');
			else sessionStorage.removeItem(KEY);
		} catch {
			/* ignore */
		}
	}

	// A small right-skewed curve for the cover emblem (lognormal-ish shape)
	const W = 120;
	const H = 54;
	const pts = Array.from({ length: 61 }, (_, i) => {
		const x = (i / 60) * W;
		const t = 0.02 + (i / 60) * 3.2;
		const y = Math.exp(-((Math.log(t) + 0.15) ** 2) / (2 * 0.55 ** 2)) / t;
		return [x, y] as const;
	});
	const yMax = Math.max(...pts.map((p) => p[1]));
	const curve = pts.map(([x, y]) => `${x.toFixed(1)},${(H - (y / yMax) * (H - 4)).toFixed(1)}`);
	const linePath = `M${curve.join('L')}`;
	const areaPath = `M0,${H}L${curve.join('L')}L${W},${H}Z`;

	// Restores the open state before first paint, so a returning reader doesn't see the cover swing again
	const restore = `<script>try{if(sessionStorage.getItem('${KEY}'))document.documentElement.dataset.bookOpen=''}catch(e){}<\/script>`;
</script>

<svelte:head>
	<title>{BOOK.title}</title>
	<meta name="description" content={BOOK.subtitle} />
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html restore}
	<noscript><style>.book .cover{display:none}</style></noscript>
</svelte:head>

<main class="page">
	<div class="stage" class:open>
		<div class="book">
			<!-- The title page (right-hand page once open) -->
			<header class="leaf title-page">
				<div class="leaf-inner">
					<span class="ornament" aria-hidden="true">❦&#xFE0E;</span>
					<h1>{BOOK.title}</h1>
					<p class="subtitle">{BOOK.subtitle}</p>
					<hr class="rule-double" />
					<p class="author smallcaps">{BOOK.author}</p>
				</div>
			</header>

			<!-- The cover: front is the cloth binding, back is the endpaper -->
			<button
				class="cover"
				type="button"
				onclick={toggle}
				aria-label={open ? 'Close the book' : 'Open the book'}
				aria-expanded={open}
			>
				<span class="face front" aria-hidden="true">
					<span class="frame">
						<span class="c-title">{BOOK.title}</span>
						<svg class="emblem" viewBox="0 0 {W} {H}" width={W} height={H}>
							<defs>
								<pattern id="gilt-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
									<line x1="0" y1="0" x2="0" y2="4" stroke="currentColor" stroke-width="1" opacity="0.55" />
								</pattern>
							</defs>
							<path d={areaPath} fill="url(#gilt-hatch)" />
							<path d={linePath} fill="none" stroke="currentColor" stroke-width="1.6" />
							<line x1="0" y1={H} x2={W} y2={H} stroke="currentColor" stroke-width="1" />
						</svg>
						<span class="c-sub">{BOOK.subtitle}</span>
						<span class="c-author">{BOOK.author}</span>
					</span>
				</span>
				<span class="face back" aria-hidden="true"></span>
			</button>
		</div>
		<p class="hint typewriter" aria-hidden="true">Open the cover</p>
	</div>

	<section class="contents" aria-labelledby="contents">
		<h2 id="contents" class="smallcaps">Contents</h2>
		<ol>
			{#each chapters as ch (ch.folder)}
				<li>
					<a href="/{ch.slug}">
						{#if ch.summary}
							<span class="t">{ch.title}</span>
							<span class="line">
								<span class="summary">{ch.summary}</span>
								<span class="leader" aria-hidden="true"></span>
								<span class="num">Chapter {chapterWord(ch.number)}</span>
							</span>
						{:else}
							<span class="line">
								<span class="t">{ch.title}</span>
								<span class="leader" aria-hidden="true"></span>
								<span class="num">Chapter {chapterWord(ch.number)}</span>
							</span>
						{/if}
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
		padding: 2.5rem var(--gutter) 0;
	}

	/* ---------- the book ---------- */
	.stage {
		--bw: min(310px, 40vw);
		--bh: calc(var(--bw) * 1.5);
		--cloth: #5e2a25;
		--cloth-dark: #45201c;
		--gilt: #d2ad62;
		--speed: 1.15s;
		--ease: cubic-bezier(0.6, 0.05, 0.25, 1);
		perspective: 1800px;
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-bottom: 3.5rem;
	}
	.book {
		position: relative;
		width: var(--bw);
		height: var(--bh);
		transform-style: preserve-3d;
		transition: transform var(--speed) var(--ease);
	}
	.open .book,
	:global(html[data-book-open]) .book {
		transform: translateX(calc(var(--bw) / 2));
	}

	/* the right-hand page */
	.leaf {
		position: absolute;
		inset: 0;
		background: #fbf8f0;
		border-radius: 1px 3px 3px 1px;
		box-shadow:
			1px 1px 0 #e6dfcd,
			2px 2px 0 #fbf8f0,
			3px 3px 0 #e6dfcd,
			4px 4px 0 #fbf8f0,
			5px 5px 0 #ddd4bf,
			8px 14px 28px rgb(38 34 28 / 0.22);
		background-image: linear-gradient(to right, rgb(38 34 28 / 0.12), rgb(38 34 28 / 0.04) 6%, rgb(38 34 28 / 0.01) 14%, transparent 22%);
	}
	.leaf-inner {
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 0 calc(var(--bw) * 0.1);
	}
	.ornament {
		color: var(--accent);
		font-size: calc(var(--bw) * 0.07);
		margin-bottom: calc(var(--bw) * 0.06);
	}
	h1 {
		font-family: var(--font-head);
		font-weight: 900;
		font-size: calc(var(--bw) * 0.135);
		line-height: 1.02;
		text-wrap: balance;
		margin: 0 0 calc(var(--bw) * 0.05);
	}
	.subtitle {
		font-style: italic;
		font-size: calc(var(--bw) * 0.056);
		line-height: 1.3;
		color: var(--ink-soft);
		text-wrap: balance;
		margin: 0 0 calc(var(--bw) * 0.05);
	}
	.leaf :global(.rule-double) {
		width: 40%;
		margin: 0 auto;
	}
	.author {
		margin: calc(var(--bw) * 0.05) 0 0;
		font-size: calc(var(--bw) * 0.055);
	}

	/* the cover */
	.cover {
		all: unset;
		position: absolute;
		inset: 0;
		cursor: pointer;
		transform-origin: left center;
		transform-style: preserve-3d;
		transition:
			transform var(--speed) var(--ease),
			opacity var(--speed) var(--ease);
		z-index: 2;
	}
	.cover:focus-visible .front {
		outline: 2px solid var(--gilt);
		outline-offset: 4px;
	}
	.open .cover,
	:global(html[data-book-open]) .cover {
		transform: rotateY(-180deg);
	}
	.face {
		position: absolute;
		inset: 0;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
		border-radius: 2px 5px 5px 2px;
	}
	.front {
		display: flex;
		padding: calc(var(--bw) * 0.06);
		color: var(--gilt);
		background:
			linear-gradient(to right, rgb(0 0 0 / 0.35), rgb(255 255 255 / 0.06) 4%, rgb(0 0 0 / 0.12) 7%, transparent 11%),
			repeating-linear-gradient(0deg, rgb(255 255 255 / 0.025) 0 1px, transparent 1px 3px),
			repeating-linear-gradient(90deg, rgb(0 0 0 / 0.04) 0 1px, transparent 1px 3px),
			radial-gradient(ellipse at 60% 35%, var(--cloth), var(--cloth-dark));
		box-shadow:
			inset 0 0 0 1px rgb(0 0 0 / 0.3),
			8px 14px 28px rgb(38 34 28 / 0.35);
	}
	.frame {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		text-align: center;
		padding: calc(var(--bw) * 0.1) calc(var(--bw) * 0.06) calc(var(--bw) * 0.07);
		margin-left: calc(var(--bw) * 0.04);
		border: 1px solid currentColor;
		outline: 1px solid currentColor;
		outline-offset: -5px;
	}
	.c-title {
		font-family: var(--font-head);
		font-weight: 700;
		font-size: calc(var(--bw) * 0.12);
		line-height: 1.05;
		letter-spacing: 0.01em;
		text-wrap: balance;
		text-shadow: 0 1px 0 rgb(0 0 0 / 0.35);
	}
	.emblem {
		width: 42%;
		height: auto;
	}
	.c-sub {
		font-family: var(--font-body);
		font-style: italic;
		font-size: calc(var(--bw) * 0.05);
		line-height: 1.3;
		text-wrap: balance;
		opacity: 0.9;
	}
	.c-author {
		font-family: var(--font-body);
		font-variant-caps: all-small-caps;
		letter-spacing: 0.12em;
		font-size: calc(var(--bw) * 0.065);
	}

	/* endpaper: tiny lopsided curves on cream */
	.back {
		transform: rotateY(180deg);
		background-color: #efe6d2;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='30'%3E%3Cpath d='M4 22 C8 22 9 8 13 8 C18 8 22 21 34 22' fill='none' stroke='%238e3b33' stroke-opacity='.28' stroke-width='1.2'/%3E%3Cpath d='M26 7 h12' stroke='%23a97c2c' stroke-opacity='.22'/%3E%3C/svg%3E"),
			linear-gradient(to left, rgb(38 34 28 / 0.16), rgb(38 34 28 / 0.04) 7%, transparent 18%);
		background-size: 44px 30px, 100% 100%;
		background-position: center, 0 0;
		box-shadow:
			inset 0 0 0 calc(var(--bw) * 0.02) #e3d8bf,
			-8px 14px 28px rgb(38 34 28 / 0.18);
	}

	.hint {
		margin: 1.2rem 0 0;
		font-size: 0.8rem;
		color: var(--ink-faded);
		transition: opacity 0.4s;
	}
	.open .hint,
	:global(html[data-book-open]) .hint {
		opacity: 0;
	}

	/* phones: no room for a spread, so the cover swings away to reveal the title page */
	@media (max-width: 640px) {
		.stage {
			--bw: min(300px, 76vw);
		}
		.open .book,
		:global(html[data-book-open]) .book {
			transform: none;
		}
		.open .cover,
		:global(html[data-book-open]) .cover {
			transform: rotateY(-115deg);
			opacity: 0;
			pointer-events: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.book,
		.cover {
			transition: none;
		}
	}

	/* ---------- contents ---------- */
	.contents h2 {
		text-align: center;
		font-family: var(--font-head);
		font-size: 1.3rem;
		margin-bottom: 1.2rem;
	}
	/* A printed table of contents: the title, then the summary with a dotted leader
	   running to the chapter number, where a page number would sit. */
	ol {
		list-style: none;
		padding: 0.4rem 0 0;
		margin: 0;
		border-top: 1px solid var(--rule);
	}
	li a {
		display: block;
		padding: 0.75rem 0;
		text-decoration: none;
	}
	.line {
		display: flex;
		align-items: last baseline;
		gap: 0.5rem;
	}
	.t {
		display: block;
		font-family: var(--font-head);
		font-weight: 700;
		font-size: 1.3rem;
		line-height: 1.2;
		text-wrap: balance;
		transition: color 0.2s;
	}
	.leader {
		flex: 1;
		min-width: 1.5rem;
		/* sits on the text baseline, level with the periods */
		border-bottom: 2px dotted var(--ink-faded);
		margin-bottom: 0.32em;
	}
	.num {
		flex: none;
		font-variant-caps: all-small-caps;
		letter-spacing: 0.06em;
		font-size: 1.15rem;
		color: var(--ink-soft);
	}
	.summary {
		margin-top: 0.15rem;
		font-style: italic;
		color: var(--ink-soft);
		font-size: 1.02rem;
		line-height: 1.35;
	}
	li a:hover .t,
	li a:focus-visible .t {
		color: var(--accent);
	}
</style>
