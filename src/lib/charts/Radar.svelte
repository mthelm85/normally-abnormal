<!--
	Radar / spider chart. One row per spoke, one column per series.
	<Radar data={rows} axis="category" y={['15-24', '65 & over']} domain={[-2, 2]} />
-->
<script lang="ts">
	import { scaleLinear } from 'd3-scale';
	import Figure from './Figure.svelte';
	import { easeOut, getMotion, plateHeight, stagger } from './motion.svelte';
	import { type Row, asArray, seriesColor, wrap, checkColumns } from './util';

	interface Props {
		data: Row[];
		/** column naming each spoke */
		axis: string;
		y: string | string[];
		labels?: Record<string, string>;
		domain?: [number, number];
		/** values to draw rings at (defaults to scale ticks) */
		rings?: number[];
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
		axis,
		y,
		labels = {},
		domain,
		rings,
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
	$effect(() => checkColumns('Radar', data, [axis, ...asArray(y)]));
	let hidden = $state(new Set<string>());
	const shown = $derived(keys.filter((k) => !hidden.has(k)));
	const colorOf = (k: string) => seriesColor(keys.indexOf(k));
	const nameOf = (k: string) => labels[k] ?? k;

	let w = $state(640);
	const plateH = plateHeight(160);
	const size = $derived(height ?? (compact ? plateH : Math.min(w, 460)));
	const pad = $derived(compact ? 10 : 70);
	const R = $derived(size / 2 - pad);
	const n = $derived(data.length);

	const rScale = $derived.by(() => {
		const vals = data.flatMap((d) => keys.map((k) => +d[k]));
		return scaleLinear()
			.domain(domain ?? [Math.min(0, ...vals), Math.max(...vals)])
			.range([0, R]);
	});
	const ringValues = $derived(rings ?? rScale.ticks(4));
	const angle = (i: number) => (i / n) * Math.PI * 2 - Math.PI / 2;
	const pt = (i: number, v: number) => [
		Math.cos(angle(i)) * rScale(v),
		Math.sin(angle(i)) * rScale(v)
	];

	const cursorIdx = $derived(
		motion.cursor === null
			? null
			: Math.min(shown.length - 1, Math.floor(motion.cursor * shown.length))
	);
	let hover = $state<string | null>(null);
	const focusKey = $derived(hover ?? (cursorIdx === null ? null : shown[cursorIdx]));

	const polys = $derived(
		shown.map((k, si) => {
			const p = easeOut(stagger(motion.reveal, si, shown.length, 0.5));
			const [lo] = rScale.domain();
			const points = data.map((d, i) => {
				const v = lo + (+d[k] - lo) * p;
				return pt(i, v).join(',');
			});
			return { k, points: points.join(' ') };
		})
	);

	const legend = $derived(
		keys.map((k) => ({ key: k, label: nameOf(k), color: colorOf(k), mark: 'line' as const }))
	);
</script>

<Figure {title} {subtitle} {source} {period} {note} {legend} {compact} bind:hidden>
	<div class="wrap" bind:clientWidth={w}>
		<svg
			viewBox="0 0 {size} {size}"
			width={size}
			height={size}
			role="img"
			aria-label={title ?? 'Radar chart'}
		>
			<g transform="translate({size / 2},{size / 2})">
				{#each ringValues as v (v)}
					<polygon
						class="ring"
						class:zero={v === 0}
						points={data.map((_, i) => pt(i, v).join(',')).join(' ')}
					/>
				{/each}
				{#each data as d, i (d[axis])}
					{@const [ex, ey] = [Math.cos(angle(i)) * R, Math.sin(angle(i)) * R]}
					<line class="spoke" x2={ex} y2={ey} />
					{#if !compact}
						{@const lx = Math.cos(angle(i)) * (R + 12)}
						{@const ly = Math.sin(angle(i)) * (R + 12)}
						{@const lines = wrap(String(d[axis]), 13, 2)}
						<text
							class="spoke-label"
							x={lx}
							y={ly - ((lines.length - 1) * 12) / 2}
							text-anchor={Math.abs(lx) < 8 ? 'middle' : lx > 0 ? 'start' : 'end'}
						>
							{#each lines as line, j (j)}
								<tspan x={lx} dy={j === 0 ? '0.32em' : 12}>{line}</tspan>
							{/each}
						</text>
					{/if}
				{/each}
				{#each polys as p (p.k)}
					<polygon
						class="poly"
						class:dim={focusKey !== null && focusKey !== p.k}
						class:focus={focusKey === p.k}
						points={p.points}
						style:stroke={colorOf(p.k)}
						style:fill={colorOf(p.k)}
						role="presentation"
						onpointerenter={compact ? undefined : () => (hover = p.k)}
						onpointerleave={compact ? undefined : () => (hover = null)}
					/>
				{/each}
				{#if compact && focusKey}
					<text class="tag" y={size / 2 - 2}>{nameOf(focusKey)}</text>
				{/if}
			</g>
		</svg>
	</div>
</Figure>

<style>
	.wrap {
		display: flex;
		justify-content: center;
	}
	svg {
		overflow: visible;
	}
	.ring {
		fill: none;
		stroke: var(--ink-ghost);
		stroke-width: 0.8;
		stroke-dasharray: 1 3;
	}
	.ring.zero {
		stroke: var(--ink-faded);
		stroke-dasharray: none;
	}
	.spoke {
		stroke: var(--ink-ghost);
		stroke-width: 0.8;
	}
	.spoke-label {
		font-family: var(--font-type);
		font-size: 11.5px;
		fill: var(--ink-soft);
	}
	.poly {
		stroke-width: 1.8;
		stroke-linejoin: round;
		fill-opacity: 0.06;
		transition:
			opacity 0.25s,
			fill-opacity 0.25s;
	}
	.poly.dim {
		opacity: 0.18;
	}
	.poly.focus {
		fill-opacity: 0.16;
		stroke-width: 2.4;
	}
	.tag {
		text-anchor: middle;
		font-family: var(--font-type);
		font-size: 10.5px;
		font-weight: 600;
		fill: var(--ink);
	}
</style>
