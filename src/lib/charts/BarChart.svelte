<!--
	Bar chart — vertical or horizontal, one or more series (grouped).
	<BarChart data={rows} x="category" y="Share (%)" horizontal highlight={['Haiti']} />
-->
<script lang="ts">
	import { scaleBand, scaleLinear } from 'd3-scale';
	import Figure from './Figure.svelte';
	import AxisX from './AxisX.svelte';
	import AxisY from './AxisY.svelte';
	import Tooltip from './Tooltip.svelte';
	import { easeBack, getMotion, plateHeight, stagger } from './motion.svelte';
	import {
		type Fmt,
		type Row,
		asArray,
		formatter,
		hatch,
		seriesColor,
		smartNumber,
		textWidth,
		wrap,
		checkColumns
	} from './util';

	interface Props {
		data: Row[];
		/** category column */
		x: string;
		/** value column(s) */
		y: string | string[];
		labels?: Record<string, string>;
		horizontal?: boolean;
		/** value-axis title */
		valueLabel?: string;
		domain?: [number, number];
		format?: Fmt;
		/** categories to pick out in the accent colour (single series) */
		highlight?: string[];
		/** shade with hatching instead of solid ink */
		hatched?: boolean;
		/** print values at the bar ends (default: when it fits) */
		values?: boolean;
		colors?: string[];
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
		horizontal = false,
		valueLabel,
		domain,
		format,
		highlight = [],
		hatched = false,
		values,
		colors,
		height,
		compact = false,
		title,
		subtitle,
		source,
		period,
		note
	}: Props = $props();

	const motion = getMotion();
	const keys = $derived(asArray(y));
	$effect(() => checkColumns('BarChart', data, [x, ...asArray(y)]));
	let hidden = $state(new Set<string>());
	const shown = $derived(keys.filter((k) => !hidden.has(k)));
	const nameOf = (k: string) => labels[k] ?? k;
	const colorOf = (k: string) => colors?.[keys.indexOf(k)] ?? seriesColor(keys.indexOf(k));
	const fmt = $derived(formatter(format, smartNumber));

	const cats = $derived(data.map((d) => String(d[x])));
	const n = $derived(cats.length);

	let w = $state(640);

	// ——— layout ———
	const maxValue = $derived(Math.max(0, ...data.flatMap((d) => shown.map((k) => +d[k] || 0))));
	const vDomain = $derived((domain ?? [0, maxValue]) as [number, number]);
	const showValues = $derived(
		values ?? (horizontal ? shown.length <= 3 && n <= 30 : n * shown.length <= 16)
	);

	// Horizontal: category labels sit in a left gutter, wrapped to two lines.
	const labelChars = $derived(
		Math.max(10, Math.floor((w * (compact ? 0.32 : 0.34)) / (compact ? 5 : 6.2)))
	);
	const wrapped = $derived(cats.map((c) => wrap(c, labelChars, compact ? 1 : 2)));
	const twoLine = $derived(wrapped.some((l) => l.length > 1));
	const plateH = plateHeight();
	// Compact rows stretch to fill the plate, but never shrink below legibility.
	const rowH = $derived(
		compact ? Math.max(11, (plateH - 16) / n) : Math.max(twoLine ? 30 : 22, shown.length * 9 + 8)
	);

	const left = $derived(
		horizontal
			? Math.min(
					w * 0.4,
					Math.max(...wrapped.flat().map((s) => textWidth(s, compact ? 9.5 : 12))) + 10
				)
			: compact
				? 2
				: Math.max(...vTicksFor(vDomain).map((t) => textWidth(fmt(t)))) + 12
	);
	const top = $derived(compact ? 12 : horizontal ? 6 : valueLabel ? 28 : 12);
	const bottom = $derived(
		compact ? (horizontal ? 4 : 28) : horizontal ? (valueLabel ? 44 : 28) : 42
	);
	const right = $derived(horizontal && showValues ? (compact ? 26 : 40) : compact ? 4 : 14);
	const h = $derived(height ?? (horizontal ? n * rowH + top + bottom : compact ? plateH : 320));
	const innerW = $derived(Math.max(10, w - left - right));
	const innerH = $derived(h - top - bottom);

	function vTicksFor(d: [number, number]) {
		return scaleLinear()
			.domain(d)
			.nice()
			.ticks(compact ? 3 : 5);
	}

	const vScale = $derived.by(() => {
		const s = scaleLinear()
			.domain(vDomain)
			.range(horizontal ? [0, innerW] : [innerH, 0]);
		return domain ? s : s.nice(compact ? 3 : 5);
	});
	const cScale = $derived(
		scaleBand()
			.domain(cats)
			.range(horizontal ? [0, innerH] : [0, innerW])
			.paddingInner(shown.length > 1 ? 0.28 : compact ? 0.22 : 0.3)
			.paddingOuter(0.15)
	);
	const sScale = $derived(scaleBand().domain(shown).range([0, cScale.bandwidth()]).padding(0.06));

	// ——— motion ———
	const cursorIdx = $derived(
		motion.cursor === null ? null : Math.min(n - 1, Math.floor(motion.cursor * n))
	);
	let hover = $state<{ i: number; px: number; py: number } | null>(null);
	const focus = $derived(hover?.i ?? cursorIdx);

	const fillOf = (k: string, cat: string, i: number) => {
		if (shown.length === 1 && highlight.length)
			return highlight.includes(cat) ? 'var(--accent)' : colorOf(k);
		if (shown.length === 1 && focus === i && cursorIdx !== null) return 'var(--accent)';
		return hatched ? hatch(keys.indexOf(k)) : colorOf(k);
	};

	const bars = $derived(
		data.flatMap((d, i) =>
			shown.map((k) => {
				const v = +d[k] || 0;
				const p = easeBack(stagger(motion.reveal, i, n, 0.55));
				const len = Math.abs(vScale(v) - vScale(0)) * Math.max(0, p);
				const band = cScale(cats[i])! + sScale(k)!;
				const bw = sScale.bandwidth();
				return horizontal
					? {
							i,
							k,
							v,
							cat: cats[i],
							x: vScale(0),
							y: band,
							w: len,
							h: bw,
							end: vScale(0) + len,
							mid: band + bw / 2
						}
					: {
							i,
							k,
							v,
							cat: cats[i],
							x: band,
							y: vScale(0) - len,
							w: bw,
							h: len,
							end: vScale(0) - len,
							mid: band + bw / 2
						};
			})
		)
	);

	function enter(e: PointerEvent, i: number) {
		const svg = (e.currentTarget as SVGElement).ownerSVGElement!;
		const r = svg.getBoundingClientRect();
		hover = { i, px: e.clientX - r.left, py: e.clientY - r.top };
	}

	const legend = $derived(
		keys.map((k) => ({
			key: k,
			label: nameOf(k),
			color: colorOf(k),
			mark: hatched ? ('hatch' as const) : ('block' as const)
		}))
	);
