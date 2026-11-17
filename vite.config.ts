import { mdsvex } from 'mdsvex';
import dropcap from './src/lib/build/dropcap.js';
import math from './src/lib/build/math.js';
import figures from './src/lib/build/figures.js';
import drafts from './src/lib/build/drafts.js';
import adapter from '@sveltejs/adapter-static';
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
			// Static files for GitHub Pages. BASE_PATH is the repository path the site is
			// served under (e.g. /normally-abnormal); the deploy workflow sets it. Leave it
			// unset for a custom domain or local builds.
			adapter: adapter({ fallback: '404.html' }),
			paths: { base: (process.env.BASE_PATH ?? '') as '' | `/${string}` },
			preprocess: [
				drafts(),
				figures(),
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
