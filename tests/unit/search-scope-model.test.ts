import { describe, expect, it } from 'vitest';
import type { VersionEntry } from '../../src/data/versions';
import {
	buildSearchContext,
	describeSearchResult,
	type SearchLabels,
} from '../../src/lib/search/search-scope-model';

const current: VersionEntry = {
	commit: 'c1abea3de165032fe064300340807b7a6af388f8',
	id: 'c1abea3de165',
	committedAt: '2026-08-18',
	label: { en: 'Current', 'pt-br': 'Atual' },
	status: 'current',
	locales: ['en', 'pt-br'],
	repositoryUrl: 'https://github.com/MaxMFonseca/MLE',
	corrections: [],
};

const archived: VersionEntry = {
	...current,
	commit: 'aaaaaaaaaaaabbbbbbbbbbbbbbbbbbbbbbbbbbbb',
	id: 'aaaaaaaaaaaa',
	committedAt: '2025-01-01',
	label: { en: 'Archived', 'pt-br': 'Arquivada' },
	status: 'archived',
};

const englishLabels: SearchLabels = {
	versionBadge: 'Commit',
	languageBadge: 'Language',
	languageNames: { en: 'English', 'pt-br': 'Brazilian Portuguese' },
};

const portugueseLabels: SearchLabels = {
	versionBadge: 'Commit',
	languageBadge: 'Idioma',
	languageNames: { en: 'Inglês', 'pt-br': 'Português (Brasil)' },
};

describe('search scope model', () => {
	it('builds exact active filters from immutable English and Portuguese routes', () => {
		const reordered = [archived, current];

		expect(
			buildSearchContext({
				pathname: '/MLEDocs/versions/c1abea3de165/systems/renderer/',
				versions: reordered,
			}),
		).toMatchObject({
			versionId: 'c1abea3de165',
			locale: 'en',
			filters: {
				active: { mleVersion: 'c1abea3de165', mleLocale: 'en' },
				all: undefined,
			},
		});

		expect(
			buildSearchContext({
				pathname: '/MLEDocs/pt-br/versions/aaaaaaaaaaaa/guides/',
				versions: reordered,
			}),
		).toMatchObject({
			versionId: 'aaaaaaaaaaaa',
			locale: 'pt-br',
			filters: {
				active: { mleVersion: 'aaaaaaaaaaaa', mleLocale: 'pt-br' },
				all: undefined,
			},
		});
	});

	it('resolves latest aliases to the manifest current entry without relying on array order', () => {
		const reordered = [archived, current];

		expect(
			buildSearchContext({
				pathname: '/MLEDocs/latest/systems/renderer/',
				versions: reordered,
			}),
		).toMatchObject({
			versionId: 'c1abea3de165',
			locale: 'en',
			filters: {
				active: { mleVersion: 'c1abea3de165', mleLocale: 'en' },
				all: undefined,
			},
		});

		expect(
			buildSearchContext({
				pathname: '/MLEDocs/pt-br/latest/systems/renderer/',
				versions: reordered,
			}),
		).toMatchObject({
			versionId: 'c1abea3de165',
			locale: 'pt-br',
			filters: {
				active: { mleVersion: 'c1abea3de165', mleLocale: 'pt-br' },
				all: undefined,
			},
		});
	});

	it('withholds active filters for unknown versions, malformed encodings, and unrelated routes', () => {
		for (const pathname of [
			'/MLEDocs/versions/ffffffffffff/systems/renderer/',
			'/MLEDocs/pt-br/versions/%E0%A4%A/systems/renderer/',
			'/other/MLEDocs/versions/c1abea3de165/systems/renderer/',
			'/MLEDocs/arbitrary/versions/c1abea3de165/systems/renderer/',
		]) {
			const context = buildSearchContext({ pathname, versions: [current, archived] });
			expect(context.versionId, pathname).toBeUndefined();
			expect(context.filters.active, pathname).toBeUndefined();
			expect(context.filters.all, pathname).toBeUndefined();
		}
	});

	it('honors a caller-supplied base path boundary', () => {
		expect(
			buildSearchContext({
				pathname: '/docs/pt-br/versions/c1abea3de165/reference/',
				versions: [current],
				base: '/docs/',
			}),
		).toMatchObject({
			base: '/docs',
			versionId: 'c1abea3de165',
			locale: 'pt-br',
			filters: {
				active: { mleVersion: 'c1abea3de165', mleLocale: 'pt-br' },
				all: undefined,
			},
		});
	});
});

describe('search result context', () => {
	it('identifies the active immutable result and exposes English badge text', () => {
		const active = buildSearchContext({
			pathname: '/MLEDocs/versions/c1abea3de165/systems/renderer/',
			versions: [archived, current],
		});

		expect(
			describeSearchResult({
				url: 'https://maxmfonseca.github.io/MLEDocs/versions/c1abea3de165/systems/renderer/?q=renderer#frame',
				active,
				labels: englishLabels,
			}),
		).toEqual({
			kind: 'versioned',
			versionId: 'c1abea3de165',
			locale: 'en',
			isActive: true,
			versionBadge: 'Commit c1abea3de165',
			languageBadge: 'Language English',
		});
	});

	it('describes an out-of-context archived Portuguese result from stable identities', () => {
		const active = buildSearchContext({
			pathname: '/MLEDocs/versions/c1abea3de165/',
			versions: [archived, current],
		});

		expect(
			describeSearchResult({
				url: '/MLEDocs/pt-br/versions/aaaaaaaaaaaa/tools/',
				active,
				labels: portugueseLabels,
			}),
		).toEqual({
			kind: 'versioned',
			versionId: 'aaaaaaaaaaaa',
			locale: 'pt-br',
			isActive: false,
			versionBadge: 'Commit aaaaaaaaaaaa',
			languageBadge: 'Idioma Português (Brasil)',
		});
	});

	it('never treats latest, unknown, malformed, or unrelated result URLs as active', () => {
		const active = buildSearchContext({
			pathname: '/MLEDocs/versions/c1abea3de165/',
			versions: [current, archived],
		});

		for (const url of [
			'/MLEDocs/latest/systems/renderer/',
			'/MLEDocs/versions/ffffffffffff/systems/renderer/',
			'/MLEDocs/versions/%E0%A4%A/systems/renderer/',
			'/MLEDocs/unrelated/versions/c1abea3de165/systems/renderer/',
		]) {
			expect(describeSearchResult({ url, active, labels: englishLabels }), url).toEqual({
				kind: 'unknown',
				isActive: false,
			});
		}
	});
});
