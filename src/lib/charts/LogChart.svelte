<!--
	LogChart: points and lines on log (or linear) axes. Made for rank–size plots,
	where a power law is a straight line, but any axis can be linear.

	<LogChart data={rows} x="population"
		series={[
			{ y: 'rank', label: 'Cities and towns', mark: 'points' },
			{ y: 'lognormal', label: 'Lognormal fit', mark: 'line' },
			{ y: 'pareto', label: 'Power law', mark: 'dashed' }
		]}
		xLabel="Population" yLabel="Rank" />

	Wide data: one row per point. Each series draws one y column against `x`, or
	against its own x column (`series[i].x`) when the series don't share sizes.
	Empty cells are skipped, so a line can cover only part of the range.
-->
<script lang="ts">
	import { scaleLinear, scaleLog } from 'd3-scale';
	import { line as d3line } from 'd3-shape';
	import Figure from './Figure.svelte';
	import AxisX from './AxisX.svelte';
	import AxisY from './AxisY.svelte';
	import Tooltip from './Tooltip.svelte';
	import { type Fmt, type Row, checkColumns, formatter, seriesColor, smartNumber } from './util';

	interface Series {
		/** column for this series' values on the vertical axis */
		y: string;
		/** column for its horizontal positions; defaults to the chart's `x` */
		x?: string;
		label: string;
		mark?: 'points' | 'line' | 'dashed';
		/** series colour index (0 = ink, 1 = oxblood, …); defaults to its position */
		color?: number;
	}

	interface Props {
		data: Row[];
		x: string;
		series: Series[];
		xLog?: boolean;
		yLog?: boolean;
		xDomain?: [number, number];
		yDomain?: [number, number];
		xTicks?: number[];
		yTicks?: number[];
		xFormat?: Fmt;
		yFormat?: Fmt;
		xLabel?: string;
		yLabel?: string;
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
		series,
		xLog = true,
		yLog = true,
		xDomain,
		yDomain,
		xTicks,
		yTicks,
		xFormat,
		yFormat,
		xLabel,
		yLabel,
		height = 360,
		compact = false,
		title,
		subtitle,
		source,
		period,
		note
	}: Props = $props();

	$effect(() => checkColumns('LogChart', data, [x, ...series.flatMap((s) => [s.y, s.x])]));

	const fx = $derived(formatter(xFormat, smartNumber));
	const fy = $derived(formatter(yFormat, smartNumber));
	const ok = (v: unknown, log: boolean): v is number =>
		typeof v === 'number' && Number.isFinite(v) && (!log || v > 0);

	let hidden = $state(new Set<string>());
	const colorOf = (s: Series) => seriesColor(s.color ?? series.indexOf(s));

	// Each series as plain [x, y] points, empty cells dropped, in x order.
	const pts = $derived(
		series.map((s) =>
			data
				.map((d) => [d[s.x ?? x], d[s.y]] as [unknown, unknown])
				.filter((p): p is [number, number] => ok(p[0], xLog) && ok(p[1], yLog))
				.sort((a, b) => a[0] - b[0])
		)
	);

	function span(values: number[], log: boolean): [number, number] {
		const lo = Math.min(...values), hi = Math.max(...values);
		return log ? [lo / 1.4, hi * 1.4] : [Math.min(0, lo), hi * 1.05];
	}
	const xd = $derived(xDomain ?? span(pts.flat().map((p) => p[0]), xLog));
	const yd = $derived(yDomain ?? span(pts.flat().map((p) => p[1]), yLog));
	// Points outside a set domain are left out (not pinned to the edge).
	const inside = (p: [number, number]) => p[0] >= xd[0] && p[0] <= xd[1] && p[1] >= yd[0] && p[1] <= yd[1];
	const drawn = $derived(pts.map((p) => p.filter(inside)));

	// Powers of ten inside the domain (log axes); d3's own ticks otherwise.
	const decades = ([a, b]: [number, number]) => {
		const out: number[] = [];
		for (let e = Math.ceil(Math.log10(a)); e <= Math.floor(Math.log10(b)); e++) out.push(10 ** e);
		return out;
	};

	let w = $state(640);
	const left = $derived(compact ? 6 : 58);
	const right = 14;
	const top = $derived(yLabel && !compact ? 28 : 10);
	const bottom = $derived(xLabel && !compact ? 44 : 28);
	const innerW = $derived(Math.max(10, w - left - right));
	const innerH = $derived(height - top - bottom);

	const xScale = $derived(
		(xLog ? scaleLog() : scaleLinear()).domain(xd).range([0, innerW])
	);
	const yScale = $derived(
		(yLog ? scaleLog() : scaleLinear()).domain(yd).range([innerH, 0])
	);
	const xt = $derived(xTicks ?? (xLog ? decades(xd) : undefined));
	const yt = $derived(yTicks ?? (yLog ? decades(yd) : 5));

	const pathOf = (p: [number, number][]) =>
		d3line<[number, number]>()
			.x((d) => xScale(d[0]))
			.y((d) => yScale(d[1]))(p) ?? '';

	const legend = $derived(
		series.map((s) => ({
			key: s.label,
			label: s.label,
			color: colorOf(s),
			mark: ((s.mark ?? 'points') === 'points' ? 'dot' : 'line') as 'dot' | 'line'
		}))
	);

	// ——— hover: the nearest drawn point of any visible series ———
	let hover = $state<{ s: number; p: [number, number] } | null>(null);
	function onmove(e: PointerEvent) {
		const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
		const k = innerW / rect.width;
		const mx = (e.clientX - rect.left) * k, my = (e.clientY - rect.top) * k;
		let best: typeof hover = null, bd = Infinity;
		drawn.forEach((p, i) => {
			if (hidden.has(series[i].label)) return;
			for (const q of p) {
				const d = (xScale(q[0]) - mx) ** 2 + (yScale(q[1]) - my) ** 2;
				if (d < bd) (bd = d), (best = { s: i, p: q });
			}
		});
		hover = bd < 30 ** 2 ? best : null;
	}
