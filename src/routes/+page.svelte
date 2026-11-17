<!--
	Landing page for the essay series: a masthead with the series' promise, then
	each essay as a card with its signature chart in miniature (src/lib/thumbs.ts).
	The old opening-cover version is kept in src/lib/legacy/BookCoverLanding.svelte.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { BOOK, PART, chapters, chapterWord } from '#lib/chapters.js';
	import { THUMBS } from '#lib/thumbs.js';

	// Placeholder copy: rewrite freely.
	const INTRO =
		'People compute averages all the time, but most of the things we average are not normally distributed. ' +
		'This series explores the implications of non-normal distributions in everyday data, and how to better analyze them.';

	// A thumbnail path: x and y rescaled into a w × h box.
	function shape(points: [number, number][], w: number, h: number, area: boolean) {
		const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
		const x0 = Math.min(...xs), x1 = Math.max(...xs);
		const y1 = Math.max(...ys) || 1;
		const pts = points.map(([x, y]) => `${(((x - x0) / (x1 - x0 || 1)) * w).toFixed(1)},${(h - (y / y1) * (h - 3)).toFixed(1)}`);
		return { line: `M${pts.join('L')}`, area: area ? `M0,${h}L${pts.join('L')}L${w},${h}Z` : '' };
	}

	// The series emblem: a small right-skewed curve (also the fallback thumbnail).
	const EW = 120, EH = 54;
	const emblem = Array.from({ length: 61 }, (_, i) => {
		const t = 0.02 + (i / 60) * 3.2;
		return [i, Math.exp(-((Math.log(t) + 0.15) ** 2) / (2 * 0.55 ** 2)) / t] as [number, number];
	});
	const mark = shape(emblem, EW, EH, true);

	const TW = 132, TH = 72;
	const cards = $derived(
		chapters.map((ch) => {
			const t = THUMBS[ch.number];
			return { ch, label: t?.label ?? 'Series emblem', ...(t ? shape(t.points, TW, TH, t.area) : shape(emblem, TW, TH, true)) };
		})
	);
</script>

<svelte:head>
	<title>{BOOK.title}</title>
	<meta name="description" content={BOOK.subtitle} />
</svelte:head>

<main class="page">
	<header class="masthead">
		<svg class="emblem" viewBox="0 0 {EW} {EH}" width={EW} height={EH} aria-hidden="true">
			<path d={mark.area} style:fill="url(#dd-hatch-1)" />
			<path d={mark.line} class="curve" />
			<line x1="0" y1={EH} x2={EW} y2={EH} class="base" />
		</svg>
		<p class="kicker typewriter">An essay series</p>
		<h1>{BOOK.title}</h1>
		<p class="subtitle">{BOOK.subtitle}</p>
		<p class="author smallcaps">{BOOK.author}</p>
		<hr class="rule-double" />
		<p class="intro">{INTRO}</p>
	</header>

	<section aria-label="The essays">
		<ol class="essays">
			{#each cards as c (c.ch.folder)}
				<li>
					<svelte:element
						this={c.ch.comingSoon ? 'div' : 'a'}
						href={c.ch.comingSoon ? undefined : resolve('/[chapter]', { chapter: c.ch.slug })}
						class="card"
						class:soon={c.ch.comingSoon}
					>
						<svg class="thumb" viewBox="0 0 {TW} {TH}" role="img" aria-label={c.label}>
							{#if c.area}<path d={c.area} style:fill="url(#dd-hatch-0)" class="fill" />{/if}
							<path d={c.line} class="curve" />
							<line x1="0" y1={TH} x2={TW} y2={TH} class="base" />
						</svg>
						<span class="text">
							<span class="num typewriter">{PART} {chapterWord(c.ch.number)}{#if c.ch.comingSoon} · Coming soon{/if}</span>
							<span class="t">{c.ch.title}</span>
							{#if c.ch.summary}<span class="summary">{c.ch.summary}</span>{/if}
						</span>
					</svelte:element>
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

	/* ---------- masthead ---------- */
	.masthead {
		text-align: center;
		margin-bottom: 2.8rem;
	}
	.emblem {
		display: block;
		margin: 0 auto 1.1rem;
		width: 96px;
		height: auto;
	}
	.kicker {
		margin: 0 0 0.5rem;
		font-size: 0.8rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--accent);
	}
	h1 {
		font-family: var(--font-head);
		font-weight: 900;
		font-size: clamp(2.4rem, 7vw, 3.6rem);
		line-height: 1;
		margin: 0 0 0.6rem;
		text-wrap: balance;
	}
	.subtitle {
		font-style: italic;
		font-size: clamp(1.1rem, 2.6vw, 1.3rem);
		line-height: 1.3;
		color: var(--ink-soft);
		margin: 0 auto 0.9rem;
		max-width: 30ch;
		text-wrap: balance;
	}
	.author {
		margin: 0 0 1.2rem;
		font-size: 1.05rem;
		letter-spacing: 0.08em;
	}
	.masthead :global(.rule-double) {
		width: 7rem;
		margin: 0 auto 1.4rem;
	}
	.intro {
		max-width: 46ch;
		margin: 0 auto;
		font-size: 1.12rem;
		line-height: 1.5;
		text-wrap: pretty;
	}

	/* ---------- the essays ---------- */
	.essays {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 3px solid var(--rule);
	}
	.essays li {
		border-bottom: 1px solid var(--rule);
	}
	.card {
		display: grid;
		grid-template-columns: 8.5rem 1fr;
		align-items: center;
		gap: 0 1.3rem;
		padding: 1.25rem 0.2rem;
		text-decoration: none;
		color: inherit;
	}
	.thumb {
		width: 100%;
		height: auto;
		overflow: visible;
	}
	.thumb .fill {
		fill-opacity: 0.7;
	}
	.curve {
		fill: none;
		stroke: var(--ink);
		stroke-width: 1.8;
		stroke-linejoin: round;
	}
	.base {
		stroke: var(--ink);
		stroke-width: 1;
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}
	.num {
		font-size: 0.78rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--accent);
	}
	.t {
		font-family: var(--font-head);
		font-weight: 700;
		font-size: 1.45rem;
		line-height: 1.15;
		text-wrap: balance;
		transition: color 0.2s;
	}
	.summary {
		font-style: italic;
		color: var(--ink-soft);
		font-size: 1.04rem;
		line-height: 1.35;
	}
	.card.soon {
		opacity: 0.55;
	}
	.card:not(.soon):hover .t,
	.card:focus-visible .t {
		color: var(--accent);
	}
	.card:not(.soon):hover .curve {
		stroke: var(--accent);
	}

	/* phones: thumbnail above the text */
	@media (max-width: 520px) {
		.card {
			grid-template-columns: 1fr;
			gap: 0.7rem;
		}
		.thumb {
			max-width: 11rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.t {
			transition: none;
		}
	}
</style>
