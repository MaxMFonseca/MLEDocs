import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const siteOrigin = process.env.MLE_DOCS_E2E_ORIGIN ?? 'http://127.0.0.1:4321';

function pageUrl(path: string): string {
	return new URL(`/MLEDocs${path}`, siteOrigin).toString();
}

const searchCases = [
	{
		locale: 'English',
		path: '/versions/c1abea3de165/systems/renderer/',
		dialogLabel: 'Search',
		resultsContext: 'Results context',
		activeScope: 'Current commit and language',
		allScope: 'All commits and languages',
		activeLocale: 'en',
		versionBadge: 'Commit',
		languageBadge: 'Language',
	},
	{
		locale: 'Brazilian Portuguese',
		path: '/pt-br/versions/c1abea3de165/systems/renderer/',
		dialogLabel: 'Pesquisar',
		resultsContext: 'Contexto dos resultados',
		activeScope: 'Commit e idioma atuais',
		allScope: 'Todos os commits e idiomas',
		activeLocale: 'pt-br',
		versionBadge: 'Commit',
		languageBadge: 'Idioma',
	},
] as const;

async function openSearch(page: Page, dialogLabel: string) {
	const opener = page.locator('header site-search button[data-open-modal]');
	await expect(opener).toBeEnabled();
	await expect(page.locator('#starlight__search .pagefind-ui__search-input')).toHaveCount(1, {
		timeout: 15_000,
	});
	await page.keyboard.press('Control+k');
	const dialog = page.getByRole('dialog', { name: dialogLabel });
	await expect(dialog).toBeVisible();
	await expect(dialog.locator('.pagefind-ui__search-input')).toBeFocused();
	return { dialog, opener };
}

const crossLocaleFixtureQuery = 'ranges remove returned tail';

async function searchForPinnedPhrase(dialog: ReturnType<Page['getByRole']>) {
	const input = dialog.locator('.pagefind-ui__search-input');
	await input.fill(crossLocaleFixtureQuery);
	const results = dialog.locator('.pagefind-ui__result');
	await expect(results.first()).toBeVisible({ timeout: 15_000 });
	return { input, results };
}

test('the production index exposes version and locale filters only on immutable content', async ({
	request,
}) => {
	for (const { path, locale } of [
		{ path: '/versions/c1abea3de165/systems/renderer/', locale: 'en' },
		{ path: '/pt-br/versions/c1abea3de165/systems/', locale: 'pt-br' },
	]) {
		const response = await request.get(pageUrl(path));
		expect(response.ok()).toBe(true);
		const html = await response.text();
		expect(html).toContain(
			'<meta data-pagefind-filter="mleVersion" content="c1abea3de165"',
		);
		expect(html).toContain(`<meta data-pagefind-filter="mleLocale" content="${locale}"`);
	}

	for (const path of [
		'/404/',
		'/latest/systems/renderer/',
		'/pt-br/latest/systems/renderer/',
	]) {
		const response = await request.get(pageUrl(path), { maxRedirects: 0 });
		const html = await response.text();
		expect(html, path).not.toContain('data-pagefind-filter="mleVersion"');
		expect(html, path).not.toContain('data-pagefind-filter="mleLocale"');
	}
});

test('keeps all scope chosen before Pagefind finishes loading', async ({ page }) => {
	let releaseChunk!: () => void;
	const chunkReleased = new Promise<void>((resolve) => {
		releaseChunk = resolve;
	});
	let markChunkRequested!: () => void;
	const chunkRequested = new Promise<void>((resolve) => {
		markChunkRequested = resolve;
	});
	let chunkRequestCount = 0;

	await page.route(/\/ui-core\.[^/]+\.js$/, async (route) => {
		chunkRequestCount += 1;
		markChunkRequested();
		await chunkReleased;
		await route.continue();
	});

	await page.goto(pageUrl('/versions/c1abea3de165/systems/renderer/'), {
		waitUntil: 'domcontentloaded',
	});
	await chunkRequested;

	const opener = page.locator('header site-search button[data-open-modal]');
	await expect(opener).toBeEnabled();
	await page.keyboard.press('Control+k');
	const dialog = page.getByRole('dialog', { name: 'Search' });
	await expect(dialog).toBeVisible();
	await expect(dialog.locator('.pagefind-ui__search-input')).toHaveCount(0);

	const all = dialog.getByRole('radio', { name: 'All commits and languages' });
	await all.focus();
	await page.keyboard.press('Space');
	await expect(all).toBeChecked();

	releaseChunk();
	const pagefindInput = dialog.locator('.pagefind-ui__search-input');
	await expect(pagefindInput).toHaveCount(1, { timeout: 15_000 });
	await expect(pagefindInput).toBeFocused();
	const { input, results } = await searchForPinnedPhrase(dialog);
	await expect(all).toBeChecked();
	expect(await input.inputValue()).toBe(crossLocaleFixtureQuery);
	expect(chunkRequestCount).toBe(1);
	await expect
		.poll(async () =>
			[
				...new Set(
					await results.evaluateAll((items) =>
						items.map((item) => item.getAttribute('data-mle-search-locale')),
					),
				),
			].sort(),
		)
		.toEqual(['en', 'pt-br']);

	await page.keyboard.press('Escape');
	await expect(dialog).not.toBeVisible();
	await expect(opener).toBeFocused();
});

