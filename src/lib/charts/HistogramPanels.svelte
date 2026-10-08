<!--
	Small multiples of histograms: one panel per group, all on the same x axis,
	each with its own height. Bars sit at the x values given (one bar per row),
	with an optional smooth curve drawn over chosen panels.

	Long data: one row per bar, with the panel it belongs to, its x value and its
	height (a share of the total, say). Curve data uses the same columns.
	<HistogramPanels data={buckets} panel="size" x="share" y="freq"
		curve={normal} panelTitle={(n) => `Buckets of ${n} kicks`}
		reference={0.75} referenceLabel="p" />
-->
<script lang="ts">
	import { scaleLinear } from 'd3-scale';
	import { line as d3line, curveMonotoneX } from 'd3-shape';
	import Figure from './Figure.svelte';
	import AxisX from './AxisX.svelte';
	import Tooltip from './Tooltip.svelte';
	import { type Fmt, type Row, checkColumns, formatter, smartNumber } from './util';

	interface Props {
		data: Row[];
		panel: string;
		x: string;
		y: string;
		/** a smooth curve drawn over the bars, same columns as data */
		curve?: Row[];
		curveLabel?: string;
		/** panel order; defaults to the order panels first appear in data */
		panels?: any[];
		panelTitle?: (value: any) => string;
		/** shared x axis */
		xDomain?: [number, number];
		xTicks?: number[];
		xFormat?: Fmt;
		yFormat?: Fmt;
		xLabel?: string;
		/** a vertical reference line drawn in every panel */
		reference?: number;
		referenceLabel?: string;
		/** label for bar heights in the tooltip */
		yName?: string;
		/** panels per row; by default 2, or 1 on narrow screens */
		columns?: number;
		/**
		 * label each bar with its value in panels with at most this many bars,
		 * so the figure reads in print without hovering (0 turns labels off)
		 */
		labelBars?: number;
		panelHeight?: number;
		title?: string;
		subtitle?: string;
		source?: string;
		period?: string;
		note?: string;
	}

	let {
		data,
		panel,
		x,
		y,
		curve = [],
		curveLabel = 'Normal curve',
		panels,
		panelTitle = (v) => String(v),
		xDomain,
		xTicks,
		xFormat,
		yFormat,
		xLabel,
		reference,
		referenceLabel = '',
		yName = 'Share',
		columns,
		labelBars = 13,
		panelHeight = 150,
		title,
		subtitle,
		source,
		period,
		note
	}: Props = $props();

	$effect(() => checkColumns('HistogramPanels', data, [panel, x, y]));

	const fx = $derived(formatter(xFormat, smartNumber));
	const fy = $derived(formatter(yFormat, smartNumber));

	const order = $derived(panels ?? [...new Set(data.map((d) => d[panel]))]);
	const groups = $derived(
		order.map((key) => {
			const rows = data.filter((d) => d[panel] === key).sort((a, b) => a[x] - b[x]);
			const line = curve.filter((d) => d[panel] === key).sort((a, b) => a[x] - b[x]);
			let max = 0;
			for (const d of rows) max = Math.max(max, d[y]);
			for (const d of line) max = Math.max(max, d[y]);
			// bar width: the smallest gap between neighbouring x values
			let gap = Infinity;
			for (let i = 1; i < rows.length; i++) gap = Math.min(gap, rows[i][x] - rows[i - 1][x]);
			return { key, rows, line, max: max || 1, gap: Number.isFinite(gap) ? gap : null };
		})
	);

	let w = $state(640);
	const cols = $derived(columns ?? (w < 520 ? 1 : 2));
	const gutter = 28;
	const side = 10;
	const cellW = $derived((w - (cols - 1) * gutter) / cols);
	const innerW = $derived(Math.max(10, cellW - 2 * side));
	const head = 26;
	const foot = 30;
	const cellH = $derived(head + panelHeight + foot);
	const rowsN = $derived(Math.ceil(groups.length / cols));
	const totalH = $derived(rowsN * cellH + (rowsN - 1) * 18);

	const domain = $derived.by((): [number, number] => {
		if (xDomain) return xDomain;
		let lo = Infinity;
		let hi = -Infinity;
		for (const d of data) {
			lo = Math.min(lo, d[x]);
			hi = Math.max(hi, d[x]);
		}
		return [lo, hi];
	});
	// Bars are at most a fourteenth of the panel wide, and the axis is inset by
	// half that, so bars at either end of the domain stay inside the panel.
	const maxBar = $derived(innerW / 14);
	const xScale = $derived(
		scaleLinear()
			.domain(domain)
			.range([maxBar / 2, innerW - maxBar / 2])
	);

	const barW = (gap: number | null) => {
		const px = gap === null ? maxBar : xScale(domain[0] + gap) - xScale(domain[0]);
		return Math.max(1, Math.min(px * 0.8, maxBar));
	};

	let hover = $state<{ g: number; i: number; px: number; py: number } | null>(null);

	const hasCurve = $derived(curve.length > 0);
	const legend = $derived(
		hasCurve
			? [
					{ key: 'bars', label: yName, color: 'color-mix(in srgb, var(--ink) 30%, transparent)', mark: 'block' as const },
					{ key: 'curve', label: curveLabel, color: 'var(--accent)', mark: 'line' as const }
				]
			: []
	);
