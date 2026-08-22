import { expect, test } from '@playwright/test';

const origin = process.env.MLE_DOCS_E2E_ORIGIN ?? 'http://127.0.0.1:4321';
const versionId = 'c1abea3de165';
const commit = 'c1abea3de165032fe064300340807b7a6af388f8';

function url(path: string): string {
	return new URL(`/MLEDocs${path}`, origin).toString();
}

for (const pageCase of [
	{ path: 'systems/core/', title: 'Core runtime' },
	{ path: 'systems/math/geometry-and-intersections/', title: 'Geometry and intersections' },
	{ path: 'systems/utilities/', title: 'Utilities' },
	{ path: 'reference/core-math-utility-types/', title: 'Core, math, and utility types' },
	{ path: 'systems/renderer/', title: 'Renderer' },
	{ path: 'concepts/frame-and-resource-flow/', title: 'Frame and resource flow' },
	{ path: 'systems/renderer/resources-and-synchronization/', title: 'Resources and synchronization' },
	{ path: 'guides/create-a-shader-and-pipeline/', title: 'Create a shader and pipeline' },
	{ path: 'guides/upload-and-render-a-model/', title: 'Upload and render a model' },
	{ path: 'guides/control-camera-and-animation/', title: 'Control camera and animation' },
	{ path: 'reference/renderer-and-resource-contracts/', title: 'Renderer and resource contracts' },
	{ path: 'systems/lua/', title: 'Lua runtime' },
	{ path: 'systems/ui/', title: 'UI' },
	{ path: 'systems/ui/entities-hierarchy-and-layout/', title: 'Entities, hierarchy, and layout' },
	{ path: 'systems/ui/rendering-and-visuals/', title: 'Rendering and visuals' },
	{ path: 'systems/ui/text-input-and-focus/', title: 'Text input and focus' },
	{ path: 'systems/ui/events-and-callbacks/', title: 'Events and callbacks' },
	{ path: 'systems/ui/scrolling-and-popups/', title: 'Scrolling and popups' },
	{ path: 'systems/ui/animation-and-effects/', title: 'Animation and effects' },
	{ path: 'systems/ui/reusable-components/', title: 'Reusable components' },
	{ path: 'guides/build-a-form-and-handle-input/', title: 'Build a form and handle input' },
	{ path: 'guides/add-scrolling-and-popups/', title: 'Add scrolling and popups' },
	{ path: 'guides/animate-and-style-ui/', title: 'Animate and style UI' },
	{ path: 'guides/use-sprites-images-and-nine-slice/', title: 'Use sprites, images, and nine-slice' },
	{ path: 'reference/lua-api/', title: 'Lua API' },
	{ path: 'reference/ui-element-keys/', title: 'UI element keys' },
	{ path: 'reference/ui-components/', title: 'UI components' },
	{ path: 'reference/ui-events-and-callbacks/', title: 'UI events and callbacks' },
	{ path: 'reference/ui-layout-values/', title: 'UI layout values' },
	{ path: 'tools/ui-test/', title: 'UI Test' },
	{ path: 'systems/audio/', title: 'Audio' },
	{ path: 'systems/audio/lifecycle-and-command-flow/', title: 'Lifecycle and command flow' },
	{ path: 'systems/audio/playback-and-streaming/', title: 'Playback and streaming' },
	{ path: 'systems/audio/buses-voices-and-limitations/', title: 'Buses, voices, and limitations' },
	{ path: 'guides/use-audio-playback/', title: 'Use audio playback' },
	{ path: 'reference/audio-contracts/', title: 'Audio contracts' },
	{ path: 'tools/audio-test/', title: 'Audio Test' },
	{ path: 'concepts/audio-and-client-flow/', title: 'Audio and Client flow' },
	{ path: 'systems/client/', title: 'Client' },
	{ path: 'systems/window/', title: 'Window and input' },
	{ path: 'systems/server/', title: 'Experimental server' },
	{ path: 'guides/create-a-client-layer/', title: 'Create a Client layer' },
	{ path: 'guides/handle-input-focus-and-text/', title: 'Handle input, focus, and text' },
	{ path: 'reference/window-and-input-contracts/', title: 'Window and input contracts' },
	{ path: 'tools/interactive-client/', title: 'Interactive Client' },
] as const) {
	test(`${pageCase.title} renders as a pinned handbook page`, async ({ page }) => {
		await page.goto(url(`/versions/${versionId}/${pageCase.path}`));
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(pageCase.title);
		await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
			'href',
			new RegExp(`/MLEDocs/versions/${versionId}/${pageCase.path}$`),
		);
		await expect(page.locator('[data-mle-page-permanent-link]')).toHaveAttribute(
			'href',
			`/MLEDocs/versions/${versionId}/${pageCase.path}`,
		);
		const evidence = page.locator('[data-mle-source-evidence]');
		await expect(evidence).toBeVisible();
		await evidence.locator('summary').click();
		expect(await evidence.locator('a').evaluateAll((links) => links.map((link) => link.getAttribute('href'))))
			.toEqual(expect.arrayContaining([expect.stringContaining(`/blob/${commit}/`)]));
		expect(await page.locator('meta[data-pagefind-filter="mleVersion"]').getAttribute('content'))
			.toBe(versionId);
		expect(await page.locator('meta[data-pagefind-filter="mleLocale"]').getAttribute('content'))
			.toBe('en');
	});
}

