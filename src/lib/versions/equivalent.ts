import type { Locale } from '../../data/taxonomy';
import type { PageIndex, PageRecord } from '../content/page-index';

const OVERVIEW_PAGE_ID = 'overview';

export interface EquivalentPageRequest {
	readonly pageId: string;
	readonly locale: Locale;
	readonly versionId: string;
}

export type EquivalentResult =
	| { kind: 'exact'; page: PageRecord }
	| { kind: 'same-version-english'; page: PageRecord }
	| { kind: 'missing'; overview: PageRecord; missingPageId: string };

export const resolveEquivalentPage = (
	index: PageIndex,
	request: EquivalentPageRequest,
): EquivalentResult => {
	const exact = index.find(request.versionId, request.locale, request.pageId);
	if (exact) {
		return { kind: 'exact', page: exact };
	}

	const english = index.find(request.versionId, 'en', request.pageId);
	if (english) {
		return { kind: 'same-version-english', page: english };
	}

	const overview =
		index.find(request.versionId, request.locale, OVERVIEW_PAGE_ID) ??
		index.find(request.versionId, 'en', OVERVIEW_PAGE_ID);
	if (!overview) {
		throw new Error(
			`Version ${request.versionId} has no overview page for locale ${request.locale} or English.`,
		);
	}

	return { kind: 'missing', overview, missingPageId: request.pageId };
};
