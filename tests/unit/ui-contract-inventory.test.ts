import { describe, expect, it } from 'vitest';
import { handbookPages } from '../../src/data/handbook';

export interface UiContractRecord {
	readonly kind: 'usertype' | 'callable' | 'key' | 'component' | 'event' | 'callback' | 'layout-value';
	readonly name: string;
	readonly ownerPageId: string;
}

interface UiContractDiff {
	readonly missing: readonly string[];
	readonly extra: readonly string[];
	readonly duplicates: readonly string[];
}

const keyOf = ({ kind, name }: Pick<UiContractRecord, 'kind' | 'name'>) => `${kind}:${name}`;

export function compareUiContracts(
	discovered: readonly UiContractRecord[],
	documented: readonly UiContractRecord[],
): UiContractDiff {
	const discoveredKeys = new Set(discovered.map(keyOf));
	const documentedKeys = new Set(documented.map(keyOf));
	const counts = new Map<string, number>();
	for (const record of documented) counts.set(keyOf(record), (counts.get(keyOf(record)) ?? 0) + 1);
	return {
		missing: [...discoveredKeys].filter((key) => !documentedKeys.has(key)).sort(),
		extra: [...documentedKeys].filter((key) => !discoveredKeys.has(key)).sort(),
		duplicates: [...counts].filter(([, count]) => count > 1).map(([key]) => key).sort(),
	};
}

const records = (
	kind: UiContractRecord['kind'],
	ownerPageId: string,
	names: readonly string[],
): readonly UiContractRecord[] => names.map((name) => ({ kind, name, ownerPageId }));

