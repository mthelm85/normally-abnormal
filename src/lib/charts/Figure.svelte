<!--
	Newspaper chart furniture: ruled heading, legend key, plot, and source line.
	Every house chart renders inside one; custom article charts can too.
-->
<script lang="ts" module>
	export interface LegendItem {
		key: string;
		label?: string;
		color: string;
		/** swatch shape */
		mark?: 'line' | 'block' | 'hatch' | 'dot' | 'ring';
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { hatch } from './util';

	let {
		title,
		subtitle,
		source,
		period,
		note,
		legend = [],
		hidden = $bindable(new Set<string>()),
		toggleable = true,
		compact = false,
		children
	}: {
		title?: string;
		subtitle?: string;
		source?: string;
		period?: string;
		note?: string;
		legend?: LegendItem[];
		hidden?: Set<string>;
		toggleable?: boolean;
		compact?: boolean;
		children: Snippet;
	} = $props();

	function toggle(key: string) {
		const next = new Set(hidden);
		if (next.has(key)) next.delete(key);
		// Never hide the last visible series.
		else if (legend.length - next.size > 1) next.add(key);
		hidden = next;
	}

	const hatchIndex = (color: string) => Number(color.match(/series-(\d)/)?.[1] ?? 0);
</script>

<figure class="figure" class:compact>
	{#if title && !compact}
		<figcaption class="head">
			<span class="title">{title}</span>
			{#if subtitle}<span class="subtitle">{subtitle}</span>{/if}
		</figcaption>
	{/if}

	{#if legend.length > 1 && !compact}
		<div class="legend" role="group" aria-label="Legend">
			{#each legend as item (item.key)}
				{@const off = hidden.has(item.key)}
				<button
					type="button"
					class="key"
					class:off
					disabled={!toggleable}
					aria-pressed={!off}
					onclick={() => toggle(item.key)}
					title={toggleable ? (off ? 'Show' : 'Hide') + ' this series' : undefined}
				>
					<svg width="22" height="12" aria-hidden="true">
						{#if (item.mark ?? 'line') === 'line'}
							<line x1="1" x2="21" y1="6" y2="6" style:stroke={item.color} stroke-width="2.4" />
						{:else if item.mark === 'hatch'}
							<rect
								x="1"
								y="1"
								width="20"
								height="10"
								style:fill={hatch(hatchIndex(item.color))}
								style:stroke={item.color}
								stroke-width="1"
							/>
						{:else if item.mark === 'dot'}
							<circle cx="11" cy="6" r="4.5" style:fill={item.color} />
						{:else if item.mark === 'ring'}
							<circle
								cx="11"
								cy="6"
								r="4"
								fill="var(--paper)"
								style:stroke={item.color}
								stroke-width="1.6"
							/>
						{:else}
							<rect x="1" y="1" width="20" height="10" style:fill={item.color} />
						{/if}
					</svg>
					<span>{item.label ?? item.key}</span>
				</button>
			{/each}
		</div>
	{/if}

	<div class="plot">{@render children()}</div>

	{#if (source || note) && !compact}
		<p class="source">
			{#if source}<span class="smallcaps">Source:</span>
				{source}{#if period}, {period}{/if}.{/if}
			{#if note}<span class="note">{note}.</span>{/if}
		</p>
	{/if}
</figure>

<style>
	.figure {
		margin: 2.2rem 0 2.4rem;
		padding: 0.55rem 0 0.4rem;
		border-top: 3px solid var(--rule);
		border-bottom: 1px solid var(--rule);
		text-align: left;
		hyphens: manual;
	}
	.figure.compact {
		margin: 0;
		padding: 0;
		border: 0;
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		margin-bottom: 0.4rem;
	}
	.title {
		font-family: var(--font-head);
		font-weight: 700;
		font-size: 1.12rem;
		line-height: 1.2;
		text-wrap: balance;
	}
	.subtitle {
		font-style: italic;
		font-size: 0.95rem;
		color: var(--ink-soft);
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.15rem 0.9rem;
		margin: 0.25rem 0 0.4rem;
	}
	.key {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.1rem 0;
		background: none;
		border: 0;
		font-family: var(--font-type);
		font-size: 0.82rem;
		color: var(--ink);
		cursor: pointer;
		transition: opacity 0.2s;
	}
	.key:disabled {
		cursor: default;
	}
	.key svg {
		flex: none;
	}
	.key.off {
		opacity: 0.35;
		text-decoration: line-through;
	}
	.plot {
		position: relative;
	}
	.source {
		margin: 0.5rem 0 0;
		font-family: var(--font-type);
		font-size: 0.78rem;
		line-height: 1.35;
		color: var(--ink-faded);
		text-align: left;
	}
	.note {
		display: block;
		font-style: italic;
	}
</style>
