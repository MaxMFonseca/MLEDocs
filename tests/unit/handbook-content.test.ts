import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseFrontmatter } from 'astro/markdown';
import { describe, expect, it } from 'vitest';
import { handbookPages } from '../../src/data/handbook';
import { technicalPageMetadataSchema } from '../../src/lib/content/schema';
import { pinnedMleCommit, uiGuideSourceManifest } from '../fixtures/ui-guide-source-manifest';

const commit = pinnedMleCommit;
const docsRoot = resolve('src/content/docs/versions/c1abea3de165');

const publishedReferenceExpectations = [
	{
		pageId: 'lua-api', slug: 'reference/lua-api',
		rows: ['vector-constructors', 'entt-validity'],
	},
	{
		pageId: 'ui-element-keys', slug: 'reference/ui-element-keys',
		rows: ['getter-registry', 'renderable-keys', 'text-input-keys', 'hovered-getter'],
	},
	{
		pageId: 'ui-components', slug: 'reference/ui-components',
		rows: ['renderable-ownership'],
	},
	{
		pageId: 'ui-events-and-callbacks-reference', slug: 'reference/ui-events-and-callbacks',
		rows: ['hover-callbacks'],
	},
	{
		pageId: 'ui-layout-values', slug: 'reference/ui-layout-values',
		rows: ['target-bound-root', 'list-direction', 'list-justify', 'list-cross-align', 'list-wrap'],
	},
] as const;

function contractRows(text: string): ReadonlyMap<string, string> {
	return new Map(
		[...text.matchAll(/<tr data-contract-row="([^"]+)">(.*?)<\/tr>/gs)].map((match) => [match[1], match[2]]),
	);
}

interface ReferenceRowRecord {
	readonly rowId: string;
	readonly pageId: string;
}

function compareReferenceRows(expected: readonly ReferenceRowRecord[], actual: readonly ReferenceRowRecord[]) {
	const key = ({ rowId }: ReferenceRowRecord) => rowId;
	const expectedOwners = new Map(expected.map((record) => [record.rowId, record.pageId]));
	const actualOwners = new Map(actual.map((record) => [record.rowId, record.pageId]));
	const counts = new Map<string, number>();
	for (const record of actual) counts.set(key(record), (counts.get(key(record)) ?? 0) + 1);
	return {
		missing: expected.filter((record) => !actualOwners.has(record.rowId)).map(key).sort(),
		extra: actual.filter((record) => !expectedOwners.has(record.rowId)).map(key).sort(),
		duplicates: [...counts].filter(([, count]) => count > 1).map(([rowId]) => rowId).sort(),
		misowned: actual
			.filter((record) => expectedOwners.has(record.rowId) && expectedOwners.get(record.rowId) !== record.pageId)
			.map(key)
			.sort(),
	};
}

const contracts = [
	['architecture', 'concepts/architecture', ['core', 'client', 'renderer', 'lua', 'ui']],
	['lifecycle-and-ownership', 'concepts/lifecycle-and-ownership', ['core', 'client']],
	['errors-and-diagnostics', 'concepts/errors-and-diagnostics', ['core']],
	['threading-and-synchronization', 'concepts/threading-and-synchronization', ['core', 'utilities', 'renderer', 'ui']],
	['core', 'systems/core', ['core']],
	['runtime-configuration', 'systems/core/runtime-configuration', ['core']],
	['core-threading-and-performance', 'systems/core/threading-and-performance', ['core']],
	['math', 'systems/math', ['math']],
	['geometry-and-intersections', 'systems/math/geometry-and-intersections', ['math']],
	['lua-json-and-numerics', 'systems/math/lua-json-and-numerics', ['math', 'lua']],
	['utilities', 'systems/utilities', ['utilities']],
	['events-and-concurrency', 'systems/utilities/events-and-concurrency', ['utilities']],
	['data-color-and-packing', 'systems/utilities/data-color-and-packing', ['utilities', 'lua']],
	['core-math-utility-types', 'reference/core-math-utility-types', ['core', 'math', 'utilities']],
] as const;

const rendererContracts = [
	['frame-and-resource-flow', 'concepts/frame-and-resource-flow', ['renderer']],
	['renderer-overview', 'systems/renderer', ['renderer']],
	['frame-vulkan-and-queues', 'systems/renderer/frame-vulkan-and-queues', ['renderer']],
	['renderer-resources-and-synchronization', 'systems/renderer/resources-and-synchronization', ['renderer']],
	['shaders-and-pipelines', 'systems/renderer/shaders-and-pipelines', ['renderer']],
	['targets-text-and-composition', 'systems/renderer/targets-text-and-composition', ['renderer']],
	['models', 'systems/models', ['renderer', 'models']],
	['loading-meshes-and-materials', 'systems/models/loading-meshes-and-materials', ['renderer', 'models']],
	['animation-skeletons-and-cameras', 'systems/models/animation-skeletons-and-cameras', ['renderer', 'models']],
	['create-a-shader-and-pipeline', 'guides/create-a-shader-and-pipeline', ['renderer']],
	['upload-and-render-a-model', 'guides/upload-and-render-a-model', ['renderer', 'models']],
	['control-camera-and-animation', 'guides/control-camera-and-animation', ['renderer', 'models']],
	['renderer-and-resource-contracts', 'reference/renderer-and-resource-contracts', ['renderer', 'models']],
] as const;

const luaUiFoundationContracts = [
	['cpp-lua-boundary', 'concepts/cpp-lua-boundary', ['lua']],
	['ui-composition', 'concepts/ui-composition', ['ui', 'lua']],
	['lua', 'systems/lua', ['lua']],
	['runtime-calls-and-bindings', 'systems/lua/runtime-calls-and-bindings', ['lua']],
	['ui', 'systems/ui', ['ui', 'lua']],
	['entities-hierarchy-and-layout', 'systems/ui/entities-hierarchy-and-layout', ['ui', 'lua']],
	['rendering-and-visuals', 'systems/ui/rendering-and-visuals', ['ui', 'renderer']],
	['text-input-and-focus', 'systems/ui/text-input-and-focus', ['ui', 'window']],
	['ui-events-and-callbacks', 'systems/ui/events-and-callbacks', ['ui', 'lua', 'window']],
] as const;

const luaUiAdvancedContracts = [
	['scrolling-and-popups', 'systems/ui/scrolling-and-popups', ['ui', 'lua']],
	['animation-and-effects', 'systems/ui/animation-and-effects', ['ui', 'renderer']],
	['reusable-components', 'systems/ui/reusable-components', ['ui', 'lua']],
	['build-a-ui-screen', 'guides/build-a-ui-screen', ['ui', 'lua']],
	['create-a-reusable-ui-component', 'guides/create-a-reusable-ui-component', ['ui', 'lua']],
	['build-a-form-and-handle-input', 'guides/build-a-form-and-handle-input', ['ui', 'window']],
	['add-scrolling-and-popups', 'guides/add-scrolling-and-popups', ['ui', 'lua']],
	['animate-and-style-ui', 'guides/animate-and-style-ui', ['ui', 'renderer']],
	['use-sprites-images-and-nine-slice', 'guides/use-sprites-images-and-nine-slice', ['ui', 'renderer']],
	['lua-api', 'reference/lua-api', ['lua', 'ui']],
	['ui-element-keys', 'reference/ui-element-keys', ['ui', 'lua']],
	['ui-components', 'reference/ui-components', ['ui', 'lua']],
	['ui-events-and-callbacks-reference', 'reference/ui-events-and-callbacks', ['ui', 'lua', 'window']],
	['ui-layout-values', 'reference/ui-layout-values', ['ui', 'lua']],
	['ui-test', 'tools/ui-test', ['ui', 'lua']],
] as const;

const audioContracts = [
	['audio', 'systems/audio', ['audio', 'client']],
	['audio-lifecycle-and-command-flow', 'systems/audio/lifecycle-and-command-flow', ['audio', 'client']],
	['playback-and-streaming', 'systems/audio/playback-and-streaming', ['audio']],
	['buses-voices-and-limitations', 'systems/audio/buses-voices-and-limitations', ['audio']],
	['use-audio-playback', 'guides/use-audio-playback', ['audio', 'lua']],
	['audio-contracts', 'reference/audio-contracts', ['audio', 'lua']],
	['audio-test', 'tools/audio-test', ['audio', 'client', 'ui']],
] as const;

