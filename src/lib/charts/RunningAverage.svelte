<!--
	Running average of yes-or-no outcomes (Bernoulli trials): a strip of the
	first few outcomes as filled and open marks, and below it the running share
	of successes settling toward the true probability p.

	Data: one row per trial, in order, with the outcome (1 or 0) and the running
	share of successes after that trial.
	<RunningAverage data={kicks} trial="trial" outcome="outcome" running="running"
		p={0.75} strip={40} successLabel="Scored" failureLabel="Missed" unit="kicks" />
-->
<script lang="ts">
	import { scaleLinear, scaleLog } from 'd3-scale';
	import { line as d3line } from 'd3-shape';
	import Figure from './Figure.svelte';
	import AxisX from './AxisX.svelte';
	import AxisY from './AxisY.svelte';
	import Tooltip from './Tooltip.svelte';
	import { getMotion } from './motion.svelte';
	import { type Row, checkColumns, fmtNumber } from './util';

	interface RunNote {
		/** trial number the note points at */
		x: number;
		text: string;
		dx?: number;
		dy?: number;
	}

	interface Props {
		data: Row[];
		trial?: string;
		outcome?: string;
		running?: string;
		/** the true probability of success, drawn as a dashed reference line */
		p: number;
		/** how many of the first outcomes to show as marks */
		strip?: number;
		successLabel?: string;
		failureLabel?: string;
		/** what one trial is called, for labels: "kicks", "flips" */
		unit?: string;
		/** log scale on the trial axis (default true), so the early swings are visible */
		log?: boolean;
		/** bottom of the share axis; by default just low enough for the data and p */
		yMin?: number;
		notes?: RunNote[];
		height?: number;
		title?: string;
		subtitle?: string;
		source?: string;
		period?: string;
		note?: string;
	}

	let {
		data,
		trial = 'trial',
		outcome = 'outcome',
		running = 'running',
		p,
		strip = 40,
		successLabel = 'Success',
		failureLabel = 'Failure',
		unit = 'trials',
		log = true,
		yMin,
		notes = [],
		height = 300,
		title,
		subtitle,
		source,
		period,
		note
	}: Props = $props();

	const uid = $props.id();
	const motion = getMotion();
	$effect(() => checkColumns('RunningAverage', data, [trial, outcome, running]));

	const pct = (v: number) => `${Math.round(v * 100)}%`;
	const n = $derived(data.length);
	const shown = $derived(data.slice(0, Math.min(strip, n)));

	let w = $state(640);
	const left = 44;
	const right = 64;
	const innerW = $derived(Math.max(10, w - left - right));

	// ——— the strip of first outcomes ———
	const step = $derived(innerW / Math.max(1, shown.length));
	const r = $derived(Math.max(2.4, Math.min(6, step * 0.36)));
	const stripTop = 10;
	const stripH = $derived(2 * r + 6);
	const gap = 34;

	// ——— the running average ———
	const top = $derived(stripTop + stripH + gap);
	const bottom = 44;
	const innerH = $derived(Math.max(60, height - top - bottom));
	// (the share axis starts at `lo`, below)
	const xScale = $derived(
		log
			? scaleLog()
					.domain([1, Math.max(2, n)])
					.range([0, innerW])
			: scaleLinear()
					.domain([1, Math.max(2, n)])
					.range([0, innerW])
	);
	const xTicks = $derived(
		log
			? [1, 10, 100, 1000, 10000, 100000].filter((t) => t <= n)
			: xScale.ticks(Math.max(2, Math.floor(innerW / 85)))
	);
	// Bottom of the axis: a quarter-step below both the lowest running share and p.
	const lo = $derived.by(() => {
		if (yMin !== undefined) return yMin;
		let m = p;
		for (const d of data) if (typeof d[running] === 'number') m = Math.min(m, d[running]);
		return Math.max(0, Math.floor((m - 0.05) * 4) / 4);
	});
	const yScale = $derived(scaleLinear().domain([lo, 1]).range([innerH, 0]));
	const yTicks = $derived([0, 0.25, 0.5, 0.75, 1].filter((t) => t >= lo - 1e-9));
	const path = $derived(
		d3line<Row>()
			.x((d) => xScale(d[trial]))
			.y((d) => yScale(d[running]))(data) ?? ''
	);
	const xOf = (t: number) => xScale(Math.min(Math.max(t, 1), n));
	const rowAt = (t: number) => data[Math.min(Math.max(Math.round(t), 1), n) - 1];

	const placedNotes = $derived(
		notes
			.filter((nt) => nt.x >= 1 && nt.x <= n)
			.map((nt) => ({
				...nt,
				px: xOf(nt.x),
				py: yScale(rowAt(nt.x)[running]),
				dx: nt.dx ?? 14,
				dy: nt.dy ?? -30
			}))
	);

	// ——— motion: the line draws left to right ———
	const clipW = $derived(motion.reveal >= 1 ? innerW + right : motion.reveal * innerW + 1);

	// ——— hover ———
	let hover = $state<number | null>(null);
	let pointerY = $state(0);
	function onmove(e: PointerEvent) {
		const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
		const scale = innerW / rect.width;
		hover = Math.min(Math.max(Math.round(xScale.invert((e.clientX - rect.left) * scale)), 1), n);
		pointerY = (e.clientY - rect.top) * scale;
	}

	const legend = $derived([
		{ key: 'success', label: successLabel, color: 'var(--ink)', mark: 'dot' as const },
		{ key: 'failure', label: failureLabel, color: 'var(--ink)', mark: 'ring' as const }
	]);
