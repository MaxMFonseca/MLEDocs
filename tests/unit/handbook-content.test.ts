import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseFrontmatter } from 'astro/markdown';
import { describe, expect, it } from 'vitest';
import { handbookPages } from '../../src/data/handbook';
import { technicalPageMetadataSchema } from '../../src/lib/content/schema';

const commit = 'c1abea3de165032fe064300340807b7a6af388f8';
const docsRoot = resolve('src/content/docs/versions/c1abea3de165');

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
	return readFileSync(resolve(docsRoot, slug.startsWith('reference/') ? `${slug}.mdx` : `${slug}/index.mdx`), 'utf8');
}

describe('runtime foundations handbook content', () => {
	it('publishes the 14 source-authored pages beside the existing renderer page', () => {
		expect(
			handbookPages
				.filter(({ publication }) => publication === 'published')
				.map(({ pageId }) => pageId)
				.sort(),
		).toEqual([...contracts.map(([pageId]) => pageId), 'renderer-overview'].sort());
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
