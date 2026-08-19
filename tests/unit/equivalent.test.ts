import { describe, expect, it } from 'vitest';
import { buildPageIndex } from '../../src/lib/content/page-index';
import { resolveEquivalentPage } from '../../src/lib/versions/equivalent';
import { archivedVersionId, currentVersionId, pages } from '../fixtures/pages';

const index = buildPageIndex(pages);

describe('equivalent documentation pages', () => {
	it('resolves an exact version, locale, and stable page ID despite a localized slug', () => {
		expect(
			resolveEquivalentPage(index, {
				pageId: 'core-overview',
				locale: 'pt-br',
				versionId: currentVersionId,
			}),
		).toEqual({ kind: 'exact', page: pages[3] });
	});

	it('falls back to same-version English when the requested translation is absent', () => {
		expect(
			resolveEquivalentPage(index, {
				pageId: 'renderer-overview',
				locale: 'pt-br',
				versionId: currentVersionId,
			}),
		).toEqual({ kind: 'same-version-english', page: pages[4] });
	});

	it('returns the requested locale overview when the page is absent from the version', () => {
		expect(
			resolveEquivalentPage(index, {
				pageId: 'removed-page',
				locale: 'pt-br',
				versionId: currentVersionId,
			}),
		).toEqual({
			kind: 'missing',
			overview: pages[1],
			missingPageId: 'removed-page',
		});
	});

	it('does not use a page from another commit as a fallback', () => {
		expect(
			resolveEquivalentPage(index, {
				pageId: 'legacy-only',
				locale: 'pt-br',
				versionId: currentVersionId,
			}),
		).toEqual({
			kind: 'missing',
			overview: pages[1],
			missingPageId: 'legacy-only',
		});
		expect(archivedVersionId).not.toBe(currentVersionId);
	});

	it('rejects duplicate page IDs within one version and locale with both slugs', () => {
		expect(() =>
			buildPageIndex([
				pages[2],
				{ ...pages[2], slug: 'systems/core-reference' },
			]),
		).toThrow(/systems\/core.*systems\/core-reference|systems\/core-reference.*systems\/core/);
	});
});
