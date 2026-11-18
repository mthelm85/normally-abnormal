// sitemap.xml, written at build time: the home page and every published essay
// (placeholders are left out). Submit its URL in Google Search Console and Bing
// Webmaster Tools; under a github.io project path, robots.txt can't point to it.
import { chapters, pageUrl } from '#lib/chapters.js';

export const prerender = true;

export function GET() {
	const pages = [
		{ loc: pageUrl(), lastmod: chapters.map((c) => c.updated ?? c.date).filter(Boolean).sort().at(-1) },
		...chapters.filter((c) => !c.comingSoon).map((c) => ({ loc: pageUrl(c.slug), lastmod: c.updated ?? c.date }))
	];
	const xml =
		'<?xml version="1.0" encoding="UTF-8"?>\n' +
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
		pages
			.map((p) => `  <url><loc>${p.loc}</loc>${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ''}</url>`)
			.join('\n') +
		'\n</urlset>\n';
	return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
