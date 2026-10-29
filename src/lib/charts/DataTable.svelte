<!--
	A numbered book table ("Table 2.1"): ruled like the figures, with a title above
	and a source line below. The rows come from a CSV whose cells are already
	formatted for display (Julia writes them), so the web page and the print
	edition show exactly the same text.

	<DataTable id="state-pair-table" data={rows} title="…" source="…" summary />

	The first column holds row labels; the rest are right-aligned. `summary` sets
	the last row apart (a ratio or a total). `number` and `anchor` are filled in at
	build time by src/lib/build/figures.js; refer to a table with <Fig ref="…" />.
-->
<script lang="ts">
	import type { Row } from './util';

	let {
		data,
		title,
		source,
		period,
		note,
		summary = false,
		number,
		anchor
	}: {
		data: Row[];
		title?: string;
		source?: string;
		period?: string;
		note?: string;
		/** set the last row apart, e.g. a ratio or total */
		summary?: boolean;
		number?: string;
		anchor?: string;
	} = $props();

	const cols = $derived(Object.keys(data[0] ?? {}));
</script>

<figure class="book-table" id={anchor}>
	{#if title || number}
		<figcaption class="head">
			{#if number}<span class="kicker">Table {number}</span>{/if}
			{#if title}<span class="title">{title}</span>{/if}
		</figcaption>
	{/if}
	<div class="scroll">
		<table>
			<thead>
				<tr>
					{#each cols as c, j (c)}
						<th class:label={j === 0} scope="col">{c}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each data as d, i (i)}
					<tr class:summary={summary && i === data.length - 1}>
						{#each cols as c, j (c)}
							{#if j === 0}
								<th class="label" scope="row">{d[c]}</th>
							{:else}
								<td>{d[c]}</td>
							{/if}
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	{#if source || note}
		<p class="source">
			{#if source}<span class="smallcaps">Source:</span>
				{source}{#if period}, {period}{/if}.{/if}
			{#if note}<span class="note">{note}.</span>{/if}
		</p>
	{/if}
</figure>

<style>
	.book-table {
		margin: 2.2rem 0 2.4rem;
		padding: 0.55rem 0 0.4rem;
		border-top: 3px solid var(--rule);
		border-bottom: 1px solid var(--rule);
		text-align: left;
		hyphens: manual;
		scroll-margin-top: 1.5rem;
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		margin-bottom: 0.6rem;
	}
	.kicker {
		font-family: var(--font-type);
		font-size: 0.8rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--accent);
	}
	.title {
		font-family: var(--font-head);
		font-weight: 700;
		font-size: 1.12rem;
		line-height: 1.2;
		text-wrap: balance;
	}
	.scroll {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-body);
		font-size: 1rem;
		font-variant-numeric: lining-nums tabular-nums;
	}
	th,
	td {
		padding: 0.3rem 0 0.3rem 0.9rem;
		text-align: right;
		white-space: nowrap;
	}
	.label {
		padding-left: 0;
		text-align: left;
		font-weight: 400;
	}
	thead th {
		font-family: var(--font-type);
		font-size: 0.78rem;
		font-weight: 400;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-soft);
		border-bottom: 1px solid var(--rule);
	}
	.summary th,
	.summary td {
		border-top: 1px solid var(--rule);
		font-style: italic;
	}
	/* Phones: tighter type and spacing so most tables fit without scrolling. */
	@media (max-width: 520px) {
		table {
			font-size: 0.86rem;
		}
		th,
		td {
			padding-left: 0.45rem;
		}
		thead th {
			font-size: 0.66rem;
			letter-spacing: 0.03em;
		}
	}
	.source {
		margin: 0.5rem 0 0;
		font-family: var(--font-type);
		font-size: 0.78rem;
		line-height: 1.35;
		color: var(--ink-faded);
	}
	.note {
		display: block;
		font-style: italic;
	}
</style>
