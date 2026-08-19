import { describe, expect, it } from 'vitest';
import type { VersionEntry } from '../../src/data/versions';
import { resolveVersionEntryFromRouteId } from '../../src/lib/versions/manifest';

const pinnedVersion: VersionEntry = {
	commit: 'c1abea3de165032fe064300340807b7a6af388f8',
	id: 'c1abea3de165',
	committedAt: '2026-08-18',
	label: { en: 'Archived', 'pt-br': 'Arquivada' },
	status: 'archived',
	locales: ['en', 'pt-br'],
	repositoryUrl: 'https://github.com/MaxMFonseca/MLE',
	corrections: [],
};

const futureVersion: VersionEntry = {
	commit: 'f2f2f2f2f2f2f2f2f2f2f2f2f2f2f2f2f2f2f2f2',
	id: 'f2f2f2f2f2f2',
	committedAt: '2026-08-20',
	label: { en: 'Current', 'pt-br': 'Atual' },
	status: 'current',
	locales: ['en', 'pt-br'],
	repositoryUrl: 'https://github.com/MaxMFonseca/MLE',
	corrections: [],
};

const reorderedVersions = [futureVersion, pinnedVersion] as const;

describe('snapshot version route resolution', () => {
	it('selects the immutable route snapshot regardless of manifest order', () => {
		const english = resolveVersionEntryFromRouteId(
			'versions/c1abea3de165/start-here/project-status',
			reorderedVersions,
		);
		const portuguese = resolveVersionEntryFromRouteId(
			'pt-br/versions/c1abea3de165',
			reorderedVersions,
		);

		expect(english.id).toBe('c1abea3de165');
		expect(english.commit).toBe('c1abea3de165032fe064300340807b7a6af388f8');
		expect(portuguese.id).toBe('c1abea3de165');
		expect(portuguese.commit).toBe('c1abea3de165032fe064300340807b7a6af388f8');
	});

	it('rejects a malformed snapshot route with a stable error', () => {
		expect(() =>
			resolveVersionEntryFromRouteId('versions/not-a-commit/overview', reorderedVersions),
		).toThrow('Cannot resolve an MLE snapshot from route ID "versions/not-a-commit/overview".');
	});

	it('rejects a snapshot route missing from the manifest with a stable error', () => {
		expect(() =>
			resolveVersionEntryFromRouteId('versions/aaaaaaaaaaaa/overview', reorderedVersions),
		).toThrow(
			'Documentation route "versions/aaaaaaaaaaaa/overview" references unknown MLE snapshot "aaaaaaaaaaaa".',
		);
	});
});