const discoveredRecords: readonly UiContractRecord[] = [
	...records('usertype', 'runtime-calls-and-bindings', [
		'Vec2i', 'Vec3i', 'Vec4i', 'Vec2f', 'Vec3f', 'Vec4f', 'Rectf', 'Recti', 'Color', 'Stopwatch',
		'mle_UI', 'mle_ui_Entt', 'uiHovered', 'mle_Image',
	]),
	...records('callable', 'lua-api', [
		'Utils.partial_word_match', 'C.stop',
		'Color()', 'Color(Vec3f, f32)', 'Color(Vec4f)', 'Color(Vec4u)',
		'Color(f32, f32, f32, f32)', 'Color(u32, u32, u32, u32)', 'Color(u32)', 'Color(string)', 'Color(object)',
		'Color.r', 'Color.g', 'Color.b', 'Color.a', 'Color.mix', 'Color.lighten', 'Color.withA',
		'Color.toLinear', 'Color.toSRGB', 'Color.random', 'Color.fromHSV', 'Color.toHSV',
		'Stopwatch()', 'Stopwatch.reset', 'Stopwatch.elapsedSecInt', 'Stopwatch.elapsedSecFloat', 'Stopwatch.elapsedMSFloat',
		'mle_UI.getElementById', 'mle_UI.hitTest', 'mle_UI.logAllBounds', 'mle_UI.getRoot', 'mle_UI.destroyElementById',
		'mle_ui_Entt.apply', 'mle_ui_Entt.applyTable', 'mle_ui_Entt.get', 'mle_ui_Entt.entt', 'mle_ui_Entt.ui',
		'mle_ui_Entt.parent', 'mle_ui_Entt.name', 'mle_ui_Entt.fullName', 'mle_ui_Entt.getChild', 'mle_ui_Entt.valid',
		'mle_ui_Entt.addChild', 'mle_ui_Entt.addExistingChild', 'mle_ui_Entt.applyOnChildren', 'mle_ui_Entt.enableAll',
		'mle_ui_Entt.disableAll', 'mle_ui_Entt.disableAllBut', 'mle_ui_Entt.call', 'mle_ui_Entt.dispatch',
		'mle_ui_Entt.destroy', 'mle_ui_Entt.destroyAllChildren', 'mle_ui_Entt.beginCursorDrag', 'mle_ui_Entt.ignoreHover',
		'mle_ui_Entt.getChildrenNamedRecursive', 'mle_ui_Entt.hasTag', 'mle_ui_Entt.getChildrenWithTagRecursive',
		'mle_ui_Entt.createPopup', 'mle_ui_Entt.getBoundsOnRoot', 'mle_ui_Entt.getBoundsOnRootNormalized',
		'mle_ui_Entt.requestInternalBoundsUpdate', 'mle_ui_Entt.requestExternalBoundsUpdate', 'mle_ui_Entt.destroyAnimation',
		'mle_Image.getExtent',
	]),
	...records('key', 'ui-element-keys', [
		'children_base', 'style', 'comp', 'name', 'idx', 'styles',
		'c', 'children', 'add_child', 'child', 'container', 'list', 'list_container', 'free', 'free_container',
		'size', 'size_x', 'size_y', 'size_x_dep', 'size_y_dep', 'pos', 'pos_x', 'pos_y', 'pos_x_dep', 'pos_y_dep',
		'padding', 'padding_t', 'padding_b', 'padding_l', 'padding_r', 'padding_x', 'padding_y', 'margin', 'margin_t',
		'margin_b', 'margin_l', 'margin_r', 'margin_x', 'margin_y', 'border', 'border_thickness', 'border_color',
		'border_round', 'border_t', 'border_b', 'border_l', 'border_r', 'border_x', 'border_y', 'border_round_lt',
		'border_round_rt', 'border_round_lb', 'border_round_rb', 'origin', 'origin_x', 'origin_y', 'aspect_ratio',
		'background', 'hoverable', 'on_hover', 'on_hover_in', 'on_hover_out', 'on_key', 'on_keys', 'on_scroll',
		'table', 'render_scale', 'on_update', 'animation', 'on_create', 'on_destroy', 'listen', 'id', 'tags',
		'remove_tags', 'layer', 'fn', 'active', 'enabled', 'disabled', 'force_fit', 'escape_parent_scissor',
		'ignore_parent_scissor', 'render_outside_parent', 'add_scroll_y', 'scroll_sensitivity', 'on_resized', 'sprite',
		'nine_slice', 'render_image', 'text', 'text_input_enable', 'text_input_disable', 'text_input_clear',
		'text_input_set', 'blur', 'shader', 'shader_params', 'hovered', 'scroll', 'overflow',
	]),
	...records('component', 'ui-components', [
		'Relationship', 'ChildrenBase', 'Name', 'ID', 'Tags', 'Table', 'Layer', 'Functions', 'OnUpdate', 'OnCreate',
		'OnDestroy', 'ListenEvents', 'RenderScale', 'Background', 'DisabledFlag', 'ForceFitFlag', 'EscapeParentScissorFlag',
		'RequestInternalBoundsUpdateFlag', 'RequestExternalBoundsUpdateFlag', 'DestroyFlag', 'CursorDragFlag', 'ResizedFlag',
		'IgnoreHoverFlag',
		'OnResized', 'ContentOverflow', 'PopupRoot', 'TargetSize', 'TargetPosition', 'TargetPadding', 'TargetMargin',
		'TargetBorder', 'TargetOrigin', 'TargetAspectRatio', 'Bounds', 'Border', 'SizeProvider', 'Dependency', 'ListContainer',
		'FreeContainer', 'Hoverable', 'Hovered', 'Renderable', 'Shader', 'Animation', 'RootImage', 'BlitExternalImage',
		'Text', 'Sprite', 'NineSlice', 'RenderImage', 'Blur', 'LuaShader',
	]),
	...records('event', 'ui-events-and-callbacks-reference', [
		'custom dispatch', 'hover in', 'hover', 'hover out', 'key', 'scroll', 'cursor drag begin', 'cursor drag',
		'cursor drag end', 'resized', 'text submit', 'text complete', 'animation finished',
	]),
	...records('callback', 'ui-events-and-callbacks-reference', [
		'on_hover_in', 'on_hover', 'on_hover_out', 'on_key', 'on_keys', 'on_scroll', 'on_update', 'on_create',
		'on_destroy', 'listen', 'on_resized', 'fn', 'onCursorDragBegin', 'onCursorDrag', 'onCursorDragEnd',
		'text.input.on_submit', 'text.input.on_complete', 'animation.on_finished',
	]),
	...records('layout-value', 'ui-layout-values', [
		'TargetBound.default', 'TargetBound.px', 'TargetBound.flex', 'TargetBound.fit', 'TargetBound.%', 'TargetBound.%r',
		'TargetBound.%w', 'TargetBound.%h', 'origin.l', 'origin.t', 'origin.r', 'origin.b', 'origin.x', 'origin.c',
		'list.horizontal', 'list.vertical', 'list.horizontal_reversed', 'list.vertical_reversed', 'justify.start',
		'justify.center', 'justify.end', 'justify.space_between', 'justify.space_around', 'justify.space_evenly',
		'cross_align.start', 'cross_align.center', 'cross_align.end', 'cross_align.stretch', 'wrap.no', 'wrap.wrap',
		'wrap.wrap_reversed',
	]),
];

