import { describe, expect, expectTypeOf, it } from 'vitest';
import { versions, type VersionEntry } from '../../src/data/versions';

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
});
