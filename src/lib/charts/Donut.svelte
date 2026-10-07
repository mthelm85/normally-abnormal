<!--
	Donut (or pie, with inner={0}). Past six slices the colours repeat as hatching.
	<Donut data={rows} label="category" value="value" unit="hrs" />
-->
<script lang="ts">
	import { arc as d3arc, pie as d3pie } from 'd3-shape';
	import Figure from './Figure.svelte';
	import { getMotion, plateHeight } from './motion.svelte';
	import {
		type Fmt,
		type Row,
		PALETTE_SIZE,
		formatter,
		hatch,
		seriesColor,
		smartNumber,
		checkColumns
	} from './util';

	interface Props {
		data: Row[];
		label: string;
		value: string;
		/** inner radius as a share of the outer (0 = pie) */
		inner?: number;
		/** unit printed after values, e.g. "hrs" */
		unit?: string;
		format?: Fmt;
		/** caption in the hole when nothing is focused */
		center?: string;
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
		value,
		inner = 0.56,
		unit = '',
		format,
		center,
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
	$effect(() => checkColumns('Donut', data, [label, value]));
	const total = $derived(data.reduce((s, d) => s + (+d[value] || 0), 0));
	const pct = (v: number) => `${((v / total) * 100).toFixed(v / total < 0.1 ? 1 : 0)}%`;

	let w = $state(640);
	// The key sits beside the donut when there's room.
	const side = $derived(!compact && w >= 520);
	const plateH = plateHeight();
	const size = $derived(height ?? (compact ? plateH : side ? 300 : Math.min(w, 320)));
	const r = $derived(size / 2 - (compact ? 6 : 10));

	const slices = $derived(
		d3pie<Row>()
			.sort(null)
			.value((d) => +d[value] || 0)(data)
	);
	// The largest slices get solid colour; the small remainder is told apart by hatching.
	const rank = $derived.by(() => {
		const order = data.map((d, i) => ({ v: +d[value] || 0, i })).sort((a, b) => b.v - a.v);
		const r: number[] = [];
		order.forEach((o, k) => (r[o.i] = k));
		return r;
	});
	const fillOf = (i: number) => {
		const k = rank[i];
		return k < PALETTE_SIZE ? seriesColor(k) : hatch(k, k >= PALETTE_SIZE * 2);
	};
	const strokeOf = (i: number) => (rank[i] >= PALETTE_SIZE ? seriesColor(rank[i]) : 'var(--paper)');

	// The sweep: slices are clipped to an angle that grows with the reveal.
	const sweep = $derived(motion.reveal * Math.PI * 2);

	const cursorIdx = $derived(
		motion.cursor === null
			? null
			: Math.min(data.length - 1, Math.floor(motion.cursor * data.length))
	);
	let hover = $state<number | null>(null);
	const focus = $derived(hover ?? cursorIdx);

	const arcs = $derived(
		slices.map((s, i) => {
			const end = Math.min(s.endAngle, sweep);
			const lift = focus === i ? (compact ? 5 : 8) : 0;
			const mid = (s.startAngle + s.endAngle) / 2;
			const path =
				end > s.startAngle
					? (d3arc<any>()
							.innerRadius(r * inner)
							.outerRadius(r)
							.padAngle(0.006)({ startAngle: s.startAngle, endAngle: end }) ?? '')
					: '';
			return { i, path, dx: Math.sin(mid) * lift, dy: -Math.cos(mid) * lift };
		})
	);
	const focused = $derived(focus === null ? null : data[focus]);
</script>

<Figure {title} {subtitle} {source} {period} {note} {compact}>
	<div class="wrap" class:side bind:clientWidth={w}>
		<svg
			viewBox="0 0 {size} {size}"
			width={size}
			height={size}
			role="img"
			aria-label={title ?? 'Donut chart'}
		>
			<g transform="translate({size / 2},{size / 2})">
				{#each arcs as a (a.i)}
					<path
						d={a.path}
						transform="translate({a.dx},{a.dy})"
						class="slice"
						style:fill={fillOf(a.i)}
						style:stroke={strokeOf(a.i)}
						role="presentation"
						onpointerenter={compact ? undefined : () => (hover = a.i)}
						onpointerleave={compact ? undefined : () => (hover = null)}
					/>
				{/each}
				{#if inner > 0.3}
					<g class="hole" class:compact>
						{#if focused}
							<text class="big" dy="0.1em">{fmt(+focused[value])}{unit ? ` ${unit}` : ''}</text>
							<text class="small" dy={compact ? '1.6em' : '1.9em'}>{pct(+focused[value])}</text>
							<text class="name" dy={compact ? '-1.5em' : '-1.7em'}>{focused[label]}</text>
						{:else if center}
							<text class="name" dy="0.32em">{center}</text>
						{/if}
					</g>
				{/if}
			</g>
		</svg>

		{#if !compact}
			<ol class="key">
				{#each data as d, i (d[label])}
					<li
						class:focus={focus === i}
						onpointerenter={() => (hover = i)}
						onpointerleave={() => (hover = null)}
					>
						<svg width="14" height="12" aria-hidden="true">
							<rect
								width="14"
								height="12"
								style:fill={fillOf(i)}
								style:stroke={seriesColor(rank[i])}
								stroke-width="1"
							/>
						</svg>
						<span class="lab">{d[label]}</span>
						<span class="num">{fmt(+d[value])}{unit ? ` ${unit}` : ''}</span>
					</li>
				{/each}
			</ol>
		{/if}
	</div>
</Figure>

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}
	.wrap.side {
		flex-direction: row;
		align-items: center;
		justify-content: center;
		gap: 2rem;
	}
	svg {
		flex: none;
		overflow: visible;
	}
	.slice {
		stroke-width: 1;
		transition: transform 0.25s ease-out;
	}
	.hole text {
		text-anchor: middle;
		fill: var(--ink);
	}
	.big {
		font-family: var(--font-head);
		font-weight: 700;
		font-size: 26px;
	}
	.small {
		font-family: var(--font-type);
		font-size: 13px;
		fill: var(--ink-soft) !important;
	}
	.name {
		font-family: var(--font-body);
		font-style: italic;
		font-size: 15px;
	}
	.compact .big {
		font-size: 17px;
	}
	.compact .small {
		font-size: 10px;
	}
	.compact .name {
		font-size: 11px;
	}
	.key {
		list-style: none;
		margin: 0;
		padding: 0;
		min-width: 15rem;
		font-family: var(--font-type);
		font-size: 0.85rem;
	}
	.key li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.12rem 0;
		border-bottom: 1px dotted var(--ink-ghost);
		cursor: default;
	}
	.key li.focus {
		color: var(--accent);
		font-weight: 700;
	}
	.lab {
		flex: 1;
	}
	.num {
		font-variant-numeric: tabular-nums;
	}
</style>