// This fixture is intentionally maintained independently from source discovery above.
// A source-only or documentation-only edit must produce a real missing/extra diff.
const documentedRecords: readonly UiContractRecord[] = [
	...records('usertype', 'runtime-calls-and-bindings', [
		'Vec2i', 'Vec3i', 'Vec4i', 'Vec2f', 'Vec3f', 'Vec4f', 'Rectf', 'Recti', 'Color', 'Stopwatch',
		'mle_UI', 'mle_ui_Entt', 'uiHovered', 'mle_Image',
	]),
	...records('callable', 'lua-api', [
		'Utils.partial_word_match', 'C.stop',
		'Color()', 'Color(Vec3f, f32)', 'Color(Vec4f)', 'Color(Vec4u)',
		'Color(f32, f32, f32, f32)', 'Color(u32, u32, u32, u32)', 'Color(u32)', 'Color(string)', 'Color(object)',
		'Color.r', 'Color.g', 'Color.b', 'Color.a', 'Color.mix', 'Color.lighten', 'Color.withA',
		'Color.toLinear', 'Color.toSRGB', 'Color.random', 'Color.fromHSV', 'Color.toHSV',
		'Stopwatch()', 'Stopwatch.reset', 'Stopwatch.elapsedSecInt', 'Stopwatch.elapsedSecFloat', 'Stopwatch.elapsedMSFloat',
		'mle_UI.getElementById', 'mle_UI.hitTest', 'mle_UI.logAllBounds', 'mle_UI.getRoot', 'mle_UI.destroyElementById',
		'mle_ui_Entt.apply', 'mle_ui_Entt.applyTable', 'mle_ui_Entt.get', 'mle_ui_Entt.entt', 'mle_ui_Entt.ui',
		'mle_ui_Entt.parent', 'mle_ui_Entt.name', 'mle_ui_Entt.fullName', 'mle_ui_Entt.getChild', 'mle_ui_Entt.valid',
		'mle_ui_Entt.addChild', 'mle_ui_Entt.addExistingChild', 'mle_ui_Entt.applyOnChildren', 'mle_ui_Entt.enableAll',
		'mle_ui_Entt.disableAll', 'mle_ui_Entt.disableAllBut', 'mle_ui_Entt.call', 'mle_ui_Entt.dispatch',
		'mle_ui_Entt.destroy', 'mle_ui_Entt.destroyAllChildren', 'mle_ui_Entt.beginCursorDrag', 'mle_ui_Entt.ignoreHover',
		'mle_ui_Entt.getChildrenNamedRecursive', 'mle_ui_Entt.hasTag', 'mle_ui_Entt.getChildrenWithTagRecursive',
		'mle_ui_Entt.createPopup', 'mle_ui_Entt.getBoundsOnRoot', 'mle_ui_Entt.getBoundsOnRootNormalized',
		'mle_ui_Entt.requestInternalBoundsUpdate', 'mle_ui_Entt.requestExternalBoundsUpdate', 'mle_ui_Entt.destroyAnimation',
		'mle_Image.getExtent',
	]),
	...records('key', 'ui-element-keys', [
		'children_base', 'style', 'comp', 'name', 'idx', 'styles',
		'c', 'children', 'add_child', 'child', 'container', 'list', 'list_container', 'free', 'free_container',
		'size', 'size_x', 'size_y', 'size_x_dep', 'size_y_dep', 'pos', 'pos_x', 'pos_y', 'pos_x_dep', 'pos_y_dep',
		'padding', 'padding_t', 'padding_b', 'padding_l', 'padding_r', 'padding_x', 'padding_y', 'margin', 'margin_t',
		'margin_b', 'margin_l', 'margin_r', 'margin_x', 'margin_y', 'border', 'border_thickness', 'border_color',
		'border_round', 'border_t', 'border_b', 'border_l', 'border_r', 'border_x', 'border_y', 'border_round_lt',
		'border_round_rt', 'border_round_lb', 'border_round_rb', 'origin', 'origin_x', 'origin_y', 'aspect_ratio',
		'background', 'hoverable', 'on_hover', 'on_hover_in', 'on_hover_out', 'on_key', 'on_keys', 'on_scroll',
		'table', 'render_scale', 'on_update', 'animation', 'on_create', 'on_destroy', 'listen', 'id', 'tags',
		'remove_tags', 'layer', 'fn', 'active', 'enabled', 'disabled', 'force_fit', 'escape_parent_scissor',
		'ignore_parent_scissor', 'render_outside_parent', 'add_scroll_y', 'scroll_sensitivity', 'on_resized', 'sprite',
		'nine_slice', 'render_image', 'text', 'text_input_enable', 'text_input_disable', 'text_input_clear',
		'text_input_set', 'blur', 'shader', 'shader_params', 'hovered', 'scroll', 'overflow',
	]),
	...records('component', 'ui-components', [
		'Relationship', 'ChildrenBase', 'Name', 'ID', 'Tags', 'Table', 'Layer', 'Functions', 'OnUpdate', 'OnCreate',
		'OnDestroy', 'ListenEvents', 'RenderScale', 'Background', 'DisabledFlag', 'ForceFitFlag', 'EscapeParentScissorFlag',
		'RequestInternalBoundsUpdateFlag', 'RequestExternalBoundsUpdateFlag', 'DestroyFlag', 'CursorDragFlag', 'ResizedFlag',
		'IgnoreHoverFlag', 'OnResized', 'ContentOverflow', 'PopupRoot', 'TargetSize', 'TargetPosition', 'TargetPadding',
		'TargetMargin', 'TargetBorder', 'TargetOrigin', 'TargetAspectRatio', 'Bounds', 'Border', 'SizeProvider', 'Dependency',
		'ListContainer', 'FreeContainer', 'Hoverable', 'Hovered', 'Renderable', 'Shader', 'Animation', 'RootImage',
		'BlitExternalImage', 'Text', 'Sprite', 'NineSlice', 'RenderImage', 'Blur', 'LuaShader',
	]),
	...records('event', 'ui-events-and-callbacks-reference', [
		'custom dispatch', 'hover in', 'hover', 'hover out', 'key', 'scroll', 'cursor drag begin', 'cursor drag',
		'cursor drag end', 'resized', 'text submit', 'text complete', 'animation finished',
	]),
	...records('callback', 'ui-events-and-callbacks-reference', [
		'on_hover_in', 'on_hover', 'on_hover_out', 'on_key', 'on_keys', 'on_scroll', 'on_update', 'on_create',
		'on_destroy', 'listen', 'on_resized', 'fn', 'onCursorDragBegin', 'onCursorDrag', 'onCursorDragEnd',
		'text.input.on_submit', 'text.input.on_complete', 'animation.on_finished',
	]),
	...records('layout-value', 'ui-layout-values', [
		'TargetBound.default', 'TargetBound.px', 'TargetBound.flex', 'TargetBound.fit', 'TargetBound.%', 'TargetBound.%r',
		'TargetBound.%w', 'TargetBound.%h', 'origin.l', 'origin.t', 'origin.r', 'origin.b', 'origin.x', 'origin.c',
		'list.horizontal', 'list.vertical', 'list.horizontal_reversed', 'list.vertical_reversed', 'justify.start',
		'justify.center', 'justify.end', 'justify.space_between', 'justify.space_around', 'justify.space_evenly',
		'cross_align.start', 'cross_align.center', 'cross_align.end', 'cross_align.stretch', 'wrap.no', 'wrap.wrap',
		'wrap.wrap_reversed',
	]),
];

