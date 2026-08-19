import { describe, expect, expectTypeOf, it } from 'vitest';
import { versions, type VersionEntry } from '../../src/data/versions';
import {
	getCurrentVersion,
	getVersion,
	validateVersions,
} from '../../src/lib/versions/manifest';

const archivedVersion: VersionEntry = {
	...versions[0],
	commit: 'd2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2',
	id: 'd2d2d2d2d2d2',
	committedAt: '2026-08-17',
	label: { en: 'Archived', 'pt-br': 'Arquivada' },
	status: 'archived',
};

const withChanges = (changes: Partial<VersionEntry>): VersionEntry => ({
	...versions[0],
	...changes,
});

describe('documentation version manifest', () => {
	it('publishes the immutable initial MLE snapshot', () => {
		expect(versions).toHaveLength(1);
		expect(versions[0]).toEqual({
			commit: 'c1abea3de165032fe064300340807b7a6af388f8',
			id: 'c1abea3de165',
			committedAt: '2026-08-18',
			label: { en: 'Current', 'pt-br': 'Atual' },
			status: 'current',
			locales: ['en', 'pt-br'],
			repositoryUrl: 'https://github.com/MaxMFonseca/MLE',
			corrections: [],
		});
	});

	it('exposes the manifest through readonly contracts', () => {
		expectTypeOf(versions).toExtend<readonly VersionEntry[]>();
		expectTypeOf(versions[0]).toExtend<VersionEntry>();
	});

	it('accepts a valid manifest', () => {
		expect(validateVersions([versions[0], archivedVersion])).toEqual([]);
	});

	it('rejects an empty manifest', () => {
		expect(validateVersions([])).toEqual([
			'Version manifest must contain at least one entry.',
			'Version manifest must contain exactly one current entry; found 0.',
		]);
	});

	it('requires exactly one current entry', () => {
		expect(validateVersions([archivedVersion])).toEqual([
			'Version manifest must contain exactly one current entry; found 0.',
		]);

		expect(
			validateVersions([
				versions[0],
				withChanges({
					commit: archivedVersion.commit,
					id: archivedVersion.id,
					label: archivedVersion.label,
				}),
			]),
		).toEqual([
			'Version manifest must contain exactly one current entry; found 2.',
		]);
	});

	it('reports malformed commit and mismatched ID errors in invariant order', () => {
		expect(validateVersions([withChanges({ commit: 'ABC123' })])).toEqual([
			'Version c1abea3de165 has invalid commit ABC123; expected a 40-character lowercase SHA.',
			'Version c1abea3de165 does not match commit ABC123; expected ID ABC123.',
		]);
	});

	it('requires each ID to equal the first 12 commit characters', () => {
		expect(validateVersions([withChanges({ id: '000000000000' })])).toEqual([
			'Version 000000000000 does not match commit c1abea3de165032fe064300340807b7a6af388f8; expected ID c1abea3de165.',
		]);
	});

	it('rejects duplicate full commit SHAs', () => {
		expect(
			validateVersions([
				versions[0],
				withChanges({ status: 'archived' }),
			]),
		).toEqual([
			'Duplicate commit c1abea3de165032fe064300340807b7a6af388f8 appears in versions c1abea3de165 and c1abea3de165.',
			'Duplicate version ID c1abea3de165 appears for commits c1abea3de165032fe064300340807b7a6af388f8 and c1abea3de165032fe064300340807b7a6af388f8.',
		]);
	});

	it('rejects duplicate IDs even when full commits differ', () => {
		const duplicateId = withChanges({
			commit: 'c1abea3de165ffffffffffffffffffffffffffff',
			status: 'archived',
		});

		expect(validateVersions([versions[0], duplicateId])).toEqual([
			'Duplicate version ID c1abea3de165 appears for commits c1abea3de165032fe064300340807b7a6af388f8 and c1abea3de165ffffffffffffffffffffffffffff.',
		]);
	});

	it('rejects dates that are not real ISO calendar dates', () => {
		expect(
			validateVersions([
				withChanges({
					committedAt: '2026-02-30' as VersionEntry['committedAt'],
				}),
			]),
		).toEqual([
			'Version c1abea3de165 has invalid committedAt date 2026-02-30; expected YYYY-MM-DD.',
		]);
	});

	it('requires at least one declared locale', () => {
		expect(validateVersions([withChanges({ locales: [] })])).toEqual([
			'Version c1abea3de165 must declare at least one locale.',
		]);
	});

	it('requires English among the declared locales', () => {
		expect(validateVersions([withChanges({ locales: ['pt-br'] })])).toEqual([
			'Version c1abea3de165 must declare the English locale (en).',
		]);
	});

	it('requires a non-empty archived label for every declared locale', () => {
		expect(
			validateVersions([
				versions[0],
				{
					...archivedVersion,
					label: { en: 'Archived', 'pt-br': '' },
				},
			]),
		).toEqual([
			'Version d2d2d2d2d2d2 has an empty label for declared locale pt-br.',
		]);
	});

	it('preserves entry and invariant order when returning multiple errors', () => {
		const firstInvalid = withChanges({
			commit: 'invalid-first',
			committedAt: '2026-02-30' as VersionEntry['committedAt'],
			locales: ['pt-br'],
			status: 'archived',
		});
		const secondInvalid = {
			...archivedVersion,
			commit: 'invalid-second',
			label: { en: '', 'pt-br': 'Arquivada' },
		} satisfies VersionEntry;

		expect(validateVersions([firstInvalid, secondInvalid])).toEqual([
			'Version c1abea3de165 has invalid commit invalid-first; expected a 40-character lowercase SHA.',
			'Version c1abea3de165 does not match commit invalid-first; expected ID invalid-firs.',
			'Version c1abea3de165 has invalid committedAt date 2026-02-30; expected YYYY-MM-DD.',
			'Version c1abea3de165 must declare the English locale (en).',
			'Version d2d2d2d2d2d2 has invalid commit invalid-second; expected a 40-character lowercase SHA.',
			'Version d2d2d2d2d2d2 does not match commit invalid-second; expected ID invalid-seco.',
			'Version d2d2d2d2d2d2 has an empty label for declared locale en.',
			'Version manifest must contain exactly one current entry; found 0.',
		]);
	});

	it('looks up versions and defaults to the published manifest', () => {
		expect(getCurrentVersion()).toBe(versions[0]);
		expect(getCurrentVersion([archivedVersion, versions[0]])).toBe(versions[0]);
		expect(getVersion(archivedVersion.id, [versions[0], archivedVersion])).toBe(
			archivedVersion,
		);
		expect(getVersion('missing', [versions[0]])).toBeUndefined();
	});

	it('joins every validation error before current-version lookup throws', () => {
		const invalid = withChanges({
			commit: 'invalid',
			committedAt: '2026-02-30' as VersionEntry['committedAt'],
			status: 'archived',
		});

		expect(() => getCurrentVersion([invalid])).toThrow(
			[
				'Invalid version manifest:',
				'Version c1abea3de165 has invalid commit invalid; expected a 40-character lowercase SHA.',
				'Version c1abea3de165 does not match commit invalid; expected ID invalid.',
				'Version c1abea3de165 has invalid committedAt date 2026-02-30; expected YYYY-MM-DD.',
				'Version manifest must contain exactly one current entry; found 0.',
			].join('\n'),
		);
	});
});
