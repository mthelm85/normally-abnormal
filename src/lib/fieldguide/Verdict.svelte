<!--
	One filled-in checklist line: the box marked with the result, the label,
	the result in words, and a short reason.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		result,
		children
	}: { label: string; result: 'pass' | 'partly' | 'fail'; children?: Snippet } = $props();

	const words = { pass: 'Passes', partly: 'Partly', fail: 'Fails' } as const;
</script>

<div class="verdict {result}">
	<svg class="box" viewBox="0 0 16 16" width="17" height="17" aria-hidden="true">
		<rect x="0.75" y="0.75" width="14.5" height="14.5" />
		{#if result === 'pass'}
			<path d="M3.5 8.5 L6.8 11.6 L12.8 4" />
		{:else if result === 'fail'}
			<path d="M4 4 L12 12 M12 4 L4 12" />
		{:else}
			<path d="M4 8 L12 8" />
		{/if}
	</svg>
	<div class="text">
		<span class="head"><strong>{label}</strong><span class="result">{words[result]}</span></span>
		{#if children}{@render children()}{/if}
	</div>
</div>

<style>
	.verdict {
		display: grid;
		grid-template-columns: 1.5rem 1fr;
		gap: 0 0.55rem;
		padding: 0.45rem 0;
		border-bottom: 1px dotted var(--rule);
	}
	.box {
		margin-top: 0.2rem;
	}
	rect {
		fill: var(--paper);
		stroke: var(--ink);
		stroke-width: 1.5;
	}
	path {
		fill: none;
		stroke-width: 2.2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.pass path {
		stroke: var(--ink);
	}
	.fail path {
		stroke: var(--accent);
	}
	.partly path {
		stroke: var(--ochre, #a97c2c);
		stroke-width: 2.6;
	}
	.head {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}
	strong {
		font-family: var(--font-head);
		font-weight: 700;
		font-size: 1.02rem;
		line-height: 1.25;
	}
	.result {
		font-family: var(--font-type);
		font-size: 0.75rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.pass .result {
		color: var(--ink-soft);
	}
	.fail .result {
		color: var(--accent);
	}
	.partly .result {
		color: var(--ochre, #a97c2c);
	}
	.text {
		grid-column: 2;
	}
</style>