const clientPlatformContracts = [
	['audio-and-client-flow', 'concepts/audio-and-client-flow', ['audio', 'client'], 'in-development'],
	['client-system', 'systems/client', ['client'], 'in-development'],
	['window', 'systems/window', ['window'], 'in-development'],
	['server', 'systems/server', ['server'], 'experimental'],
	['create-a-client-layer', 'guides/create-a-client-layer', ['client'], 'in-development'],
	['handle-input-focus-and-text', 'guides/handle-input-focus-and-text', ['window', 'ui'], 'in-development'],
	['window-and-input-contracts', 'reference/window-and-input-contracts', ['window', 'ui'], 'in-development'],
	['interactive-client', 'tools/interactive-client', ['client', 'window', 'ui'], 'in-development'],
] as const;

const toolTestContracts = [
	['core-test-suite', 'tools/core-test-suite', ['core', 'tests']],
	['model-test', 'tools/model-test', ['models', 'renderer', 'client']],
	['test-fixtures', 'tools/test-fixtures', ['tests', 'project']],
	['mlecubes', 'tools/mlecubes', ['tools', 'ui']],
	['tests-and-interactive-pages', 'contributing/tests-and-interactive-pages', ['tests', 'project']],
] as const;

const ownership: Readonly<Record<string, { sourceFiles: readonly string[]; testFiles: readonly string[] }>> = {
	architecture: {
		sourceFiles: ['src/mle/Entry.inl', 'src/mle/core/Core.cpp', 'src/mle/client/Client.cpp'],
		testFiles: ['tests/Client/src/Main.cpp'],
	},
	'lifecycle-and-ownership': {
		sourceFiles: ['src/mle/Entry.inl', 'src/mle/core/Core.cpp', 'src/mle/core/Logger.cpp', 'src/mle/client/Client.cpp'],
		testFiles: ['tests/Client/src/Main.cpp'],
	},
	'errors-and-diagnostics': {
		sourceFiles: ['src/mle/core/Result.h', 'src/mle/core/Unwrap.h', 'src/mle/core/Assert.h', 'src/mle/core/Core.cpp', 'src/mle/core/Logger.cpp'],
		testFiles: ['tests/Core/src/utils/T.String.cpp'],
	},
	'threading-and-synchronization': {
		sourceFiles: [
			'src/mle/core/ThreadPool.cpp', 'src/mle/core/ThreadPool.h', 'src/mle/core/PerfTracker.cpp', 'src/mle/core/PerfTracker.h',
			'src/mle/utils/EventDispatcher.h', 'src/mle/utils/containers/TSQueue.h', 'src/mle/utils/containers/AtomicTripleBuffer.h',
			'src/mle/renderer/SyncManager.cpp', 'src/mle/ui/systems/Rendering.cpp',
		],
		testFiles: ['tests/Core/src/core/T.ThreadPool.cpp'],
	},
	core: {
		sourceFiles: [
			'src/mle/Entry.inl', 'src/mle/core/Assert.h', 'src/mle/core/Consts.h', 'src/mle/core/Core.cpp', 'src/mle/core/Core.h',
			'src/mle/core/Logger.cpp', 'src/mle/core/Logger.h', 'src/mle/core/Result.h', 'src/mle/core/Types.h', 'src/mle/core/Unwrap.h',
		],
		testFiles: ['tests/Client/src/Main.cpp'],
	},
	'runtime-configuration': {
		sourceFiles: ['src/mle/core/RuntimeConfig.cpp', 'src/mle/core/RuntimeConfig.h'],
		testFiles: ['tests/Core/src/utils/T.String.cpp'],
	},
	'core-threading-and-performance': {
		sourceFiles: ['src/mle/core/ThreadPool.cpp', 'src/mle/core/ThreadPool.h', 'src/mle/core/PerfTracker.cpp', 'src/mle/core/PerfTracker.h'],
		testFiles: ['tests/Core/src/core/T.ThreadPool.cpp'],
	},
	math: {
		sourceFiles: ['src/mle/math/Types.h', 'src/mle/math/Types2D.cpp', 'src/mle/math/Types2D.h', 'src/mle/math/Types3D.cpp', 'src/mle/math/Types3D.h', 'src/mle/math/Utils.cpp', 'src/mle/math/Utils.h'],
		testFiles: ['tests/Core/src/math/T.Types2D.cpp'],
	},
	'geometry-and-intersections': {
		sourceFiles: ['src/mle/math/Types2D.cpp', 'src/mle/math/Types2D.h', 'src/mle/math/Types3D.cpp', 'src/mle/math/Types3D.h', 'src/mle/math/Intersect2D.cpp', 'src/mle/math/Intersect2D.h'],
		testFiles: ['tests/Core/src/math/T.Types2D.cpp'],
	},
	'lua-json-and-numerics': {
		sourceFiles: ['src/mle/math/LuaUTMathTypes.h', 'src/mle/math/Json.h', 'src/mle/math/Utils.cpp', 'src/mle/math/Utils.h'],
		testFiles: ['tests/Core/src/math/T.Types2D.cpp'],
	},
	utilities: {
		sourceFiles: ['src/mle/utils/Types.h', 'src/mle/utils/Utils.cpp', 'src/mle/utils/Utils.h', 'src/mle/utils/ECS.h', 'src/mle/utils/SystemState.h'],
		testFiles: ['tests/Core/src/utils/Utils.h'],
	},
	'events-and-concurrency': {
		sourceFiles: ['src/mle/utils/EventDispatcher.h', 'src/mle/utils/LockedData.h', 'src/mle/utils/containers/AtomicQueue.h', 'src/mle/utils/containers/AtomicTripleBuffer.h', 'src/mle/utils/containers/TSQueue.h'],
		testFiles: ['tests/Core/src/core/T.ThreadPool.cpp'],
	},
	'data-color-and-packing': {
		sourceFiles: [
			'src/mle/utils/File.cpp', 'src/mle/utils/File.h', 'src/mle/utils/String.cpp', 'src/mle/utils/String.h', 'src/mle/utils/ID.cpp',
			'src/mle/utils/ID.h', 'src/mle/utils/RNG.cpp', 'src/mle/utils/RNG.h', 'src/mle/utils/Flags.h', 'src/mle/utils/Hash.h',
			'src/mle/utils/Stopwatch.h', 'src/mle/utils/Color.cpp', 'src/mle/utils/Color.h', 'src/mle/utils/ColorCache.cpp',
			'src/mle/utils/ColorCache.h', 'src/mle/utils/Justify.h', 'src/mle/utils/RectPacker.cpp', 'src/mle/utils/RectPacker.h',
			'src/mle/utils/LuaUTUtils.h',
		],
		testFiles: ['tests/Core/src/utils/T.String.cpp', 'tests/Core/src/utils/T.Justify.cpp', 'tests/Core/src/utils/T.RectPacker.cpp', 'tests/Core/src/utils/Utils.h'],
	},
	'core-math-utility-types': {
		sourceFiles: [
			'src/mle/core/Result.h', 'src/mle/core/Types.h', 'src/mle/core/Logger.h', 'src/mle/math/Types.h', 'src/mle/math/Types2D.h',
			'src/mle/math/Types3D.h', 'src/mle/math/Utils.h', 'src/mle/utils/Types.h', 'src/mle/utils/SystemState.h',
			'src/mle/utils/ID.h', 'src/mle/utils/Flags.h', 'src/mle/utils/Color.h', 'src/mle/utils/Justify.h',
		],
		testFiles: ['tests/Core/src/core/T.ThreadPool.cpp', 'tests/Core/src/math/T.Types2D.cpp', 'tests/Core/src/utils/T.String.cpp', 'tests/Core/src/utils/T.Justify.cpp', 'tests/Core/src/utils/T.RectPacker.cpp'],
	},
};

