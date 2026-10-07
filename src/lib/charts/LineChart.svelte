<!--
	Line / area chart. Wide data: one row per x, one column per series.
	<LineChart data={rows} x="year" y={['Florida', 'Texas']} area zero />
-->
<script lang="ts">
	import { scaleLinear, scalePoint, scaleUtc } from 'd3-scale';
	import {
		area as d3area,
		curveLinear,
		curveMonotoneX,
		curveStepAfter,
		line as d3line
	} from 'd3-shape';
	import { extent } from 'd3-array';
	import Figure from './Figure.svelte';
	import AxisX from './AxisX.svelte';
	import AxisY from './AxisY.svelte';
	import Tooltip from './Tooltip.svelte';
	import { easeInOut, getMotion, plateHeight } from './motion.svelte';
	import {
		type Fmt,
		type Note,
		type Row,
		asArray,
		fmtMonth,
		fmtMonthLong,
		fmtYear,
		formatter,
		hatch,
		inferKind,
		lerp,
		sameX,
		seriesColor,
		smartNumber,
		textWidth,
		checkColumns
	} from './util';

	interface Props {
		data: Row[];
		x: string;
		/** one column name, or several for multiple series */
		y: string | string[];
		/** display names for series columns */
		labels?: Record<string, string>;
		area?: boolean;
		curve?: 'monotone' | 'linear' | 'step';
		/** include zero on the value axis */
		zero?: boolean;
		/** fix either end of the value axis; null leaves that end automatic */
		yDomain?: [number | null, number | null];
		xLabel?: string;
		yLabel?: string;
		xFormat?: Fmt;
		yFormat?: Fmt;
		/** override series colours (CSS colours) */
		colors?: string[];
		/** annotations drawn onto the chart */
		notes?: Note[];
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
		area = false,
		curve = 'monotone',
		zero = false,
		yDomain,
		xLabel,
		yLabel,
		xFormat,
		yFormat,
		colors,
		notes = [],
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
	$effect(() => checkColumns('LineChart', data, [x, ...asArray(y)]));
	let hidden = $state(new Set<string>());
	const shown = $derived(keys.filter((k) => !hidden.has(k)));
	const colorOf = (k: string) => colors?.[keys.indexOf(k)] ?? seriesColor(keys.indexOf(k));
	const nameOf = (k: string) => labels[k] ?? k;

	let w = $state(640);
	const plateH = plateHeight();
	const h = $derived(height ?? (compact ? plateH : 340));
	const n = $derived(data.length);

	// ——— x ———
	const xs = $derived(data.map((d) => d[x]));
	const kind = $derived(inferKind(xs));
	const isYear = $derived(
		kind === 'linear' && xs.every((v) => Number.isInteger(v) && v > 1000 && v < 3000)
	);
	const fx = $derived(
		formatter(
			xFormat,
			kind === 'time' ? fmtMonth : isYear ? fmtYear : kind === 'linear' ? smartNumber : String
		)
	);
	const fxLong = $derived(xFormat ? fx : kind === 'time' ? fmtMonthLong : fx);
	const fy = $derived(formatter(yFormat, smartNumber));

	// ——— y ———
	const valid = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v);
	const yExtent = $derived.by(() => {
		let lo = Infinity;
		let hi = -Infinity;
		for (const d of data)
			for (const k of shown)
				if (valid(d[k])) {
					lo = Math.min(lo, d[k]);
					hi = Math.max(hi, d[k]);
				}
		if (zero) lo = Math.min(0, lo);
		return [yDomain?.[0] ?? lo, yDomain?.[1] ?? hi] as [number, number];
	});

	const top = $derived(compact ? 14 : yLabel ? 28 : 12);
	const bottom = $derived(compact ? 18 : xLabel ? 44 : 28);
	const innerH = $derived(h - top - bottom);
	const yScale = $derived.by(() => {
		const s = scaleLinear().domain(yExtent).range([innerH, 0]);
		return yDomain ? s : s.nice(compact ? 3 : 5);
	});
	const yTicks = $derived(yScale.ticks(compact ? 3 : 5));
	const left = $derived(compact ? 2 : Math.max(...yTicks.map((t) => textWidth(fy(t)))) + 12);
	const right = $derived(compact ? 4 : 14);
	const innerW = $derived(Math.max(10, w - left - right));

	const xScale = $derived.by((): any => {
		if (kind === 'time')
			return scaleUtc()
				.domain(extent(xs) as [Date, Date])
				.range([0, innerW]);
		if (kind === 'linear')
			return scaleLinear()
				.domain(extent(xs) as [number, number])
				.range([0, innerW]);
		return scalePoint().domain(xs.map(String)).range([0, innerW]);
	});
	const xPos = (i: number) => (kind === 'band' ? xScale(String(xs[i])) : xScale(xs[i]));
	const xTicks = $derived.by(() => {
		if (kind !== 'linear' || !isYear) return undefined;
		const t = xScale.ticks(Math.max(2, Math.min(8, Math.floor(innerW / (compact ? 70 : 85)))));
		return t.filter(Number.isInteger);
	});

	// ——— marks ———
	const curveFn = $derived(
		curve === 'linear' ? curveLinear : curve === 'step' ? curveStepAfter : curveMonotoneX
	);
	const base = $derived(yScale.domain()[0] > 0 ? innerH : yScale(0));
	const paths = $derived(
		shown.map((k) => {
			const defined = (d: Row) => valid(d[k]);
			return {
				key: k,
				line:
					d3line<Row>()
						.defined(defined)
						.x((_, i) => xPos(i))
						.y((d) => yScale(d[k]))
						.curve(curveFn)(data) ?? '',
				area: area
					? (d3area<Row>()
							.defined(defined)
							.x((_, i) => xPos(i))
							.y0(base)
							.y1((d) => yScale(d[k]))
							.curve(curveFn)(data) ?? '')
					: ''
			};
		})
	);

	// Fractional index helpers (for the pen and the wandering cursor).
	const xAt = (f: number) => lerp(xPos(Math.floor(f)), xPos(Math.ceil(f)), f - Math.floor(f));
	const yAt = (k: string, f: number) => {
		const a = data[Math.floor(f)]?.[k];
		const b = data[Math.ceil(f)]?.[k];
		return valid(a) && valid(b) ? yScale(lerp(a, b, f - Math.floor(f))) : null;
	};

	// ——— motion ———
	const frontier = $derived(motion.reveal * (n - 1));
	const clipW = $derived(motion.reveal >= 1 ? innerW + right + 4 : xAt(frontier) + 1);
	const drawing = $derived(motion.reveal > 0 && motion.reveal < 1);
	const cursorF = $derived(motion.cursor === null ? null : easeInOut(motion.cursor) * (n - 1));

	// ——— hover ———
	let hover = $state<number | null>(null);
	let pointerY = $state(0);
	function onmove(e: PointerEvent) {
		const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
		const scale = innerW / rect.width;
		const mx = (e.clientX - rect.left) * scale;
		let best = 0;
		for (let i = 1; i < n; i++) if (Math.abs(xPos(i) - mx) < Math.abs(xPos(best) - mx)) best = i;
		hover = best;
		pointerY = (e.clientY - rect.top) * scale;
	}

	const placedNotes = $derived(
		notes
			.map((nt) => {
				const i = xs.findIndex((v) => sameX(v, nt.x));
				if (i < 0) return null;
				const key = typeof nt.y === 'string' ? nt.y : keys[0];
				const py = typeof nt.y === 'number' ? yScale(nt.y) : yScale(data[i][key]);
				return { ...nt, i, px: xPos(i), py, dx: nt.dx ?? -12, dy: nt.dy ?? -34 };
			})
			.filter((v) => v !== null)
	);

	const legend = $derived(
		keys.map((k) => ({ key: k, label: nameOf(k), color: colorOf(k), mark: 'line' as const }))
	);