test('Core pages occupy their registry order in the systems sidebar', async ({ page }) => {
	await page.goto(url(`/versions/${versionId}/systems/core/`));
	const sidebar = page.locator('#starlight__sidebar');
	const labels = await sidebar.getByRole('link').allTextContents();
	const coreIndex = labels.findIndex((label) => label.trim() === 'Core runtime');
	expect(coreIndex).toBeGreaterThanOrEqual(0);
	expect(labels.slice(coreIndex, coreIndex + 3).map((label) => label.trim())).toEqual([
		'Core runtime',
		'Runtime configuration',
		'Threading and performance',
	]);
});

test('latest Core alias resolves to the permanent commit route', async ({ page }) => {
	await page.goto(url('/latest/systems/core/'));
	await expect(page).toHaveURL(new RegExp(`/MLEDocs/versions/${versionId}/systems/core/$`));
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Core runtime');
});

test('latest renderer guide resolves to the permanent commit route', async ({ page }) => {
	await page.goto(url('/latest/guides/create-a-shader-and-pipeline/'));
	await expect(page).toHaveURL(new RegExp(`/MLEDocs/versions/${versionId}/guides/create-a-shader-and-pipeline/$`));
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Create a shader and pipeline');
});

test('latest UI overview resolves to the permanent commit route', async ({ page }) => {
	await page.goto(url('/latest/systems/ui/'));
	await expect(page).toHaveURL(new RegExp(`/MLEDocs/versions/${versionId}/systems/ui/$`));
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('UI');
});

test('latest UI guide resolves to the permanent commit route', async ({ page }) => {
	await page.goto(url('/latest/guides/build-a-form-and-handle-input/'));
	await expect(page).toHaveURL(new RegExp(`/MLEDocs/versions/${versionId}/guides/build-a-form-and-handle-input/$`));
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Build a form and handle input');
});

test('Portuguese geometry route is a same-commit English fallback', async ({ page }) => {
	await page.goto(url(`/pt-br/versions/${versionId}/systems/math/geometry-and-intersections/`));
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Geometry and intersections');
	await expect(page.locator('main')).toHaveAttribute('lang', 'en');
	await expect(page.locator('[data-mle-translation-status="fallback"]')).toContainText(
		`Commit fixado: ${versionId}.`,
	);
	expect(await page.locator('meta[data-pagefind-filter="mleLocale"]').getAttribute('content'))
		.toBe('pt-br');
});

