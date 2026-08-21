import { describe, expect, it } from 'vitest';
import { buildPinnedSourceUrl } from '../../src/lib/content/source-evidence';

const repository = 'https://github.com/MaxMFonseca/MLE';
const commit = 'c1abea3de165032fe064300340807b7a6af388f8';

describe('pinned source evidence', () => {
	it('uses the full SHA and preserves hierarchy', () => {
		expect(buildPinnedSourceUrl(repository, commit, 'scripts/envsetup.sh')).toBe(
			`${repository}/blob/${commit}/scripts/envsetup.sh`,
		);
	});

	it('encodes path segments but not slashes', () => {
		expect(buildPinnedSourceUrl(repository, commit, 'tests/Client/file name.txt')).toBe(
			`${repository}/blob/${commit}/tests/Client/file%20name.txt`,
		);
	});

	it.each(['../README.md', '/README.md', 'README.md#L1', 'README.md?raw=1'])(
		'rejects unsafe path %s',
		(path) => expect(() => buildPinnedSourceUrl(repository, commit, path)).toThrow(),
	);
});
