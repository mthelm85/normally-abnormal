<!--
	Density: a distribution's shape as hatched area under one ink curve, with
	markers for the mean, median or mode, shaded ranges, labeled spans, and notes
	on the curve.

	Wide data on an evenly spaced grid: one row per x, one column per curve.
	<Density data={rows} x="x" y="lognormal"
		markers={[{ x: 'median' }, { x: 'mean' }]}
		notes={[{ x: 9, text: 'a few large values pull the mean right' }]} />

	Statistics given as 'mean' | 'median' | 'mode' are computed from the curve on
	its grid. For heavy-tailed curves (Pareto, Cauchy) or cropped data the grid
	cuts the tail off, so pass the true value as a number from Julia instead, and
	pass `below` so the hover readout uses the true share below the pointer.
-->
<script lang="ts" module>
	export type Stat = 'mean' | 'median' | 'mode';

	export interface Marker {
		/** a position on the x axis, or a statistic computed from the curve */
		x: number | Stat;
		/** label above the plot; defaults to the statistic's name */
		label?: string;
		/** the curve this marker belongs to; defaults to the first */
		series?: string;
		/** print the value after the label (default true) */
		value?: boolean;
		/** a solid stem instead of the default dashed one */
		solid?: boolean;
		/** which side of the stem the label runs to (default: centered on it) */
		align?: 'left' | 'right' | 'center';
		/** label row, 0 nearest the plot; omitted = placed automatically to avoid overlaps */
		row?: number;
	}

	export interface Shade {
		/** start of the range; defaults to the left edge */
		from?: number;
		/** end of the range; defaults to the right edge */
		to?: number;
		/** the curve to shade under; defaults to the first */
		series?: string;
		/** short italic label, set just above the curve */
		label?: string;
		/** x position for the label; defaults to the middle of the range */
		labelAt?: number;
		/** nudge the label up (negative) or down, in px */
		dy?: number;
		/** add the dense hatch over the tint (default true); false gives a plain tint for nested ranges */
		hatch?: boolean;
	}

	export interface Span {
		/** start and end of the range on the x axis */
		from: number;
		to: number;
		/** label set above the bracket, e.g. "68% of buckets" */
		label?: string;
	}

	export interface DensityNote {
		/** x position on the curve the note points at */
		x: number;
		text: string;
		series?: string;
		/** text offset from the point, in px */
		dx?: number;
		dy?: number;
	}
</script>

