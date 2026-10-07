// Ambient declarations for non-JS imports (kept out of app.d.ts, which is a module).

declare module '*.csv' {
	const rows: Record<string, any>[];
	export default rows;
}

declare module '*.svx' {
	import type { Component } from 'svelte';
	export const metadata: Record<string, any>;
	const component: Component;
	export default component;
}
