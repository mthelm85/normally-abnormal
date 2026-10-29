<!--
	A Field Guide checklist filled in for one dataset: the same card, with each
	box marked passes / partly / fails and a short reason. It is numbered as a
	figure ("Figure 2.2") by src/lib/build/figures.js, so the text can refer to it
	with <Fig ref="..." />.

	<AppliedGuide id="wage-checklist" title="Field Guide 1.1, Applied to Wages">
		<Section title="How each value is built">
			<Verdict label="Additive" result="fail">Raises are percentages.</Verdict>
		</Section>
		<p>Verdict: …</p>
	</AppliedGuide>
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getFigureNumber } from '../charts/figure-number';

	let { title, children }: { title: string; children: Snippet } = $props();
	const fig = getFigureNumber();
</script>

<figure class="applied" id={fig?.id} aria-label={fig ? `Figure ${fig.n}: ${title}` : title}>
	<header>
		{#if fig}<span class="kicker">Figure {fig.n}</span>{/if}
		<span class="title">{title}</span>
	</header>
	<div class="body">{@render children()}</div>
</figure>

<style>
	.applied {
		margin: 2.2rem 0 2.4rem;
		padding: 1.1rem 1.3rem 1rem;
		background: color-mix(in srgb, var(--paper) 55%, white);
		border: 1px solid var(--ink);
		box-shadow:
			inset 0 0 0 3px color-mix(in srgb, var(--paper) 55%, white),
			inset 0 0 0 4px var(--rule);
		scroll-margin-top: 1.5rem;
		text-align: left;
		hyphens: manual;
		break-inside: avoid;
	}
	header {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding-bottom: 0.55rem;
		margin-bottom: 0.7rem;
		border-bottom: 1px solid var(--rule);
	}
	.kicker {
		font-family: var(--font-type);
		font-size: 0.8rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--accent);
	}
	.title {
		font-family: var(--font-head);
		font-weight: 700;
		font-size: 1.25rem;
		line-height: 1.2;
		text-wrap: balance;
	}
	.body {
		font-size: 1.05rem;
		line-height: 1.45;
	}
	.body :global(p) {
		margin: 0.7rem 0 0;
		text-indent: 0;
	}
	.body > :global(:first-child) {
		margin-top: 0;
	}
	@media print {
		.applied {
			background: none;
		}
	}
</style>
