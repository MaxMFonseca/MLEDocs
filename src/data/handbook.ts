import type { NavigationPageId } from './navigation.ts';

export type HandbookKind = 'concept' | 'system' | 'guide' | 'reference' | 'tool' | 'contributing';
export type HandbookEmphasis = 'overview' | 'focused' | 'deep' | 'lookup';
export type HandbookPublication = 'planned' | 'published';

export interface HandbookPage {
	readonly pageId: string;
	readonly slug: string;
	readonly title: string;
	readonly sectionId: NavigationPageId;
	readonly groupId: string;
	readonly order: number;
	readonly kind: HandbookKind;
	readonly emphasis: HandbookEmphasis;
	readonly publication: HandbookPublication;
	readonly subsystem: string;
	readonly ownerPageId?: string;
}

export interface HandbookGroup {
	readonly id: string;
	readonly sectionId: NavigationPageId;
	readonly label: string;
	readonly order: number;
	readonly pages: readonly HandbookPage[];
}

type PageInput = Omit<HandbookPage, 'sectionId' | 'groupId' | 'order' | 'publication'> & {
	readonly publication?: HandbookPublication;
};

const group = (
	id: string,
	sectionId: NavigationPageId,
	label: string,
	order: number,
	pages: readonly PageInput[],
): HandbookGroup => ({
	id,
	sectionId,
	label,
	order,
	pages: pages.map((page, index) => ({
		...page,
		groupId: id,
		sectionId,
		order: index + 1,
		publication: page.publication ?? 'planned',
	})),
});