test('Portuguese renderer guide is a same-commit English fallback', async ({ page }) => {
	await page.goto(url(`/pt-br/versions/${versionId}/guides/upload-and-render-a-model/`));
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Upload and render a model');
	await expect(page.locator('main')).toHaveAttribute('lang', 'en');
	await expect(page.locator('[data-mle-translation-status="fallback"]')).toContainText(`Commit fixado: ${versionId}.`);
	expect(await page.locator('meta[data-pagefind-filter="mleVersion"]').getAttribute('content')).toBe(versionId);
	expect(await page.locator('meta[data-pagefind-filter="mleLocale"]').getAttribute('content')).toBe('pt-br');
});

test('Portuguese UI hierarchy is a same-commit English fallback', async ({ page }) => {
	await page.goto(url(`/pt-br/versions/${versionId}/systems/ui/entities-hierarchy-and-layout/`));
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Entities, hierarchy, and layout');
	await expect(page.locator('main')).toHaveAttribute('lang', 'en');
	await expect(page.locator('[data-mle-translation-status="fallback"]')).toContainText(`Commit fixado: ${versionId}.`);
	expect(await page.locator('meta[data-pagefind-filter="mleVersion"]').getAttribute('content')).toBe(versionId);
	expect(await page.locator('meta[data-pagefind-filter="mleLocale"]').getAttribute('content')).toBe('pt-br');
});

test('Portuguese dense UI reference is a same-commit English fallback', async ({ page }) => {
	await page.goto(url(`/pt-br/versions/${versionId}/reference/ui-element-keys/`));
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('UI element keys');
	await expect(page.locator('main')).toHaveAttribute('lang', 'en');
	await expect(page.locator('[data-mle-translation-status="fallback"]')).toContainText(`Commit fixado: ${versionId}.`);
	expect(await page.locator('meta[data-pagefind-filter="mleLocale"]').getAttribute('content')).toBe('pt-br');
});

test('Lua and UI foundation pages occupy their registry order in the systems sidebar', async ({ page }) => {
	await page.goto(url(`/versions/${versionId}/systems/ui/`));
	const labels = (await page.locator('#starlight__sidebar').getByRole('link').allTextContents()).map((label) => label.trim());
	const luaIndex = labels.indexOf('Lua runtime');
	const uiIndex = labels.indexOf('UI');
	expect(luaIndex).toBeGreaterThanOrEqual(0);
	expect(labels.slice(luaIndex, luaIndex + 2)).toEqual(['Lua runtime', 'Runtime calls and bindings']);
	expect(uiIndex).toBeGreaterThan(luaIndex);
	expect(labels.slice(uiIndex, uiIndex + 8)).toEqual([
		'UI', 'Entities, hierarchy, and layout', 'Rendering and visuals', 'Text input and focus', 'Events and callbacks',
		'Scrolling and popups', 'Animation and effects', 'Reusable components',
	]);
});

test('UI guides expose the complete practical sequence', async ({ page }) => {
	for (const path of [
		'build-a-ui-screen', 'create-a-reusable-ui-component', 'build-a-form-and-handle-input',
		'add-scrolling-and-popups', 'animate-and-style-ui', 'use-sprites-images-and-nine-slice',
	]) {
		await page.goto(url(`/versions/${versionId}/guides/${path}/`));
		for (const name of ['Outcome', 'Preconditions', 'Construct the entities and components', 'Configure layout and visuals', 'Connect state and interaction', 'Verify the result', 'Cleanup and failure modes', 'Authoritative example']) {
			await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
		}
	}
});

test('renderer guides expose the practical sequence and source boundary', async ({ page }) => {
	for (const path of [
		'guides/create-a-shader-and-pipeline/',
		'guides/upload-and-render-a-model/',
		'guides/control-camera-and-animation/',
	]) {
		await page.goto(url(`/versions/${versionId}/${path}`));
		await expect(page.getByRole('heading', { name: 'Prerequisites' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Sequence' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Success signal' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Cleanup' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Limitations' })).toBeVisible();
		const evidence = page.locator('[data-mle-source-evidence]');
		await evidence.locator('summary').click();
		await expect(evidence.locator(`a[href*="/blob/${commit}/"]`).first()).toBeVisible();
	}
});

