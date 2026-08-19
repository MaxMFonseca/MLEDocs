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