const handbookGroupsUnvalidated = [
	group('concepts-foundations', 'concepts', 'Engine model', 1, [
		{ pageId: 'architecture', slug: 'concepts/architecture', title: 'Architecture', kind: 'concept', emphasis: 'overview', publication: 'published', subsystem: 'core' },
		{ pageId: 'lifecycle-and-ownership', slug: 'concepts/lifecycle-and-ownership', title: 'Lifecycle and ownership', kind: 'concept', emphasis: 'focused', publication: 'published', subsystem: 'core' },
		{ pageId: 'errors-and-diagnostics', slug: 'concepts/errors-and-diagnostics', title: 'Errors and diagnostics', kind: 'concept', emphasis: 'focused', publication: 'published', subsystem: 'core' },
		{ pageId: 'threading-and-synchronization', slug: 'concepts/threading-and-synchronization', title: 'Threading and synchronization', kind: 'concept', emphasis: 'focused', publication: 'published', subsystem: 'core' },
		{ pageId: 'frame-and-resource-flow', slug: 'concepts/frame-and-resource-flow', title: 'Frame and resource flow', kind: 'concept', emphasis: 'focused', publication: 'published', subsystem: 'renderer' },
		{ pageId: 'cpp-lua-boundary', slug: 'concepts/cpp-lua-boundary', title: 'C++ and Lua boundary', kind: 'concept', emphasis: 'focused', publication: 'published', subsystem: 'lua' },
		{ pageId: 'ui-composition', slug: 'concepts/ui-composition', title: 'UI composition', kind: 'concept', emphasis: 'focused', publication: 'published', subsystem: 'ui' },
		{ pageId: 'audio-and-client-flow', slug: 'concepts/audio-and-client-flow', title: 'Audio and Client flow', kind: 'concept', emphasis: 'focused', publication: 'published', subsystem: 'audio' },
	]),
	group('core-foundations', 'systems', 'Core runtime', 2, [
		{ pageId: 'core', slug: 'systems/core', title: 'Core runtime', kind: 'system', emphasis: 'overview', publication: 'published', subsystem: 'core' },
		{ pageId: 'runtime-configuration', slug: 'systems/core/runtime-configuration', title: 'Runtime configuration', kind: 'system', emphasis: 'focused', publication: 'published', subsystem: 'core' },
		{ pageId: 'core-threading-and-performance', slug: 'systems/core/threading-and-performance', title: 'Threading and performance', kind: 'system', emphasis: 'focused', publication: 'published', subsystem: 'core' },
	]),
	group('math-foundations', 'systems', 'Math', 3, [
		{ pageId: 'math', slug: 'systems/math', title: 'Math', kind: 'system', emphasis: 'overview', publication: 'published', subsystem: 'math' },
		{ pageId: 'geometry-and-intersections', slug: 'systems/math/geometry-and-intersections', title: 'Geometry and intersections', kind: 'system', emphasis: 'focused', publication: 'published', subsystem: 'math' },
		{ pageId: 'lua-json-and-numerics', slug: 'systems/math/lua-json-and-numerics', title: 'Lua, JSON, and numerics', kind: 'system', emphasis: 'focused', publication: 'published', subsystem: 'math' },
	]),
	group('utilities-foundations', 'systems', 'Utilities', 4, [
		{ pageId: 'utilities', slug: 'systems/utilities', title: 'Utilities', kind: 'system', emphasis: 'overview', publication: 'published', subsystem: 'utilities' },
		{ pageId: 'events-and-concurrency', slug: 'systems/utilities/events-and-concurrency', title: 'Events and concurrency', kind: 'system', emphasis: 'focused', publication: 'published', subsystem: 'utilities' },
		{ pageId: 'data-color-and-packing', slug: 'systems/utilities/data-color-and-packing', title: 'Data, color, and packing', kind: 'system', emphasis: 'focused', publication: 'published', subsystem: 'utilities' },
	]),
	group('foundation-reference', 'reference', 'Core, math, and utility reference', 5, [
		{ pageId: 'core-math-utility-types', slug: 'reference/core-math-utility-types', title: 'Core, math, and utility types', kind: 'reference', emphasis: 'lookup', publication: 'published', subsystem: 'core', ownerPageId: 'core' },
	]),
	group('renderer-system', 'systems', 'Renderer', 6, [
		{ pageId: 'renderer-overview', slug: 'systems/renderer', title: 'Renderer', kind: 'system', emphasis: 'overview', publication: 'published', subsystem: 'renderer' },
		{ pageId: 'frame-vulkan-and-queues', slug: 'systems/renderer/frame-vulkan-and-queues', title: 'Frame, Vulkan, and queues', kind: 'system', emphasis: 'focused', publication: 'published', subsystem: 'renderer' },
		{ pageId: 'renderer-resources-and-synchronization', slug: 'systems/renderer/resources-and-synchronization', title: 'Resources and synchronization', kind: 'system', emphasis: 'focused', publication: 'published', subsystem: 'renderer' },
		{ pageId: 'shaders-and-pipelines', slug: 'systems/renderer/shaders-and-pipelines', title: 'Shaders and pipelines', kind: 'system', emphasis: 'focused', publication: 'published', subsystem: 'renderer' },
		{ pageId: 'targets-text-and-composition', slug: 'systems/renderer/targets-text-and-composition', title: 'Targets, text, and composition', kind: 'system', emphasis: 'focused', publication: 'published', subsystem: 'renderer' },
	]),
	group('models-system', 'systems', 'Models and animation', 7, [
		{ pageId: 'models', slug: 'systems/models', title: 'Models', kind: 'system', emphasis: 'overview', publication: 'published', subsystem: 'models' },
		{ pageId: 'loading-meshes-and-materials', slug: 'systems/models/loading-meshes-and-materials', title: 'Loading meshes and materials', kind: 'system', emphasis: 'focused', publication: 'published', subsystem: 'models' },
		{ pageId: 'animation-skeletons-and-cameras', slug: 'systems/models/animation-skeletons-and-cameras', title: 'Animation, skeletons, and cameras', kind: 'system', emphasis: 'focused', publication: 'published', subsystem: 'models' },
	]),
	group('renderer-guides', 'guides', 'Renderer and model guides', 8, [
		{ pageId: 'create-a-shader-and-pipeline', slug: 'guides/create-a-shader-and-pipeline', title: 'Create a shader and pipeline', kind: 'guide', emphasis: 'focused', publication: 'published', subsystem: 'renderer' },
		{ pageId: 'upload-and-render-a-model', slug: 'guides/upload-and-render-a-model', title: 'Upload and render a model', kind: 'guide', emphasis: 'focused', publication: 'published', subsystem: 'models' },
		{ pageId: 'control-camera-and-animation', slug: 'guides/control-camera-and-animation', title: 'Control camera and animation', kind: 'guide', emphasis: 'focused', publication: 'published', subsystem: 'models' },
	]),
	group('renderer-reference', 'reference', 'Renderer reference', 9, [
		{ pageId: 'renderer-and-resource-contracts', slug: 'reference/renderer-and-resource-contracts', title: 'Renderer and resource contracts', kind: 'reference', emphasis: 'lookup', publication: 'published', subsystem: 'renderer', ownerPageId: 'renderer-overview' },
	]),
	group('lua-system', 'systems', 'Lua runtime', 10, [
		{ pageId: 'lua', slug: 'systems/lua', title: 'Lua runtime', kind: 'system', emphasis: 'overview', publication: 'published', subsystem: 'lua' },
		{ pageId: 'runtime-calls-and-bindings', slug: 'systems/lua/runtime-calls-and-bindings', title: 'Runtime calls and bindings', kind: 'system', emphasis: 'deep', publication: 'published', subsystem: 'lua' },
	]),
	group('ui-system', 'systems', 'UI', 11, [
		{ pageId: 'ui', slug: 'systems/ui', title: 'UI', kind: 'system', emphasis: 'overview', publication: 'published', subsystem: 'ui' },
		{ pageId: 'entities-hierarchy-and-layout', slug: 'systems/ui/entities-hierarchy-and-layout', title: 'Entities, hierarchy, and layout', kind: 'system', emphasis: 'deep', publication: 'published', subsystem: 'ui' },
		{ pageId: 'rendering-and-visuals', slug: 'systems/ui/rendering-and-visuals', title: 'Rendering and visuals', kind: 'system', emphasis: 'deep', publication: 'published', subsystem: 'ui' },
		{ pageId: 'text-input-and-focus', slug: 'systems/ui/text-input-and-focus', title: 'Text input and focus', kind: 'system', emphasis: 'deep', publication: 'published', subsystem: 'ui' },
		{ pageId: 'ui-events-and-callbacks', slug: 'systems/ui/events-and-callbacks', title: 'Events and callbacks', kind: 'system', emphasis: 'deep', publication: 'published', subsystem: 'ui' },
		{ pageId: 'scrolling-and-popups', slug: 'systems/ui/scrolling-and-popups', title: 'Scrolling and popups', kind: 'system', emphasis: 'deep', publication: 'published', subsystem: 'ui' },
		{ pageId: 'animation-and-effects', slug: 'systems/ui/animation-and-effects', title: 'Animation and effects', kind: 'system', emphasis: 'deep', publication: 'published', subsystem: 'ui' },
		{ pageId: 'reusable-components', slug: 'systems/ui/reusable-components', title: 'Reusable components', kind: 'system', emphasis: 'deep', publication: 'published', subsystem: 'ui' },
	]),
	group('ui-guides', 'guides', 'UI guides', 12, [
		{ pageId: 'build-a-ui-screen', slug: 'guides/build-a-ui-screen', title: 'Build a UI screen', kind: 'guide', emphasis: 'deep', publication: 'published', subsystem: 'ui' },
		{ pageId: 'create-a-reusable-ui-component', slug: 'guides/create-a-reusable-ui-component', title: 'Create a reusable UI component', kind: 'guide', emphasis: 'deep', publication: 'published', subsystem: 'ui' },
		{ pageId: 'build-a-form-and-handle-input', slug: 'guides/build-a-form-and-handle-input', title: 'Build a form and handle input', kind: 'guide', emphasis: 'deep', publication: 'published', subsystem: 'ui' },
		{ pageId: 'add-scrolling-and-popups', slug: 'guides/add-scrolling-and-popups', title: 'Add scrolling and popups', kind: 'guide', emphasis: 'deep', publication: 'published', subsystem: 'ui' },
		{ pageId: 'animate-and-style-ui', slug: 'guides/animate-and-style-ui', title: 'Animate and style UI', kind: 'guide', emphasis: 'deep', publication: 'published', subsystem: 'ui' },
		{ pageId: 'use-sprites-images-and-nine-slice', slug: 'guides/use-sprites-images-and-nine-slice', title: 'Use sprites, images, and nine-slice', kind: 'guide', emphasis: 'deep', publication: 'published', subsystem: 'ui' },
	]),
	group('ui-reference', 'reference', 'Lua and UI reference', 13, [
		{ pageId: 'lua-api', slug: 'reference/lua-api', title: 'Lua API', kind: 'reference', emphasis: 'lookup', publication: 'published', subsystem: 'lua', ownerPageId: 'lua' },
		{ pageId: 'ui-element-keys', slug: 'reference/ui-element-keys', title: 'UI element keys', kind: 'reference', emphasis: 'lookup', publication: 'published', subsystem: 'ui', ownerPageId: 'ui' },
		{ pageId: 'ui-components', slug: 'reference/ui-components', title: 'UI components', kind: 'reference', emphasis: 'lookup', publication: 'published', subsystem: 'ui', ownerPageId: 'ui' },
		{ pageId: 'ui-events-and-callbacks-reference', slug: 'reference/ui-events-and-callbacks', title: 'UI events and callbacks', kind: 'reference', emphasis: 'lookup', publication: 'published', subsystem: 'ui', ownerPageId: 'ui' },
		{ pageId: 'ui-layout-values', slug: 'reference/ui-layout-values', title: 'UI layout values', kind: 'reference', emphasis: 'lookup', publication: 'published', subsystem: 'ui', ownerPageId: 'ui' },
	]),
	group('ui-tools', 'tools', 'UI tools', 14, [
		{ pageId: 'ui-test', slug: 'tools/ui-test', title: 'UI Test', kind: 'tool', emphasis: 'deep', publication: 'published', subsystem: 'ui' },
	]),
	group('audio-system', 'systems', 'Audio', 15, [
		{ pageId: 'audio', slug: 'systems/audio', title: 'Audio', kind: 'system', emphasis: 'overview', publication: 'published', subsystem: 'audio' },
		{ pageId: 'audio-lifecycle-and-command-flow', slug: 'systems/audio/lifecycle-and-command-flow', title: 'Lifecycle and command flow', kind: 'system', emphasis: 'focused', publication: 'published', subsystem: 'audio' },
		{ pageId: 'playback-and-streaming', slug: 'systems/audio/playback-and-streaming', title: 'Playback and streaming', kind: 'system', emphasis: 'focused', publication: 'published', subsystem: 'audio' },
		{ pageId: 'buses-voices-and-limitations', slug: 'systems/audio/buses-voices-and-limitations', title: 'Buses, voices, and limitations', kind: 'system', emphasis: 'focused', publication: 'published', subsystem: 'audio' },
	]),
	group('audio-guides', 'guides', 'Audio guides', 16, [
		{ pageId: 'use-audio-playback', slug: 'guides/use-audio-playback', title: 'Use audio playback', kind: 'guide', emphasis: 'focused', publication: 'published', subsystem: 'audio' },
	]),
	group('audio-reference', 'reference', 'Audio reference', 17, [
		{ pageId: 'audio-contracts', slug: 'reference/audio-contracts', title: 'Audio contracts', kind: 'reference', emphasis: 'lookup', publication: 'published', subsystem: 'audio', ownerPageId: 'audio' },
	]),
	group('audio-tools', 'tools', 'Audio tools', 18, [
		{ pageId: 'audio-test', slug: 'tools/audio-test', title: 'Audio Test', kind: 'tool', emphasis: 'focused', publication: 'published', subsystem: 'audio' },
	]),
	group('client-system', 'systems', 'Client', 19, [
		{ pageId: 'client-system', slug: 'systems/client', title: 'Client', kind: 'system', emphasis: 'overview', publication: 'published', subsystem: 'client' },
	]),
	group('window-system', 'systems', 'Window and input', 20, [
		{ pageId: 'window', slug: 'systems/window', title: 'Window and input', kind: 'system', emphasis: 'overview', publication: 'published', subsystem: 'window' },
	]),
	group('server-system', 'systems', 'Experimental server', 21, [
		{ pageId: 'server', slug: 'systems/server', title: 'Experimental server', kind: 'system', emphasis: 'overview', publication: 'published', subsystem: 'server' },
	]),
	group('client-guides', 'guides', 'Client and input guides', 22, [
		{ pageId: 'create-a-client-layer', slug: 'guides/create-a-client-layer', title: 'Create a Client layer', kind: 'guide', emphasis: 'focused', publication: 'published', subsystem: 'client' },
		{ pageId: 'handle-input-focus-and-text', slug: 'guides/handle-input-focus-and-text', title: 'Handle input, focus, and text', kind: 'guide', emphasis: 'focused', publication: 'published', subsystem: 'window' },
	]),
	group('window-reference', 'reference', 'Window and input reference', 23, [
		{ pageId: 'window-and-input-contracts', slug: 'reference/window-and-input-contracts', title: 'Window and input contracts', kind: 'reference', emphasis: 'lookup', publication: 'published', subsystem: 'window', ownerPageId: 'window' },
	]),
	group('platform-tools', 'tools', 'Client and test tools', 24, [
		{ pageId: 'interactive-client', slug: 'tools/interactive-client', title: 'Interactive Client', kind: 'tool', emphasis: 'focused', publication: 'published', subsystem: 'client' },
		{ pageId: 'core-test-suite', slug: 'tools/core-test-suite', title: 'Core test suite', kind: 'tool', emphasis: 'focused', publication: 'published', subsystem: 'core' },
		{ pageId: 'model-test', slug: 'tools/model-test', title: 'Model Test', kind: 'tool', emphasis: 'focused', publication: 'published', subsystem: 'models' },
		{ pageId: 'test-fixtures', slug: 'tools/test-fixtures', title: 'Test fixtures', kind: 'tool', emphasis: 'focused', publication: 'published', subsystem: 'tools' },
		{ pageId: 'mlecubes', slug: 'tools/mlecubes', title: 'MLECubes', kind: 'tool', emphasis: 'focused', publication: 'published', subsystem: 'tools' },
	]),
	group('contributing-tests', 'contributing', 'Tests and interactive pages', 25, [
		{ pageId: 'tests-and-interactive-pages', slug: 'contributing/tests-and-interactive-pages', title: 'Tests and interactive pages', kind: 'contributing', emphasis: 'focused', publication: 'published', subsystem: 'tools' },
	]),
] as const satisfies readonly HandbookGroup[];