<script lang="ts">
	import { scaleLinear, scaleLog } from 'd3-scale';
	import { area as d3area, curveMonotoneX, line as d3line } from 'd3-shape';
	import { bisector, extent } from 'd3-array';
	import Figure from './Figure.svelte';
	import AxisX from './AxisX.svelte';
	import AxisY from './AxisY.svelte';
	import Tooltip from './Tooltip.svelte';
	import { getMotion, plateHeight } from './motion.svelte';
	import {
		type Fmt,
		type Row,
		asArray,
		checkColumns,
		formatter,
		hatch,
		lerp,
		seriesColor,
		smartNumber,
		textWidth
	} from './util';

	interface Props {
		data: Row[];
		/** the grid column */
		x: string;
		/** one density column, or several curves to compare */
		y: string | string[];
		labels?: Record<string, string>;
		colors?: string[];
		/** columns drawn as dashed lines (a reference curve, say) */
		dashed?: string[];
		/** hatch the area under the first curve (default true) */
		area?: boolean;
		markers?: Marker[];
		shade?: Shade[];
		/** labeled brackets near the baseline (first is lowest), e.g. ±1 and ±2 SD */
		spans?: Span[];
		notes?: DensityNote[];
		/** show density values on a left axis (default false: readers rarely need them) */
		yAxis?: boolean;
		/** crop the x axis */
		xDomain?: [number | null, number | null];
		/**
		 * 'log' spaces the x axis by ratios (each tick a multiple of the last). Pass a
		 * density per unit of log(x) as `y` so areas still read as shares.
		 */
		xType?: 'linear' | 'log';
		/** explicit x tick values (handy on a log axis) */
		xTicks?: number[];
		xLabel?: string;
		xFormat?: Fmt;
		yFormat?: Fmt;
		/** tooltip line under the x value; false hides it */
		belowLabel?: string | false;
		/**
		 * column holding the true share of the whole distribution below each x.
		 * Use it when the plot crops a tail; otherwise the share is computed from
		 * the plotted curve alone. One column applies to the first curve; to give
		 * every curve its own, map each curve to a column: { a: 'a_below', … }.
		 */
		below?: string | Record<string, string>;
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
		labels = {},
		colors,
		dashed = [],
		area = true,
		markers = [],
		shade = [],
		spans = [],
		notes = [],
		yAxis = false,
		xDomain,
		xType = 'linear',
		xTicks,
		xLabel,
		xFormat,
		yFormat,
		belowLabel = 'Share below',
		below,
		height,
		compact = false,
		title,
		subtitle,
		source,
		period,
		note
	}: Props = $props();

	const uid = $props.id();
	const motion = getMotion();

	const keys = $derived(asArray(y));
	const belowOf = (k: string) =>
		typeof below === 'string' ? (k === keys[0] ? below : undefined) : below?.[k];
	$effect(() =>
		checkColumns('Density', data, [x, ...asArray(y), ...asArray(y).map((k) => belowOf(k))])
	);
	let hidden = $state(new Set<string>());
	const shown = $derived(keys.filter((k) => !hidden.has(k)));
	const colorOf = (k: string) => colors?.[keys.indexOf(k)] ?? seriesColor(keys.indexOf(k));
	const nameOf = (k: string) => labels[k] ?? k;
	const seriesOf = (s?: string) => (s && keys.includes(s) ? s : keys[0]);

	const fx = $derived(formatter(xFormat, smartNumber));
	const fy = $derived(formatter(yFormat, smartNumber));
	const pct = (v: number) => `${Math.round(v * 100)}%`;

	let w = $state(640);
	const plateH = plateHeight();
	const h = $derived(height ?? (compact ? plateH : 300));
	const n = $derived(data.length);

	// ——— the curve as numbers: running area, mean, median, mode ———
	const bx = bisector((d: Row) => d[x]).left;
	function summarize(k: string) {
		const cum = new Array<number>(n).fill(0);
		let total = 0;
		let moment = 0;
		let best = 0;
		for (let i = 1; i < n; i++) {
			const a = data[i - 1];
			const b = data[i];
			// On a log axis the curve is a density per unit of log(x), so its area
			// is measured in log steps; in dollar steps the shares would drift right.
			const dx = xType === 'log' ? Math.log(b[x] / a[x]) : b[x] - a[x];
			total += ((a[k] + b[k]) / 2) * dx;
			moment += ((a[x] * a[k] + b[x] * b[k]) / 2) * dx;
			cum[i] = total;
			if (b[k] > data[best][k]) best = i;
		}
		let median = data[n - 1]?.[x];
		for (let i = 1; i < n; i++)
			if (cum[i] >= total / 2) {
				const t = (total / 2 - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
				median = lerp(data[i - 1][x], data[i][x], t);
				break;
			}
		return { cum, total, mean: moment / total, median, mode: data[best]?.[x] };
	}
	const summary = $derived(Object.fromEntries(keys.map((k) => [k, summarize(k)])));

	/** linear interpolation of a column (or the running area) at any x */
	function at(k: string, v: number, values?: number[]) {
		const get = (i: number) => (values ? values[i] : data[i][k]);
		const i = bx(data, v);
		if (i <= 0) return get(0);
		if (i >= n) return get(n - 1);
		const a = data[i - 1][x];
		const b = data[i][x];
		return lerp(get(i - 1), get(i), (v - a) / (b - a || 1));
	}
	const shareBelow = (k: string, v: number) => {
		const col = belowOf(k);
		if (col) return at(col, v);
		return summary[k].total > 0 ? at(k, v, summary[k].cum) / summary[k].total : 0;
	};

	// ——— scales ———
	const xExtent = $derived.by(() => {
		const [lo, hi] = extent(data, (d) => d[x] as number) as [number, number];
		return [xDomain?.[0] ?? lo, xDomain?.[1] ?? hi] as [number, number];
	});
	const yMax = $derived.by(() => {
		let m = 0;
		for (const d of data)
			if (d[x] >= xExtent[0] && d[x] <= xExtent[1])
				for (const k of shown) if (typeof d[k] === 'number') m = Math.max(m, d[k]);
		return m || 1;
	});

	const left = $derived(compact ? 4 : yAxis ? 44 : 16);
	const right = $derived(compact ? 4 : 16);
	const innerW = $derived(Math.max(10, w - left - right));
	const xScale = $derived(
		xType === 'log'
			? scaleLog().domain(xExtent).range([0, innerW])
			: scaleLinear().domain(xExtent).range([0, innerW])
	);

	// ——— markers: where they sit, and which label row keeps them apart ———
	const LABEL_SIZE = 11;
	const placedMarkers = $derived.by(() => {
		const out = markers
			.map((m) => {
				const k = seriesOf(m.series);
				if (!shown.includes(k)) return null;
				const v = typeof m.x === 'number' ? m.x : summary[k][m.x];
				if (typeof v !== 'number' || !Number.isFinite(v)) return null;
				if (v < xExtent[0] || v > xExtent[1]) return null;
				const name = m.label ?? (typeof m.x === 'string' ? m.x[0].toUpperCase() + m.x.slice(1) : '');
				const text = m.value === false ? name : name ? `${name} · ${fx(v)}` : fx(v);
				return { ...m, k, v, text, px: xScale(v), fixedRow: m.row, row: 0, eff: m.align ?? 'center', tw: 0 };
			})
			.filter((m) => m !== null)
			.sort((a, b) => a.px - b.px);
		const rightEdge: number[] = [];
		for (const m of out) {
			const tw = textWidth(m.text, LABEL_SIZE) + 6;
			// A label that would run off the chart's edge is centered over its
			// stem instead (and kept inside the edge), as on a narrow phone or page.
			let align = m.align ?? 'center';
			if (align === 'left' && m.px - tw - 4 < 2 - left) align = 'center';
			if (align === 'right' && m.px + tw + 4 > innerW + right - 2) align = 'center';
			m.eff = align;
			m.tw = tw;
			const lo = align === 'left' ? m.px - tw - 4 : align === 'right' ? m.px - 4 : m.px - tw / 2;
			const hi = align === 'left' ? m.px + 4 : align === 'right' ? m.px + tw + 4 : m.px + tw / 2;
			let row = m.fixedRow ?? 0;
			if (m.fixedRow === undefined) while (rightEdge[row] !== undefined && lo < rightEdge[row]) row++;
			rightEdge[row] = Math.max(rightEdge[row] ?? -Infinity, hi);
			m.row = row;
		}
		return out;
	});
	const labelRows = $derived(
		placedMarkers.length ? Math.max(...placedMarkers.map((m) => m.row)) + 1 : 0
	);

	const top = $derived(compact ? 10 : labelRows ? 14 + labelRows * 15 : yAxis ? 14 : 10);
	const bottom = $derived(compact ? 18 : xLabel ? 44 : 28);
	const innerH = $derived(h - top - bottom);
	const yScale = $derived(
		scaleLinear()
			.domain([0, yMax * 1.06])
			.range([innerH, 0])
	);
	const yTicks = $derived(yScale.ticks(4));

	// ——— marks ———
	const visible = (d: Row) => d[x] >= xExtent[0] && d[x] <= xExtent[1];
	const plotted = $derived(data.filter(visible));
	const paths = $derived(
		shown.map((k) => ({
			key: k,
			line:
				d3line<Row>()
					.x((d) => xScale(d[x]))
					.y((d) => yScale(d[k]))
					.curve(curveMonotoneX)(plotted) ?? '',
			area:
				d3area<Row>()
					.x((d) => xScale(d[x]))
					.y0(innerH)
					.y1((d) => yScale(d[k]))
					.curve(curveMonotoneX)(plotted) ?? ''
		}))
	);
	const areaOf = (k: string) => paths.find((p) => p.key === k)?.area ?? '';

	const placedShades = $derived(
		shade
			.map((s, i) => {
				const k = seriesOf(s.series);
				if (!shown.includes(k)) return null;
				const x0 = xScale(Math.max(s.from ?? xExtent[0], xExtent[0]));
				const x1 = xScale(Math.min(s.to ?? xExtent[1], xExtent[1]));
				if (x1 <= x0) return null;
				const lx = s.labelAt !== undefined ? xScale(s.labelAt) : (x0 + x1) / 2;
				const ly = Math.max(12, yScale(at(k, xScale.invert(lx))) - 12 + (s.dy ?? 0));
				return { ...s, i, k, x0, x1, lx, ly };
			})
			.filter((s) => s !== null)
	);

	const placedSpans = $derived(
		spans
			.map((sp, i) => {
				const x0 = xScale(Math.max(sp.from, xExtent[0]));
				const x1 = xScale(Math.min(sp.to, xExtent[1]));
				if (x1 <= x0) return null;
				return { ...sp, i, x0, x1, y: innerH - 18 - i * 28 };
			})
			.filter((v) => v !== null)
	);

	const placedNotes = $derived(
		notes
			.map((nt) => {
				const k = seriesOf(nt.series);
				if (!shown.includes(k) || nt.x < xExtent[0] || nt.x > xExtent[1]) return null;
				return {
					...nt,
					px: xScale(nt.x),
					py: yScale(at(k, nt.x)),
					dx: nt.dx ?? 14,
					dy: nt.dy ?? -30
				};
			})
			.filter((v) => v !== null)
	);

	// ——— motion: the pen draws left to right ———
	const clipW = $derived(motion.reveal >= 1 ? innerW + right + 4 : motion.reveal * innerW + 1);
	const inked = (px: number) => motion.reveal >= 1 || px <= motion.reveal * innerW;

	// ——— hover ———
	let hover = $state<number | null>(null);
	let pointerY = $state(0);
	function onmove(e: PointerEvent) {
		const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
		const scale = innerW / rect.width;
		hover = xScale.invert((e.clientX - rect.left) * scale);
		pointerY = (e.clientY - rect.top) * scale;
	}

	const legend = $derived(
		keys.map((k, i) => ({
			key: k,
			label: nameOf(k),
			color: colorOf(k),
			mark: (i === 0 && area ? 'hatch' : 'line') as 'hatch' | 'line'
		}))
	);
</script>

<Figure {title} {subtitle} {source} {period} {note} {legend} {compact} bind:hidden>
	<div bind:clientWidth={w}>
		<svg
			viewBox="0 0 {w} {h}"
			width="100%"
			role="img"
			aria-label={title ?? `Distribution of ${keys.map(nameOf).join(', ')}`}
		>
			<defs>
				<clipPath id="{uid}-reveal">
					<rect x={-left} y={-top} width={left + clipW} height={h} />
				</clipPath>
				{#each placedShades as s (s.i)}
					<clipPath id="{uid}-shade-{s.i}">
						<rect x={s.x0} y="0" width={s.x1 - s.x0} height={innerH} />
					</clipPath>
				{/each}
			</defs>

			<g transform="translate({left},{top})">
				{#if yAxis && !compact}
					<AxisY scale={yScale} width={innerW} ticks={yTicks} format={fy} {compact} />
				{/if}
				<AxisX scale={xScale} height={innerH} width={innerW} ticks={xTicks} format={fx} label={xLabel} {compact} />

				<g clip-path="url(#{uid}-reveal)">
					{#if area && shown.includes(keys[0])}
						<path
							d={areaOf(keys[0])}
							class="area"
							style:fill={hatch(0)}
							style:fill-opacity={0.55}
						/>
					{/if}

					{#each placedShades as s (s.i)}
						<g clip-path="url(#{uid}-shade-{s.i})">
							<path
								d={areaOf(s.k)}
								class="area"
								style:fill={colorOf(s.k)}
								style:fill-opacity={0.14}
							/>
							{#if s.hatch !== false}
								<path d={areaOf(s.k)} class="area" style:fill={hatch(keys.indexOf(s.k), true)} />
							{/if}
						</g>
						<line class="edge" x1={s.x0} x2={s.x0} y1={innerH} y2={yScale(at(s.k, xScale.invert(s.x0)))} />
						<line class="edge" x1={s.x1} x2={s.x1} y1={innerH} y2={yScale(at(s.k, xScale.invert(s.x1)))} />
					{/each}

					{#each paths as p (p.key)}
						<path
							d={p.line}
							class="line"
							class:primary={p.key === keys[0]}
							class:dashed={dashed.includes(p.key)}
							class:compact
							style:stroke={colorOf(p.key)}
						/>
					{/each}
				</g>

				{#each placedShades as s (s.i)}
					{#if s.label && !compact && inked(s.x1)}
						<text class="shade-label" x={s.lx} y={s.ly} text-anchor="middle"
							>{s.label}</text
						>
					{/if}
				{/each}

				{#each placedMarkers as m (m.text + m.k)}
					{@const py = yScale(at(m.k, m.v))}
					{@const ly = -10 - m.row * 15}
					{#if inked(m.px)}
						<g class="marker">
							<!-- one line from the label to the axis, so the dashes run unbroken -->
							<line class="stem" class:solid={m.solid} x1={m.px} x2={m.px} y1={compact ? py : ly + 4} y2={innerH} />
							<circle cx={m.px} cy={py} r="3.5" style:stroke={keys.length > 1 ? colorOf(m.k) : undefined} />
							{#if !compact}
								{@const align = m.eff}
								<text
									x={align === 'center'
										? Math.min(Math.max(m.px, m.tw / 2 - left + 2), innerW + right - m.tw / 2 - 2)
										: m.px + (align === 'left' ? -5 : 5)}
									y={ly}
									text-anchor={align === 'left' ? 'end' : align === 'right' ? 'start' : 'middle'}
									style:fill={keys.length > 1 ? colorOf(m.k) : undefined}>{m.text}</text
								>
							{/if}
						</g>
					{/if}
				{/each}

				{#each placedSpans as sp (sp.i)}
					{#if !compact && inked(sp.x1)}
						<g class="span">
							<line x1={sp.x0} x2={sp.x1} y1={sp.y} y2={sp.y} />
							<line x1={sp.x0} x2={sp.x0} y1={sp.y - 4} y2={sp.y + 4} />
							<line x1={sp.x1} x2={sp.x1} y1={sp.y - 4} y2={sp.y + 4} />
							{#if sp.label}
								<text x={(sp.x0 + sp.x1) / 2} y={sp.y - 5} text-anchor="middle">{sp.label}</text>
							{/if}
						</g>
					{/if}
				{/each}

				{#each placedNotes as nt (nt.text)}
					{#if inked(nt.px) && !compact}
						<g class="note">
							<line x1={nt.px} y1={nt.py} x2={nt.px + nt.dx} y2={nt.py + nt.dy} />
							<circle cx={nt.px} cy={nt.py} r="3" />
							<text
								x={nt.px + nt.dx}
								y={nt.py + nt.dy - 4}
								text-anchor={nt.dx < 0 ? 'end' : 'start'}>{nt.text}</text
							>
						</g>
					{/if}
				{/each}

				{#if hover !== null}
					{@const hx = xScale(hover)}
					<line class="rule" x1={hx} x2={hx} y1="0" y2={innerH} />
					{#each shown as k (k)}
						<circle class="dot" cx={hx} cy={yScale(at(k, hover))} r="4" style:fill={colorOf(k)} />
					{/each}
				{/if}

				{#if !compact}
					<rect
						class="hit"
						width={innerW}
						height={innerH}
						role="presentation"
						onpointermove={onmove}
						onpointerleave={() => (hover = null)}
					/>
				{/if}
			</g>
		</svg>

		{#if hover !== null}
			<Tooltip x={left + xScale(hover)} y={top + pointerY} width={w}>
				<span class="tip-head">{xLabel ? `${xLabel}: ` : ''}{fx(hover)}</span>
				{#if belowLabel !== false}
					{#each shown as k (k)}
						<span class="tip-row">
							<span
								>{#if shown.length > 1}<span class="swatch" style:background={colorOf(k)}
									></span>{nameOf(k)}{:else}{belowLabel}{/if}</span
							>
							<b>{pct(shareBelow(k, hover))}</b>
						</span>
					{/each}
				{/if}
			</Tooltip>
		{/if}
	</div>
</Figure>

<style>
	svg {
		overflow: visible;
		height: auto;
	}
	.area {
		stroke: none;
	}
	.line {
		fill: none;
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.line.primary {
		stroke-width: 2.4;
	}
	.line.compact {
		stroke-width: 1.7;
	}
	.line.dashed {
		stroke-width: 1.6;
		stroke-dasharray: 5 4;
	}
	.edge {
		stroke: var(--ink);
		stroke-width: 0.8;
	}
	.shade-label {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 14px;
		fill: var(--ink);
		paint-order: stroke;
		stroke: var(--paper);
		stroke-width: 4px;
	}
	.marker .stem {
		stroke: var(--ink);
		stroke-width: 1.1;
		stroke-dasharray: 3 3;
	}
	.marker .stem.solid {
		stroke-dasharray: none;
	}
	.marker circle {
		fill: var(--paper);
		stroke: var(--accent);
		stroke-width: 1.6;
	}
	.marker text {
		font-family: var(--font-type);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		fill: var(--ink);
		paint-order: stroke;
		stroke: var(--paper);
		stroke-width: 3px;
	}
	.span line {
		stroke: var(--ink);
		stroke-width: 0.9;
	}
	.span text {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 14px;
		fill: var(--ink);
		paint-order: stroke;
		stroke: var(--paper);
		stroke-width: 4px;
	}
	.note line {
		stroke: var(--ink);
		stroke-width: 0.8;
	}
	.note circle {
		fill: var(--paper);
		stroke: var(--accent);
		stroke-width: 1.6;
	}
	.note text {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 14px;
		fill: var(--ink);
		paint-order: stroke;
		stroke: var(--paper);
		stroke-width: 4px;
	}
	.rule {
		stroke: var(--ink);
		stroke-width: 0.8;
		stroke-dasharray: 2 2;
	}
	.dot {
		stroke: var(--paper);
		stroke-width: 1.5;
	}
	.hit {
		fill: transparent;
		cursor: crosshair;
	}
</style>
