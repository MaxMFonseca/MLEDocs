import { expect, test, type Page } from '@playwright/test';

const versionId = 'c1abea3de165';

async function settlePage(page: Page): Promise<void> {
	await page.waitForLoadState('networkidle');
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all(
			[...document.images].map(async (image) => {
				if (!image.complete) {
					await new Promise<void>((resolve) => {
						image.addEventListener('load', () => resolve(), { once: true });
						image.addEventListener('error', () => resolve(), { once: true });
					});
				}
				await image.decode().catch(() => undefined);
			}),
		);
	});
}

async function setTheme(page: Page, theme: 'dark' | 'light'): Promise<void> {
	await page.addInitScript((selectedTheme) => {
		localStorage.setItem('starlight-theme', selectedTheme);
	}, theme);
}

async function openSettledSearch(page: Page, dialogLabel: string) {
	await expect(page.locator('#starlight__search .pagefind-ui__search-input')).toHaveCount(1, {
		timeout: 15_000,
	});
	await page.keyboard.press('Control+k');
	const dialog = page.getByRole('dialog', { name: dialogLabel });
	await expect(dialog).toBeVisible();
	await expect(dialog.locator('.pagefind-ui__search-input')).toBeFocused();
	return dialog;
}

async function searchAndSettle(dialog: ReturnType<Page['getByRole']>, query: string): Promise<void> {
	await dialog.locator('.pagefind-ui__search-input').fill(query);
	const results = dialog.locator('.pagefind-ui__result');
	await expect(results.first()).toBeVisible({ timeout: 15_000 });
	await expect
		.poll(async () =>
			results.evaluateAll((items) =>
				items.every((item) => item.hasAttribute('data-mle-search-version')),
			),
			{ timeout: 15_000 },
		)
		.toBe(true);
}

test('documentation landing desktop dark', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await setTheme(page, 'dark');
	await page.goto('');
	await expect(page.locator('[data-mle-landing]')).toBeVisible();
	await settlePage(page);

	await expect(page).toHaveScreenshot('landing-desktop-dark.png', {
		animations: 'disabled',
		caret: 'hide',
		fullPage: true,
	});
});

test('documentation landing phone light', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await setTheme(page, 'light');
	await page.goto('');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	await settlePage(page);

	await expect(page).toHaveScreenshot('landing-phone-light.png', {
		animations: 'disabled',
		caret: 'hide',
		fullPage: true,
	});
});

test('homepage desktop dark editorial layout', async ({ page }) => {
	await page.goto(`versions/${versionId}/`);
	await page.locator('header starlight-theme-select select').selectOption('dark');
	await settlePage(page);

	await expect(page).toHaveScreenshot('homepage-desktop-dark.png', {
		animations: 'disabled',
		caret: 'hide',
		fullPage: true,
	});
});

test('homepage mobile light editorial layout', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.addInitScript(() => localStorage.setItem('starlight-theme', 'light'));
	await page.goto(`versions/${versionId}/`);
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	await settlePage(page);

	await expect(page).toHaveScreenshot('homepage-mobile-light.png', {
		animations: 'disabled',
		caret: 'hide',
		fullPage: true,
	});
});

test('renderer article desktop layout', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(`versions/${versionId}/systems/renderer/`);
	await settlePage(page);

	await expect(page).toHaveScreenshot('renderer-article-desktop.png', {
		animations: 'disabled',
		caret: 'hide',
		fullPage: true,
	});
});

test('renderer article wide layout keeps a slim page outline', async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 900 });
	await page.goto(`versions/${versionId}/systems/renderer/`);
	await settlePage(page);
	await expect(page.locator('[data-mle-wide-toc]')).toBeVisible();

	await expect(page).toHaveScreenshot('renderer-article-wide-outline.png', {
		animations: 'disabled',
		caret: 'hide',
		fullPage: true,
	});
});

test('focused version picker context', async ({ page }) => {
	await page.goto(`versions/${versionId}/systems/renderer/`);
	await settlePage(page);

	const picker = page.locator('[data-mle-version-picker]');
	await picker.focus();
	await expect(page.locator('[data-mle-version-context]')).toHaveScreenshot(
		'version-picker-context.png',
		{
			animations: 'disabled',
			caret: 'hide',
		},
	);
});

