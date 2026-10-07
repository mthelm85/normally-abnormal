<!-- A small typed "clipping" that follows the pointer. Positioned in plot pixels. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { x, y, width, children }: { x: number; y: number; width: number; children: Snippet } =
		$props();

	// Flip to the left of the pointer in the right half of the plot.
	const flip = $derived(x > width * 0.55);
</script>

<div class="tip" class:flip style:left="{x}px" style:top="{y}px" role="status">
	{@render children()}
</div>

<style>
	.tip {
		position: absolute;
		z-index: 2;
		transform: translate(14px, -50%);
		min-width: 8rem;
		max-width: 17rem;
		padding: 0.35rem 0.55rem 0.4rem;
		background: var(--paper);
		border: 1px solid var(--ink);
		box-shadow: 3px 3px 0 rgb(38 34 28 / 0.18);
		font-family: var(--font-type);
		font-size: 0.8rem;
		line-height: 1.35;
		pointer-events: none;
		white-space: normal;
	}
	.tip.flip {
		transform: translate(calc(-100% - 14px), -50%);
	}
	.tip :global(.tip-head) {
		display: block;
		margin-bottom: 0.15rem;
		padding-bottom: 0.15rem;
		border-bottom: 1px solid var(--ink-ghost);
		font-weight: 700;
	}
	.tip :global(.tip-row) {
		display: flex;
		justify-content: space-between;
		gap: 0.8rem;
	}
	.tip :global(.tip-row b) {
		font-weight: 600;
	}
	.tip :global(.swatch) {
		display: inline-block;
		width: 0.6em;
		height: 0.6em;
		margin-right: 0.3em;
		vertical-align: 0.05em;
	}
</style>
