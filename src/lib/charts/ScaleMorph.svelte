<!--
	ScaleMorph: one distribution, with a slider that bends the x axis from an
	ordinary scale into a log scale.

	The axis moves through the Box–Cox family, T(x) = (x^λ − 1) / λ, from λ = 1
	(ordinary) to λ = 0 (log). Every frame is a true chart: the height is redrawn as
	density × x^(1−λ), so the area under the curve still reads as a share of the
	whole at every point of the slider.

	<ScaleMorph data={rows} x="x" y="density" reference="lognormal"
		below="share_below" median={350000} mean={500766}
		linearDomain={[0, 2000000]} logDomain={[30000, 3000000]} />

	`y` (and `reference`) are ordinary densities, per unit of x. The chart starts
	on the log scale, so with no script (or in print) it is the finished picture.
-->
<script lang="ts">
	import { scaleLinear } from 'd3-scale';
	import { area as d3area, curveMonotoneX, line as d3line } from 'd3-shape';
	import { bisector } from 'd3-array';
	import { onMount } from 'svelte';
	import Figure from './Figure.svelte';
	import AxisX from './AxisX.svelte';
	import Tooltip from './Tooltip.svelte';
	import { type Fmt, type Row, checkColumns, formatter, hatch, lerp, seriesColor, smartNumber } from './util';

	interface Props {
		data: Row[];
		x: string;
		/** density per unit of x */
		y: string;
		/** a reference density per unit of x, drawn dashed */
		reference?: string;
		labels?: Record<string, string>;
		/** column with the true share below each x, for the hover readout */
		below?: string;
		/** statistics to mark; the mode is found from the curve in each frame */
		median?: number;
		mean?: number;
		mode?: boolean;
		linearDomain: [number, number];
		logDomain: [number, number];
		linearTicks?: number[];
		logTicks?: number[];
		xLabel?: string;
		xFormat?: Fmt;
		/** names for the two ends of the slider */
		ends?: [string, string];
		height?: number;
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
		reference,
		labels = {},
		below,
		median,
		mean,
		mode = true,
		linearDomain,
		logDomain,
		linearTicks,
		logTicks,
		xLabel = 'Value',
		xFormat,
		ends = ['Dollars', 'Multiples'],
		height = 300,
		title,
		subtitle,
		source,
		period,
		note
	}: Props = $props();

	const uid = $props.id();
	$effect(() => checkColumns('ScaleMorph', data, [x, y, reference, below]));
	const fx = $derived(formatter(xFormat, smartNumber));

	// ——— the dial: p = 0 is the ordinary axis, p = 1 the log axis ———
	let p = $state(1);
	const lambda = $derived(1 - p);

	/** Box–Cox transform and its inverse */
	const T = (v: number, l: number) => (l < 1e-4 ? Math.log(v) : (Math.pow(v, l) - 1) / l);
	const Tinv = (t: number, l: number) => (l < 1e-4 ? Math.exp(t) : Math.pow(Math.max(0, l * t + 1), 1 / l));
	/** density per unit of T(x): f(x) · dx/dT = f(x) · x^(1−λ) */
	const height_ = (f: number, v: number, l: number) => (v <= 0 ? (l >= 1 ? f : 0) : f * Math.pow(v, 1 - l));

	// The window slides between the two figures' ranges along with the axis.
	const lo = $derived(lerp(logDomain[0], linearDomain[0], lambda));
	const hi = $derived(lerp(logDomain[1], linearDomain[1], lambda));

	let w = $state(640);
	const left = 16;
	const right = 16;
	const innerW = $derived(Math.max(10, w - left - right));

	const xScale = $derived(scaleLinear().domain([T(lo, lambda), T(hi, lambda)]).range([0, innerW]));
	const px = (v: number) => xScale(T(v, lambda));

	const rows = $derived(data.filter((d) => d[x] >= lo && d[x] <= hi));
	const frame = $derived(
		rows.map((d) => ({
			v: d[x] as number,
			h: height_(d[y], d[x], lambda),
			r: reference ? height_(d[reference], d[x], lambda) : 0
		}))
	);
	const peak = $derived(frame.reduce((a, b) => (b.h > a.h ? b : a), frame[0]));
	const yMax = $derived(Math.max(...frame.map((f) => Math.max(f.h, f.r))) || 1);

	// ——— labels and ticks: thin out whichever ticks crowd each other ———
	const tickSpace = 52;
	const ticks = $derived.by(() => {
		const lin = linearTicks ?? scaleLinear().domain(linearDomain).ticks(5);
		const log = logTicks ?? [];
		// Near either end, only that end's ticks; in between, both, as room allows.
		const order = lambda > 0.85 ? lin : lambda < 0.15 ? log : lambda >= 0.5 ? [...lin, ...log] : [...log, ...lin];
		const kept: number[] = [];
		for (const t of order) {
			if (t < lo || t > hi || kept.includes(t)) continue;
			if (t <= 0 && lambda < 1) continue;
			const at = px(t);
			if (kept.every((k) => Math.abs(px(k) - at) >= tickSpace)) kept.push(t);
		}
		return kept.sort((a, b) => a - b);
	});
	const axisLabel = $derived(
		lambda > 0.98 ? xLabel : lambda < 0.02 ? `${xLabel} (log scale)` : `${xLabel} (bending toward a log scale)`
	);

	// ——— markers: mean on the lowest row, median above it, mode on top ———
	const markers = $derived(
		[
			mean !== undefined && { label: 'Mean', v: mean, row: 0 },
			median !== undefined && { label: 'Median', v: median, row: 1 },
			mode && peak && { label: 'Mode', v: peak.v, row: 2 }
		].filter((m) => !!m && m.v >= lo && m.v <= hi) as { label: string; v: number; row: number }[]
	);
	const rowsUsed = $derived(markers.length ? Math.max(...markers.map((m) => m.row)) + 1 : 0);
	const top = $derived(14 + rowsUsed * 15);
	const bottom = 44;
	const innerH = $derived(height - top - bottom);
	const yScale = $derived(
		scaleLinear()
			.domain([0, yMax * 1.06])
			.range([innerH, 0])
	);

	// ——— marks ———
	type Pt = { v: number; h: number; r: number };
	const line = (k: 'h' | 'r') =>
		d3line<Pt>()
			.x((d) => px(d.v))
			.y((d) => yScale(d[k]))
			.curve(curveMonotoneX)(frame) ?? '';
	const curve = $derived(line('h'));
	const refCurve = $derived(reference ? line('r') : '');
	const fill = $derived(
		d3area<Pt>()
			.x((d) => px(d.v))
			.y0(innerH)
			.y1((d) => yScale(d.h))
			.curve(curveMonotoneX)(frame) ?? ''
	);

	/** curve height at any x, by interpolating the frame */
	const bv = bisector((d: Pt) => d.v).left;
	function heightAt(v: number) {
		const i = bv(frame, v);
		if (i <= 0) return frame[0]?.h ?? 0;
		if (i >= frame.length) return frame[frame.length - 1].h;
		const a = frame[i - 1];
		const b = frame[i];
		return lerp(a.h, b.h, (v - a.v) / (b.v - a.v || 1));
	}
	const bd = bisector((d: Row) => d[x]).left;
	function shareBelow(v: number) {
		if (!below) return null;
		const i = Math.min(Math.max(bd(data, v), 1), data.length - 1);
		const a = data[i - 1];
		const b = data[i];
		return lerp(a[below], b[below], (v - a[x]) / (b[x] - a[x] || 1));
	}

	// ——— playing it: hold on dollars, bend to the log scale, hold ———
	let reduced = $state(false);
	let playing = $state(false);
	let raf = 0;
	onMount(() => {
		reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		return () => cancelAnimationFrame(raf);
	});
	/**
	 * Eases in, then runs at constant speed: the speed climbs from zero over the
	 * first RAMP of the time, then holds steady to the end.
	 */
	const RAMP = 0.25;
	function ramp(t: number) {
		if (t <= 0) return 0;
		if (t >= 1) return 1;
		const v = 1 / (1 - RAMP / 2);
		return t < RAMP ? (v * t * t) / (2 * RAMP) : v * (t - RAMP / 2);
	}
	function play() {
		cancelAnimationFrame(raf);
		const HOLD = 700;
		const BEND = 3200;
		const start = performance.now();
		playing = true;
		p = 0;
		const tick = (now: number) => {
			const t = (now - start - HOLD) / BEND;
			p = ramp(t);
			if (t < 1) raf = requestAnimationFrame(tick);
			else playing = false;
		};
		raf = requestAnimationFrame(tick);
	}
	function stop() {
		cancelAnimationFrame(raf);
		playing = false;
	}

	// ——— hover ———
	let hover = $state<number | null>(null);
	let pointerY = $state(0);
	function onmove(e: PointerEvent) {
		const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
		const scale = innerW / rect.width;
		hover = Tinv(xScale.invert((e.clientX - rect.left) * scale), lambda);
		pointerY = (e.clientY - rect.top) * scale;
	}

	const legend = $derived([
		{ key: y, label: labels[y] ?? y, color: seriesColor(0), mark: 'hatch' as const },
		...(reference
			? [{ key: reference, label: labels[reference] ?? reference, color: seriesColor(1), mark: 'line' as const }]
			: [])
	]);
