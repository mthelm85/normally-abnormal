<!--
	DrawStrips: a few distributions, one panel each on a shared x axis, with a
	strip of random draws under each curve, so a reader can see how much single
	values bounce around.

	<DrawStrips curves={rows} x="x" series={[{ key: 'narrow', label: 'SD 5' }, …]}
		draws={drawRows} drawSeries="series" drawValue="value" />

	`curves` is wide (one column per distribution); `draws` is long (one row per
	draw, naming its distribution).
-->
<script lang="ts">
	import { scaleLinear } from 'd3-scale';
	import { area as d3area, curveMonotoneX, line as d3line } from 'd3-shape';
	import Figure from './Figure.svelte';
	import AxisX from './AxisX.svelte';
	import { type Fmt, type Row, checkColumns, formatter, hatch, smartNumber } from './util';

	interface Props {
		curves: Row[];
		x: string;
		series: { key: string; label: string }[];
		draws: Row[];
		drawSeries: string;
		drawValue: string;
		/** a vertical marker at this x in every panel (the shared mean, say) */
		reference?: number;
		referenceLabel?: string;
		xDomain?: [number, number];
		xTicks?: number[];
		xFormat?: Fmt;
		xLabel?: string;
		panelHeight?: number;
		title?: string;
		subtitle?: string;
		source?: string;
		period?: string;
		note?: string;
	}

	let {
		curves,
		x,
		series,
		draws,
		drawSeries,
		drawValue,
		reference,
		referenceLabel = '',
		xDomain,
		xTicks,
		xFormat,
		xLabel,
		panelHeight = 120,
		title,
		subtitle,
		source,
		period,
		note
	}: Props = $props();

	$effect(() => checkColumns('DrawStrips', curves, [x, ...series.map((s) => s.key)]));
	$effect(() => checkColumns('DrawStrips', draws, [drawSeries, drawValue]));

	const fx = $derived(formatter(xFormat, smartNumber));
	let w = $state(640);
	const side = 16;
	const innerW = $derived(Math.max(10, w - 2 * side));
	const head = 24; // panel label
	const strip = 26; // the row of draws
	const axisH = 30;
	const gap = 16;
	const cellH = $derived(head + panelHeight + strip + axisH);
	const totalH = $derived(series.length * cellH + (series.length - 1) * gap);

	const domain = $derived.by((): [number, number] => {
		if (xDomain) return xDomain;
		const xs = curves.map((d) => d[x] as number);
		return [Math.min(...xs), Math.max(...xs)];
	});
	const xScale = $derived(scaleLinear().domain(domain).range([0, innerW]));
	// One vertical scale for every panel, so the taller curve really is taller.
	const yMax = $derived(Math.max(...series.flatMap((s) => curves.map((d) => d[s.key] as number))) || 1);
	const yScale = $derived(
		scaleLinear()
			.domain([0, yMax * 1.05])
			.range([panelHeight, 0])
	);

	const paths = $derived(
		series.map((s) => ({
			...s,
			line:
				d3line<Row>()
					.x((d) => xScale(d[x]))
					.y((d) => yScale(d[s.key]))
					.curve(curveMonotoneX)(curves) ?? '',
			area:
				d3area<Row>()
					.x((d) => xScale(d[x]))
					.y0(panelHeight)
					.y1((d) => yScale(d[s.key]))
					.curve(curveMonotoneX)(curves) ?? '',
			points: draws
				.filter((d) => d[drawSeries] === s.key)
				.map((d) => d[drawValue] as number)
				.filter((v) => v >= domain[0] && v <= domain[1])
		}))
	);
</script>

<Figure {title} {subtitle} {source} {period} {note}>
	<div bind:clientWidth={w}>
		<svg viewBox="0 0 {w} {totalH}" width="100%" role="img" aria-label={title ?? 'Distributions with random draws'}>
			{#each paths as p, i (p.key)}
				<g transform="translate({side},{i * (cellH + gap)})">
					<text class="panel-title" x="0" y="15">{p.label}</text>
					<g transform="translate(0,{head})">
						<path d={p.area} class="area" style:fill={hatch(0)} style:fill-opacity={0.55} />
						<path d={p.line} class="line" />
						{#if reference !== undefined}
							{@const rx = xScale(reference)}
							<line class="ref" x1={rx} x2={rx} y1="0" y2={panelHeight} />
							{#if referenceLabel && i === paths.length - 1}
								<text class="ref-label" x={rx + 5} y="10">{referenceLabel}</text>
							{/if}
						{/if}
						<!-- the draws: one dot each, in a strip under the curve -->
						<g class="draws" transform="translate(0,{panelHeight + strip / 2})">
							{#each p.points as v, j (j)}
								<circle cx={xScale(v)} cy="0" r="3.4" />
							{/each}
						</g>
						<AxisX scale={xScale} height={panelHeight + strip} width={innerW} ticks={xTicks} format={fx}
							label={i === paths.length - 1 ? xLabel : undefined} />
					</g>
				</g>
			{/each}
		</svg>
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
		font-size: 15px;
		fill: var(--ink);
	}
	.area {
		stroke: none;
	}
	.line {
		fill: none;
		stroke: var(--ink);
		stroke-width: 2.2;
	}
	.ref {
		stroke: var(--accent);
		stroke-width: 1.1;
		stroke-dasharray: 3 3;
	}
	.ref-label {
		font-family: var(--font-type);
		font-size: 11px;
		fill: var(--accent);
	}
	.draws circle {
		fill: var(--accent);
		fill-opacity: 0.55;
		stroke: var(--accent);
		stroke-width: 0.8;
	}
</style>