export const handbookGroups = handbookGroupsUnvalidated;
export const handbookPages = handbookGroups.flatMap(({ pages }) => pages);

export function getHandbookPage(pageId: string): HandbookPage {
	const page = handbookPages.find((candidate) => candidate.pageId === pageId);
	if (!page) throw new Error(`Unknown handbook page ${pageId}.`);
	return page;
}

export function validateHandbookRegistry(groups: readonly HandbookGroup[]): readonly string[] {
	const errors: string[] = [];
	const pageIds = new Set<string>();
	const slugs = new Set<string>();
	const knownSections = new Set<string>([
		'start', 'concepts', 'systems', 'guides', 'reference', 'tools', 'contributing',
	]);
	const pages = groups.flatMap(({ pages: groupPages }) => groupPages);
	const knownPageIds = new Set(pages.map(({ pageId }) => pageId));

	for (const handbookGroup of groups) {
		if (!knownSections.has(handbookGroup.sectionId)) {
			errors.push(`Handbook group ${handbookGroup.id} references unknown navigation section ${handbookGroup.sectionId}.`);
		}
		for (const [index, page] of handbookGroup.pages.entries()) {
			const expectedOrder = index + 1;
			if (page.order !== expectedOrder) {
				errors.push(`Handbook group ${handbookGroup.id} has noncontiguous page order: expected ${expectedOrder}, found ${page.order}.`);
			}
			if (pageIds.has(page.pageId)) errors.push(`Duplicate handbook pageId ${page.pageId}.`);
			else pageIds.add(page.pageId);
			if (slugs.has(page.slug)) errors.push(`Duplicate handbook slug ${page.slug}.`);
			else slugs.add(page.slug);
			if (!['planned', 'published'].includes(page.publication)) {
				errors.push(`Handbook page ${page.pageId} has invalid publication ${page.publication}.`);
			}
			if (page.kind === 'reference' && (!page.ownerPageId || !knownPageIds.has(page.ownerPageId))) {
				errors.push(`Handbook page ${page.pageId} references unknown owner ${page.ownerPageId ?? '(none)'}.`);
			}
		}
	}

	return errors.sort((left, right) => left.localeCompare(right));
}

const registryErrors = validateHandbookRegistry(handbookGroups);
if (registryErrors.length > 0) {
	throw new Error(['Invalid handbook registry:', ...registryErrors].join('\n'));
}
