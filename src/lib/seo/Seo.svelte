<!--
	Everything search engines, AI crawlers and link previews read about a page:
	title, description, canonical URL, Open Graph and Twitter card tags, and
	structured data (JSON-LD). One per page, inside nothing (it writes to <head>).

	<Seo title="…" description="…" url={pageUrl(slug)} image={pageUrl('og/slug.png')}
		type="article" jsonld={{ … }} />
-->
<script lang="ts">
	import { BOOK } from '#lib/chapters.js';

	let {
		title,
		description,
		url,
		image,
		imageAlt,
		type = 'website',
		published,
		modified,
		noindex = false,
		jsonld
	}: {
		/** the full <title> */
		title: string;
		description: string;
		/** absolute canonical URL */
		url: string;
		/** absolute URL of a 1200 × 630 PNG */
		image?: string;
		imageAlt?: string;
		type?: 'website' | 'article';
		/** YYYY-MM-DD */
		published?: string;
		modified?: string;
		/** keep a page out of search results (placeholders) */
		noindex?: boolean;
		/** structured data, serialized into a JSON-LD script */
		jsonld?: Record<string, unknown>;
	} = $props();

	// "<" escaped so the JSON can never close the script tag early.
	const ld = $derived(
		jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replaceAll('<', '\\u003c')}</` + 'script>' : ''
	);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta name="author" content={BOOK.author} />
	<link rel="canonical" href={url} />
	{#if noindex}<meta name="robots" content="noindex" />{/if}

	<meta property="og:site_name" content={BOOK.title} />
	<meta property="og:type" content={type} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	<meta property="og:locale" content="en_US" />
	{#if image}
		<meta property="og:image" content={image} />
		<meta property="og:image:width" content="1200" />
		<meta property="og:image:height" content="630" />
		{#if imageAlt}<meta property="og:image:alt" content={imageAlt} />{/if}
	{/if}
	{#if type === 'article'}
		<meta property="article:author" content={BOOK.authorUrl} />
		{#if published}<meta property="article:published_time" content={published} />{/if}
		{#if modified}<meta property="article:modified_time" content={modified} />{/if}
	{/if}

	<meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	{#if image}<meta name="twitter:image" content={image} />{/if}

	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html ld}
</svelte:head>
