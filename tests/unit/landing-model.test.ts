import { describe, expect, it } from 'vitest';
import type { VersionEntry } from '../../src/data/versions';
import { buildLandingModel } from '../../src/lib/landing/model';

const current: VersionEntry = {
	commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
	id: 'aaaaaaaaaaaa',
	committedAt: '2026-08-18',
	label: { en: 'current', 'pt-br': 'atual' },
	status: 'current',
	locales: ['en', 'pt-br'],
	repositoryUrl: 'https://github.com/MaxMFonseca/MLE',
	corrections: [],
};

const archived: VersionEntry = {
	commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
	id: 'bbbbbbbbbbbb',
	committedAt: '2025-12-01',
	label: { en: 'archived', 'pt-br': 'arquivada' },
	status: 'archived',
	locales: ['en', 'pt-br'],
	repositoryUrl: 'https://github.com/MaxMFonseca/MLE',
	corrections: [],
};

describe('landing model', () => {
	it('resolves Portuguese labels and destinations from the selected version when entries are reordered', () => {
		const portuguese = buildLandingModel([archived, current], current.id, 'pt-br');

		expect(portuguese.version.commit).toBe(current.commit);
		expect(portuguese.options.map(({ label }) => label)).toEqual([
			'aaaaaaaaaaaa · 2026-08-18 · atual',
			'bbbbbbbbbbbb · 2025-12-01 · arquivada',
		]);
		expect(portuguese.options[0]?.destination).toBe(
			`/MLEDocs/pt-br/versions/${current.id}/`,
		);
		expect(portuguese.sections.map(({ label }) => label)).toEqual([
			'Comece aqui',
			'Conceitos',
			'Sistemas do motor',
			'Guias práticos',
			'Referência',
			'Ferramentas e aplicativos de teste',
			'Como contribuir',
		]);
		expect(portuguese.sections.every(({ href }) => href.startsWith('/MLEDocs/pt-br/'))).toBe(true);
		expect(portuguese.alternateLanding).toBe('/MLEDocs/');
		expect(portuguese.documentationHome).toBe(`/MLEDocs/pt-br/versions/${current.id}/`);
		expect(portuguese.sourceDestination).toBe(`${current.repositoryUrl}/tree/${current.commit}`);
	});

	it('resolves English destinations without a Portuguese path', () => {
		const english = buildLandingModel([current, archived], current.id, 'en');

		expect(english.options[0]?.label).toContain('current');
		expect(english.alternateLanding).toBe('/MLEDocs/pt-br/');
		expect(english.documentationHome).toBe(`/MLEDocs/versions/${current.id}/`);
		expect(english.sections.every(({ href }) => !href.includes('/pt-br/'))).toBe(true);
	});

	it('rejects an unknown selected version ID', () => {
		expect(() => buildLandingModel([archived, current], 'cccccccccccc', 'en')).toThrow(
			'Unknown landing version: cccccccccccc',
		);
	});

	it('rejects a locale absent from the selected version', () => {
		const englishOnly: VersionEntry = {
			...current,
			id: 'dddddddddddd',
			locales: ['en'],
		};

		expect(() => buildLandingModel([archived, englishOnly], englishOnly.id, 'pt-br')).toThrow(
			'Landing version dddddddddddd does not declare locale pt-br.',
		);
	});
});
