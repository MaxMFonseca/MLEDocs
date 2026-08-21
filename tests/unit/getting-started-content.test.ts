import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseFrontmatter } from 'astro/markdown';
import { describe, expect, it } from 'vitest';
import { technicalPageMetadataSchema } from '../../src/content.config';

const snapshotDirectory = resolve('src/content/docs/versions/c1abea3de165');
const commit = 'c1abea3de165032fe064300340807b7a6af388f8';

const expected = [
	{ path: 'start-here/requirements.mdx', pageId: 'requirements', sources: ['README.md', 'CMakeLists.txt'], tests: [] },
	{ path: 'start-here/setup.mdx', pageId: 'setup', sources: ['README.md', 'scripts/envsetup.sh'], tests: [] },
	{ path: 'start-here/build.mdx', pageId: 'build', sources: ['CMakeLists.txt', 'scripts/envsetup.sh'], tests: [] },
	{
		path: 'start-here/tests.mdx',
		pageId: 'tests',
		sources: ['tests/CMakeLists.txt', 'tests/Core/CMakeLists.txt', 'scripts/envsetup.sh'],
		tests: ['tests/Core/src/Main.cpp'],
	},
	{
		path: 'start-here/client.mdx',
		pageId: 'client',
		sources: [
			'README.md',
			'tests/Client/CMakeLists.txt',
			'tests/Client/src/Main.cpp',
			'tests/Client/src/layers/Init.cpp',
			'src/mle/client/Client.cpp',
			'scripts/envsetup.sh',
		],
		tests: [],
	},
	{
		path: 'start-here/repository-tour.mdx',
		pageId: 'repository-tour',
		sources: [
			'CMakeLists.txt',
			'README.md',
			'tools/CMakeLists.txt',
			'tools/MLECubes/CMakeLists.txt',
			'tools/MLECubes/src/Main.cpp',
			'docs/Doxyfile.in',
			'docs/footer.html',
			'docs/style.css',
			'src/mle/mainpage.dox',
			'docs/media/gameplay.png',
		],
		tests: [],
	},
	{
		path: 'start-here/troubleshooting.mdx',
		pageId: 'troubleshooting',
		sources: ['scripts/envsetup.sh', 'CMakeLists.txt', 'external/CMakeLists.txt'],
		tests: [],
	},
] as const;

describe('getting-started foundations', () => {
	it.each(expected)('publishes verified canonical metadata for $path', ({ path, pageId, sources, tests }) => {
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
		expect(metadata.sourceFiles).toEqual(expect.arrayContaining(sources));
		expect(metadata.testFiles).toEqual(tests);
	});

	it.each(expected)('keeps $path free of stale or unsupported guidance', ({ path }) => {
		const source = readFileSync(resolve(snapshotDirectory, path), 'utf8');

		expect(source).not.toMatch(/\b(?:TODO|TBD|lorem)\b/i);
		expect(source).not.toMatch(new RegExp(`github\\.com/MaxMFonseca/MLE/(?:blob|tree)/(?!${commit}/)`, 'i'));
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

	it('distinguishes the automated Core suite from the interactive Client demonstration', () => {
		const tests = readFileSync(resolve(snapshotDirectory, 'start-here/tests.mdx'), 'utf8');

		expect(tests).toContain('Automated verification');
		expect(tests).toContain('Interactive demonstration');
	});

	it('documents exact executable locations and the resource-reset loss before test links are recreated', () => {
		const tests = readFileSync(resolve(snapshotDirectory, 'start-here/tests.mdx'), 'utf8');

		expect(tests).toContain('`build/<build_type>/tests/Core/Core`');
		expect(tests).toContain('`build/<build_type>/tests/Core/AudioLifecycle`');
		expect(tests).toContain('`build/<build_type>/tests/Client/Client`');
		expect(tests).toContain('`build/<build_type>/tests/<name>/res`');
		expect(tests).toContain('deletes `build/<build_type>/tests/<name>/res` recursively');
		expect(tests).toContain('suppressed');
		expect(tests).toContain('dangling `i` link');
	});

	it('publishes the Client target and launch path', () => {
		const client = readFileSync(resolve(snapshotDirectory, 'start-here/client.mdx'), 'utf8');

		expect(client).toContain('`Client`');
		expect(client).toContain('mle_ber -n Client -t Debug');
	});

	it('documents Client layer setup, input routing, and the window-close stop boundary', () => {
		const client = readFileSync(resolve(snapshotDirectory, 'start-here/client.mdx'), 'utf8');

		expect(client).toContain('`mle::user::InitLayer`');
		expect(client).toContain('`mle::user::PerfLayer`');
		expect(client).toContain('`mle::user::TerminalLayer`');
		expect(client).toContain('`Window::i().poolEvents()`');
		expect(client).toContain('`UserInputManager::i().update()`');
		expect(client).toContain('`UserInputManager::i().lateUpdate()`');
		expect(client).toContain('closing the window requests stop');
	});

	it('labels vendored and obsolete repository material without treating it as first-party guidance', () => {
		const tour = readFileSync(resolve(snapshotDirectory, 'start-here/repository-tour.mdx'), 'utf8');

		expect(tour).toContain('vendored');
		expect(tour).toContain('obsolete Doxygen');
	});

	it('structures troubleshooting around evidence and avoids unresolved broad deletion guidance', () => {
		const troubleshooting = readFileSync(resolve(snapshotDirectory, 'start-here/troubleshooting.mdx'), 'utf8');

		for (const symptom of [
			'Sourced functions are unavailable',
			'Submodules or LuaJIT are missing',
			'CMake, compiler, or C++23 configuration fails',
			'Vulkan discovery or shader compiler fails',
			'ICU, OpenAL, or LuaJIT discovery fails',
			'Test or Client resources are missing',
			'A build directory behaves as if options are stale',
			'Windows behavior is not established',
		]) {
			expect(troubleshooting).toContain(`## ${symptom}`);
		}
		expect(troubleshooting).toContain('**Likely cause:**');
		expect(troubleshooting).toContain('**Check:**');
		expect(troubleshooting).toContain('**Recovery:**');
		expect(troubleshooting).toContain('`${_MLE_ROOT}/build`');
		expect(troubleshooting).toContain('`No shaders found.`');
		expect(troubleshooting).toContain('returns 0');
		expect(troubleshooting).toContain('`Some shaders failed.`');
		expect(troubleshooting).not.toMatch(/(?:rm|Remove-Item)\s+-[A-Za-z]*r[A-Za-z]*f?\s+(?:\$\{?\w+\}?|\$\w+|~|\*)/i);
	});
});
