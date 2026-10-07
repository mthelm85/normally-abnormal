<script lang="ts">
	import 'katex/dist/katex.min.css';
	import '#lib/styles/base.css';
	import favicon from '#lib/assets/favicon.svg';
	import { onNavigate } from '$app/navigation';
	import { ChartDefs } from '#charts';
	import { BOOK } from '#lib/chapters.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// Cross-fade between pages where the browser supports view transitions.
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preload" href="/fonts/garamond.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
	<link rel="preload" href="/fonts/playfair.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<ChartDefs />

<header class="running">
	<a href="/" class="typewriter">{BOOK.title}</a>
	<hr class="rule-thin" />
</header>

{@render children()}

<footer>
	<hr class="rule-double" />
	<p>© {new Date().getFullYear()} {BOOK.author}</p>
</footer>

<style>
	.running {
		max-width: calc(var(--measure) + 2 * var(--gutter));
		margin: 0 auto;
		padding: 1.2rem var(--gutter) 0;
		text-align: center;
	}
	.running a {
		display: inline-block;
		margin-bottom: 0.5rem;
		font-size: 0.9rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		text-decoration: none;
		color: var(--ink-faded);
	}
	.running a:hover {
		color: var(--accent);
	}
	footer {
		max-width: calc(var(--measure) + 2 * var(--gutter));
		margin: 4rem auto 0;
		padding: 0 var(--gutter) 1.5rem;
		text-align: center;
	}
	footer p {
		margin: 0.5rem 0 0;
		font-family: var(--font-head);
		font-size: 0.95rem;
		letter-spacing: 0.03em;
	}
</style>