</script>

<Figure {title} {subtitle} {source} {period} {note} {legend} toggleable={false}>
	<div bind:clientWidth={w}>
		<svg
			viewBox="0 0 {w} {height}"
			width="100%"
			role="img"
			aria-label={title ?? `Running share of successes over ${n} ${unit}`}
		>
			<defs>
				<clipPath id="{uid}-reveal">
					<rect x={-left} y={-top} width={left + clipW} height={height} />
				</clipPath>
			</defs>

			<!-- the first outcomes, one mark each -->
			<g transform="translate({left},{stripTop})">
				<text class="strip-label" x={0} y={-1}>First {shown.length} {unit}</text>
				{#each shown as d, i (i)}
					<circle
						class="mark"
						class:hit={d[outcome] === 1}
						cx={step * (i + 0.5)}
						cy={r + 6}
						{r}
					/>
				{/each}
				<text class="strip-tally" x={innerW + 8} y={r + 6} dy="0.32em"
					>{shown.filter((d) => d[outcome] === 1).length} of {shown.length}</text
				>
			</g>

			<g transform="translate({left},{top})">
				<text class="axis-title" x="0" y="-14">Share of {unit} so far</text>
				<AxisY scale={yScale} width={innerW} ticks={yTicks} format={pct} />
				<AxisX
					scale={xScale}
					height={innerH}
					width={innerW}
					ticks={xTicks}
					format={fmtNumber}
					label={`Number of ${unit}${log ? ' (log scale)' : ''}`}
				/>

				<line class="truth" x1="0" x2={innerW} y1={yScale(p)} y2={yScale(p)} />
				<text class="truth-label" x={innerW + 6} y={yScale(p)} dy="0.32em">p = {pct(p)}</text>

				<g clip-path="url(#{uid}-reveal)">
					<path d={path} class="run" />
				</g>

				{#each placedNotes as nt (nt.text)}
					<g class="note">
						<line x1={nt.px} y1={nt.py} x2={nt.px + nt.dx} y2={nt.py + nt.dy} />
						<circle cx={nt.px} cy={nt.py} r="3" />
						<text x={nt.px + nt.dx} y={nt.py + nt.dy - 4} text-anchor={nt.dx < 0 ? 'end' : 'start'}
							>{nt.text}</text
						>
					</g>
				{/each}

				{#if hover !== null}
					{@const hx = xOf(hover)}
					<line class="rule" x1={hx} x2={hx} y1="0" y2={innerH} />
					<circle class="dot" cx={hx} cy={yScale(rowAt(hover)[running])} r="4" />
				{/if}

				<rect
					class="hitbox"
					width={innerW}
					height={innerH}
					role="presentation"
					onpointermove={onmove}
					onpointerleave={() => (hover = null)}
				/>
			</g>
		</svg>

		{#if hover !== null}
			{@const row = rowAt(hover)}
			<Tooltip x={left + xOf(hover)} y={top + pointerY} width={w}>
				<span class="tip-head">After {fmtNumber(hover)} {hover === 1 ? unit.replace(/s$/, '') : unit}</span>
				<span class="tip-row"><span>Share so far</span><b>{pct(row[running])}</b></span>
				<span class="tip-row"
					><span>{successLabel}</span><b>{fmtNumber(Math.round(row[running] * hover))}</b></span
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
	.mark {
		fill: var(--paper);
		stroke: var(--ink);
		stroke-width: 1.3;
	}
	.mark.hit {
		fill: var(--ink);
	}
	.strip-label,
	.axis-title {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 13px;
		fill: var(--ink-soft);
	}
	.strip-tally {
		font-family: var(--font-type);
		font-size: 12px;
		fill: var(--ink-soft);
	}
	.truth {
		stroke: var(--accent);
		stroke-width: 1.4;
		stroke-dasharray: 5 4;
	}
	.truth-label {
		font-family: var(--font-type);
		font-size: 12px;
		font-weight: 600;
		fill: var(--accent);
	}
	.run {
		fill: none;
		stroke: var(--ink);
		stroke-width: 2.2;
		stroke-linejoin: round;
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
		fill: var(--ink);
		stroke: var(--paper);
		stroke-width: 1.5;
	}
	.hitbox {
		fill: transparent;
		cursor: crosshair;
	}
</style>
