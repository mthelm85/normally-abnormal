<!--
	A Daily-Prophet-style moving plate for the front page. At rest it shows the
	finished chart; now and then the page's projectionist has it perform: the ink
	fades, draws itself in again, and a cursor wanders through the data. No more
	than two plates move at once. Respects prefers-reduced-motion.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Reel, setMotion } from './motion.svelte';

	let {
		children,
		length = 10000
	}: { children: Snippet; /** ms per performance */ length?: number } = $props();

	// svelte-ignore state_referenced_locally
	const reel = new Reel(length);
	setMotion(reel);

	let el: HTMLDivElement;
	$effect(() => reel.run(el));
</script>

<div class="plate" class:playing={reel.playing} bind:this={el} style:--fade={reel.fade}>
	<div class="ink">{@render children()}</div>
</div>

<style>
	.plate {
		position: relative;
		padding: 6px 4px 2px;
		border: 1px solid var(--ink-soft);
		outline: 1px solid var(--ink-soft);
		outline-offset: 2px;
		margin: 3px;
		pointer-events: none;
		overflow: hidden;

		/* Plates are black-and-white photographs: series and highlights become
		   well-separated greys, and the filter catches everything else
		   (hatching patterns). The plate itself is transparent, so it sits on the page's paper. */
		--series-0: #1f1f1f;
		--series-1: #8a8a8a;
		--series-2: #505050;
		--series-3: #b4b4b4;
		--series-4: #6c6c6c;
		--series-5: #a0a0a0;
		--accent: #9a9a9a;
		filter: grayscale(1);
	}
	.ink {
		opacity: var(--fade);
	}
	/* The film flicker only runs while a plate is performing. */
	.playing .ink {
		animation: flicker 3.2s steps(1) infinite;
	}
	@keyframes flicker {
		0% {
			filter: none;
		}
		31% {
			filter: brightness(1.04) contrast(0.97);
		}
		33% {
			filter: none;
		}
		67% {
			filter: brightness(0.97);
		}
		68% {
			filter: none;
		}
		88% {
			filter: brightness(1.03) contrast(0.98);
		}
		89% {
			filter: none;
		}
	}
</style>