</script>

<Figure {title} {subtitle} {source} {period} {note} {legend} {compact} bind:hidden>
	<div class="holder" bind:clientWidth={w}>
		<svg viewBox="0 0 {w} {height}" width="100%" role="img" aria-label={title ?? series.map((s) => s.label).join(', ')}>
			<g transform="translate({left},{top})">
				{#if !compact}
					<AxisY scale={yScale} width={innerW} ticks={yt} format={fy} label={yLabel} />
				{/if}
				<AxisX scale={xScale} height={innerH} width={innerW} ticks={xt} format={fx} label={xLabel} {compact} />

				{#each series as s, i (s.label)}
					{#if !hidden.has(s.label)}
						{#if (s.mark ?? 'points') === 'points'}
							<g class="points" style:fill={colorOf(s)}>
								{#each drawn[i] as p, j (j)}
									<circle cx={xScale(p[0])} cy={yScale(p[1])} r="2.6" />
								{/each}
							</g>
						{:else}
							<path d={pathOf(drawn[i])} class="line" class:dashed={s.mark === 'dashed'} style:stroke={colorOf(s)} />
						{/if}
					{/if}
				{/each}

				{#if hover}
					<circle class="dot" cx={xScale(hover.p[0])} cy={yScale(hover.p[1])} r="5" style:stroke={colorOf(series[hover.s])} />
				{/if}

				{#if !compact}
					<rect class="hit" width={innerW} height={innerH} role="presentation" onpointermove={onmove} onpointerleave={() => (hover = null)} />
				{/if}
			</g>
		</svg>

		{#if hover}
			<Tooltip x={left + xScale(hover.p[0])} y={top + yScale(hover.p[1])} width={w}>
				<span class="tip-head">{series[hover.s].label}</span>
				<span class="tip-row"><span>{xLabel ?? x}</span><b>{fx(hover.p[0])}</b></span>
				<span class="tip-row"><span>{yLabel ?? series[hover.s].y}</span><b>{fy(hover.p[1])}</b></span>
			</Tooltip>
		{/if}
	</div>
</Figure>

<style>
	.holder {
		position: relative;
	}
	svg {
		overflow: visible;
		height: auto;
	}
	.points circle {
		fill-opacity: 0.6;
	}
	.line {
		fill: none;
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.line.dashed {
		stroke-width: 1.6;
		stroke-dasharray: 5 4;
	}
	.dot {
		fill: var(--paper);
		stroke-width: 2;
	}
	.hit {
		fill: transparent;
	}
</style>
