import { mdsvex } from 'mdsvex';
import dropcap from './src/lib/build/dropcap.js';
import math from './src/lib/build/math.js';
import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';

/** `import rows from './data/x.csv'` → array of typed rows (numbers, ISO dates → Date). */
function csv(): Plugin {
	return {
		name: 'data-dispatch:csv',
		transform(code, id) {
			if (!id.endsWith('.csv')) return;
			return {
				code: `import { csvParse, autoType } from 'd3-dsv';\nexport default csvParse(${JSON.stringify(code)}, autoType);`,
				map: null
			};
		}
	};
}

export default defineConfig({
	plugins: [
		csv(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			preprocess: [
				math(),
				mdsvex({
					extensions: ['.svx', '.md'],
					smartypants: { dashes: 'oldschool' },
					rehypePlugins: [dropcap]
				})
			],
			extensions: ['.svelte', '.svx', '.md']
		})
	]
});
