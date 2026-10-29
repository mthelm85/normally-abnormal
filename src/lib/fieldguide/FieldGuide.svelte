<!--
	A Field Guide card: practical reference material set apart from the prose,
	numbered by chapter ("Field Guide 1.1") and meant to be returned to.

	<FieldGuide id="bell-check" title="Should I Expect a Bell Curve?">
		<Check label="Many pieces">Is each value built from many contributions?</Check>
		<Section title="What to report instead">…</Section>
		<p>Closing note.</p>
	</FieldGuide>

	`number` and `anchor` are filled in at build time by src/lib/build/figures.js;
	refer to a card in the text with <Fig ref="bell-check" />.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		number,
		anchor,
		children
	}: { title: string; number?: string; anchor?: string; children: Snippet } = $props();
</script>

<aside class="field-guide" id={anchor} aria-label={number ? `Field Guide ${number}: ${title}` : title}>
	<header>
		<span class="kicker">Field Guide{number ? ` ${number}` : ''}</span>
		<h3>{title}</h3>
	</header>
	<div class="body">{@render children()}</div>
</aside>

<style>
	.field-guide {
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
	/* beats the centered .prose heading style */
	header h3 {
		margin: 0;
		text-align: left;
		font-family: var(--font-head);
		font-weight: 700;
		font-size: 1.25rem;
		line-height: 1.2;
		text-wrap: balance;
	}
	.body {
		font-size: 1.05rem;
		line-height: 1.45;
		counter-reset: fg-step; /* numbered <Step>s start at 1 in each card */
	}
	.body :global(p) {
		margin: 0.7rem 0 0;
		text-indent: 0;
	}
	.body > :global(:first-child) {
		margin-top: 0;
	}
	@media print {
		.field-guide {
			background: none;
		}
	}
</style>
