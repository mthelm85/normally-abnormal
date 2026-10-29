<!--
	One numbered step in a Field Guide card that's a procedure rather than a
	checklist: a number, a short bold label, and what to do. Steps number
	themselves within their card (1, 2, 3…).

	<Step label="Compare centers">Divide one median by the other…</Step>
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { label, children }: { label?: string; children: Snippet } = $props();
</script>

<div class="step">
	<span class="num" aria-hidden="true"></span>
	<span class="text">
		{#if label}<strong>{label}</strong>{/if}
		{@render children()}
	</span>
</div>

<style>
	.step {
		counter-increment: fg-step;
		display: grid;
		grid-template-columns: 1.5rem 1fr;
		align-items: start;
		gap: 0 0.55rem;
		padding: 0.45rem 0;
		border-bottom: 1px dotted var(--rule);
	}
	/* The number, set in the same ink-ringed square as a checklist's box. */
	.num {
		grid-column: 1;
		width: 1.15rem;
		height: 1.15rem;
		margin-top: 0.17rem;
		border: 1.5px solid var(--ink);
		border-radius: 50%;
		display: grid;
		place-items: center;
		font-family: var(--font-type);
		font-size: 0.72rem;
		line-height: 1;
		color: var(--ink);
	}
	.num::before {
		content: counter(fg-step);
	}
	.text {
		grid-column: 2;
	}
	strong {
		display: block;
		font-family: var(--font-head);
		font-weight: 700;
		font-size: 1.02rem;
		line-height: 1.25;
	}
</style>
