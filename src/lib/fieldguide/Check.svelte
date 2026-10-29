<!--
	One checklist line in a Field Guide card: a box to tick, a short bold label,
	and the question. On screen the box can be ticked (nothing is saved); in print
	it is an empty square for a pen.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { label, children }: { label?: string; children: Snippet } = $props();
</script>

<label class="check">
	<input type="checkbox" />
	<span class="box" aria-hidden="true"></span>
	<span class="text">
		{#if label}<strong>{label}</strong>{/if}
		{@render children()}
	</span>
</label>

<style>
	.check {
		display: grid;
		grid-template-columns: 1.5rem 1fr;
		align-items: start;
		gap: 0 0.55rem;
		padding: 0.45rem 0;
		border-bottom: 1px dotted var(--rule);
		cursor: pointer;
	}
	input {
		position: absolute;
		opacity: 0;
		width: 1px;
		height: 1px;
	}
	.box {
		grid-row: 1;
		grid-column: 1;
		width: 1.05rem;
		height: 1.05rem;
		margin-top: 0.22rem;
		border: 1.5px solid var(--ink);
		background: var(--paper);
		position: relative;
	}
	input:checked + .box::after {
		content: '';
		position: absolute;
		left: 0.27rem;
		top: -0.18rem;
		width: 0.38rem;
		height: 0.85rem;
		border: solid var(--accent);
		border-width: 0 2.5px 2.5px 0;
		transform: rotate(40deg);
	}
	input:focus-visible + .box {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
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
	@media print {
		input:checked + .box::after {
			display: none;
		}
	}
</style>
