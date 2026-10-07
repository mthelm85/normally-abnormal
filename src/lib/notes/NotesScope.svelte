<!-- Gives a chapter its own note list, renders the chapter, then lists the notes. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { NoteList, setNotes } from './notes.svelte';

	let { children }: { children: Snippet } = $props();
	const notes = setNotes(new NoteList());
</script>

{@render children()}

{#if notes.items.length}
	<section class="notes" aria-labelledby="notes-head">
		<h2 id="notes-head">Notes</h2>
		<ol>
			{#each notes.items as item (item.id)}
				<li id={item.id}>
					{@render item.content()}
					<a href="#{item.ref}" class="back" aria-label="Back to the text">↩</a>
				</li>
			{/each}
		</ol>
	</section>
{/if}

<style>
	.notes {
		max-width: var(--measure);
		margin: 3rem auto 0;
		padding-top: 1rem;
		border-top: 1px solid var(--rule);
		font-size: 1rem;
		line-height: 1.45;
	}
	.notes h2 {
		font-family: var(--font-head);
		font-size: 1.1rem;
		font-variant-caps: all-small-caps;
		letter-spacing: 0.08em;
		text-align: center;
		margin-bottom: 0.8rem;
	}
	.notes ol {
		padding-left: 1.6em;
		margin: 0;
	}
	.notes li {
		margin-bottom: 0.5em;
	}
	.notes li::marker {
		font-family: var(--font-type);
		font-size: 0.85em;
		color: var(--ink-faded);
	}
	.notes li:target {
		background: color-mix(in srgb, var(--ochre) 18%, transparent);
	}
	.back {
		margin-left: 0.3em;
		text-decoration: none;
		color: var(--ink-faded);
	}
</style>
