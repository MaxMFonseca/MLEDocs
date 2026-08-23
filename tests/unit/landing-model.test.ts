import { describe, expect, it } from 'vitest';
import type { VersionEntry } from '../../src/data/versions';
import { buildLandingModel } from '../../src/lib/landing/model';

const current: VersionEntry = {
	commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
	id: 'aaaaaaaaaaaa',
	committedAt: '2026-08-18',
	label: { en: 'Current', 'pt-br': 'Atual' },
	status: 'current',
	locales: ['en', 'pt-br'],
	repositoryUrl: 'https://github.com/MaxMFonseca/MLE',
	corrections: [],
};

const archived: VersionEntry = {
	commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
	id: 'bbbbbbbbbbbb',
	committedAt: '2025-12-01',
	label: { en: 'Archived', 'pt-br': 'Arquivada' },
	status: 'archived',
	locales: ['en', 'pt-br'],
	repositoryUrl: 'https://github.com/MaxMFonseca/MLE',
	corrections: [],
};

describe('landing model', () => {
	it('derives every landing destination from the selected ID when entries are reordered', () => {
		const model = buildLandingModel([archived, current], archived.id);

		expect(model.version.commit).toBe(archived.commit);
		expect(model.options.map((option) => option.versionId)).toEqual([current.id, archived.id]);
		expect(model.options.map((option) => option.label)).toEqual([
			'aaaaaaaaaaaa · 2026-08-18 · current',
			'bbbbbbbbbbbb · 2025-12-01 · archived',
		]);
		expect(model.englishHome).toBe(`/MLEDocs/versions/${archived.id}/`);
		expect(model.portugueseHome).toBe(`/MLEDocs/pt-br/versions/${archived.id}/`);
		expect(model.sourceDestination).toBe(`${archived.repositoryUrl}/tree/${archived.commit}`);
		expect(model.sections).toHaveLength(7);
		expect(model.sections.every((entry) => entry.href.includes(`/versions/${archived.id}/`))).toBe(true);
		expect(model.sections.map((entry) => entry.section.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
	});

	it('rejects an unknown selected version ID', () => {
		expect(() => buildLandingModel([archived, current], 'cccccccccccc')).toThrow(
			'Unknown landing version: cccccccccccc',
		);
	});
});