test('Pagefind discovers the pinned runtime configuration page in active scope', async ({ page }) => {
	await page.goto(url(`/versions/${versionId}/systems/core/`));
	await expect(page.locator('#starlight__search .pagefind-ui__search-input')).toHaveCount(1, {
		timeout: 15_000,
	});
	await page.keyboard.press('Control+k');
	const dialog = page.getByRole('dialog', { name: 'Search' });
	await dialog.locator('.pagefind-ui__search-input').fill('RuntimeConfig listener');
	const result = dialog.locator('.pagefind-ui__result').filter({ hasText: 'Runtime configuration' }).first();
	await expect(result).toBeVisible({ timeout: 15_000 });
	await expect(result).toHaveAttribute('data-mle-search-version', versionId);
	await expect(result).toHaveAttribute('data-mle-search-locale', 'en');
});

test('audio pages expose command ownership, limitations, and evidence without synchronous promises', async ({ page }) => {
	await page.goto(url(`/versions/${versionId}/systems/audio/lifecycle-and-command-flow/`));
	await expect(page.locator('main')).toContainText('ACCEPTED');
	await expect(page.locator('main')).toContainText('FULL');
	await expect(page.locator('main')).toContainText('CLOSED');
	await expect(page.locator('main')).toContainText('returns no acceptance or completion value');

	await page.goto(url(`/versions/${versionId}/systems/audio/buses-voices-and-limitations/`));
	await expect(page.locator('main')).toContainText('There are no named buses');
	await expect(page.locator('main')).toContainText('SetListener');
	await expect(page.locator('main')).toContainText('TODO handlers');

	await page.goto(url(`/versions/${versionId}/systems/audio/playback-and-streaming/`));
	await expect(page.locator('main')).toContainText('up to four OpenAL buffers');
	await expect(page.locator('main')).toContainText('queue fewer buffers');

	await page.goto(url(`/versions/${versionId}/reference/audio-contracts/`));
	await expect(page.locator('main')).toContainText('RampCompletion::STOP');
	await expect(page.locator('main')).toContainText('RampAdvance');

	await page.goto(url(`/versions/${versionId}/guides/use-audio-playback/`));
	await expect(page.locator('main')).toContainText('partial call-shape example');
	await expect(page.locator('main')).toContainText('cancels the in-progress stream fade');

	await page.goto(url(`/versions/${versionId}/tools/audio-test/`));
	await expect(page.locator('main')).toContainText('PENDING USER PLAYTEST');
	await expect(page.locator('main')).toContainText('interactive Client demonstration');
	await expect(page.locator('main')).toContainText('AudioTest.cpp');
	await expect(page.locator('main')).toContainText('Play the protected UI cue');
});

