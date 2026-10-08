<!--
	Running average of yes-or-no outcomes (Bernoulli trials), in two panels that
	share one value axis:
	  1. the first few trials, each outcome drawn as a mark directly above its
	     point on the running line, so every miss and hit visibly moves it;
	  2. every trial, with the first panel's stretch shaded, as the running
	     share settles toward the true probability p.

	Data: one row per trial, in order, with the outcome (1 or 0) and the running
	share of successes after that trial.
	<RunningAverage data={kicks} p={0.75} strip={40} unit="kicks"
		successLabel="Scored" failureLabel="Missed" />
-->
<script lang="ts">
	import { scaleLinear } from 'd3-scale';
	import { line as d3line } from 'd3-shape';
	import Figure from './Figure.svelte';
	import AxisX from './AxisX.svelte';
	import AxisY from './AxisY.svelte';
	import Tooltip from './Tooltip.svelte';
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
		/** how many of the first trials the top panel shows */
		strip?: number;
		successLabel?: string;
		failureLabel?: string;
		/** what one trial is called, for labels: "kicks", "flips" */
		unit?: string;
		/** bottom of the share axis; by default just low enough for the data and p */
		yMin?: number;
		/** notes on the running line; each goes in whichever panel can show it (top first) */
		notes?: RunNote[];
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
		yMin,
		notes = [],
		title,
		subtitle,
		source,
		period,
		note
	}: Props = $props();

	$effect(() => checkColumns('RunningAverage', data, [trial, outcome, running]));

	const pct = (v: number) => `${Math.round(v * 100)}%`;
	const n = $derived(data.length);
	const m = $derived(Math.min(strip, n));
	const first = $derived(data.slice(0, m));
	const one = $derived(unit.replace(/s$/, ''));

	let w = $state(640);
	const left = 44;
	const right = 64;
	const innerW = $derived(Math.max(10, w - left - right));

	// ——— shared value axis ———
	const lo = $derived.by(() => {
		if (yMin !== undefined) return yMin;
		let v = p;
		for (const d of data) if (typeof d[running] === 'number') v = Math.min(v, d[running]);
		return Math.max(0, Math.floor((v - 0.05) * 4) / 4);
	});
	const yTicks = $derived([0, 0.25, 0.5, 0.75, 1].filter((t) => t >= lo - 1e-9));
	const plotH = 150;
	const yScale = $derived(scaleLinear().domain([lo, 1]).range([plotH, 0]));

	// ——— panel geometry ———
	const r = $derived(Math.max(2.4, Math.min(6, (innerW / Math.max(1, m)) * 0.36)));
	const marksY = $derived(r + 2); // marks row, inside panel A
	const lineTopA = $derived(2 * r + 22); // panel A's line area starts below the marks
	const topA = 30;
	const heightA = $derived(lineTopA + plotH + 40);
	const topB = $derived(topA + heightA + 34);
	const heightB = $derived(plotH + 44);
	const totalH = $derived(topB + heightB + 6);

	const xA = $derived(scaleLinear().domain([1, Math.max(2, m)]).range([0, innerW]));
	const xB = $derived(scaleLinear().domain([1, Math.max(2, n)]).range([0, innerW]));
	const ticksA = $derived([1, ...xA.ticks(Math.max(2, Math.floor(innerW / 70)))].filter((t, i, a) => t >= 1 && a.indexOf(t) === i && Number.isInteger(t)));
	const ticksB = $derived([1, ...xB.ticks(Math.max(2, Math.floor(innerW / 85)))].filter((t, i, a) => t >= 1 && a.indexOf(t) === i && Number.isInteger(t)));

	const lineFor = (x: (v: number) => number, rows: Row[]) =>
		d3line<Row>()
			.x((d) => x(d[trial]))
			.y((d) => yScale(d[running]))(rows) ?? '';
	const pathA = $derived(lineFor(xA, first));
	const pathB = $derived(lineFor(xB, data));
	const rowAt = (t: number) => data[Math.min(Math.max(Math.round(t), 1), n) - 1];

	const notesA = $derived(notes.filter((nt) => nt.x >= 1 && nt.x <= m));
	const notesB = $derived(notes.filter((nt) => nt.x > m && nt.x <= n));
	const place = (nt: RunNote, x: (v: number) => number) => ({
		...nt,
		px: x(nt.x),
		py: yScale(rowAt(nt.x)[running]),
		dx: nt.dx ?? 14,
		dy: nt.dy ?? -30
	});

	// ——— hover (either panel) ———
	let hover = $state<{ panel: 'A' | 'B'; t: number } | null>(null);
	let pointerY = $state(0);
	function mover(panel: 'A' | 'B') {
		return (e: PointerEvent) => {
			const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
			const scale = innerW / rect.width;
			const x = panel === 'A' ? xA : xB;
			const max = panel === 'A' ? m : n;
			const t = Math.min(Math.max(Math.round(x.invert((e.clientX - rect.left) * scale)), 1), max);
			hover = { panel, t };
			pointerY = (e.clientY - rect.top) * scale + (panel === 'A' ? topA + lineTopA : topB);
		};
	}
	const hoverX = $derived(hover ? (hover.panel === 'A' ? xA : xB)(hover.t) : 0);

	const legend = $derived([
		{ key: 'success', label: successLabel, color: 'var(--ink)', mark: 'dot' as const },
		{ key: 'failure', label: failureLabel, color: 'var(--ink)', mark: 'ring' as const }
	]);
