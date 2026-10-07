<!--
	Shared SVG patterns, rendered once in the root layout. Any chart can fill
	with url(#dd-hatch-N) (45° hatching in series colour N) or
	url(#dd-hatch-alt-N) (crosshatch), the way 1940s papers shaded without colour.
-->
<script lang="ts">
	import { PALETTE_SIZE } from './util';
	const indices = Array.from({ length: PALETTE_SIZE }, (_, i) => i);
</script>

<svg class="defs" aria-hidden="true" width="0" height="0">
	<defs>
		{#each indices as i (i)}
			<pattern
				id="dd-hatch-{i}"
				width="5"
				height="5"
				patternUnits="userSpaceOnUse"
				patternTransform="rotate(45)"
			>
				<line x1="0" y1="0" x2="0" y2="5" style:stroke="var(--series-{i})" stroke-width="1.3" />
			</pattern>
			<pattern id="dd-hatch-alt-{i}" width="6" height="6" patternUnits="userSpaceOnUse">
				<path
					d="M0,6 L6,0 M0,0 L6,6"
					style:stroke="var(--series-{i})"
					stroke-width="0.8"
					fill="none"
				/>
			</pattern>
		{/each}
	</defs>
</svg>

<style>
	.defs {
		position: absolute;
		width: 0;
		height: 0;
		overflow: hidden;
	}
</style>
