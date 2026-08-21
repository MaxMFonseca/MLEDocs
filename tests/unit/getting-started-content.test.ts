import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseFrontmatter } from 'astro/markdown';
import { describe, expect, it } from 'vitest';
import { technicalPageMetadataSchema } from '../../src/content.config';
import { buildSectionIndexModel, navigationSections } from '../../src/data/navigation';
import { versions } from '../../src/data/versions';

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

const contributorFoundations = [
	{
		path: 'contributing/contributor-environment.mdx',
		pageId: 'contributor-environment',
		sources: ['README.md', 'CMakeLists.txt', 'scripts/envsetup.sh', 'src/mle/Entry.inl'],
		tests: [],
		links: [
			'/MLEDocs/versions/c1abea3de165/start-here/setup/',
			'/MLEDocs/versions/c1abea3de165/start-here/build/',
			'/MLEDocs/versions/c1abea3de165/start-here/repository-tour/',
		],
	},
	{
		path: 'contributing/contributor-testing.mdx',
		pageId: 'contributor-testing',
		sources: ['tests/CMakeLists.txt', 'tests/Core/CMakeLists.txt', 'tests/Client/CMakeLists.txt'],
		tests: ['tests/Core/src/Main.cpp', 'tests/Client/src/Main.cpp'],
		links: [
			'/MLEDocs/versions/c1abea3de165/start-here/tests/',
			'/MLEDocs/versions/c1abea3de165/start-here/client/',
		],
	},
	{
		path: 'contributing/resources-shaders.mdx',
		pageId: 'resources-shaders',
		sources: [
			'scripts/envsetup.sh',
			'res/shaders/ui/bg.frag',
			'tests/Core/res/shaders/test.vert',
			'tests/Client/res/shaders/ui/bg.frag',
		],
		tests: [],
		links: [
			'/MLEDocs/versions/c1abea3de165/start-here/build/',
			'/MLEDocs/versions/c1abea3de165/start-here/client/',
		],
	},
	{
		path: 'contributing/documentation.mdx',
		pageId: 'documentation',
		sources: ['README.md', 'scripts/envsetup.sh', 'docs/Doxyfile.in', 'src/mle/mainpage.dox'],
		tests: [],
		links: ['/MLEDocs/versions/c1abea3de165/start-here/repository-tour/'],
	},
	{
		path: 'contributing/translations.mdx',
		pageId: 'translations',
		sources: ['README.md'],
		tests: [],
		links: ['/MLEDocs/versions/c1abea3de165/start-here/repository-tour/'],
	},
] as const;

const contributorPageIds = contributorFoundations.map(({ pageId }) => pageId).sort();

const referenceContracts = [
	{
		path: 'reference/build-options.mdx',
		pageId: 'build-options',
		sources: [
			'CMakeLists.txt',
			'external/CMakeLists.txt',
			'tests/CMakeLists.txt',
			'tests/Core/CMakeLists.txt',
			'tests/Client/CMakeLists.txt',
			'tools/CMakeLists.txt',
			'tools/MLECubes/CMakeLists.txt',
			'scripts/envsetup.sh',
		],
		tests: [],
		evidenceUrls: [
			`https://github.com/MaxMFonseca/MLE/blob/${commit}/CMakeLists.txt`,
			`https://github.com/MaxMFonseca/MLE/blob/${commit}/external/CMakeLists.txt`,
			`https://github.com/MaxMFonseca/MLE/blob/${commit}/tests/CMakeLists.txt`,
			`https://github.com/MaxMFonseca/MLE/blob/${commit}/tests/Core/CMakeLists.txt`,
			`https://github.com/MaxMFonseca/MLE/blob/${commit}/tests/Client/CMakeLists.txt`,
			`https://github.com/MaxMFonseca/MLE/blob/${commit}/tools/CMakeLists.txt`,
			`https://github.com/MaxMFonseca/MLE/blob/${commit}/tools/MLECubes/CMakeLists.txt`,
			`https://github.com/MaxMFonseca/MLE/blob/${commit}/scripts/envsetup.sh`,
		],
		options: [
			'MLE_ENABLE_DOXYGEN',
			'MLE_BUILD_TESTS',
			'MLE_MAX_LOG_LEVEL',
			'MLE_DEFAULT_LOG_LEVEL_STDOUT',
			'SPIRV_REFLECT_STATIC_LIB',
		],
		targets: ['MLE', 'Core', 'AudioLifecycle', 'Client', 'MLECubes'],
	},
	{
		path: 'reference/helper-commands.mdx',
		pageId: 'helper-commands',
		sources: ['scripts/envsetup.sh'],
		tests: [],
		evidenceUrls: [`https://github.com/MaxMFonseca/MLE/blob/${commit}/scripts/envsetup.sh`],
		commands: [
			'mle_setup',
			'mle_config',
			'mle_build',
			'mle_run_test',
			'mle_ber',
			'mle_clean',
			'mle_nvim_dap',
			'mle_add_shader_dirs',
			'mle_compile_shaders_all',
			'mle_gen_docs',
		],
	},
] as const;

