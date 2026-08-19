import { describe, expect, it } from 'vitest';
import type { VersionEntry } from '../../src/data/versions';
import { buildPageIndex, type PageRecord } from '../../src/lib/content/page-index';
import { buildVersionPickerModel } from '../../src/components/versioning/version-picker-model';

const currentId = 'aaaaaaaaaaaa';
const archivedId = 'bbbbbbbbbbbb';

const manifest = [
	{
		commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
		id: currentId,
		committedAt: '2026-08-18',
		label: { en: 'Current', 'pt-br': 'Atual' },
		status: 'current',
		locales: ['en', 'pt-br'],
		repositoryUrl: 'https://github.com/MaxMFonseca/MLE',
		corrections: [],
	},
	{
		commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
		id: archivedId,
		committedAt: '2025-12-01',
		label: { en: 'Archived', 'pt-br': 'Arquivada' },
		status: 'archived',
		locales: ['en', 'pt-br'],
		repositoryUrl: 'https://github.com/MaxMFonseca/MLE',
		corrections: [],
	},
] as const satisfies readonly VersionEntry[];

const sharedPages = [
	{
		pageId: 'overview',
		locale: 'pt-br',
		versionId: currentId,
		slug: '',
		translationStatus: 'current',
	},
	{
		pageId: 'renderer-overview',
		locale: 'pt-br',
		versionId: currentId,
		slug: 'sistemas/renderizador',
		translationStatus: 'current',
	},
	{
		pageId: 'overview',
		locale: 'pt-br',
		versionId: archivedId,
		slug: '',
		translationStatus: 'current',
	},
] as const satisfies readonly PageRecord[];

describe('version picker decision model', () => {
	it('navigates to the exact equivalent page in the selected version and locale', () => {
		const index = buildPageIndex([
			...sharedPages,
			{
				pageId: 'renderer-overview',
				locale: 'pt-br',
				versionId: archivedId,
				slug: 'sistemas/renderizador-arquivado',
				translationStatus: 'current',
			},
		]);

		const model = buildVersionPickerModel({
			versions: manifest,
			pageIndex: index,
			pageId: 'renderer-overview',
			locale: 'pt-br',
			activeVersionId: currentId,
		});

		expect(model.options[1]).toEqual({
			kind: 'navigate',
			version: manifest[1],
			label: 'bbbbbbbbbbbb · 2025-12-01 · arquivada',
			selectionValue:
				'/MLEDocs/pt-br/versions/bbbbbbbbbbbb/sistemas/renderizador-arquivado/',
			destination:
				'/MLEDocs/pt-br/versions/bbbbbbbbbbbb/sistemas/renderizador-arquivado/',
		});
	});

	it('keeps a missing equivalent on-page and exposes only an explicit overview choice', () => {
		const model = buildVersionPickerModel({
			versions: manifest,
			pageIndex: buildPageIndex(sharedPages),
			pageId: 'renderer-overview',
			locale: 'pt-br',
			activeVersionId: currentId,
		});

		expect(model.options[1]).toEqual({
			kind: 'missing',
			version: manifest[1],
			label: 'bbbbbbbbbbbb · 2025-12-01 · arquivada',
			selectionValue: '#mle-version-missing-bbbbbbbbbbbb',
			explanationId: 'mle-version-missing-bbbbbbbbbbbb',
			missingPageId: 'renderer-overview',
			overviewDestination: '/MLEDocs/pt-br/versions/bbbbbbbbbbbb/',
		});
		expect(model.options[1]).not.toHaveProperty('destination');
	});
});
