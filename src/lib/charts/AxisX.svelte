<!-- Bottom axis: solid baseline, short ticks; thins band labels so they never collide. -->
<script lang="ts">
	import { textWidth, wrap } from './util';

	let {
		scale,
		height,
		width,
		ticks,
		format = (v: any) => String(v),
		label,
		grid = false,
		baseline = true,
		compact = false
	}: {
		scale: any;
		height: number;
		width: number;
		ticks?: number | any[];
		format?: (v: any) => string;
		label?: string;
		grid?: boolean;
		baseline?: boolean;
		compact?: boolean;
	} = $props();

	const values = $derived.by(() => {
		if (Array.isArray(ticks)) return ticks;
		if (!scale.ticks) {
			// Band labels wrap to two lines first; only thin them out if that still collides.
			const all: any[] = scale.domain();
			const widest =
				Math.max(...all.map((v) => Math.max(...lines(v).map((l) => textWidth(l, size))))) + 8;
			const step = Math.max(1, Math.ceil((all.length * widest) / Math.max(width, 1)));
			return all.filter((_, i) => i % step === 0);
		}
		const count = ticks ?? Math.max(2, Math.min(8, Math.floor(width / (compact ? 70 : 85))));
		return scale.ticks(count);
	});
	const offset = $derived(scale.bandwidth ? scale.bandwidth() / 2 : 0);
	const size = $derived(compact ? 10 : 12);
	const lines = (v: any): string[] => {
		const s = format(v);
		if (scale.ticks) return [s];
		const room = Math.max(4, Math.floor(scale.step() / (size * 0.5)) - 1);
		return textWidth(s, size) + 8 > scale.step() ? wrap(s, room, 2) : [s];
	};
</script>

<g class="axis" class:compact transform="translate(0,{height})">
	{#if baseline}<line class="base" x1="0" x2={width} />{/if}
	{#each values as v (String(v))}
		{@const x = scale(v) + offset}
		<g transform="translate({x},0)">
			{#if grid}<line class="grid" y1={-height} y2="0" />{/if}
			<line class="tick" y2={compact ? 3 : 5} />
			<text y={compact ? 13 : 18} text-anchor="middle">
				{#each lines(v) as line, j (j)}
					<tspan x="0" dy={j === 0 ? 0 : size + 1}>{line}</tspan>
				{/each}
			</text>
		</g>
	{/each}
	{#if label && !compact}
		<text class="label" x={width} y="36" text-anchor="end">{label}</text>
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
	.base {
		stroke: var(--ink);
		stroke-width: 1.2;
	}
	.tick {
		stroke: var(--ink);
		stroke-width: 0.8;
	}
	.grid {
		stroke: var(--ink-ghost);
		stroke-width: 0.8;
		stroke-dasharray: 1 3;
	}
	.label {
		font-family: var(--font-body);
		font-size: 13px;
		fill: var(--ink-soft);
	}
</style>
