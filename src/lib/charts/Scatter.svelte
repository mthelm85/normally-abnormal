<!--
	Scatter plot with optional point labels and a least-squares trend line.
	<Scatter data={rows} x="nonCitizen" y="unemployed" label="sector" trend labelled={['Construction']} />
-->
<script lang="ts">
	import { scaleLinear } from 'd3-scale';
	import Figure from './Figure.svelte';
	import AxisX from './AxisX.svelte';
	import AxisY from './AxisY.svelte';
	import Tooltip from './Tooltip.svelte';
	import { easeBack, getMotion, plateHeight, stagger } from './motion.svelte';
	import { type Fmt, type Row, formatter, smartNumber, textWidth, checkColumns } from './util';

	interface Props {
		data: Row[];
		x: string;
		y: string;
		/** column naming each point */
		label?: string;
		/** points to label permanently ('all' labels every point) */
		labelled?: string[] | 'all';
		trend?: boolean;
		zero?: boolean;
		xLabel?: string;
		yLabel?: string;
		xFormat?: Fmt;
		yFormat?: Fmt;
		height?: number;
		compact?: boolean;
		title?: string;
		subtitle?: string;
		source?: string;
		period?: string;
		note?: string;
	}

	let {
		data,
		x,
		y,
		label,
		labelled = [],
		trend = false,
		zero = false,
		xLabel,
		yLabel,
		xFormat,
		yFormat,
		height,
		compact = false,
		title,
		subtitle,
		source,
		period,
		note
	}: Props = $props();

	const motion = getMotion();
	const fx = $derived(formatter(xFormat, smartNumber));
	const fy = $derived(formatter(yFormat, smartNumber));
	const n = $derived(data.length);
	$effect(() => checkColumns('Scatter', data, [x, y, label]));

	let w = $state(640);
	const plateH = plateHeight();
	const h = $derived(height ?? (compact ? plateH : 360));
	const top = $derived(compact ? 14 : yLabel ? 28 : 12);
	const bottom = $derived(compact ? 18 : xLabel ? 44 : 28);
	const innerH = $derived(h - top - bottom);

	const yScale = $derived(
		scaleLinear()
			.domain([zero ? 0 : Math.min(...data.map((d) => +d[y])), Math.max(...data.map((d) => +d[y]))])
			.range([innerH, 0])
			.nice()
	);
	const yTicks = $derived(yScale.ticks(compact ? 3 : 5));
	const left = $derived(compact ? 2 : Math.max(...yTicks.map((t) => textWidth(fy(t)))) + 12);
	const right = $derived(compact ? 6 : 16);
	const innerW = $derived(Math.max(10, w - left - right));
	const xScale = $derived(
		scaleLinear()
			.domain([Math.min(...data.map((d) => +d[x])), Math.max(...data.map((d) => +d[x]))])
			.range([0, innerW])
			.nice()
	);

	// Points appear left to right.
	const order = $derived(
		data
			.map((d, i) => ({ d, i }))
			.sort((a, b) => +a.d[x] - +b.d[x])
			.map((p, rank) => ({ ...p, rank }))
	);

	const fit = $derived.by(() => {
		const xs = data.map((d) => +d[x]);
		const ys = data.map((d) => +d[y]);
		const mx = xs.reduce((a, b) => a + b, 0) / n;
		const my = ys.reduce((a, b) => a + b, 0) / n;
		let num = 0;
		let den = 0;
		xs.forEach((v, i) => {
			num += (v - mx) * (ys[i] - my);
			den += (v - mx) ** 2;
		});
		const slope = den ? num / den : 0;
		const [x0, x1] = xScale.domain();
		return { x0, x1, y0: my + slope * (x0 - mx), y1: my + slope * (x1 - mx) };
	});

	const cursorRank = $derived(
		motion.cursor === null ? null : Math.min(n - 1, Math.floor(motion.cursor * n))
	);
	let hover = $state<number | null>(null);
	const focusIdx = $derived(hover ?? (cursorRank === null ? null : order[cursorRank].i));
	const isLabelled = (d: Row) =>
		labelled === 'all' || (label ? labelled.includes(String(d[label])) : false);
</script>

<Figure {title} {subtitle} {source} {period} {note} {compact}>
	<div bind:clientWidth={w}>
		<svg viewBox="0 0 {w} {h}" width="100%" role="img" aria-label={title ?? `${x} against ${y}`}>
			<g transform="translate({left},{top})">
				<AxisY scale={yScale} width={innerW} ticks={yTicks} format={fy} label={yLabel} {compact} />
				<AxisX scale={xScale} height={innerH} width={innerW} format={fx} label={xLabel} {compact} />

				{#if trend}
					{@const t = Math.min(1, motion.reveal * 1.2)}
					<line
						class="trend"
						x1={xScale(fit.x0)}
						y1={yScale(fit.y0)}
						x2={xScale(fit.x0 + (fit.x1 - fit.x0) * t)}
						y2={yScale(fit.y0 + (fit.y1 - fit.y0) * t)}
					/>
				{/if}

				{#each order as { d, i, rank } (i)}
					{@const p = easeBack(stagger(motion.reveal, rank, n, 0.65))}
					{@const cx = xScale(+d[x])}
					{@const cy = yScale(+d[y])}
					{@const focused = focusIdx === i}
					<circle
						class="pt"
						class:focused
						{cx}
						{cy}
						r={Math.max(0, (compact ? 3 : 5) * p * (focused ? 1.35 : 1))}
						role="presentation"
						onpointerenter={compact ? undefined : () => (hover = i)}
						onpointerleave={compact ? undefined : () => (hover = null)}
					/>
					{#if label && (focused || (isLabelled(d) && motion.reveal >= 1))}
						{@const anchorEnd = cx > innerW * 0.6}
						<text
							class="lbl"
							class:compact
							x={cx + (anchorEnd ? -8 : 8)}
							y={cy - 6}
							text-anchor={anchorEnd ? 'end' : 'start'}>{d[label]}</text
						>
					{/if}
				{/each}
			</g>
		</svg>

		{#if hover !== null}
			{@const d = data[hover]}
			<Tooltip x={left + xScale(+d[x])} y={top + yScale(+d[y])} width={w}>
				{#if label}<span class="tip-head">{d[label]}</span>{/if}
				<span class="tip-row"><span>{xLabel ?? x}</span><b>{fx(d[x])}</b></span>
				<span class="tip-row"><span>{yLabel ?? y}</span><b>{fy(d[y])}</b></span>
			</Tooltip>
		{/if}
	</div>
</Figure>

<style>
	svg {
		overflow: visible;
		height: auto;
	}
	.pt {
		fill: color-mix(in srgb, var(--ink) 78%, transparent);
		stroke: var(--paper);
		stroke-width: 1.2;
		cursor: default;
		transition: fill 0.15s;
	}
	.pt.focused {
		fill: var(--accent);
	}
	.trend {
		stroke: var(--accent);
		stroke-width: 1.3;
		stroke-dasharray: 5 4;
	}
	.lbl {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 13.5px;
		fill: var(--ink);
		paint-order: stroke;
		stroke: var(--paper);
		stroke-width: 4px;
		pointer-events: none;
	}
	.lbl.compact {
		font-size: 10.5px;
		stroke: var(--paper);
	}
</style>