test('maturity and commit page context', async ({ page }) => {
	await page.goto(`versions/${versionId}/systems/renderer/`);
	await settlePage(page);

	await expect(page.locator('main [aria-label="Page context"]')).toHaveScreenshot(
		'maturity-page-context.png',
		{
			animations: 'disabled',
			caret: 'hide',
		},
	);
});

test('Portuguese same-commit fallback context', async ({ page }) => {
	await page.goto(`pt-br/versions/${versionId}/systems/renderer/`);
	await settlePage(page);

	const titlePanel = page.locator('main .content-panel').first();
	await expect(titlePanel).toContainText('Commit fixado: c1abea3de165');
	await expect(titlePanel).toHaveScreenshot('pt-br-fallback-context.png', {
		animations: 'disabled',
		caret: 'hide',
	});
});

test('English section hub desktop Dark', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await setTheme(page, 'dark');
	await page.goto(`versions/${versionId}/systems/`);
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await settlePage(page);

	await expect(page).toHaveScreenshot('section-hub-desktop-dark.png', {
		animations: 'disabled',
		caret: 'hide',
		fullPage: true,
	});
});

test('Portuguese section hub phone Light', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await setTheme(page, 'light');
	await page.goto(`pt-br/versions/${versionId}/tools/`);
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	await settlePage(page);

	await expect(page).toHaveScreenshot('pt-br-section-hub-phone-light.png', {
		animations: 'disabled',
		caret: 'hide',
		fullPage: true,
	});
});

test('scoped search desktop Dark', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await setTheme(page, 'dark');
	await page.goto(`versions/${versionId}/systems/renderer/`);
	const dialog = await openSettledSearch(page, 'Search');
	await searchAndSettle(dialog, 'renderer');
	await expect(dialog.getByRole('radio', { name: 'Current commit and language' })).toBeChecked();
	await settlePage(page);

	await expect(dialog).toHaveScreenshot('scoped-search-desktop-dark.png', {
		animations: 'disabled',
		caret: 'hide',
	});
});

test('all-scope search phone Light', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await setTheme(page, 'light');
	await page.goto(`pt-br/versions/${versionId}/systems/renderer/`);
	const dialog = await openSettledSearch(page, 'Pesquisar');
	await searchAndSettle(dialog, 'renderer');
	const allScope = dialog.getByRole('radio', { name: 'Todos os commits e idiomas' });
	await allScope.check();
	await expect(allScope).toBeChecked();
	await expect
		.poll(async () =>
			[
				...new Set(
					await dialog.locator('.pagefind-ui__result').evaluateAll((items) =>
						items.map((item) => item.getAttribute('data-mle-search-locale')),
					),
				),
			].sort(),
		)
		.toEqual(['en', 'pt-br']);
	await expect
		.poll(
			async () =>
				dialog.locator('.pagefind-ui__result').evaluateAll((items) =>
					items.every((item) =>
						Boolean(item.querySelector('[data-mle-search-result-context]')),
					),
				),
			{ timeout: 15_000 },
		)
		.toBe(true);
	await settlePage(page);

	await expect(dialog).toHaveScreenshot('all-scope-search-phone-light.png', {
		animations: 'disabled',
		caret: 'hide',
	});
});

test('breadcrumb on exact English page', async ({ page }) => {
	await page.goto(`versions/${versionId}/systems/renderer/`);
	await settlePage(page);
	const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
	await expect(breadcrumb.locator('[data-mle-breadcrumb-label]')).toHaveText([
		'English',
		versionId,
		'Engine Systems',
		'Renderer overview',
	]);

	await expect(breadcrumb).toHaveScreenshot('breadcrumb-exact-en.png', {
		animations: 'disabled',
		caret: 'hide',
	});
});

test('breadcrumb on Portuguese same-commit fallback', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await setTheme(page, 'light');
	await page.goto(`pt-br/versions/${versionId}/systems/renderer/`);
	await settlePage(page);
	const breadcrumb = page.getByRole('navigation', { name: 'Caminho de navegação' });
	await expect(breadcrumb.locator('[data-mle-breadcrumb-label]')).toHaveText([
		'Português (Brasil)',
		versionId,
		'Sistemas do motor',
		'Renderer overview',
	]);

	await expect(breadcrumb).toHaveScreenshot('breadcrumb-pt-br-fallback.png', {
		animations: 'disabled',
		caret: 'hide',
	});
});
