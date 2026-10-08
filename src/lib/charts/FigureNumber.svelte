<!-- Wraps a chart so its <Figure> shows "Figure 1.2". Inserted by src/lib/build/figures.js. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { setFigureNumber } from './figure-number';

	let { n, id, children }: { n: string; id: string; children: Snippet } = $props();
	// svelte-ignore state_referenced_locally
	setFigureNumber({ n, id });
</script>

{@render children()}
