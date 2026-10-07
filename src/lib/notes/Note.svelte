<!--
	A note or citation. In the text it is a small superscript number that opens
	on hover or focus; the chapter also lists every note at the end.

	…closer to just four.<Note>Nelson Cowan, “The Magical Number 4…” (2001).</Note>
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getNotes } from './notes.svelte';

	let { children }: { children: Snippet } = $props();

	// A note's content is fixed once written, so capturing it once is intended.
	// svelte-ignore state_referenced_locally
	const entry = getNotes()?.add(children);
	let open = $state(false);
	let marker = $state<HTMLAnchorElement>();
	let shift = $state(0);
	let width = $state(352);

	// Keep the card inside the text column, whichever side the marker sits on.
	function show() {
		open = true;
		if (!marker) return;
		const r = marker.getBoundingClientRect();
		const col = (marker.closest('.prose') ?? document.body).getBoundingClientRect();
		width = Math.min(352, col.width);
		const left = Math.min(Math.max(r.left + r.width / 2 - width / 2, col.left), col.right - width);
		shift = left - r.left;
	}
</script>

<span class="note"
	><a
		href="#{entry?.id}"
		id={entry?.ref}
		class="marker"
		aria-describedby="{entry?.id}-pop"
		bind:this={marker}
		onmouseenter={show}
		onmouseleave={() => (open = false)}
		onfocus={show}
		onblur={() => (open = false)}><sup>{entry?.n ?? '*'}</sup></a
	><span
		class="pop"
		class:open
		id="{entry?.id}-pop"
		role="note"
		style:left="{shift}px"
		style:width="{width}px">{@render children()}</span></span
>

<style>
	.note {
		position: relative;
	}
	.marker {
		text-decoration: none;
		border: 0 !important;
		color: var(--accent);
		font-family: var(--font-type);
		font-size: 0.72em;
		padding: 0 0.1em;
	}
	.marker sup {
		vertical-align: super;
		line-height: 0;
	}
	.pop {
		display: none;
		position: absolute;
		bottom: 1.6em;
		z-index: 3;
		padding: 0.5rem 0.7rem;
		background: var(--paper);
		border: 1px solid var(--ink);
		box-shadow: 3px 3px 0 rgb(38 34 28 / 0.18);
		font-size: 0.85rem;
		line-height: 1.4;
		text-align: left;
		text-indent: 0;
		hyphens: manual;
	}
	.pop.open {
		display: block;
	}
</style>