for (const searchCase of searchCases) {
	test(`${searchCase.locale} search defaults to its immutable commit and language`, async ({
		page,
	}) => {
		const offsiteRequests: string[] = [];
		page.on('request', (request) => {
			const url = new URL(request.url());
			if (url.hostname !== '127.0.0.1') offsiteRequests.push(url.toString());
		});

		await page.goto(pageUrl(searchCase.path));
		const { dialog, opener } = await openSearch(page, searchCase.dialogLabel);
		const scopeGroup = dialog.getByRole('group', { name: searchCase.resultsContext });
		const active = scopeGroup.getByRole('radio', { name: searchCase.activeScope });
		await expect(active).toBeChecked();

		const { results } = await searchForPinnedPhrase(dialog);
		await expect(results).not.toHaveCount(0);
		const resultLocales = await results.evaluateAll((items) =>
			items.map((item) => item.getAttribute('data-mle-search-locale')),
		);
		expect(resultLocales).toEqual(resultLocales.map(() => searchCase.activeLocale));

		await page.keyboard.press('Escape');
		await expect(dialog).not.toBeVisible();
		await expect(opener).toBeFocused();
		expect(offsiteRequests).toEqual([]);
	});

	test(`${searchCase.locale} all-scope search preserves the query and labels every result`, async ({
		page,
	}) => {
		await page.goto(pageUrl(searchCase.path));
		const { dialog } = await openSearch(page, searchCase.dialogLabel);
		const { input, results } = await searchForPinnedPhrase(dialog);
		const all = dialog.getByRole('radio', { name: searchCase.allScope });

		await all.focus();
		await page.keyboard.press('Space');
		await expect(all).toBeChecked();
		await expect(all).toBeFocused();
		expect(await input.inputValue()).toBe(crossLocaleFixtureQuery);

		await expect
			.poll(async () => results.count(), { timeout: 15_000 })
			.toBeGreaterThan(1);
		await expect
			.poll(
				async () =>
					results.evaluateAll((items) =>
						items.every((item) =>
							Boolean(item.querySelector('[data-mle-search-result-context]')),
						),
					),
				{ timeout: 15_000 },
			)
			.toBe(true);

		for (const result of await results.all()) {
			await expect(result.locator('[data-mle-search-version]')).toContainText(
				searchCase.versionBadge,
			);
			await expect(result.locator('[data-mle-search-language]')).toContainText(
				searchCase.languageBadge,
			);
			await expect(result).toHaveAttribute('data-mle-search-version', /^[0-9a-f]{12}$/);
			await expect(result).toHaveAttribute('data-mle-search-locale', /^(?:en|pt-br)$/);
		}

		await expect
			.poll(async () =>
				[
					...new Set(
						await results.evaluateAll((items) =>
							items.map((item) => item.getAttribute('data-mle-search-locale')),
						),
					),
				].sort(),
			)
			.toEqual(['en', 'pt-br']);

		const destinationLink = results.first().locator('.pagefind-ui__result-link').first();
		const displayedDestination = await destinationLink.getAttribute('href');
		expect(displayedDestination).toMatch(/\/MLEDocs\/(?:pt-br\/)?versions\/[0-9a-f]{12}\//);
		await destinationLink.click();
		await expect(page).toHaveURL((url) =>
			url.pathname === new URL(displayedDestination!, siteOrigin).pathname,
		);
	});
}

test('the scoped search dialog is axe-clean in both themes and reflows at 360 pixels', async ({
	page,
}) => {
	await page.setViewportSize({ width: 360, height: 800 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(pageUrl('/pt-br/versions/c1abea3de165/systems/renderer/'));

	const themePicker = page.locator('header starlight-theme-select select');
	for (const theme of ['dark', 'light']) {
		await themePicker.selectOption(theme, { force: true });
		await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
		const { dialog } = await openSearch(page, 'Pesquisar');
		await searchForPinnedPhrase(dialog);

		const all = dialog.getByRole('radio', { name: 'Todos os commits e idiomas' });
		const active = dialog.getByRole('radio', { name: 'Commit e idioma atuais' });
		await active.focus();
		await page.keyboard.press('ArrowRight');
		await expect(all).toBeChecked();
		await expect(all).toBeFocused();

		const layout = await dialog.evaluate((element) => ({
			overflow: element.scrollWidth - element.clientWidth,
			right: element.getBoundingClientRect().right,
			viewportWidth: document.documentElement.clientWidth,
			transitionDuration: getComputedStyle(element).transitionDuration,
			animationDuration: getComputedStyle(element).animationDuration,
		}));
		expect(layout.overflow).toBeLessThanOrEqual(1);
		expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth);
		expect(layout.transitionDuration).toBe('0s');
		expect(layout.animationDuration).toBe('0s');
		expect((await new AxeBuilder({ page }).include('dialog').analyze()).violations).toEqual([]);

		await page.keyboard.press('Escape');
		await expect(dialog).not.toBeVisible();
	}
});

test('Pagefind returns the pinned UI key reference in active and all scopes', async ({ page }) => {
	await page.goto(pageUrl('/versions/c1abea3de165/reference/ui-element-keys/'));
	const { dialog } = await openSearch(page, 'Search');
	const input = dialog.locator('.pagefind-ui__search-input');
	await input.fill('text_input_disable');
	const result = dialog.locator('.pagefind-ui__result').filter({ hasText: 'UI element keys' }).first();
	await expect(result).toBeVisible({ timeout: 15_000 });
	await expect(result).toHaveAttribute('data-mle-search-version', 'c1abea3de165');
	await expect(result).toHaveAttribute('data-mle-search-locale', 'en');
	const all = dialog.getByRole('radio', { name: 'All commits and languages' });
	await all.check();
	await expect(all).toBeChecked();
	expect(await input.inputValue()).toBe('text_input_disable');
	await expect.poll(async () => dialog.locator('.pagefind-ui__result').count()).toBeGreaterThan(1);
});