const physicalContributorPageIds = (): string[] =>
	readdirSync(resolve(snapshotDirectory, 'contributing'))
		.filter((name) => name.endsWith('.mdx') && name !== 'index.mdx')
		.map((name) => {
			const source = readFileSync(resolve(snapshotDirectory, 'contributing', name), 'utf8');
			return technicalPageMetadataSchema.parse(parseFrontmatter(source).frontmatter).pageId;
		})
		.sort();

describe('getting-started foundations', () => {
	it.each(referenceContracts)(
		'publishes pinned canonical reference metadata and independently enumerated contracts for $pageId',
		(contract) => {
			const source = readFileSync(resolve(snapshotDirectory, contract.path), 'utf8');
			const { frontmatter } = parseFrontmatter(source);
			const metadata = technicalPageMetadataSchema.parse(frontmatter);
			const evidenceUrls = source.match(/https:\/\/github\.com\/MaxMFonseca\/MLE\/(?:blob|tree)\/[^)\s]+/g) ?? [];

			expect(frontmatter).toMatchObject({
				contentType: 'technical',
				description: expect.any(String),
				mleCommit: commit,
				maturity: 'in-development',
				audiences: ['integrator', 'contributor'],
				pageId: contract.pageId,
				translationStatus: 'canonical',
			});
			expect((frontmatter.description as string).trim()).not.toBe('');
			expect(metadata.sourceFiles).toEqual([...contract.sources]);
			expect(metadata.testFiles).toEqual(contract.tests);
			expect(evidenceUrls).toEqual([...contract.evidenceUrls]);
			for (const option of 'options' in contract ? contract.options : []) expect(source).toContain(`\`${option}\``);
			for (const target of 'targets' in contract ? contract.targets : []) expect(source).toContain(`\`${target}\``);
			for (const command of 'commands' in contract ? contract.commands : []) expect(source).toContain(`\`${command}\``);
			expect(source).toContain('/MLEDocs/versions/c1abea3de165/');
			expect(source).not.toMatch(/\/latest\//i);
		},
	);

	it('keeps the destructive and obsolete helper boundaries in their command contracts', () => {
		const source = readFileSync(resolve(snapshotDirectory, 'reference/helper-commands.mdx'), 'utf8');
		const commandRow = (command: string) => source.split('\n').find((line) => line.startsWith(`| \`${command}\``)) ?? '';

		const config = commandRow('mle_config');
		expect(config).toContain('uses `.` as the destination directory for `compile_commands.json`');
		expect(config).toContain('final `ln` status becomes the function result');

		const build = commandRow('mle_build');
		expect(build).toContain('When shader files are found, `glslangValidator` and usable shader directories are operational requirements');
		expect(build).toContain('`No shaders found.` can return `0`');

		const compileShaders = commandRow('mle_compile_shaders_all');
		expect(compileShaders).toContain('A sourced helper/root context and syntactically valid options are baseline preconditions');
		expect(compileShaders).toContain('Shader directories and eligible files may be absent or empty; `No shaders found.` returns `0`');
		expect(compileShaders).toContain('Only after eligible shaders are found and parallel jobs launch do usable `nproc` output and `glslangValidator` become operational requirements');
		expect(compileShaders).toContain('Missing directories are reported and skipped');
		expect(compileShaders).toContain('`Some shaders failed.` and returns `1`');

		const runTest = commandRow('mle_run_test');
		expect(runTest).toContain('does not validate that the selected target exists');
		expect(runTest).toContain('Deletes and recreates `build/<build_type>/tests/<name>/res`');
		expect(runTest).toContain('`mle` and `i` links');
		expect(runTest).toContain('suppressed with `2>/dev/null`');

		const clean = commandRow('mle_clean');
		expect(clean).toContain('Recursively removes `${_MLE_ROOT}/build`');
		expect(clean).toContain('relative `compile_commands.json` and `latest.log`');

		const obsolete = source.slice(source.indexOf('## `mle_gen_docs`'), source.indexOf('## Command contracts'));
		expect(obsolete).toContain('**Obsolete workflow — excluded from MLEDocs.**');
		expect(obsolete).toContain('not authority for this documentation site');
	});

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
		expect(metadata.sourceFiles).toEqual(expect.arrayContaining([...sources]));
		expect(metadata.testFiles).toEqual(tests);
	});

	it.each(contributorFoundations)(
		'publishes canonical contributor metadata, registry parity, and immutable Start Here links for $pageId',
		({ path, pageId, sources, tests, links }) => {
			const source = readFileSync(resolve(snapshotDirectory, path), 'utf8');
			const { frontmatter } = parseFrontmatter(source);
			const metadata = technicalPageMetadataSchema.parse(frontmatter);
			const contributing = navigationSections.find((section) => section.pageId === 'contributing');

			expect(frontmatter).toMatchObject({
				contentType: 'technical',
				description: expect.any(String),
				mleCommit: commit,
				maturity: 'in-development',
				audiences: ['contributor'],
				pageId,
				translationStatus: 'canonical',
			});
			expect((frontmatter.description as string).trim()).not.toBe('');
			expect(metadata.sourceFiles).toEqual(expect.arrayContaining([...sources]));
			expect(metadata.testFiles).toEqual(tests);
			expect(contributing?.plannedGroups.flatMap((group) => group.children).map((child) => child.pageId)).toContain(pageId);
			for (const link of links) expect(source).toContain(link);
			expect(source).not.toMatch(/\/latest\//i);
		},
	);

	it('keeps the complete physical contributor page-ID set aligned with the complete Contributing registry set', () => {
		const contributing = navigationSections.find((section) => section.pageId === 'contributing');
		const registryPageIds = contributing?.plannedGroups
			.flatMap((group) => group.children)
			.map((child) => child.pageId)
			.sort();

		expect(physicalContributorPageIds()).toEqual(contributorPageIds);
		expect(registryPageIds).toEqual(contributorPageIds);
	});

	it('models the Contributing hub with exactly five available children and no planned groups', () => {
		const model = buildSectionIndexModel({
			sectionId: 'contributing',
			version: versions[0],
			locale: 'en',
			pages: [
				{
					pageId: 'contributing',
					locale: 'en',
					versionId: 'c1abea3de165',
					slug: 'contributing',
					translationStatus: 'canonical',
				},
				...physicalContributorPageIds().map((pageId) => ({
					pageId,
					locale: 'en' as const,
					versionId: 'c1abea3de165',
					slug: `contributing/${pageId}`,
					translationStatus: 'canonical' as const,
				})),
			],
		});

		expect(model.available.map((child) => child.pageId).sort()).toEqual(contributorPageIds);
		expect(model.plannedGroups).toEqual([]);
	});

	it('keeps contributor testing expectations separate from the Start Here focused invocation', () => {
		const source = readFileSync(resolve(snapshotDirectory, 'contributing/contributor-testing.mdx'), 'utf8');

		expect(source).toContain('/MLEDocs/versions/c1abea3de165/start-here/tests/');
		expect(source).not.toContain('mle_run_test -n Core -t Debug -- --gtest_filter=AnimationTest.*');
	});

	it('localizes internal documentation links while preserving protected translation literals', () => {
		const source = readFileSync(resolve(snapshotDirectory, 'contributing/translations.mdx'), 'utf8');

		expect(source).toContain('/MLEDocs/pt-br/versions/c1abea3de165/...');
		expect(source).toContain('code, configuration, command, and source-evidence literals');
		expect(source).not.toContain('paths, URLs, MLE identifiers, log output, page IDs, and commit identities exactly');
	});

	it('routes tool-resource reachability through the repository tour rather than claiming it here', () => {
		const source = readFileSync(resolve(snapshotDirectory, 'contributing/resources-shaders.mdx'), 'utf8');

		expect(source).toContain('/MLEDocs/versions/c1abea3de165/start-here/repository-tour/');
		expect(source).not.toContain("A tool's `res/` tree");
	});

	it('marks mle_gen_docs obsolete and excluded from the MLEDocs workflow', () => {
		const source = readFileSync(resolve(snapshotDirectory, 'contributing/documentation.mdx'), 'utf8');

		expect(source).toContain('`mle_gen_docs` is obsolete');
		expect(source).toContain('excluded from the MLEDocs workflow');
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
