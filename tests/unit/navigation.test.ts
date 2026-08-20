import { describe, expect, it } from 'vitest';
import { buildVersionedSidebar } from '../../src/data/navigation';
import type { VersionEntry } from '../../src/data/versions';

const currentVersion = {
	commit: 'c1abea3de165032fe064300340807b7a6af388f8',
	id: 'c1abea3de165',
	committedAt: '2026-08-18',
	label: { en: 'Current', 'pt-br': 'Atual' },
	status: 'current',
	locales: ['en', 'pt-br'],
	repositoryUrl: 'https://github.com/MaxMFonseca/MLE',
	corrections: [],
} as const satisfies VersionEntry;

const archivedVersion = {
	commit: 'dddddddddddddddddddddddddddddddddddddddd',
	id: 'dddddddddddd',
	committedAt: '2026-07-01',
	label: { en: 'Previous', 'pt-br': 'Anterior' },
	status: 'archived',
	locales: ['en', 'pt-br'],
	repositoryUrl: 'https://github.com/MaxMFonseca/MLE',
	corrections: [],
} as const satisfies VersionEntry;

describe('versioned snapshot sidebar', () => {
	it('is deterministic when a two-version manifest is reordered', () => {
		const currentFirst = buildVersionedSidebar([currentVersion, archivedVersion]);
		const archivedFirst = buildVersionedSidebar([archivedVersion, currentVersion]);

		expect(archivedFirst).toEqual(currentFirst);
		expect(currentFirst.map(({ label }) => label)).toEqual([
			'c1abea3de165 · 2026-08-18 · current',
			'dddddddddddd · 2026-07-01 · archived',
		]);
		expect(currentFirst.map(({ translations }) => translations['pt-BR'])).toEqual([
			'c1abea3de165 · 2026-08-18 · atual',
			'dddddddddddd · 2026-07-01 · arquivada',
		]);
	});

	it('keeps every generated link inside its explicitly labeled snapshot group', () => {
		const sidebar = buildVersionedSidebar([archivedVersion, currentVersion]);

		for (const group of sidebar) {
			const versionId = group.label.slice(0, 12);
			const directories = group.items.flatMap((section) =>
				section.items.map((item) => item.autogenerate.directory),
			);

			expect(group.label).toMatch(
				new RegExp(`^${versionId} · \\d{4}-\\d{2}-\\d{2} · (?:current|archived)$`),
			);
			expect(directories).toEqual([
				`versions/${versionId}/start-here`,
				`versions/${versionId}/systems`,
			]);
			expect(directories.every((directory) => directory.startsWith(`versions/${versionId}/`))).toBe(
				true,
			);
		}
	});
});