function source(slug: string): string {
	const direct = resolve(docsRoot, `${slug}.mdx`);
	return readFileSync(existsSync(direct) ? direct : resolve(docsRoot, `${slug}/index.mdx`), 'utf8');
}

describe('runtime foundations handbook content', () => {
	it('publishes the 14 source-authored pages beside the existing renderer page', () => {
		expect(
			handbookPages
				.filter(({ publication }) => publication === 'published')
				.map(({ pageId }) => pageId)
				.sort(),
		).toEqual([...contracts.map(([pageId]) => pageId), ...rendererContracts.map(([pageId]) => pageId), ...luaUiFoundationContracts.map(([pageId]) => pageId), ...luaUiAdvancedContracts.map(([pageId]) => pageId), ...audioContracts.map(([pageId]) => pageId), ...clientPlatformContracts.map(([pageId]) => pageId), ...toolTestContracts.map(([pageId]) => pageId)].sort());
	});

	it.each(contracts)('%s has pinned, canonical technical metadata', (pageId, slug, subsystems) => {
		const text = source(slug);
		const parsed = parseFrontmatter(text);
		const metadata = technicalPageMetadataSchema.parse(parsed.frontmatter);
		const registry = handbookPages.find((page) => page.pageId === pageId);
		const files = ownership[pageId];
		if (!files) throw new Error(`Missing ownership contract for ${pageId}.`);

		expect(parsed.frontmatter.contentType).toBe('technical');
		expect(metadata).toMatchObject({
			mleCommit: commit,
			maturity: 'in-development',
			pageId,
			translationStatus: 'canonical',
		});
		expect(metadata.audiences).toEqual(expect.arrayContaining(['integrator', 'contributor']));
		expect(metadata.subsystems).toEqual(subsystems);
		expect(metadata.sourceFiles).toEqual(files.sourceFiles);
		expect(metadata.testFiles).toEqual(files.testFiles);
		expect(metadata.lastVerified).toBe('2026-08-21');
		expect(registry).toMatchObject({ pageId, publication: 'published', slug });
		expect(text).toContain(`github.com/MaxMFonseca/MLE/blob/${commit}/`);
		expect(text).not.toMatch(/github\.com\/MaxMFonseca\/MLE\/(?:blob|tree)\/(?!c1abea3de165032fe064300340807b7a6af388f8)/);
		expect(text).not.toMatch(/\b(?:TBD|lorem ipsum|Doxygen)\b/i);
	});

	it('explains the observed startup, ownership, and shutdown gaps without promising them away', () => {
		expect(source('concepts/architecture')).toMatch(/Entry.*Core::init.*Client::init.*run/s);
		expect(source('concepts/architecture')).toMatch(/render thread/i);
		const lifecycle = source('concepts/lifecycle-and-ownership');
		expect(lifecycle).toMatch(/PerfTracker.*ThreadPool/s);
		expect(lifecycle).toMatch(/Entry\.inl.*performs no Core shutdown/is);
		expect(lifecycle).toMatch(/commented.*`mle::shutdown\(\)`.*unresolved/is);
		expect(lifecycle).not.toMatch(/Core::shutdown`?;? (?:its )?call is commented|Core shutdown (?:is|remains|was|left) commented/i);
		expect(lifecycle).toMatch(/Logger.*not.*shut down/i);
		expect(lifecycle).toMatch(/header visibility.*stability/i);

		const core = source('systems/core');
		expect(core).toMatch(/Entry.*performs no Core shutdown.*commented.*`mle::shutdown\(\)`.*unresolved/is);
		expect(core).not.toMatch(/leaves Core shutdown commented|Core shutdown (?:is|remains|was|left) commented/i);
	});

	it('states the error and diagnostic control contracts', () => {
		const text = source('concepts/errors-and-diagnostics');
		expect(text).toMatch(/isError.*NOK/s);
		expect(text).toMatch(/Expected<T>.*std::expected/s);
		expect(text).toMatch(/unwrap.*unrecoverable.*abort/s);
		expect(text).toMatch(/debug.*assert.*release.*std::unreachable/s);
	});

	it('documents implementation-observed runtime configuration behavior as limitations', () => {
		const text = source('systems/core/runtime-configuration');
		expect(text).toMatch(/--key/);
		expect(text).toMatch(/boolean.*1/i);
		expect(text).toMatch(/outside.*mutex/i);
		expect(text).toMatch(/returning true.*does not unregister/i);
		expect(text).toMatch(/destructor.*unlisten/s);
	});

	it('sets honest thread and performance boundaries', () => {
		const text = source('systems/core/threading-and-performance');
		expect(text).toMatch(/callback.*worker thread/i);
		expect(text).toMatch(/shutdown.*does not guarantee.*drain/i);
		expect(text).toMatch(/approximately one second/i);
		expect(text).toMatch(/raw pointer.*listener/i);
	});

	it('records geometry and numeric edge semantics from the pinned implementation', () => {
		const geometry = source('systems/math/geometry-and-intersections');
		expect(geometry).toMatch(/negative.*extent.*shift/i);
		expect(geometry).toMatch(/touching.*intersect/i);
		expect(geometry).toMatch(/infinite line.*behind the origin/i);
		expect(geometry).toMatch(/Polygon2f.*unimplemented/s);

		const numerics = source('systems/math/lua-json-and-numerics');
		expect(numerics).toMatch(/JSON.*w.*x.*y.*z.*format.*x.*y.*z.*w/is);
		expect(numerics).toMatch(/absolute floor.*1e-6/i);
		expect(numerics).toMatch(/Vec2i.*Vec4f.*Rectf/s);
	});

	it('makes concurrency ownership and queue limitations explicit', () => {
		const text = source('systems/utilities/events-and-concurrency');
		expect(text).toMatch(/ListenerHnd.*raw pointer.*destruction.*unlisten/s);
		expect(text).toMatch(/TSQueue.*wait.*indefinitely.*timeout.*cancellation/is);
		expect(text).toMatch(/AtomicQueue.*single producer.*single consumer/is);
		expect(text).toMatch(/(?:AtomicTripleBuffer|triple-buffer).*latest.*skip/is);
	});

	it('keeps data, color, and packing limitations visible', () => {
		const text = source('systems/utilities/data-color-and-packing');
		expect(text).toMatch(/FAILED_TO_OPEN/);
		expect(text).toMatch(/UTF.*does not validate.*malformed/is);
		expect(text).toMatch(/genID.*zero.*process/is);
		expect(text).toMatch(/non-prefixed.*text.*WHITE/is);
		expect(text).toMatch(/prefixed.*malformed.*std::stoul.*throw/is);
		expect(text).toMatch(/HSV.*does not return.*continues.*RGB fields.*indexed list/is);
		expect(text).toMatch(/h\/s\/v-only.*WHITE/is);
		expect(text).not.toMatch(/HSV branch[^.]*falls through to `?WHITE`?/i);
		expect(text).toMatch(/ColorCache.*named.*WHITE/is);
		expect(text).toMatch(/RectPacker.*first failure.*order/is);
	});

	it('describes Justify as a stateless static algorithm family', () => {
		const text = source('systems/utilities');
		expect(text).toMatch(/Justify<T>.*stateless.*static/is);
		expect(text).not.toMatch(/Utility values such as[^.]*Justify[^.]*own their state/i);
	});

	it('provides an owner-linked lookup instead of an SDK stability claim', () => {
		const text = source('reference/core-math-utility-types');
		for (const identifier of [
			'Result', 'Expected<T>', 'LogLevel', 'Axis', 'BoxFace', 'NearFar', 'SystemState', 'INVALID_ID', 'LineMode',
		]) expect(text).toContain(identifier);
		expect(text).toMatch(/LogLevel.*TRACE.*DEBUG.*INFO.*WARN.*ERROR.*CRITICAL.*OFF/s);
		expect(text).toMatch(/SystemState.*UNINITIALIZED.*INITIALIZED.*RUNNING.*STOPPING/s);
		expect(text).toMatch(/Non-error results.*SWAPCHAIN_NOT_VISIBLE.*CURSOR_NOT_INSIDE_WINDOW/s);
		expect(text).toMatch(/Error results.*ALLOCATION_FAILED.*FAILED_TO_CREATE.*OAL_ERROR/s);
		expect(text).toMatch(/`vec3f`, `vec4f`, `mat3f`, `mat4f`, `quat`/);
		expect(text).not.toMatch(/\b(?:ERR|SHUTTING_DOWN|SHUTDOWN|NEEDS_RECREATION|NULL_PTR|Quatf|CBytesRef)\b/);
		expect(text).toMatch(/owner page/i);
		expect(text).toMatch(/not.*(?:API|SDK).*stability/is);
	});
});

describe('renderer and models handbook content', () => {
	it('publishes the exact 13 renderer and model records without advancing later systems', () => {
		for (const [pageId] of rendererContracts) {
			expect(handbookPages.find((page) => page.pageId === pageId)?.publication).toBe('published');
		}
		for (const pageId of ['client', 'tools-and-test-applications']) {
			expect(handbookPages.find((page) => page.pageId === pageId)?.publication).not.toBe('published');
		}
	});

	it.each(rendererContracts)('%s has canonical pinned evidence and an exact physical route', (pageId, slug, subsystems) => {
		const text = source(slug);
		const parsed = parseFrontmatter(text);
		const metadata = technicalPageMetadataSchema.parse(parsed.frontmatter);
		expect(metadata).toMatchObject({
			mleCommit: commit,
			maturity: 'in-development',
			pageId,
			translationStatus: 'canonical',
		});
		expect(metadata.audiences).toEqual(expect.arrayContaining(['integrator', 'contributor']));
		expect(metadata.subsystems).toEqual(subsystems);
		expect(metadata.sourceFiles.length).toBeGreaterThan(0);
		expect(metadata.testFiles.length).toBeGreaterThan(0);
		expect(metadata.lastVerified).toBe(pageId === 'renderer-overview' ? '2026-08-20' : '2026-08-21');
		expect(handbookPages.find((page) => page.pageId === pageId)).toMatchObject({ slug, publication: 'published' });
		expect(text).toContain(`github.com/MaxMFonseca/MLE/blob/${commit}/`);
		expect(text).not.toMatch(/\b(?:TBD|lorem ipsum|Doxygen)\b/i);
	});

	it('keeps CPU orchestration, render-thread recording, queue submission, and presentation distinct', () => {
		const text = source('concepts/frame-and-resource-flow');
		expect(text).toMatch(/FrameRenderer.*jthread.*Client::render\(\).*RenderingThread.*secondary command buffer.*graphics queue.*presentKHR/is);
		expect(text).toMatch(/getSecondaryCommandBuffer.*executeCommands.*same.*FrameRenderer.*thread/is);
		expect(text).not.toMatch(/worker(?:-side| thread).*RenderingThread/is);
		expect(text).toMatch(/selected-device-dependent/i);
		expect(text).toMatch(/deferred deletion.*frame fence/is);
	});

	it('states resource and shader preconditions at their use boundaries', () => {
		const resources = source('systems/renderer/resources-and-synchronization');
		expect(resources).toMatch(/queue-family ownership.*release.*acquire/is);
		expect(resources).toMatch(/NOT_READY.*NOT_FOUND/s);
		expect(resources).toMatch(/layout.*transitionState.*barrier/is);
		const shaders = source('systems/renderer/shaders-and-pipelines');
		expect(shaders).toMatch(/\.vert.*\.frag.*\.comp.*\.spv/s);
		expect(shaders).toMatch(/ini_.*after.*vertex attributes/is);
		expect(shaders).toMatch(/one push-constant block.*stage/is);
		const guide = source('guides/create-a-shader-and-pipeline');
		expect(guide).toContain('getVkImageFormat(ImageFormat::COLOR)');
		expect(guide).toContain('pipelineCache().setPipeline("my/pass", ci)');
		expect(guide).toMatch(
			/std::array color_attachment_formats = \{.*getVkImageFormat\(ImageFormat::COLOR\).*\};.*auto blend_attachments = Pipeline::makeDefaultBlendAttachments<1>\(\);.*ci\.color_attachment_formats = color_attachment_formats;.*ci\.blend_attachments = blend_attachments;.*setPipeline\("my\/pass", ci\)/s,
		);
		expect(guide).not.toMatch(/ci\.color_attachment_formats\s*=\s*\{/);
		expect(guide).not.toContain('getFormat(ImageFormat::COLOR)');
		expect(guide).not.toContain('pipelineCache().add(');
	});

	it('separates source contracts, automated tests, and Model Test demonstrations', () => {
		const models = source('systems/models');
		expect(models).toMatch(/Model Test.*demonstration.*not.*guarantee/is);
		expect(models).toMatch(/addMeshPack.*animation.*mesh caches/is);
		expect(models).toMatch(/Mesh.*owns.*SkinBinding.*node indices.*inverse binds/is);
		expect(models).toMatch(/Skeleton.*joint names.*parent relationships.*separate.*otherwise unused cache/is);
		const loading = source('systems/models/loading-meshes-and-materials');
		expect(loading).toMatch(/\.glb.*\.gltf.*FAILED_TO_OPEN/s);
		expect(loading).toMatch(/name#.*first.*alias/is);
		expect(loading).toMatch(/each primitive.*separate.*vertex.*index buffers.*synchronous.*transfer.*acquire/is);
		expect(loading).toMatch(/embedded.*addTextureWait.*synchronous/is);
		const animation = source('systems/models/animation-skeletons-and-cameras');
		expect(animation).toMatch(/nonempty.*unique.*animation/is);
		expect(animation).toMatch(/Mesh.*owns.*SkinBinding.*node indices.*inverse binds/is);
		expect(animation).toMatch(/Skeleton.*joint names.*parent relationships.*separate.*otherwise unused cache/is);
		expect(animation).toMatch(/mesh-owned SkinBinding.*animation integration.*source-observed.*Model Test/is);
		expect(animation).toMatch(/Camera.*perspective.*orthographic/is);
		const upload = source('guides/upload-and-render-a-model');
		expect(upload).toMatch(/embedded.*addTextureWait.*synchronous/is);
		expect(upload).toMatch(/general.*loadTexture.*asynchronous.*NOT_READY/is);
		const control = source('guides/control-camera-and-animation');
		expect(control).toMatch(/SkinBinding.*ends with.*Mesh.*MeshCache/is);
		expect(control).not.toMatch(/mesh, clip, skeleton, and binding references must not outlive their caches/i);
	});

	it('gives every guide an observable result, cleanup, and limitation boundary', () => {
		for (const slug of ['guides/create-a-shader-and-pipeline', 'guides/upload-and-render-a-model', 'guides/control-camera-and-animation']) {
			const text = source(slug);
			expect(text).toMatch(/Prerequisites/i);
			expect(text).toMatch(/Success signal/i);
			expect(text).toMatch(/Cleanup/i);
			expect(text).toMatch(/Limitations/i);
		}
	});
});

describe('Lua and UI foundation handbook content', () => {
	it.each(luaUiFoundationContracts)('%s has canonical pinned evidence and an exact physical route', (pageId, slug, subsystems) => {
		const text = source(slug);
		const parsed = parseFrontmatter(text);
		const metadata = technicalPageMetadataSchema.parse(parsed.frontmatter);
		expect(metadata).toMatchObject({
			mleCommit: commit,
			maturity: 'in-development',
			pageId,
			translationStatus: 'canonical',
		});
		expect(metadata.audiences).toEqual(expect.arrayContaining(['integrator', 'contributor']));
		expect(metadata.subsystems).toEqual(subsystems);
		expect(metadata.sourceFiles.length).toBeGreaterThan(0);
		expect(metadata.testFiles.length).toBeGreaterThan(0);
		expect(metadata.lastVerified).toBe('2026-08-21');
		expect(handbookPages.find((page) => page.pageId === pageId)).toMatchObject({ slug, publication: 'published' });
		expect(text).toContain(`github.com/MaxMFonseca/MLE/blob/${commit}/`);
		expect(text).not.toMatch(/\b(?:TBD|lorem ipsum|Doxygen)\b/i);
	});

	it('separates direct script execution, protected probing, and runtime registration', () => {
		const boundary = source('concepts/cpp-lua-boundary');
		expect(boundary).toMatch(/public scripting boundary.*sol::state.*Client/is);
		expect(boundary).toMatch(/auxiliary.*state.*CompRenderingCtx/is);
		expect(boundary).toMatch(/sol::object.*sol::table.*usertype/is);
		expect(boundary).toMatch(/panic.*unrecoverable/is);
		const runtime = source('systems/lua/runtime-calls-and-bindings');
		expect(runtime).toMatch(/script_file.*res\/lua/is);
		expect(runtime).toMatch(/tryRequire.*NOT_FOUND/is);
		expect(runtime).toMatch(/does not.*package\.loaded|executes.*again/is);
	});

	it('states UI ownership, phase order, hierarchy, and invalidation contracts', () => {
		const composition = source('concepts/ui-composition');
		expect(composition).toMatch(/Lua table.*entity.*component.*bounds.*render packet/is);
		const overview = source('systems/ui');
		expect(overview).toMatch(/animation.*hover.*on_update.*events.*bounds.*rendering.*destroy/is);
		expect(overview).toMatch(/UI.*owns.*registry.*systems/is);
		const hierarchy = source('systems/ui/entities-hierarchy-and-layout');
		expect(hierarchy).toMatch(/Relationship.*circular.*sibling/is);
		expect(hierarchy).toMatch(/internal.*content.*external.*ancestor/is);
		expect(hierarchy).toMatch(/px.*flex.*fit.*%r.*%w.*%h/is);
		expect(hierarchy).toMatch(/hasFitSize.*returns true.*every.*internal.*propagates.*external/is);
		expect(hierarchy).toMatch(/intended.*selective.*pinned.*broad/is);
	});

	it('keeps rendering, input, and callback limitations source-observed', () => {
		const rendering = source('systems/ui/rendering-and-visuals');
		expect(rendering).toMatch(/triple.buffer.*packet.*render thread/is);
		expect(rendering).toMatch(/one.*`Renderable`.*per entity/is);
		expect(rendering).toMatch(/parent scissor.*render target/is);
		expect(rendering).toMatch(/Rendering::update.*ascending.*lower.*first/is);
		expect(rendering).toMatch(/Relationship.*hover.*descending.*higher.*first/is);
		const input = source('systems/ui/text-input-and-focus');
		expect(input).toMatch(/not globally exclusive.*disable/is);
		for (const key of ['text_input_enable', 'text_input_disable', 'text_input_set', 'text_input_clear']) expect(input).toContain(key);
		expect(input).toMatch(/Enter.*submit.*Tab.*complete.*Escape.*blur/is);
		const events = source('systems/ui/events-and-callbacks');
		expect(events).toMatch(/queued.*same frame.*events phase/is);
		expect(events).toMatch(/raw.*EventListener.*unlisten/is);
		expect(events).toMatch(/boolean.*asymmetric|wrong callback/is);
	});
});

describe('advanced Lua and UI handbook content', () => {
	it('keeps independently owned reference semantics on the five published reference pages', () => {
		const expectedRows = publishedReferenceExpectations.flatMap(({ pageId, rows }) =>
			rows.map((rowId) => ({ rowId, pageId })),
		);
		const actualRows: ReferenceRowRecord[] = [];
		for (const expectation of publishedReferenceExpectations) {
			const text = source(expectation.slug);
			const metadata = technicalPageMetadataSchema.parse(parseFrontmatter(text).frontmatter);
			expect(metadata.pageId).toBe(expectation.pageId);
			expect(handbookPages.find(({ pageId }) => pageId === expectation.pageId)).toMatchObject({
				publication: 'published', slug: expectation.slug,
			});
			actualRows.push(...[...contractRows(text)].map(([rowId]) => ({ rowId, pageId: expectation.pageId })));
		}
		expect(compareReferenceRows(expectedRows, actualRows)).toEqual({
			missing: [], extra: [], duplicates: [], misowned: [],
		});

		const deleted = actualRows.filter(({ rowId }) => rowId !== 'entt-validity');
		const misowned = actualRows.map((record) => record.rowId === 'entt-validity' ? { ...record, pageId: 'ui-components' } : record);
		expect(compareReferenceRows(expectedRows, deleted).missing).toEqual(['entt-validity']);
		expect(compareReferenceRows(expectedRows, misowned).misowned).toEqual(['entt-validity']);
	});

	it('states the reviewed Lua/UI boundaries in stable reference rows', () => {
		const luaApi = contractRows(source('reference/lua-api'));
		expect(luaApi.get('vector-constructors')).toMatch(/full positional.*fields.*no default.*scalar.*operators/is);
		expect(luaApi.get('entt-validity')).toMatch(/non-null.*not.*registry.*stale.*never reuse/is);

		const keys = contractRows(source('reference/ui-element-keys'));
		expect(keys.get('getter-registry')).toMatch(/table.*hovered.*fn.*text.*scroll.*overflow.*tags/is);
		expect(keys.get('renderable-keys')).toMatch(/incompatible.*logs.*returns.*preserves/is);
		expect(keys.get('text-input-keys')).toMatch(/text\.input.*TextBox.*enable.*focus.*warn.*disable.*guard/is);
		expect(keys.get('hovered-getter')).toMatch(/assert/i);

		expect(contractRows(source('reference/ui-components')).get('renderable-ownership')).toMatch(/incompatible.*preserves/is);
		expect(contractRows(source('reference/ui-events-and-callbacks')).get('hover-callbacks')).toMatch(/\(ew\).*ew:get\(['"]hovered['"]\)/is);

		const layout = contractRows(source('reference/ui-layout-values'));
		expect(layout.get('target-bound-root')).toMatch(/root/i);
		expect(layout.get('list-direction')).toMatch(/horizontal.*h.*row.*vertical.*v.*column.*col.*h_r.*row_r.*v_r.*col_r/is);
		expect(layout.get('list-justify')).toMatch(/start.*s.*b.*center.*centre.*c.*space_between.*sb.*space_around.*sa.*space_evenly.*se/is);
		expect(layout.get('list-cross-align')).toMatch(/start.*s.*b.*center.*centre.*c.*end.*e.*stretch/is);
		expect(layout.get('list-wrap')).toMatch(/n.*no.*y.*yes.*wrap.*y_r.*yes_reversed.*wrap_reversed.*wrap_r/is);
	});

	it('links every practical UI guide to its committed source identity and published system owner without a scout checkout', () => {
		const unavailableScoutRoot = resolve(process.env.MLE_SCOUT_SOURCE_ROOT ?? 'tests/fixtures/unavailable-mle-scout-source');
		expect(existsSync(unavailableScoutRoot)).toBe(false);
		for (const { pageId, slug, sourcePath, ownerPageId, ownerSlug } of uiGuideSourceManifest) {
			const text = source(slug);
			const metadata = technicalPageMetadataSchema.parse(parseFrontmatter(text).frontmatter);
			expect(metadata.sourceFiles).toContain(sourcePath);
			expect(text).toContain(`github.com/MaxMFonseca/MLE/blob/${commit}/${sourcePath}`);
			expect(text).toContain(`../../${ownerSlug}`);
			expect(metadata.pageId).toBe(pageId);
			expect(handbookPages.find(({ pageId }) => pageId === ownerPageId)?.publication).toBe('published');
		}
	});

	it('keeps tracked UI contract tests independent of the ignored local research tree', () => {
		const ignoredScoutPath = ['.local', 'research'].join('/');
		for (const testFile of ['tests/unit/handbook-content.test.ts', 'tests/unit/ui-contract-inventory.test.ts']) {
			expect(readFileSync(resolve(testFile), 'utf8')).not.toContain(ignoredScoutPath);
		}
		expect(uiGuideSourceManifest).toHaveLength(6);
		expect(uiGuideSourceManifest.every(({ sourcePath }) => !sourcePath.startsWith('/') && !sourcePath.includes('\\'))).toBe(true);
	});

	it.each(luaUiAdvancedContracts)('%s has canonical pinned evidence and an exact physical route', (pageId, slug, subsystems) => {
		const text = source(slug);
		const metadata = technicalPageMetadataSchema.parse(parseFrontmatter(text).frontmatter);
		expect(metadata).toMatchObject({ mleCommit: commit, maturity: 'in-development', pageId, translationStatus: 'canonical' });
		expect(metadata.audiences).toEqual(expect.arrayContaining(['integrator', 'contributor']));
		expect(metadata.subsystems).toEqual(subsystems);
		expect(metadata.sourceFiles.length).toBeGreaterThan(0);
		expect(metadata.testFiles.length).toBeGreaterThan(0);
		expect(metadata.lastVerified).toBe('2026-08-21');
		expect(handbookPages.find((page) => page.pageId === pageId)).toMatchObject({ slug, publication: 'published' });
		expect(text).toContain(`github.com/MaxMFonseca/MLE/blob/${commit}/`);
		expect(text).not.toMatch(/\b(?:TBD|lorem ipsum|Doxygen)\b/i);
	});

	it('gives every UI guide the complete practical sequence and a shipped authoritative example', () => {
		for (const [, slug] of luaUiAdvancedContracts.filter(([pageId]) => handbookPages.find((page) => page.pageId === pageId)?.kind === 'guide')) {
			const text = source(slug);
			for (const heading of ['Outcome', 'Preconditions', 'Construct the entities and components', 'Configure layout and visuals', 'Connect state and interaction', 'Verify the result', 'Cleanup and failure modes', 'Authoritative example']) {
				expect(text, `${slug}: ${heading}`).toContain(`## ${heading}`);
			}
			expect(text).toMatch(/(?:tests\/Client|res\/lua)\/.*\.lua/);
		}
	});

	it('keeps the retained UI limitations beside the advanced features', () => {
		expect(source('systems/ui/scrolling-and-popups')).toMatch(/viewport.*clipping.*popup.*stack.*focus.*cleanup/is);
		const animation = source('systems/ui/animation-and-effects');
		expect(animation).toMatch(/fixed.*1\/60/is);
		expect(animation).toMatch(/invalidation/is);
		expect(animation).toMatch(/on_finished.*destroyAnimation/is);
		expect(source('systems/ui/reusable-components')).toMatch(/script_file.*package\.loaded.*re-executes.*style.*comp.*children/is);
	});

	it('ships keyboard-labeled dense references and distinguishes UI Test demonstrations from automated evidence', () => {
		for (const slug of ['reference/lua-api', 'reference/ui-element-keys', 'reference/ui-components', 'reference/ui-events-and-callbacks', 'reference/ui-layout-values']) {
			expect(source(slug)).toMatch(/<table tabindex="0" role="region" aria-label="[^"]+">/);
		}
		const uiTest = source('tools/ui-test');
		expect(uiTest).toMatch(/interactive demonstration.*not.*automated|demonstrated.*not.*guarantee/is);
		for (const page of ['Animation', 'FilterableList', 'FormPanel', 'Inventory', 'Layer', 'NineSlice', 'PopupStack', 'Scrollable', 'SpriteProgressBar', 'TextDropdownSelector']) expect(uiTest).toContain(page);
	});
});

