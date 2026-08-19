import { describe, expect, it } from 'vitest';
import { versions } from '../../src/data/versions';
import { withBase, docsPath } from '../../src/lib/links/base';
import { mleSourceUrl } from '../../src/lib/links/source';

const version = versions[0];

describe('documentation links', () => {
	it('normalizes a path beneath the supplied base', () => {
		expect(withBase('/versions/a/', '/MLEDocs/')).toBe('/MLEDocs/versions/a/');
		expect(withBase('versions/a', 'docs')).toBe('/docs/versions/a/');
	});

	it('uses the MLEDocs base by default', () => {
		expect(withBase('/versions/a/')).toBe('/MLEDocs/versions/a/');
	});

	it('builds English version documentation paths', () => {
		expect(docsPath({ locale: 'en', versionId: 'c1abea3de165', slug: 'systems/core' }))
			.toBe('/MLEDocs/versions/c1abea3de165/systems/core/');
	});

	it('builds localized version documentation paths', () => {
		expect(docsPath({ locale: 'pt-br', versionId: 'c1abea3de165', slug: 'systems/core' }))
			.toBe('/MLEDocs/pt-br/versions/c1abea3de165/systems/core/');
	});

	it('normalizes optional documentation slugs beneath a custom base', () => {
		expect(
			docsPath({
				base: '/preview/',
				locale: 'en',
				versionId: 'c1abea3de165',
				slug: '/systems/core/',
			}),
		).toBe('/preview/versions/c1abea3de165/systems/core/');
	});

	it('creates pinned MLE source URLs from the full commit SHA', () => {
		expect(mleSourceUrl(version, 'src/mle/core/Core.h', 13)).toBe(
			'https://github.com/MaxMFonseca/MLE/blob/c1abea3de165032fe064300340807b7a6af388f8/src/mle/core/Core.h#L13',
		);
	});

	it('encodes source path segments without encoding separators', () => {
		expect(mleSourceUrl(version, 'src/mle/core/Core File.h')).toBe(
			'https://github.com/MaxMFonseca/MLE/blob/c1abea3de165032fe064300340807b7a6af388f8/src/mle/core/Core%20File.h',
		);
	});

	it('rejects unsafe source paths', () => {
		for (const path of [
			'..',
			'../secrets.txt',
			'src/../secrets.txt',
			'src\\mle\\core\\Core.h',
			'https://example.com/Core.h',
		]) {
			expect(() => mleSourceUrl(version, path)).toThrow();
		}
	});

	it('rejects source URLs for non-manifest versions', () => {
		expect(() =>
			mleSourceUrl({ ...version, id: 'not-a-version' }, 'src/mle/core/Core.h'),
		).toThrow();
		expect(() =>
			mleSourceUrl(
				{ ...version, commit: 'd2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2' },
				'src/mle/core/Core.h',
			),
		).toThrow();
	});

	it('rejects invalid source line numbers', () => {
		expect(() => mleSourceUrl(version, 'src/mle/core/Core.h', -1)).toThrow();
		expect(() => mleSourceUrl(version, 'src/mle/core/Core.h', 0)).toThrow();
		expect(() => mleSourceUrl(version, 'src/mle/core/Core.h', Number.NaN)).toThrow();
		expect(() => mleSourceUrl(version, 'src/mle/core/Core.h', Number.POSITIVE_INFINITY)).toThrow();
		expect(() => mleSourceUrl(version, 'src/mle/core/Core.h', 1.5)).toThrow();
	});
});
