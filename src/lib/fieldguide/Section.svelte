<!-- A labeled part of a Field Guide card, e.g. "Signs you're here", "Quick test". -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, children }: { title: string; children: Snippet } = $props();
</script>

<section>
	<h4>{title}</h4>
	{@render children()}
</section>

<style>
	section {
		margin-top: 0.9rem;
	}
	section:first-child {
		margin-top: 0;
	}
	/* beats the centered, small-caps .prose h4 style */
	section h4 {
		margin: 0 0 0.25rem;
		text-align: left;
		font-variant-caps: normal;
		font-family: var(--font-type);
		font-size: 0.8rem;
		font-weight: 400;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}
	section h4::after {
		content: none;
	}
</style>
