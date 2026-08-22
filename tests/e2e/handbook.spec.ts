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