</script>

<Figure {title} {subtitle} {source} {period} {note} {legend} {compact} bind:hidden>
	<div bind:clientWidth={w}>
		<svg viewBox="0 0 {w} {h}" width="100%" role="img" aria-label={title ?? nameOf(keys[0])}>
			<g transform="translate({left},{top})">
				{#if horizontal}
					<AxisX
						scale={vScale}
						height={innerH}
						width={innerW}
						format={fmt}
						label={valueLabel}
						grid
						baseline={false}
						{compact}
					/>
					{#each wrapped as lines, i (cats[i])}
						{@const cy = cScale(cats[i])! + cScale.bandwidth() / 2}
						<text
							class="cat"
							class:compact
							class:focus={focus === i}
							x="-8"
							y={cy - ((lines.length - 1) * (compact ? 9 : 13)) / 2}
							text-anchor="end"
						>
							{#each lines as line, j (j)}
								<tspan x="-8" dy={j === 0 ? '0.32em' : compact ? 9 : 13}>{line}</tspan>
							{/each}
						</text>
					{/each}
					<line class="base" y1="0" y2={innerH} x1={vScale(0)} x2={vScale(0)} />
				{:else}
					<AxisY
						scale={vScale}
						width={innerW}
						format={fmt}
						label={valueLabel}
						ticks={compact ? 3 : 5}
						{compact}
					/>
					<AxisX scale={cScale} height={innerH} width={innerW} {compact} />
				{/if}

				{#each bars as b (b.cat + b.k)}
					<rect
						class="bar"
						class:dim={focus !== null && focus !== b.i && (hover !== null || (compact && shown.length > 1))}
						x={b.x}
						y={b.y}
						width={Math.max(0, b.w)}
						height={Math.max(0, b.h)}
						style:fill={fillOf(b.k, b.cat, b.i)}
						style:stroke={hatched ? colorOf(b.k) : 'none'}
						role="presentation"
						onpointermove={compact ? undefined : (e) => enter(e, b.i)}
						onpointerleave={compact ? undefined : () => (hover = null)}
					/>
					{#if (showValues && !compact && motion.reveal >= 1) || (compact && focus === b.i && shown.length === 1)}
						{#if horizontal}
							<text
								class="val"
								class:compact
								class:focus={focus === b.i}
								x={b.end + 4}
								y={b.mid}
								dy="0.32em">{fmt(b.v)}</text
							>
						{:else}
							<text
								class="val"
								class:compact
								class:focus={focus === b.i}
								x={b.mid}
								y={b.end - 5}
								text-anchor="middle">{fmt(b.v)}</text
							>
						{/if}
					{/if}
				{/each}
			</g>
		</svg>

		{#if hover !== null}
			<Tooltip x={hover.px} y={hover.py} width={w}>
				<span class="tip-head">{cats[hover.i]}</span>
				{#each shown as k (k)}
					<span class="tip-row">
						<span><span class="swatch" style:background={colorOf(k)}></span>{nameOf(k)}</span>
						<b>{fmt(data[hover.i][k])}</b>
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
	.bar {
		stroke-width: 0.8;
		transition: opacity 0.15s;
	}
	.bar.dim {
		opacity: 0.45;
	}
	.cat {
		font-family: var(--font-type);
		font-size: 12px;
		fill: var(--ink);
	}
	.cat.compact {
		font-size: 9.5px;
		fill: var(--ink-soft);
	}
	.cat.focus {
		font-weight: 700;
	}
	.val {
		font-family: var(--font-type);
		font-size: 11px;
		fill: var(--ink-soft);
	}
	.val.compact {
		font-size: 10px;
	}
	.val.focus {
		fill: var(--accent);
		font-weight: 700;
	}
	.base {
		stroke: var(--ink);
		stroke-width: 1.2;
	}
</style>