</script>

<Figure {title} {subtitle} {source} {period} {note} {legend} toggleable={false}>
	<div class="controls">
		<button
			type="button"
			class="play"
			onclick={playing ? stop : play}
			hidden={reduced}
			aria-label={playing ? 'Stop' : p > 0.99 ? 'Replay' : 'Play'}
			title={playing ? 'Stop' : p > 0.99 ? 'Replay' : 'Play'}
		>
			<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
				{#if playing}
					<rect class="solid" x="8" y="8" width="8" height="8" rx="0.5" />
				{:else if p > 0.99}
					<path class="stroke" d="M19 12A7 7 0 1 1 16.95 7.05M16.95 3.55V7.05H13.45" />
				{:else}
					<path class="solid" d="M9.5 7L17 12L9.5 17Z" />
				{/if}
			</svg>
		</button>
		<label class="dial">
			<span class="end">{ends[0]}</span>
			<input
				type="range"
				min="0"
				max="1"
				step="0.001"
				bind:value={p}
				oninput={stop}
				aria-label="Bend the axis from {ends[0].toLowerCase()} to {ends[1].toLowerCase()}"
			/>
			<span class="end">{ends[1]}</span>
		</label>
	</div>

	<div bind:clientWidth={w}>
		<svg viewBox="0 0 {w} {height}" width="100%" role="img" aria-label={title}>
			<defs>
				<clipPath id="{uid}-plot">
					<rect x="-2" y={-top} width={innerW + 4} height={height} />
				</clipPath>
			</defs>
			<g transform="translate({left},{top})">
				<AxisX scale={xScale} height={innerH} width={innerW} ticks={[]} label="" />
				<g class="axis" transform="translate(0,{innerH})">
					{#each ticks as t (t)}
						<g transform="translate({px(t)},0)">
							<line class="tick" y2="5" />
							<text y="18" text-anchor="middle">{fx(t)}</text>
						</g>
					{/each}
					<text class="label" x={innerW} y="36" text-anchor="end">{axisLabel}</text>
				</g>

				<g clip-path="url(#{uid}-plot)">
					<path d={fill} class="area" style:fill={hatch(0)} style:fill-opacity={0.55} />
					<path d={curve} class="line primary" style:stroke={seriesColor(0)} />
					{#if reference}
						<path d={refCurve} class="line dashed" style:stroke={seriesColor(1)} />
					{/if}
				</g>

				{#each markers as m (m.label)}
					{@const mx = px(m.v)}
					{@const my = yScale(heightAt(m.v))}
					{@const ly = -10 - m.row * 15}
					<g class="marker">
						<line class="stem" x1={mx} x2={mx} y1={ly + 4} y2={innerH} />
						<circle cx={mx} cy={my} r="3.5" />
						<text x={Math.min(Math.max(mx, 50), innerW - 50)} y={ly} text-anchor="middle"
							>{m.label} · {fx(m.v)}</text
						>
					</g>
				{/each}

				{#if hover !== null}
					{@const hx = px(hover)}
					<line class="rule" x1={hx} x2={hx} y1="0" y2={innerH} />
					<circle class="dot" cx={hx} cy={yScale(heightAt(hover))} r="4" style:fill={seriesColor(0)} />
				{/if}

				<rect
					class="hit"
					width={innerW}
					height={innerH}
					role="presentation"
					onpointermove={onmove}
					onpointerleave={() => (hover = null)}
				/>
			</g>
		</svg>

		{#if hover !== null}
			{@const share = shareBelow(hover)}
			<Tooltip x={left + px(hover)} y={top + pointerY} width={w}>
				<span class="tip-head">{xLabel}: {fx(hover)}</span>
				{#if share !== null}
					<span class="tip-row"><span>Share below</span><b>{Math.round(share * 100)}%</b></span>
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
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.9rem;
		margin: 0.2rem 0 0.5rem;
		font-family: var(--font-type);
		font-size: 0.8rem;
		color: var(--ink-soft);
	}
	.play {
		flex: none;
		display: grid;
		place-items: center;
		width: 2.1rem;
		height: 2.1rem;
		padding: 0;
		color: var(--ink);
		background: transparent;
		border: 1.4px solid var(--ink);
		border-radius: 50%;
		cursor: pointer;
		transition:
			background 0.15s,
			color 0.15s;
	}
	.play:hover {
		color: var(--paper);
		background: var(--ink);
	}
	.play .solid {
		fill: currentColor;
	}
	.play .stroke {
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.play[hidden] {
		display: none;
	}
	.dial {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-width: 15rem;
	}
	.end {
		flex: none;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	input[type='range'] {
		flex: 1;
		min-width: 0;
		accent-color: var(--accent);
	}
	.axis text {
		font-family: var(--font-type);
		font-size: 12px;
		fill: var(--ink-soft);
	}
	.axis .label {
		font-family: var(--font-body);
		font-size: 13px;
	}
	.axis .tick {
		stroke: var(--ink);
		stroke-width: 0.8;
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
	.line.dashed {
		stroke-width: 1.6;
		stroke-dasharray: 5 4;
	}
	.marker .stem {
		stroke: var(--ink);
		stroke-width: 1.1;
		stroke-dasharray: 3 3;
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