</script>

<Figure {title} {subtitle} {source} {period} {note} {legend} toggleable={false}>
	<div bind:clientWidth={w}>
		<svg viewBox="0 0 {w} {totalH}" width="100%" role="img" aria-label={title ?? 'Histograms'}>
			{#each groups as g, gi (g.key)}
				{@const cx = (gi % cols) * (cellW + gutter) + side}
				{@const cy = Math.floor(gi / cols) * (cellH + 18)}
				{@const yScale = scaleLinear().domain([0, g.max * (labelBars > 0 && g.rows.length <= labelBars ? 1.2 : 1.08)]).range([panelHeight, 0])}
				{@const bw = barW(g.gap)}
				<g transform="translate({cx},{cy})">
					<text class="panel-title" x="0" y="16">{panelTitle(g.key)}</text>
					<g transform="translate(0,{head})">
						{#if reference !== undefined}
							<line class="ref" x1={xScale(reference)} x2={xScale(reference)} y1="-4" y2={panelHeight} />
							{#if referenceLabel}
								<text class="ref-label" x={xScale(reference) + 4} y="6">{referenceLabel}</text>
							{/if}
						{/if}
						{#each g.rows as d, i (i)}
							{#if d[y] > 0}
								<rect
									class="bar"
									class:on={hover?.g === gi && hover?.i === i}
									x={xScale(d[x]) - bw / 2}
									y={yScale(d[y])}
									width={bw}
									height={panelHeight - yScale(d[y])}
									role="presentation"
									onpointerenter={() =>
										(hover = { g: gi, i, px: cx + xScale(d[x]), py: cy + head + yScale(d[y]) })}
									onpointerleave={() => (hover = null)}
								/>
							{/if}
						{/each}
						{#if labelBars > 0 && g.rows.length <= labelBars}
							{@const spacing = g.gap === null ? innerW : xScale(domain[0] + g.gap) - xScale(domain[0])}
							{@const fmt = spacing >= 40 ? fy : formatter('.0%', smartNumber)}
							{@const tiny = spacing >= 40 ? 0.0005 : 0.005}
							{#each g.rows as d, i (i)}
								{#if d[y] > 0 && spacing >= 18}
									<text class="bar-label" x={xScale(d[x])} y={yScale(d[y]) - 4} text-anchor="middle"
										>{d[y] < tiny ? (spacing >= 40 ? '<0.1%' : '<1%') : fmt(d[y])}</text
									>
								{/if}
							{/each}
						{/if}
						{#if g.line.length}
							<path
								class="curve"
								d={d3line<Row>()
									.x((d) => xScale(d[x]))
									.y((d) => yScale(d[y]))
									.curve(curveMonotoneX)(g.line) ?? ''}
							/>
						{/if}
						<AxisX scale={xScale} height={panelHeight} width={innerW} ticks={xTicks} format={fx} />
					</g>
				</g>
			{/each}
		</svg>
		{#if xLabel}<p class="x-label">{xLabel}</p>{/if}

		{#if hover}
			{@const d = groups[hover.g].rows[hover.i]}
			<Tooltip x={hover.px} y={hover.py} width={w}>
				<span class="tip-head">{panelTitle(groups[hover.g].key)}</span>
				<span class="tip-row"><span>{fx(d[x])}</span><b>{fy(d[y])}</b></span>
			</Tooltip>
		{/if}
	</div>
</Figure>

<style>
	svg {
		overflow: visible;
		height: auto;
	}
	.panel-title {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 14px;
		fill: var(--ink);
	}
	.bar {
		fill: color-mix(in srgb, var(--ink) 30%, transparent);
		stroke: var(--ink);
		stroke-width: 0.6;
		transition: fill 0.15s;
	}
	.bar.on {
		fill: var(--ink);
	}
	.bar-label {
		font-family: var(--font-type);
		font-size: 10.5px;
		fill: var(--ink-soft);
		paint-order: stroke;
		stroke: var(--paper);
		stroke-width: 3px;
	}
	.curve {
		fill: none;
		stroke: var(--accent);
		stroke-width: 1.8;
	}
	.ref {
		stroke: var(--accent);
		stroke-width: 1.1;
		stroke-dasharray: 4 3;
	}
	.ref-label {
		font-family: var(--font-type);
		font-size: 11px;
		font-weight: 600;
		fill: var(--accent);
	}
	.x-label {
		margin: 0.2rem 0 0;
		text-align: right;
		text-indent: 0;
		font-family: var(--font-type);
		font-size: 13px;
		color: var(--ink-soft);
	}
</style>
