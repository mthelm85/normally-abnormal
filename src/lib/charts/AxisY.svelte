<!-- Value axis on the left: dotted rules across the plot, typewriter figures. -->
<script lang="ts">
	let {
		scale,
		width,
		ticks = 5,
		format = (v: any) => String(v),
		label,
		grid = true,
		compact = false
	}: {
		scale: any;
		width: number;
		ticks?: number | any[];
		format?: (v: any) => string;
		label?: string;
		grid?: boolean;
		compact?: boolean;
	} = $props();

	const values = $derived(Array.isArray(ticks) ? ticks : scale.ticks(ticks));
	const offset = $derived(scale.bandwidth ? scale.bandwidth() / 2 : 0);
</script>

<g class="axis" class:compact>
	{#each values as v (String(v))}
		{@const y = scale(v) + offset}
		<g transform="translate(0,{y})">
			{#if grid}<line class="grid" x1="0" x2={width} />{/if}
			<text
				x={compact ? 0 : -6}
				dy={compact ? -3 : '0.32em'}
				text-anchor={compact ? 'start' : 'end'}>{format(v)}</text
			>
		</g>
	{/each}
	{#if label && !compact}
		<text class="label" x="0" y={-14}>{label}</text>
	{/if}
</g>

<style>
	.axis text {
		font-family: var(--font-type);
		font-size: 12px;
		fill: var(--ink-soft);
	}
	.compact text {
		font-size: 10px;
		fill: var(--ink-faded);
	}
	.grid {
		stroke: var(--ink-ghost);
		stroke-width: 0.8;
		stroke-dasharray: 1 3;
	}
	.label {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 13px;
		fill: var(--ink-soft);
	}
</style>
