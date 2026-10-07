<!--
	Dumbbell: change between two columns for each row.
	<Dumbbell data={rows} label="country" from="2014" to="2022" />
-->
<script lang="ts">
	import { scaleBand, scaleLinear } from 'd3-scale';
	import Figure from './Figure.svelte';
	import AxisX from './AxisX.svelte';
	import Tooltip from './Tooltip.svelte';
	import { easeOut, getMotion, plateHeight, stagger } from './motion.svelte';
	import { type Fmt, type Row, formatter, smartNumber, textWidth, checkColumns } from './util';

	interface Props {
		data: Row[];
		label: string;
		from: string;
		to: string;
		xLabel?: string;
		domain?: [number, number];
		format?: Fmt;
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
		label,
		from,
		to,
		xLabel,
		domain,
		format,
		height,
		compact = false,
		title,
		subtitle,
		source,
		period,
		note
	}: Props = $props();

	const motion = getMotion();
	const fmt = $derived(formatter(format, smartNumber));
	const names = $derived(data.map((d) => String(d[label])));
	const n = $derived(names.length);
	$effect(() => checkColumns('Dumbbell', data, [label, from, to]));

	let w = $state(640);
	const plateH = plateHeight();
	const rowH = $derived(compact ? Math.max(9, (plateH - 20) / n) : 22);
	const top = $derived(compact ? 4 : 6);
	const bottom = $derived(compact ? 16 : xLabel ? 44 : 28);
	const left = $derived(
		compact
			? Math.max(...names.map((s) => textWidth(s, 9))) + 8
			: Math.max(...names.map((s) => textWidth(s))) + 12
	);
	const right = $derived(compact ? 6 : 18);
	const h = $derived(height ?? n * rowH + top + bottom);
	const innerW = $derived(Math.max(10, w - left - right));
	const innerH = $derived(h - top - bottom);

	const xScale = $derived.by(() => {
		const vals = data.flatMap((d) => [+d[from], +d[to]]);
		const s = scaleLinear()
			.domain(domain ?? [Math.min(0, ...vals), Math.max(...vals)])
			.range([0, innerW]);
		return domain ? s : s.nice();
	});
	const yScale = $derived(scaleBand().domain(names).range([0, innerH]).padding(0.2));

	const cursorIdx = $derived(
		motion.cursor === null ? null : Math.min(n - 1, Math.floor(motion.cursor * n))
	);
	let hover = $state<{ i: number; px: number; py: number } | null>(null);
	const focus = $derived(hover?.i ?? cursorIdx);

	function enter(e: PointerEvent, i: number) {
		const r = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect();
		hover = { i, px: e.clientX - r.left, py: e.clientY - r.top };
	}

	const legend = $derived([
		{ key: from, color: 'var(--ink)', mark: 'ring' as const },
		{ key: to, color: 'var(--accent)', mark: 'dot' as const }
	]);
</script>

<Figure {title} {subtitle} {source} {period} {note} {legend} toggleable={false} {compact}>
	<div bind:clientWidth={w}>
		<svg viewBox="0 0 {w} {h}" width="100%" role="img" aria-label={title ?? `${from} to ${to}`}>
			<g transform="translate({left},{top})">
				<AxisX
					scale={xScale}
					height={innerH}
					width={innerW}
					format={fmt}
					label={xLabel}
					grid
					{compact}
				/>
				{#each data as d, i (names[i])}
					{@const cy = yScale(names[i])! + yScale.bandwidth() / 2}
					{@const p = easeOut(stagger(motion.reveal, i, n, 0.6))}
					{@const a = xScale(+d[from])}
					{@const b = xScale(+d[to])}
					{@const bx = a + (b - a) * p}
					<g
						class="row"
						class:focus={focus === i}
						role="presentation"
						onpointermove={compact ? undefined : (e) => enter(e, i)}
						onpointerleave={compact ? undefined : () => (hover = null)}
					>
						<rect
							class="hit"
							x={-left}
							y={cy - yScale.step() / 2}
							width={w}
							height={yScale.step()}
						/>
						<text class="name" class:compact x="-8" y={cy} dy="0.32em" text-anchor="end"
							>{names[i]}</text
						>
						{#if p > 0}
							<line class="bar" class:compact x1={a} x2={bx} y1={cy} y2={cy} />
							<circle class="from" cx={a} {cy} r={compact ? 2.2 : 4} />
							<circle class="to" cx={bx} {cy} r={(compact ? 2.6 : 4.6) * Math.min(1, p * 1.4)} />
						{/if}
						{#if compact && focus === i}
							<text class="val" x={Math.max(a, b) + 5} y={cy} dy="0.32em"
								>+{fmt(+d[to] - +d[from])}</text
							>
						{/if}
					</g>
				{/each}
			</g>
		</svg>

		{#if hover !== null}
			{@const d = data[hover.i]}
			<Tooltip x={hover.px} y={hover.py} width={w}>
				<span class="tip-head">{names[hover.i]}</span>
				<span class="tip-row"><span>{from}</span><b>{fmt(d[from])}</b></span>
				<span class="tip-row"><span>{to}</span><b>{fmt(d[to])}</b></span>
				<span class="tip-row"
					><span>Change</span><b>{+d[to] >= +d[from] ? '+' : ''}{fmt(+d[to] - +d[from])}</b></span
				>
			</Tooltip>
		{/if}
	</div>
</Figure>

<style>
	svg {
		overflow: visible;
		height: auto;
	}
	.hit {
		fill: transparent;
	}
	.name {
		font-family: var(--font-type);
		font-size: 12px;
		fill: var(--ink);
	}
	.name.compact {
		font-size: 8.5px;
		fill: var(--ink-soft);
	}
	.focus .name {
		font-weight: 700;
	}
	.bar {
		stroke: var(--ink-faded);
		stroke-width: 2.4;
	}
	.bar.compact {
		stroke-width: 1.4;
	}
	.focus .bar {
		stroke: var(--ink);
	}
	.from {
		fill: var(--paper);
		stroke: var(--ink);
		stroke-width: 1.5;
	}
	.to {
		fill: var(--accent);
	}
	.val {
		font-family: var(--font-type);
		font-size: 9.5px;
		font-weight: 700;
		fill: var(--accent);
	}
</style>
