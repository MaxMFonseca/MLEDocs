import type { Locale, TranslationStatus } from '../../data/taxonomy';
import type { VersionEntry } from '../../data/versions';
import type { PageRecord } from '../content/page-index';
import { docsPath } from '../links/base';

export interface AliasRoute {
	readonly locale: Locale;
	readonly slug: string;
	readonly destination: string;
	readonly canonical: string;
}

export interface AliasContentEntry {
	readonly id: string;
	readonly data:
		| {
				readonly contentType: 'technical';
				readonly pageId: string;
				readonly translationStatus: TranslationStatus;
			}
		| {
				readonly contentType: 'homepage' | 'redirect';
			};
}

const VERSIONED_CONTENT_ID = /^(?:(pt-br)\/)?versions\/([0-9a-f]{12})(?:\/(.*))?$/;

export const pageRecordsFromContentEntries = (
	entries: readonly AliasContentEntry[],
): readonly PageRecord[] =>
	entries.flatMap((entry): readonly PageRecord[] => {
		const match = VERSIONED_CONTENT_ID.exec(entry.id);
		if (!match) return [];

		const locale: Locale = match[1] ? 'pt-br' : 'en';
		const versionId = match[2] as string;
		const slug = match[3] ?? '';
		const isTechnical = entry.data.contentType === 'technical';

		return [
			{
				pageId: isTechnical ? entry.data.pageId : slug || 'overview',
				locale,
				versionId,
				slug,
				translationStatus: isTechnical
					? entry.data.translationStatus
					: entry.data.contentType === 'redirect'
						? 'fallback'
						: locale === 'en'
							? 'canonical'
							: 'current',
			},
		];
	});

const normalizeSlug = (slug: string): string => slug.replace(/^\/+|\/+$/g, '');

const compareAliases = (left: AliasRoute, right: AliasRoute): number => {
	if (left.locale !== right.locale) return left.locale < right.locale ? -1 : 1;
	if (left.slug === right.slug) return 0;
	return left.slug < right.slug ? -1 : 1;
};

export const buildLatestAliases = (
	current: VersionEntry,
	pages: readonly PageRecord[],
): readonly AliasRoute[] => {
	const aliases: AliasRoute[] = [];
	const pageByAlias = new Map<string, PageRecord>();

	for (const page of pages) {
		if (page.versionId !== current.id || !current.locales.includes(page.locale)) continue;

		const slug = normalizeSlug(page.slug);
		const aliasKey = JSON.stringify([page.locale, slug]);
		const existing = pageByAlias.get(aliasKey);
		if (existing) {
			throw new Error(
				`Duplicate latest alias for locale ${page.locale} and slug ${slug}: ${existing.pageId} and ${page.pageId}.`,
			);
		}

		pageByAlias.set(aliasKey, page);
		const destination = docsPath({
			locale: page.locale,
			versionId: current.id,
			slug,
		});
		aliases.push({
			locale: page.locale,
			slug,
			destination,
			canonical: destination,
		});
	}

	return aliases.sort(compareAliases);
};

const escapeHtml = (value: string): string =>
	value.replace(
		/[&<>"']/g,
		(character) =>
			({
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&#39;',
			})[character] as string,
	);

const escapeJavaScriptString = (value: string): string =>
	JSON.stringify(value)
		.replace(/</g, '\\u003c')
		.replace(/\u2028/g, '\\u2028')
		.replace(/\u2029/g, '\\u2029');

export const renderLatestAliasHtml = (route: AliasRoute): string => {
	const destination = escapeHtml(route.destination);
	const canonical = escapeHtml(route.canonical);
	const language = route.locale === 'pt-br' ? 'pt-BR' : 'en';
	const message =
		route.locale === 'pt-br'
			? 'Redirecionando para a versão permanente da documentação.'
			: 'Redirecting to the permanent documentation version.';
	const linkLabel =
		route.locale === 'pt-br'
			? 'Continuar para a documentação permanente'
			: 'Continue to the permanent documentation';

	return `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${destination}">
<link rel="canonical" href="${canonical}">
<title>${message}</title>
<script>location.replace(${escapeJavaScriptString(route.destination)});</script>
</head>
<body>
<p>${message} <a href="${destination}">${linkLabel}</a>.</p>
</body>
</html>`;
};