</script>

<Figure {title} {subtitle} {source} {period} {note} {legend} toggleable={false}>
	<div bind:clientWidth={w}>
		<svg
			viewBox="0 0 {w} {totalH}"
			width="100%"
			role="img"
			aria-label={title ?? `Running share of successes over ${n} ${unit}`}
		>
			{#snippet truth(x2: number)}
				<line class="truth" x1="0" {x2} y1={yScale(p)} y2={yScale(p)} />
				<text class="truth-label" x={x2 + 6} y={yScale(p)} dy="0.32em">p = {pct(p)}</text>
			{/snippet}

			{#snippet noteMark(nt: ReturnType<typeof place>)}
				<g class="note">
					<line x1={nt.px} y1={nt.py} x2={nt.px + nt.dx} y2={nt.py + nt.dy} />
					<circle cx={nt.px} cy={nt.py} r="3" />
					<text x={nt.px + nt.dx} y={nt.py + nt.dy - 4} text-anchor={nt.dx < 0 ? 'end' : 'start'}
						>{nt.text}</text
					>
				</g>
			{/snippet}

			<!-- Panel A: the first few trials, marks aligned with the line below them -->
			<g transform="translate({left},{topA})">
				<text class="panel-title" x="0" y="-12">The first {m} {unit}</text>
				{#each first as d, i (i)}
					{@const cx = xA(d[trial])}
					<line class="tie" x1={cx} x2={cx} y1={marksY + r + 2} y2={lineTopA - 4} />
					<circle class="mark" class:hit={d[outcome] === 1} {cx} cy={marksY} {r} />
				{/each}
				<text class="tally" x={innerW + 8} y={marksY} dy="0.32em"
					>{first.filter((d) => d[outcome] === 1).length} of {m}</text
				>

				<g transform="translate(0,{lineTopA})">
					<AxisY scale={yScale} width={innerW} ticks={yTicks} format={pct} />
					<AxisX scale={xA} height={plotH} width={innerW} ticks={ticksA} format={fmtNumber} label={`${unit[0].toUpperCase()}${unit.slice(1)} taken`} />
					{@render truth(innerW)}
					<path d={pathA} class="run" />
					{#each first as d, i (i)}
						<circle class="step" cx={xA(d[trial])} cy={yScale(d[running])} r="2" />
					{/each}
					{#each notesA as nt (nt.text)}{@render noteMark(place(nt, xA))}{/each}
					{#if hover?.panel === 'A'}
						<line class="rule" x1={hoverX} x2={hoverX} y1={-lineTopA + marksY} y2={plotH} />
					{/if}
					<rect class="hitbox" y={-lineTopA} width={innerW} height={plotH + lineTopA} role="presentation"
						onpointermove={mover('A')} onpointerleave={() => (hover = null)} />
				</g>
			</g>

			<!-- Panel B: every trial, the first panel's stretch shaded -->
			<g transform="translate({left},{topB})">
				<text class="panel-title" x="0" y="-12">All {fmtNumber(n)} {unit}</text>
				<rect class="shade" x="0" y="0" width={xB(m)} height={plotH} />
				<text class="shade-label" x={xB(m) + 5} y={plotH - 6}>first {m}</text>
				<AxisY scale={yScale} width={innerW} ticks={yTicks} format={pct} />
				<AxisX scale={xB} height={plotH} width={innerW} ticks={ticksB} format={fmtNumber} label={`${unit[0].toUpperCase()}${unit.slice(1)} taken`} />
				{@render truth(innerW)}
				<path d={pathB} class="run" />
				{#each notesB as nt (nt.text)}{@render noteMark(place(nt, xB))}{/each}
				{#if hover?.panel === 'B'}
					<line class="rule" x1={hoverX} x2={hoverX} y1="0" y2={plotH} />
					<circle class="dot" cx={hoverX} cy={yScale(rowAt(hover.t)[running])} r="4" />
				{/if}
				<rect class="hitbox" width={innerW} height={plotH} role="presentation"
					onpointermove={mover('B')} onpointerleave={() => (hover = null)} />
			</g>
		</svg>

		{#if hover}
			{@const row = rowAt(hover.t)}
			<Tooltip x={left + hoverX} y={pointerY} width={w}>
				<span class="tip-head">After {fmtNumber(hover.t)} {hover.t === 1 ? one : unit}</span>
				{#if hover.panel === 'A'}
					<span class="tip-row"><span>This {one}</span><b>{row[outcome] === 1 ? successLabel : failureLabel}</b></span>
				{/if}
				<span class="tip-row"><span>Share so far</span><b>{pct(row[running])}</b></span>
				<span class="tip-row"><span>{successLabel}</span><b>{fmtNumber(Math.round(row[running] * hover.t))} of {fmtNumber(hover.t)}</b></span>
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
	.mark {
		fill: var(--paper);
		stroke: var(--ink);
		stroke-width: 1.3;
	}
	.mark.hit {
		fill: var(--ink);
	}
	.tie {
		stroke: var(--ink-ghost);
		stroke-width: 0.7;
		stroke-dasharray: 1 2;
	}
	.tally {
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
	.step {
		fill: var(--ink);
	}
	.shade {
		fill: var(--ink);
		fill-opacity: 0.06;
	}
	.shade-label {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 12px;
		fill: var(--ink-faded);
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
