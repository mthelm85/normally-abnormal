<!--
	Tabular matter, set like a newspaper stock table. Sortable by column;
	long tables fold after `rows` lines.
	<Table data={rows} rows={12} />
-->
<script lang="ts">
	import type { Row } from './util';

	let {
		data,
		columns,
		rows = 12,
		title,
		source
	}: { data: Row[]; columns?: string[]; rows?: number; title?: string; source?: string } = $props();

	const cols = $derived(columns ?? Object.keys(data[0] ?? {}));
	let sortBy: string | null = $state(null);
	let desc = $state(false);
	let open = $state(false);

	// "3.2%" and "1,024" sort as numbers.
	const num = (v: unknown) => {
		const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[,%$]/g, ''));
		return Number.isNaN(n) ? null : n;
	};
	const numeric = $derived(
		Object.fromEntries(cols.map((c) => [c, data.every((d) => num(d[c]) !== null)]))
	);

	const sorted = $derived.by(() => {
		if (!sortBy) return data;
		const c = sortBy;
		return [...data].sort((a, b) => {
			const r = numeric[c] ? num(a[c])! - num(b[c])! : String(a[c]).localeCompare(String(b[c]));
			return desc ? -r : r;
		});
	});
	const visible = $derived(open ? sorted : sorted.slice(0, rows));

	function sort(c: string) {
		if (sortBy === c) desc = !desc;
		else {
			sortBy = c;
			desc = numeric[c];
		}
	}
</script>

<figure class="table">
	{#if title}<figcaption>{title}</figcaption>{/if}
	<table>
		<thead>
			<tr>
				{#each cols as c (c)}
					<th
						class:num={numeric[c]}
						aria-sort={sortBy === c ? (desc ? 'descending' : 'ascending') : 'none'}
					>
						<button type="button" onclick={() => sort(c)}>
							{c}<span class="arrow">{sortBy === c ? (desc ? '▾' : '▴') : ''}</span>
						</button>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each visible as d, i (i)}
				<tr>
					{#each cols as c (c)}
						<td class:num={numeric[c]}>{d[c]}</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
	{#if data.length > rows}
		<button type="button" class="more" onclick={() => (open = !open)}>
			{open ? 'Fold the table ▴' : `Continued — show all ${data.length} rows ▾`}
		</button>
	{/if}
	{#if source}<p class="source"><span class="smallcaps">Source:</span> {source}.</p>{/if}
</figure>

<style>
	.table {
		margin: 2rem 0;
		border-top: 3px solid var(--rule);
		border-bottom: 1px solid var(--rule);
		padding: 0.4rem 0;
	}
	figcaption {
		font-family: var(--font-head);
		font-weight: 700;
		font-size: 1.1rem;
		margin-bottom: 0.3rem;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-type);
		font-size: 0.9rem;
		font-variant-numeric: tabular-nums lining-nums;
	}
	th {
		border-bottom: 1px solid var(--rule);
		text-align: left;
		padding: 0;
	}
	th button {
		width: 100%;
		padding: 0.3rem 0.4rem;
		background: none;
		border: 0;
		font: inherit;
		font-weight: 700;
		font-variant-caps: all-small-caps;
		letter-spacing: 0.06em;
		text-align: inherit;
		cursor: pointer;
	}
	th.num {
		text-align: right;
	}
	.arrow {
		display: inline-block;
		width: 1em;
		color: var(--accent);
	}
	td {
		padding: 0.18rem 0.4rem;
		border-bottom: 1px dotted var(--ink-ghost);
	}
	td.num {
		text-align: right;
	}
	tbody tr:hover {
		background: var(--paper-deep);
	}
	.more {
		display: block;
		margin: 0.5rem auto 0.2rem;
		background: none;
		border: 0;
		font-family: var(--font-type);
		font-size: 0.85rem;
		color: var(--ink-soft);
		cursor: pointer;
		border-bottom: 1px dotted var(--ink-faded);
	}
	.source {
		font-family: var(--font-type);
		font-size: 0.78rem;
		color: var(--ink-faded);
		margin: 0.4rem 0 0;
	}
</style>
