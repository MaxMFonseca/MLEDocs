import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseFrontmatter } from 'astro/markdown';
import { describe, expect, it } from 'vitest';
import { technicalPageMetadataSchema } from '../../src/content.config';

const snapshotDirectory = resolve('src/content/docs/versions/c1abea3de165');
const commit = 'c1abea3de165032fe064300340807b7a6af388f8';

const expected = [
	['start-here/requirements.mdx', 'requirements', ['README.md', 'CMakeLists.txt']],
	['start-here/setup.mdx', 'setup', ['README.md', 'scripts/envsetup.sh']],
	['start-here/build.mdx', 'build', ['CMakeLists.txt', 'scripts/envsetup.sh']],
] as const;

describe('getting-started foundations', () => {
	it.each(expected)('publishes verified canonical metadata for %s', (path, pageId, sourceFiles) => {
		const source = readFileSync(resolve(snapshotDirectory, path), 'utf8');
		const { frontmatter } = parseFrontmatter(source);
		const metadata = technicalPageMetadataSchema.parse(frontmatter);

		expect(frontmatter).toMatchObject({
			contentType: 'technical',
			description: expect.any(String),
			mleCommit: commit,
			maturity: 'in-development',
			audiences: ['integrator', 'contributor'],
			pageId,
			translationStatus: 'canonical',
		});
		expect((frontmatter.description as string).trim()).not.toBe('');
		expect(metadata.sourceFiles).toEqual(expect.arrayContaining(sourceFiles));
		expect(metadata.testFiles).toEqual([]);
	});

	it.each(expected)('keeps %s free of stale or unsupported guidance', (path) => {
		const source = readFileSync(resolve(snapshotDirectory, path), 'utf8');

		expect(source).not.toMatch(/\b(?:TODO|TBD|lorem)\b/i);
		expect(source).not.toMatch(/github\.com\/MaxMFonseca\/MLE\/(?:blob|tree)\/(?:main|master)\//i);
		expect(source).not.toMatch(/\/latest\//i);
		expect(source).not.toMatch(/\bmle_gen_docs\b/i);
	});

	it('pins setup to the documented snapshot and recovers the shader directory state', () => {
		const source = readFileSync(resolve(snapshotDirectory, 'start-here/setup.mdx'), 'utf8');

		expect(source).toContain(`git checkout --detach ${commit}`);
		expect(source).toContain('unset MLE_SHADER_DIRS');
		expect(source).toContain('does not export `MLE_SHADER_DIRS`');
	});

	it('documents build working-directory, artifacts, and helper exit boundaries', () => {
		const source = readFileSync(resolve(snapshotDirectory, 'start-here/build.mdx'), 'utf8');

		expect(source).toContain('Run these commands from the repository root');
		expect(source).toContain('`build/<build_type>/libMLE.a`');
		expect(source).toContain('`build/<build_type>/tests/Core/{Core,AudioLifecycle}`');
		expect(source).toContain('`build/<build_type>/tests/Client/Client`');
		expect(source).toContain('does not prove that Client exited successfully');
	});
});