describe('audio handbook content', () => {
	it.each(audioContracts)('%s has canonical pinned evidence and an exact physical route', (pageId, slug, subsystems) => {
		const text = source(slug);
		const metadata = technicalPageMetadataSchema.parse(parseFrontmatter(text).frontmatter);
		expect(metadata).toMatchObject({ mleCommit: commit, maturity: 'in-development', pageId, translationStatus: 'canonical' });
		expect(metadata.audiences).toEqual(expect.arrayContaining(['integrator', 'contributor']));
		expect(metadata.subsystems).toEqual(subsystems);
		expect(metadata.sourceFiles.length).toBeGreaterThan(0);
		expect(metadata.testFiles.length).toBeGreaterThan(0);
		expect(metadata.lastVerified).toBe('2026-08-21');
		expect(handbookPages.find((page) => page.pageId === pageId)).toMatchObject({ slug, publication: 'published' });
		expect(text).toContain(`github.com/MaxMFonseca/MLE/blob/${commit}/`);
		expect(text).not.toMatch(/\b(?:TBD|lorem ipsum|Doxygen)\b/i);
	});

	it('publishes exactly seven audio records', () => {
		for (const [pageId] of audioContracts) expect(handbookPages.find((page) => page.pageId === pageId)?.publication).toBe('published');
	});

	it('states lifecycle, mailbox outcomes, and shutdown order without implying synchronous command results', () => {
		const lifecycle = source('systems/audio/lifecycle-and-command-flow');
		expect(lifecycle).toMatch(/Client::init.*Window.*AudioEngine::init.*addLuaBinding/is);
		expect(lifecycle).toMatch(/ACCEPTED.*FULL.*CLOSED/is);
		expect(lifecycle).toMatch(/128.*queue/i);
		expect(lifecycle).toMatch(/producer.*caller.*consumer.*audio thread/is);
		expect(lifecycle).toMatch(/layers.*before.*AudioEngine::shutdown/is);
		expect(lifecycle).toMatch(/Lua.*returns no.*acceptance|void.*not.*completion/is);
	});

	it('documents exact playback, streaming, bus, and incomplete spatial boundaries', () => {
		const playback = source('systems/audio/playback-and-streaming');
		expect(playback).toMatch(/one-shot.*decoded.*OpenAL buffer/is);
		expect(playback).toMatch(/eight.*fixed.*stream.*slots/is);
		expect(playback).toMatch(/milliseconds.*offset.*duration.*zero.*end/is);
		expect(playback).toMatch(/four.*buffers.*8,192.*samples/is);
		expect(playback).toMatch(/up to four.*buffers.*fewer.*short.*duration/is);
		expect(playback).toMatch(/pause.*ramp.*resume/is);
		expect(playback).toMatch(/StopAll.*fade_out_ms.*ignored/is);

		const buses = source('systems/audio/buses-voices-and-limitations');
		expect(buses).toMatch(/0.*master.*1.*2.*3.*4.*5.*6.*7/is);
		expect(buses).toMatch(/no named buses/i);
		expect(buses).toMatch(/equal priority.*cannot steal/is);
		expect(buses).toMatch(/protected_from_other_buses/is);
		expect(buses).toMatch(/SetListener.*SetDistanceParams.*TODO/is);
		expect(buses).not.toMatch(/(?:complete|working|supported) 3D audio/i);
	});

	it('provides a verified Lua-first workflow with outcomes, cleanup, and failure signals', () => {
		const guide = source('guides/use-audio-playback');
		for (const heading of ['Outcome', 'Prerequisites', 'Load before playback', 'Play a one-shot', 'Run a stream', 'Observe success and failure', 'Cleanup', 'Limitations']) {
			expect(guide).toContain(`## ${heading}`);
		}
		for (const identifier of ['C.Audio.loadSound', 'C.Audio.playOneShot', 'C.Audio.startStream', 'C.Audio.stopStream']) expect(guide).toContain(identifier);
		expect(guide).toMatch(/res\/sounds.*\.wav/is);
		expect(guide).toMatch(/asynchronous.*log|log.*asynchronous/is);
		expect(guide).toMatch(/InitLayer\.lua.*partial.*missing.*stream preload/is);
		expect(guide).toMatch(/stopAll.*cancel.*in-progress.*stream fade/is);
		expect(guide).toMatch(/either.*stopStream.*fade.*or.*stopAll/is);
		const luaBlocks = [...guide.matchAll(/```lua\r?\n([\s\S]*?)```/g)].map((match) => match[1]);
		for (const block of luaBlocks) {
			const runnable = block.split(/\r?\n/).filter((line) => !line.trimStart().startsWith('--')).join('\n');
			expect(
				runnable.includes('C.Audio.stopStream(') && runnable.includes('C.Audio.stopAll('),
				'one copyable Lua block must not actively request both a stream fade and immediate StopAll',
			).toBe(false);
		}
	});

	it('ships keyboard-reachable exact lookup and honest Audio Test evidence classes', () => {
		const reference = source('reference/audio-contracts');
		expect(reference).toMatch(/<table tabindex="0" role="region" aria-label="Audio command contracts">/);
		for (const command of ['Load', 'PlayOneShot', 'StartStream', 'StartStreamGroup', 'StopStream', 'SetStreamParams', 'PauseStream', 'ResumeStream', 'SetVolume', 'SetListener', 'SetDistanceParams', 'StopAll', 'SetBusVoicePolicy']) expect(reference).toContain(command);
		for (const callable of ['loadSound', 'playOneShot', 'startStream', 'setStreamParams', 'setBusVoicePolicy']) expect(reference).toContain(`C.Audio.${callable}`);
		for (const supporting of ['RampCompletion', 'RampAdvance', 'RampCompletion::NONE', 'RampCompletion::STOP']) expect(reference).toContain(supporting);
		const startStreamRow = reference.match(/<tr><td><code>StartStream<\/code><\/td>[\s\S]*?<\/tr>/)?.[0] ?? '';
		expect(startStreamRow).toMatch(/up to four.*fewer than four/is);
		expect(startStreamRow).toMatch(/complete decoded source.*total_samples.*(?:&gt;|>|greater than).*samples_per_buffer.*more than 8,192/is);
		expect(reference).toMatch(/audio\.start_stream.*three.*tokens.*message.*two arguments/is);

		const tool = source('tools/audio-test');
		expect(tool).toMatch(/automated.*Core tests/is);
		expect(tool).toMatch(/interactive demonstration.*not.*automated|demonstrated.*not.*assert/is);
		expect(tool).toMatch(/PENDING USER PLAYTEST/is);
		expect(tool).toMatch(/SDL_Init failed: No available video device/is);
		expect(tool).toMatch(/12.*fixtures.*manifest/is);
		expect(tool).toMatch(/deterministic.*--verify/is);
		expect(tool).toContain('AudioTest.cpp');
		expect(tool).not.toContain('AudioTestLayer.cpp');
		expect(tool).toMatch(/Space.*protected.*UI.*cue/is);
	});
});