test('latest audio alias resolves permanently and Portuguese remains a same-commit fallback', async ({ page }) => {
	await page.goto(url('/latest/systems/audio/'));
	await expect(page).toHaveURL(new RegExp(`/MLEDocs/versions/${versionId}/systems/audio/$`));
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/versions/${versionId}/systems/audio/$`));

	await page.goto(url(`/pt-br/versions/${versionId}/reference/audio-contracts/`));
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Audio contracts');
	await expect(page.locator('main')).toHaveAttribute('lang', 'en');
	await expect(page.locator('[data-mle-translation-status="fallback"]')).toContainText(`Commit fixado: ${versionId}.`);
	expect(await page.locator('meta[data-pagefind-filter="mleLocale"]').getAttribute('content')).toBe('pt-br');
});

test('audio reference is keyboard reachable and locally scrollable', async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 800 });
	await page.goto(url(`/versions/${versionId}/reference/audio-contracts/`));
	const table = page.getByRole('region', { name: 'Audio command contracts' });
	await expect(table).toBeVisible();
	await table.focus();
	await expect(table).toBeFocused();
	expect(await table.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
	await page.keyboard.press('ArrowRight');
	await expect.poll(() => table.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
});

test('Pagefind discovers Audio Test in the pinned English scope', async ({ page }) => {
	await page.goto(url(`/versions/${versionId}/systems/audio/`));
	await expect(page.locator('#starlight__search .pagefind-ui__search-input')).toHaveCount(1, { timeout: 15_000 });
	await page.keyboard.press('Control+k');
	const dialog = page.getByRole('dialog', { name: 'Search' });
	await dialog.locator('.pagefind-ui__search-input').fill('PENDING USER PLAYTEST');
	const result = dialog.locator('.pagefind-ui__result').filter({ hasText: 'Audio Test' }).first();
	await expect(result).toBeVisible({ timeout: 15_000 });
	await expect(result).toHaveAttribute('data-mle-search-version', versionId);
	await expect(result).toHaveAttribute('data-mle-search-locale', 'en');
});

test('Client, Window, and Server pages expose their pinned lifecycle boundaries', async ({ page }) => {
	await page.goto(url(`/versions/${versionId}/systems/client/`));
	await expect(page.locator('main')).toContainText('16,666,667 ns');
	await expect(page.locator('main')).toContainText('no event hook');
	await expect(page.locator('main')).toContainText('does not call Window::shutdown');

	await page.goto(url(`/versions/${versionId}/systems/window/`));
	await expect(page.locator('main')).toContainText('newest-first');
	await expect(page.locator('main')).toContainText('declared but not dispatched');

	await page.goto(url(`/versions/${versionId}/systems/server/`));
	await expect(page.locator('main')).toContainText('Experimental, non-production boundary');
	await expect(page.locator('main')).toContainText('No sockets');
	await expect(page.locator('main [aria-label="Page context"]')).toContainText('Experimental');
});

test('latest Client alias is permanent and Portuguese Window reference stays on the same commit', async ({ page }) => {
	await page.goto(url('/latest/systems/client/'));
	await expect(page).toHaveURL(new RegExp(`/MLEDocs/versions/${versionId}/systems/client/$`));
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/versions/${versionId}/systems/client/$`));

	await page.goto(url(`/pt-br/versions/${versionId}/reference/window-and-input-contracts/`));
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Window and input contracts');
	await expect(page.locator('main')).toHaveAttribute('lang', 'en');
	await expect(page.locator('[data-mle-translation-status="fallback"]')).toContainText(`Commit fixado: ${versionId}.`);
	expect(await page.locator('meta[data-pagefind-filter="mleVersion"]').getAttribute('content')).toBe(versionId);
	expect(await page.locator('meta[data-pagefind-filter="mleLocale"]').getAttribute('content')).toBe('pt-br');
});

test('Window/input reference is keyboard reachable and Pagefind finds the Interactive Client in active scope', async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 800 });
	await page.goto(url(`/versions/${versionId}/reference/window-and-input-contracts/`));
	const table = page.getByRole('region', { name: 'Window and input contracts' });
	await expect(table).toBeVisible();
	await table.focus();
	await expect(table).toBeFocused();
	expect(await table.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
	await page.keyboard.press('ArrowRight');
	await expect.poll(() => table.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

	await page.goto(url(`/versions/${versionId}/systems/client/`));
	await expect(page.locator('#starlight__search .pagefind-ui__search-input')).toHaveCount(1, { timeout: 15_000 });
	await page.keyboard.press('Control+k');
	const dialog = page.getByRole('dialog', { name: 'Search' });
	await dialog.locator('.pagefind-ui__search-input').fill('Ctrl+M TerminalLayer');
	const result = dialog.locator('.pagefind-ui__result').filter({ hasText: 'Interactive Client' }).first();
	await expect(result).toBeVisible({ timeout: 15_000 });
	await expect(result).toHaveAttribute('data-mle-search-version', versionId);
	await expect(result).toHaveAttribute('data-mle-search-locale', 'en');
});