const reviewRequiredRecords: readonly UiContractRecord[] = [
	...records('key', 'ui-element-keys', ['children_base', 'style', 'comp', 'name', 'idx', 'styles']),
	...records('component', 'ui-components', [
		'RequestInternalBoundsUpdateFlag', 'RequestExternalBoundsUpdateFlag', 'DestroyFlag',
		'CursorDragFlag', 'ResizedFlag', 'IgnoreHoverFlag',
	]),
	...records('callable', 'lua-api', [
		'Color()', 'Color(Vec3f, f32)', 'Color(Vec4f)', 'Color(Vec4u)',
		'Color(f32, f32, f32, f32)', 'Color(u32, u32, u32, u32)', 'Color(u32)', 'Color(string)', 'Color(object)',
		'Color.r', 'Color.g', 'Color.b', 'Color.a', 'Color.mix', 'Color.lighten', 'Color.withA',
		'Color.toLinear', 'Color.toSRGB', 'Color.random', 'Color.fromHSV', 'Color.toHSV',
		'Stopwatch()', 'Stopwatch.reset', 'Stopwatch.elapsedSecInt', 'Stopwatch.elapsedSecFloat', 'Stopwatch.elapsedMSFloat',
	]),
];

describe('Lua/UI contract comparator', () => {
	it('reports missing, extra, and duplicate records deterministically', () => {
		const baseline = records('key', 'ui-element-keys', ['alpha', 'beta']);
		const documented: readonly UiContractRecord[] = [
			baseline[0],
			{ kind: 'key', name: 'gamma', ownerPageId: 'ui-element-keys' },
			baseline[0],
		];
		expect(compareUiContracts(baseline, documented)).toEqual({
			missing: ['key:beta'],
			extra: ['key:gamma'],
			duplicates: ['key:alpha'],
		});
	});

	it('has zero unexplained gaps for the manually verified pinned inventory', () => {
		expect(compareUiContracts(discoveredRecords, documentedRecords)).toEqual({ missing: [], extra: [], duplicates: [] });
	});

	it('exposes one-sided fixture deletions as genuine missing and extra records', () => {
		const firstKey = keyOf(discoveredRecords[0]);
		const documentationDeletion = documentedRecords.filter((record) => keyOf(record) !== firstKey);
		const discoveryDeletion = discoveredRecords.filter((record) => keyOf(record) !== firstKey);
		expect(compareUiContracts(discoveredRecords, documentationDeletion)).toMatchObject({ missing: [firstKey] });
		expect(compareUiContracts(discoveryDeletion, documentedRecords)).toMatchObject({ extra: [firstKey] });
	});

	it('normalizes every reviewed structural, flag, Color, and Stopwatch contract', () => {
		for (const record of reviewRequiredRecords) {
			expect(discoveredRecords, `discovered ${keyOf(record)}`).toContainEqual(record);
			expect(documentedRecords, `documented ${keyOf(record)}`).toContainEqual(record);
		}
	});

	it('assigns every contract to an exact Task 4 or Task 5 registry owner', () => {
		const allowedOwners = new Set([
			'cpp-lua-boundary', 'ui-composition', 'lua', 'runtime-calls-and-bindings', 'ui',
			'entities-hierarchy-and-layout', 'rendering-and-visuals', 'text-input-and-focus', 'ui-events-and-callbacks',
			'scrolling-and-popups', 'animation-and-effects', 'reusable-components', 'build-a-ui-screen',
			'create-a-reusable-ui-component', 'build-a-form-and-handle-input', 'add-scrolling-and-popups',
			'animate-and-style-ui', 'use-sprites-images-and-nine-slice', 'lua-api', 'ui-element-keys', 'ui-components',
			'ui-events-and-callbacks-reference', 'ui-layout-values', 'ui-test',
		]);
		const discoveredOwners = new Map(discoveredRecords.map((record) => [keyOf(record), record.ownerPageId]));
		for (const record of [...discoveredRecords, ...documentedRecords]) {
			expect(allowedOwners.has(record.ownerPageId), keyOf(record)).toBe(true);
			expect(handbookPages.some(({ pageId }) => pageId === record.ownerPageId), record.ownerPageId).toBe(true);
		}
		for (const record of documentedRecords) {
			expect(record.ownerPageId, keyOf(record)).toBe(discoveredOwners.get(keyOf(record)));
		}
	});
});