describe('Client and platform-shell handbook content', () => {
	it.each(clientPlatformContracts)('%s has canonical pinned evidence and its exact publication contract', (pageId, slug, subsystems, maturity) => {
		const text = source(slug);
		const metadata = technicalPageMetadataSchema.parse(parseFrontmatter(text).frontmatter);
		expect(metadata).toMatchObject({ mleCommit: commit, maturity, pageId, translationStatus: 'canonical' });
		expect(metadata.audiences).toEqual(expect.arrayContaining(['integrator', 'contributor']));
		expect(metadata.subsystems).toEqual(subsystems);
		expect(metadata.sourceFiles.length).toBeGreaterThan(0);
		if (pageId === 'server') expect(metadata.testFiles).toEqual([]);
		else expect(metadata.testFiles.length).toBeGreaterThan(0);
		expect(metadata.lastVerified).toBe('2026-08-21');
		expect(handbookPages.find((page) => page.pageId === pageId)).toMatchObject({ slug, publication: 'published' });
		expect(text).toContain(`github.com/MaxMFonseca/MLE/blob/${commit}/`);
		expect(text).not.toMatch(/\b(?:TBD|lorem ipsum|Doxygen)\b/i);
	});

	it('publishes exactly the eight Task 7 records', () => {
		expect(clientPlatformContracts).toHaveLength(8);
		for (const [pageId] of clientPlatformContracts) {
			expect(handbookPages.find((page) => page.pageId === pageId)?.publication).toBe('published');
		}
	});

	it('states real Client phase, layer, and audio teardown ownership', () => {
		const concept = source('concepts/audio-and-client-flow');
		expect(concept).toMatch(/Client::init.*Window.*AudioEngine/is);
		expect(concept).toMatch(/game layer.*debug layers.*AudioEngine::shutdown/is);
		expect(concept).toMatch(/asynchronous.*mailbox|mailbox.*audio thread/is);
		const client = source('systems/client');
		expect(client).toMatch(/pollEvents|poolEvents.*UserInputManager::update.*game layer.*debug layers.*lateUpdate/is);
		expect(client).toMatch(/fixed.*16,666,667.*five.*catch-up/is);
		expect(client).toMatch(/Layer.*no.*event.*hook/is);
		expect(client).toMatch(/does not.*Window::shutdown/is);
	});

	it('keeps Window event declarations separate from implemented SDL routing', () => {
		const window = source('systems/window');
		expect(window).toMatch(/SDL_EVENT_QUIT.*Close/is);
		expect(window).toMatch(/SDL_EVENT_WINDOW_RESIZED.*Resize/is);
		expect(window).toMatch(/Iconify.*Focus.*declared.*not.*dispatch/is);
		expect(window).toMatch(/newest-first.*always_call.*first (?:eligible )?regular/is);
		expect(window).toMatch(/text.*oldest-first.*all/is);
	});

	it('leads the Server page with an experimental non-production boundary', () => {
		const server = source('systems/server');
		const body = parseFrontmatter(server).content.trimStart();
		expect(body.slice(0, 700)).toMatch(/experimental.*non-production.*implemented.*stubbed/is);
		expect(server).toMatch(/capacity-100.*AtomicQueue|AtomicQueue.*100/is);
		expect(server).toMatch(/no.*socket.*serialization.*authentication/is);
		expect(server).toMatch(/pump.*no-op.*runLoop.*never.*command/is);
		expect(server).toMatch(/jthread.*(?:not.*stop token|stop token.*not.*observe)/is);
		expect(server).toMatch(/requestStop.*(?:not|no).*(?:completion|join|barrier)/is);
		expect(server).toMatch(/derived.*destruct.*(?:before|while).*jthread.*join|jthread.*join.*after.*derived.*destruct/is);
		expect(server).toMatch(/virtual.*(?:update|shutdown).*(?:teardown|destruct)|(?:teardown|destruct).*virtual.*(?:update|shutdown)/is);
		expect(server).toMatch(/no safe public.*teardown|no public.*(?:join|completion|STOPPED).*barrier/is);
		expect(server).toMatch(/no.*automated.*test/is);
	});

	it('gives both guides prerequisites, success, cleanup, and source-observed limits', () => {
		for (const slug of ['guides/create-a-client-layer', 'guides/handle-input-focus-and-text']) {
			const guide = source(slug);
			for (const heading of ['Outcome', 'Prerequisites', 'Success signal', 'Cleanup', 'Limitations']) {
				expect(guide).toContain(`## ${heading}`);
			}
		}
		expect(source('guides/create-a-client-layer')).toMatch(/unique_ptr.*pushGameLayer.*init.*update.*render.*shutdown/is);
		const input = source('guides/handle-input-focus-and-text');
		expect(input).toMatch(/text\.input.*text_input_disable.*text_input_enable/is);
		expect(input).toMatch(/not.*exclusive.*disable.*previous/is);
		expect(input).toMatch(/disable.*without.*TextBox.*dereference|missing.*handle/is);
		expect(input.match(/element:parent\(\)/g)).toHaveLength(2);
		expect(input).not.toContain('element:getParent()');
	});

	it('links the text-input owner page to the published workflow and removes stale Systems roadmap copy', () => {
		const input = source('systems/ui/text-input-and-focus');
		expect(input).toContain('[Handle input, focus, and text](../../../guides/handle-input-focus-and-text/)');
		expect(input).not.toMatch(/planned.*Handle input, focus, and text/is);

		const englishHub = source('systems');
		const portugueseHub = readFileSync(resolve('src/content/docs/pt-br/versions/c1abea3de165/systems/index.mdx'), 'utf8');
		expect(englishHub).not.toMatch(/planned labels below/i);
		expect(portugueseHub).not.toMatch(/rótulos planejados abaixo/i);

		const uiTest = source('tools/ui-test');
		expect(uiTest).toContain('[Interactive Client](../interactive-client/)');
		expect(uiTest).not.toMatch(/planned Interactive Client|unpublished route/i);
	});

	it('ships a keyboard-reachable dense reference and honest Interactive Client evidence', () => {
		const reference = source('reference/window-and-input-contracts');
		expect(reference).toMatch(/<table tabindex="0" role="region" aria-label="Window and input contracts">/);
		expect(reference).toMatch(/PRESSED.*DOWN.*RELEASED.*UP/is);
		expect(reference).toMatch(/CURSOR_NOT_INSIDE_WINDOW/is);
		const tool = source('tools/interactive-client');
		expect(tool).toMatch(/interactive demonstration.*not.*automated|demonstrated.*not.*assert/is);
		for (const layer of ['InitLayer', 'ModelTestLayer', 'UITestLayer', 'AudioTestLayer', 'PerfLayer', 'TerminalLayer']) expect(tool).toContain(layer);
		for (const control of ['F3', 'Ctrl+M']) expect(tool).toContain(control);
	});
});