</script>

<Figure {title} {subtitle} {source} {period} {note} {legend} {compact} bind:hidden>
	<div bind:clientWidth={w}>
		<svg
			viewBox="0 0 {w} {h}"
			width="100%"
			role="img"
			aria-label={title ?? keys.map(nameOf).join(', ')}
		>
			<defs>
				<clipPath id="{uid}-reveal">
					<rect x={-left} y={-top} width={left + clipW} height={h} />
				</clipPath>
			</defs>
			<g transform="translate({left},{top})">
				<AxisY scale={yScale} width={innerW} ticks={yTicks} format={fy} label={yLabel} {compact} />
				<AxisX
					scale={xScale}
					height={innerH}
					width={innerW}
					ticks={xTicks}
					format={fx}
					label={xLabel}
					{compact}
				/>

				<g clip-path="url(#{uid}-reveal)">
					{#each paths as p (p.key)}
						{#if area}
							<path
								d={p.area}
								class="area"
								style:fill={shown.length === 1 ? hatch(keys.indexOf(p.key)) : colorOf(p.key)}
								style:fill-opacity={shown.length === 1 ? 0.55 : 0.07}
							/>
						{/if}
					{/each}
					{#each paths as p (p.key)}
						<path
							d={p.line}
							class="line"
							class:primary={keys.indexOf(p.key) === 0}
							class:compact
							style:stroke={colorOf(p.key)}
							style:opacity={hover !== null || cursorF !== null ? 0.9 : 1}
						/>
					{/each}
				</g>

				<!-- the pen nib while the ink is being laid down -->
				{#if drawing}
					{#each shown as k (k)}
						{@const py = yAt(k, frontier)}
						{#if py !== null}
							<circle cx={xAt(frontier)} cy={py} r={compact ? 2.6 : 3.4} style:fill={colorOf(k)} />
						{/if}
					{/each}
				{/if}

				{#each placedNotes as nt (nt.text)}
					{#if motion.reveal >= 1 || frontier >= nt.i}
						<g class="note">
							<line x1={nt.px} y1={nt.py} x2={nt.px + nt.dx} y2={nt.py + nt.dy} />
							<circle cx={nt.px} cy={nt.py} r="3.5" />
							<text
								x={nt.px + nt.dx}
								y={nt.py + nt.dy - 4}
								text-anchor={nt.dx < 0 ? 'end' : 'start'}>{nt.text}</text
							>
						</g>
					{/if}
				{/each}

				<!-- the wandering cursor on the front page -->
				{#if cursorF !== null}
					{@const cx = xAt(cursorF)}
					{@const idx = Math.round(cursorF)}
					<line class="rule" x1={cx} x2={cx} y1="0" y2={innerH} />
					{#each shown as k (k)}
						{@const py = yAt(k, cursorF)}
						{#if py !== null}
							<circle class="dot" {cx} cy={py} r="3.2" style:fill={colorOf(k)} />
						{/if}
					{/each}
					<text
						class="reading"
						x={Math.min(Math.max(cx, 40), innerW - 40)}
						y={-4}
						text-anchor="middle"
					>
						{fx(xs[idx])}{#if shown.length === 1}&ensp;·&ensp;{fy(data[idx][shown[0]])}{/if}
					</text>
				{/if}

				{#if hover !== null}
					{@const hx = xPos(hover)}
					<line class="rule" x1={hx} x2={hx} y1="0" y2={innerH} />
					{#each shown as k (k)}
						{#if valid(data[hover][k])}
							<circle
								class="dot"
								cx={hx}
								cy={yScale(data[hover][k])}
								r="4"
								style:fill={colorOf(k)}
							/>
						{/if}
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
			<Tooltip x={left + xPos(hover)} y={top + pointerY} width={w}>
				<span class="tip-head">{fxLong(xs[hover])}</span>
				{#each shown as k (k)}
					<span class="tip-row">
						<span><span class="swatch" style:background={colorOf(k)}></span>{nameOf(k)}</span>
						<b>{fy(data[hover][k])}</b>
					</span>
				{/each}
			</Tooltip>
		{/if}
	</div>
</Figure>

<style>
	svg {
		overflow: visible;
		height: auto;
	}
	.line {
		fill: none;
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
		transition: opacity 0.2s;
	}
	.line.primary {
		stroke-width: 2.4;
	}
	.line.compact {
		stroke-width: 1.7;
	}
	.area {
		stroke: none;
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
	.reading {
		font-family: var(--font-type);
		font-size: 10.5px;
		font-weight: 600;
		fill: var(--ink);
		paint-order: stroke;
		stroke: var(--paper);
		stroke-width: 3px;
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
	.hit {
		fill: transparent;
		cursor: crosshair;
	}
</style>
