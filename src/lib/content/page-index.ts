import type { Locale, TranslationStatus } from '../../data/taxonomy';

export interface PageRecord {
	readonly pageId: string;
	readonly locale: Locale;
	readonly versionId: string;
	readonly slug: string;
	readonly translationStatus: TranslationStatus;
}

export interface PageIndex {
	readonly pages: readonly PageRecord[];
	find(versionId: string, locale: Locale, pageId: string): PageRecord | undefined;
}

const pageKey = (versionId: string, locale: Locale, pageId: string): string =>
	JSON.stringify([versionId, locale, pageId]);

export const buildPageIndex = (pages: readonly PageRecord[]): PageIndex => {
	const pagesByKey = new Map<string, PageRecord>();

	for (const page of pages) {
		const key = pageKey(page.versionId, page.locale, page.pageId);
		const existing = pagesByKey.get(key);
		if (existing) {
			throw new Error(
				`Duplicate page ID ${page.pageId} for version ${page.versionId} and locale ${page.locale}: ${existing.slug} and ${page.slug}.`,
			);
		}

		pagesByKey.set(key, page);
	}

	return {
		pages: [...pages],
		find: (versionId, locale, pageId) => pagesByKey.get(pageKey(versionId, locale, pageId)),
	};
};