describe('tools, tests, fixtures, and contributor handbook content', () => {
	it.each(toolTestContracts)('%s has canonical pinned evidence and its exact publication contract', (pageId, slug, subsystems) => {
		const text = source(slug);
		const metadata = technicalPageMetadataSchema.parse(parseFrontmatter(text).frontmatter);
		expect(metadata).toMatchObject({
			mleCommit: commit, maturity: 'in-development', pageId, translationStatus: 'canonical', subsystems,
		});
		expect(metadata.audiences).toEqual(expect.arrayContaining(['integrator', 'contributor']));
		expect(metadata.sourceFiles.length).toBeGreaterThan(0);
		if (pageId === 'mlecubes') expect(metadata.testFiles).toEqual([]);
		else expect(metadata.testFiles.length).toBeGreaterThan(0);
		expect(metadata.lastVerified).toBe('2026-08-21');
		expect(handbookPages.find((page) => page.pageId === pageId)).toMatchObject({ slug, publication: 'published' });
		expect(text).toContain(`github.com/MaxMFonseca/MLE/blob/${commit}/`);
		expect(text).not.toMatch(/\b(?:TBD|lorem ipsum|Doxygen)\b/i);
	});

	it('publishes exactly the five Task 8 records', () => {
		expect(toolTestContracts).toHaveLength(5);
		for (const [pageId] of toolTestContracts) expect(handbookPages.find((page) => page.pageId === pageId)?.publication).toBe('published');
	});

	it('documents the automated Core entry points, filters, resources, and shutdown boundary', () => {
		const page = source('tools/core-test-suite');
		expect(page).toMatch(/Core.*AudioLifecycle.*GoogleTest.*unit/is);
		expect(page).toMatch(/--gtest_filter=.*ThreadPoolTest|ThreadPoolTest.*--gtest_filter=/is);
		expect(page).toMatch(/tests\/Core\/res.*mle.*i.*resource/is);
		expect(page).toMatch(/RUN_ALL_TESTS.*Renderer.*Core.*shutdown/is);
		expect(page).toMatch(/29.*T\.\*\.cpp|29.*translation units/is);
	});

	it('documents Model Test controls and keeps its evidence class interactive', () => {
		const page = source('tools/model-test');
		expect(page).toMatch(/interactive demonstration.*not.*automated|demonstrated.*not.*assert/is);
		expect(page).toMatch(/left.*orbit.*middle.*pan.*wheel.*zoom/is);
		expect(page).toMatch(/model.*animation.*held item.*attachment.*cubemap/is);
		expect(page).toMatch(/shader.*projection.*sun.*ambient.*clear color/is);
		expect(page).toMatch(/i\/models\/.*\.glb|tests\/Client\/res\/models/is);
	});

	it('documents fixture provenance, regeneration, corruption, and review boundaries', () => {
		const page = source('tools/test-fixtures');
		const metadata = technicalPageMetadataSchema.parse(parseFrontmatter(page).frontmatter);
		expect(page).toMatch(/generate_audio_fixtures\.py.*--verify/is);
		expect(page).toMatch(/corrupt\.wav.*negative|negative.*corrupt\.wav/is);
		expect(page).toMatch(/committed.*generated.*review.*manifest/is);
		expect(page).toMatch(/not.*public.*format|does not.*supported.*format/is);
		expect(page).toMatch(/generated.*consumed.*only.*interactive.*Audio Test/is);
		expect(page).toMatch(/Core audio.*in[- ]memory.*do not load.*generated.*WAV/is);
		expect(metadata.testFiles).not.toContain('tests/Core/src/audio/T.StreamState.cpp');
	});

	it('describes MLECubes as minimal unsupported scaffolding', () => {
		const page = source('tools/mlecubes');
		expect(page).toMatch(/Entry\.inl.*Init.*35.*Editor/is);
		expect(page).toMatch(/EditorView.*red/is);
		expect(page).toMatch(/App\.(?:h|cpp).*empty/is);
		expect(page).toMatch(/no.*automated.*tests/is);
		expect(page).toMatch(/not.*production|unsupported|prototype/is);
		expect(page).toMatch(/root.*CMakeLists.*does not add.*tools.*no shipped root.*configure.*build.*run path/is);
		expect(page).toMatch(/external.*build.graph.*modification/is);
	});

	it('gives contributors separate automated, interactive, fixture, registry, and verification workflows', () => {
		const page = source('contributing/tests-and-interactive-pages');
		for (const heading of ['Choose the evidence class', 'Add an automated Core test', 'Add an interactive Client page or layer', 'Add or regenerate fixtures', 'Update ownership and documentation', 'Verify the change']) {
			expect(page).toContain(`## ${heading}`);
		}
		expect(page).toMatch(/automated.*interactive.*fixture.*generator.*tool/is);
		expect(page).toMatch(/handbook registry|handbook\.ts/is);
	});

	it('reconciles the existing tool pages with the final inventory owners', () => {
		const ui = source('tools/ui-test');
		expect(ui).toContain('[Test fixtures](../test-fixtures/)');
		expect(ui).toContain('[Tests and interactive pages](../../contributing/tests-and-interactive-pages/)');
		const audio = source('tools/audio-test');
		expect(audio).toContain('[Test fixtures](../test-fixtures/)');
		const client = source('tools/interactive-client');
		expect(client).toContain('[Model Test](../model-test/)');
		expect(client).toContain('[Core test suite](../core-test-suite/)');
	});

	it('presents the fully published Tools and Contributing hubs without a planned-content promise', () => {
		const hubs = [
			source('tools'),
			source('contributing'),
			readFileSync(resolve('src/content/docs/pt-br/versions/c1abea3de165/tools/index.mdx'), 'utf8'),
			readFileSync(resolve('src/content/docs/pt-br/versions/c1abea3de165/contributing/index.mdx'), 'utf8'),
		];
		for (const hub of hubs) {
			expect(hub).toContain("lastVerified: '2026-08-21'");
			expect(hub).not.toMatch(/planned labels below|will document|rótulos planejados abaixo|vai documentar|vão reunir/i);
		}
	});
});

