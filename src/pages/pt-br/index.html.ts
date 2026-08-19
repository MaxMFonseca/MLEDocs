import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { getCurrentVersion } from '../../lib/versions/manifest';
import {
	buildRootAlias,
	pageRecordsFromContentEntries,
	renderLatestAliasHtml,
} from '../../lib/versions/latest-aliases';

export const GET: APIRoute = async () => {
	const current = getCurrentVersion();
	const pages = pageRecordsFromContentEntries(await getCollection('docs'));
	const alias = buildRootAlias(current, pages, 'pt-br');

	return new Response(renderLatestAliasHtml(alias), {
		headers: { 'content-type': 'text/html; charset=utf-8' },
	});
};
