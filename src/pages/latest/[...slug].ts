import { getCollection } from 'astro:content';
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCurrentVersion } from '../../lib/versions/manifest';
import {
	buildLatestAliases,
	buildVersionedPageRecords,
	renderLatestAliasHtml,
	type AliasRoute,
} from '../../lib/versions/latest-aliases';
import { versions } from '../../data/versions';

export const getStaticPaths = (async () => {
	const current = getCurrentVersion();
	const pages = buildVersionedPageRecords(await getCollection('docs'), versions);

	return buildLatestAliases(current, pages)
		.filter(({ locale }) => locale === 'en')
		.map((alias) => ({
			params: { slug: alias.slug ? `${alias.slug}/index.html` : 'index.html' },
			props: { alias },
		}));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ alias: AliasRoute }> = ({ props }) =>
	new Response(renderLatestAliasHtml(props.alias), {
		headers: { 'content-type': 'text/html; charset=utf-8' },
	});