describe('completed handbook publication language', () => {
	const stalePublicationClaims = [
		['start-here', /planned labels below describe documentation work still to be authored/i],
		['concepts', /planned labels below describe documentation coverage/i],
		['guides', /planned labels below are an editorial coverage map/i],
		['reference', /description: Planned precise reference/i],
		['reference', /planned labels below describe documentation work only/i],
		['concepts/cpp-lua-boundary', /belongs to the planned \*\*Lua API reference\*\*/i],
		['concepts/ui-composition', /remain assigned to the planned UI guides and reference/i],
		['systems/lua', /belong to the planned \*\*Reusable components\*\* page/i],
		['systems/lua/runtime-calls-and-bindings', /the planned \*\*Lua API\*\* reference will own exact names/i],
		['systems/ui', /remain in the planned Task 5 pages visible in navigation/i],
		['systems/ui/entities-hierarchy-and-layout', /belong to the planned \*\*UI element keys\*\* and \*\*UI layout values\*\* references/i],
		['systems/ui/rendering-and-visuals', /belong to the planned \*\*Animation and effects\*\* page and visual guide/i],
		['systems/ui/events-and-callbacks', /belong to the planned \*\*UI events and callbacks reference\*\*/i],
	] as const;

	it.each(stalePublicationClaims)('%s no longer advertises an already-published destination as planned', (slug, staleClaim) => {
		expect(source(slug)).not.toMatch(staleClaim);
	});
});
