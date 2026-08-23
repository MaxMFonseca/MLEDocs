import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { handbookPages } from '../../src/data/handbook';

const siteOrigin = process.env.MLE_DOCS_E2E_ORIGIN ?? 'http://127.0.0.1:4321';
const versionId = 'c1abea3de165';

function pageUrl(path: string): string {
  return new URL(`/MLEDocs${path}`, siteOrigin).toString();
}

async function expectLoadedFontsAndNoOverflow(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    loadedFamilies: [...document.fonts]
      .filter((font) => font.status === 'loaded')
      .map((font) => font.family.replace(/^(['"])(.*)\1$/, '$2')),
  }));

  expect(layout.overflow).toBeLessThanOrEqual(1);
  expect(layout.loadedFamilies).toEqual(
    expect.arrayContaining(['Sora', 'Source Sans 3', 'IBM Plex Mono']),
  );
}

async function expectTwoPartFocus(
  control: Locator,
  focusControl = true,
  indicator = control,
): Promise<void> {
  if (focusControl) await control.focus();
  await expect(control).toBeFocused();
  const focus = await indicator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      boxShadow: style.boxShadow,
    };
  });
  expect(focus.outlineStyle).not.toBe('none');
  expect(focus.outlineWidth).toBeGreaterThanOrEqual(2);
  expect(focus.boxShadow).not.toBe('none');
}

for (const landingCase of [
  { name: 'desktop dark', width: 1440, height: 900, theme: 'dark' },
  { name: 'phone light', width: 390, height: 844, theme: 'light' },
] as const) {
  test(`landing page is accessible with local fonts and no overflow on ${landingCase.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: landingCase.width, height: landingCase.height });
    await page.addInitScript((theme) => localStorage.setItem('starlight-theme', theme), landingCase.theme);
    await page.goto(pageUrl('/'));

    await expect(page.locator('html')).toHaveAttribute('data-theme', landingCase.theme);
    await expectLoadedFontsAndNoOverflow(page);
    await expectTwoPartFocus(page.getByRole('link', { name: 'Read in English' }));
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}

test('landing version picker is keyboard-focusable with a two-part focus indicator', async ({ page }) => {
  await page.goto(pageUrl('/'));

  const picker = page.locator('[data-mle-landing-version-picker]');
  await expect(picker).toHaveAccessibleName('Documentation version');
  await page.locator('body').click({ position: { x: 2, y: 2 } });
  for (let step = 0; step < 8; step += 1) {
    await page.keyboard.press('Tab');
    if (await picker.evaluate((element) => element === document.activeElement)) break;
  }
  await expect(picker).toBeFocused();
  const focus = await picker.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      wrapperShadow: getComputedStyle(element.closest('.landing-version-picker')!).boxShadow,
    };
  });
  expect(focus.outlineStyle).not.toBe('none');
  expect(focus.outlineWidth).toBeGreaterThanOrEqual(2);
  expect(focus.wrapperShadow).not.toBe('none');
});

test('applies the MLE palette instead of the Starlight defaults', async ({ page }) => {
  await page.goto(pageUrl('/versions/c1abea3de165/'));
  await page.locator('header starlight-theme-select select').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const theme = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const body = getComputedStyle(document.body);

    return {
      background: root.getPropertyValue('--mle-bg').trim(),
      accent: root.getPropertyValue('--mle-accent').trim(),
      bodyBackground: body.backgroundColor,
      colorScheme: root.colorScheme,
    };
  });

  expect(theme.background).toBe('#070608');
  expect(theme.accent).toBe('#c43f88');
  expect(theme.bodyBackground).toBe('rgb(7, 6, 8)');
  expect(theme.bodyBackground).not.toBe('rgb(9, 9, 11)');
  expect(theme.colorScheme).toBe('dark');
});

test('primary homepage action meets text contrast in dark and light themes', async ({ page }) => {
  await page.goto(pageUrl('/versions/c1abea3de165/'));
  const themePicker = page.locator('header starlight-theme-select select');
  const primaryAction = page.locator('.primary-action');

  for (const theme of ['dark', 'light']) {
    await themePicker.selectOption(theme);
    const contrast = await primaryAction.evaluate((element) => {
      const parseRgb = (value: string): readonly number[] =>
        value.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
      const luminance = (rgb: readonly number[]): number => {
        const [red = 0, green = 0, blue = 0] = rgb.map((channel) => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      };
      const style = getComputedStyle(element);
      const foreground = luminance(parseRgb(style.color));
      const background = luminance(parseRgb(style.backgroundColor));
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    });

    expect(contrast).toBeGreaterThanOrEqual(4.5);
  }
});

test('applies and persists an accessible MLE light theme', async ({ page }) => {
  await page.goto(pageUrl('/versions/c1abea3de165/'));
  await page.locator('header starlight-theme-select select').selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  const selected = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return {
      accent: root.getPropertyValue('--mle-accent').trim(),
      background: root.getPropertyValue('--mle-bg').trim(),
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      colorScheme: root.colorScheme,
      storedTheme: localStorage.getItem('starlight-theme'),
    };
  });

  expect(selected.background).toBe('#f8f4f7');
  expect(selected.accent).toBe('#9d2f69');
  expect(selected.bodyBackground).toBe('rgb(248, 244, 247)');
  expect(selected.colorScheme).toBe('light');
  expect(selected.storedTheme).toBe('light');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect
    .poll(() =>
      page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--mle-bg').trim()),
    )
    .toBe('#f8f4f7');
});

test('auto theme follows live operating-system color preference', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(pageUrl('/versions/c1abea3de165/'));

  const picker = page.locator('header starlight-theme-select select');
  await picker.selectOption('dark');
  await picker.selectOption('auto');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => localStorage.getItem('starlight-theme'))).toBe('');
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--mle-bg').trim(),
    ),
  ).toBe('#f8f4f7');

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect
    .poll(() =>
      page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--mle-bg').trim()),
    )
    .toBe('#070608');
});

test('shows a two-part focus indicator at least two pixels wide', async ({ page }) => {
  await page.goto(pageUrl('/versions/c1abea3de165/'));
  await page.keyboard.press('Tab');

  const focus = await page.locator(':focus').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      boxShadow: style.boxShadow,
    };
  });

  expect(focus.outlineStyle).not.toBe('none');
  expect(focus.outlineWidth).toBeGreaterThanOrEqual(2);
  expect(focus.boxShadow).not.toBe('none');
});

test('removes non-essential motion when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(pageUrl('/versions/c1abea3de165/'));

  const motion = await page.locator('a').first().evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      animationDuration: style.animationDuration,
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
      transitionDuration: style.transitionDuration,
    };
  });

  expect(motion.animationDuration).toBe('0s');
  expect(motion.scrollBehavior).toBe('auto');
  expect(motion.transitionDuration).toBe('0s');
});

test('keeps language names intact while reserving room for Portuguese', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(pageUrl('/versions/c1abea3de165/systems/renderer/'));

  const languageSelect = await page
    .locator('header starlight-lang-select select')
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        overflowWrap: style.overflowWrap,
        widthInEms: element.clientWidth / Number.parseFloat(style.fontSize),
      };
    });

  expect(languageSelect.overflowWrap).toBe('normal');
  expect(languageSelect.widthInEms).toBeGreaterThanOrEqual(10);
});

for (const { locale, path } of [
  { locale: 'English', path: '/versions/c1abea3de165/' },
  { locale: 'Brazilian Portuguese', path: '/pt-br/versions/c1abea3de165/' },
]) {
  test(`${locale} page loads local fonts and reflows without unintended overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(pageUrl(path));
    await page.evaluate(() => document.fonts.ready);

    const result = await page.evaluate(() => ({
      headingFont: getComputedStyle(document.querySelector('h1')!).fontFamily,
      proseFont: getComputedStyle(document.body).fontFamily,
      codeFont: getComputedStyle(document.querySelector('code')!).fontFamily,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      loadedFonts: [...document.fonts].map((font) => ({
        family: font.family.replace(/^(['"])(.*)\1$/, '$2'),
        status: font.status,
      })),
    }));

    expect(result.headingFont).toContain('Sora');
    expect(result.proseFont).toContain('Source Sans 3');
    expect(result.codeFont).toContain('IBM Plex Mono');
    expect(result.overflow).toBeLessThanOrEqual(1);
    expect(result.loadedFonts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ family: 'Sora', status: 'loaded' }),
        expect.objectContaining({ family: 'Source Sans 3', status: 'loaded' }),
        expect.objectContaining({ family: 'IBM Plex Mono', status: 'loaded' }),
      ]),
    );

    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
  });
}

for (const { name, path, width } of [
  {
    name: 'desktop page context',
    path: '/versions/c1abea3de165/systems/renderer/',
    width: 1440,
  },
  {
    name: 'phone Portuguese fallback context',
    path: '/pt-br/versions/c1abea3de165/systems/renderer/',
    width: 390,
  },
]) {
  test(`${name} keeps the version control keyboard-reachable and axe-clean`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
    await page.goto(pageUrl(path));

    const picker = page.locator('[data-mle-version-picker]');
    await page.locator('body').click({ position: { x: 2, y: 2 } });
    let reachedPicker = false;
    for (let step = 0; step < 12; step += 1) {
      await page.keyboard.press('Tab');
      if (await picker.evaluate((element) => element === document.activeElement)) {
        reachedPicker = true;
        break;
      }
    }
    expect(reachedPicker).toBe(true);
    await expect(picker).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    const focus = await picker.evaluate((element) => {
      const style = getComputedStyle(element);
      const wrapperStyle = getComputedStyle(element.closest('.picker-label')!);
      return {
        focusVisible: element.matches(':focus-visible'),
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
        outerBoxShadow: wrapperStyle.boxShadow,
      };
    });
    expect(focus.focusVisible).toBe(true);
    expect(focus.outlineStyle).not.toBe('none');
    expect(focus.outlineWidth).toBeGreaterThanOrEqual(2);
    expect(focus.outerBoxShadow).not.toBe('none');

    const result = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      maturityText: document.querySelector('[data-mle-maturity]')?.textContent?.trim(),
      maturityCue: Boolean(document.querySelector('[data-mle-maturity-cue]')),
    }));
    expect(result.overflow).toBeLessThanOrEqual(1);
    expect(result.maturityText).toMatch(/In development|Em desenvolvimento/);
    expect(result.maturityCue).toBe(true);

    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
  });
}

test('version context remains readable in Light, Dark, and Auto themes', async ({ page }) => {
  await page.goto(pageUrl('/versions/c1abea3de165/systems/renderer/'));

  const themePicker = page.locator('header starlight-theme-select select');
  const versionPicker = page.locator('[data-mle-version-picker]');
  for (const theme of ['light', 'dark', 'auto']) {
    await themePicker.selectOption(theme);
    await expect(versionPicker).toBeVisible();
    await expect(page.locator('[data-mle-permanent-link]')).toHaveText('c1abea3de165');
    await versionPicker.focus();
    const focus = await versionPicker.evaluate((element) => ({
      focusVisible: element.matches(':focus-visible'),
      outlineWidth: Number.parseFloat(getComputedStyle(element).outlineWidth),
      outerBoxShadow: getComputedStyle(element.closest('.picker-label')!).boxShadow,
    }));
    expect(focus.focusVisible).toBe(true);
    expect(focus.outlineWidth).toBeGreaterThanOrEqual(2);
    expect(focus.outerBoxShadow).not.toBe('none');
  }
});

test('phone version context visibly exposes the complete selected version metadata', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pageUrl('/pt-br/versions/c1abea3de165/systems/renderer/'));

  const summary = page.locator('[data-mle-selected-version-summary]');
  await expect(summary).toBeVisible();
  await expect(summary).toHaveText('c1abea3de165 · 2026-08-18 · atual');

  const geometry = await summary.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    right: element.getBoundingClientRect().right,
    viewportWidth: document.documentElement.clientWidth,
    whiteSpace: getComputedStyle(element).whiteSpace,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.whiteSpace).not.toBe('nowrap');
});

test('mobile 404 keeps the compact header when no version picker is rendered', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pageUrl('/not-found-without-version-context/'));

  await expect(page.locator('[data-mle-version-picker]')).toHaveCount(0);
  const headerHeight = await page
    .locator('header.header')
    .evaluate((header) => header.getBoundingClientRect().height);
  expect(headerHeight).toBeLessThanOrEqual(80);
});

test('mobile version page reserves its expanded header for the readable picker', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pageUrl('/pt-br/versions/c1abea3de165/systems/renderer/'));

  const picker = page.locator('[data-mle-version-picker]');
  const summary = page.locator('[data-mle-selected-version-summary]');
  await expect(picker).toBeVisible();
  await expect(summary).toBeVisible();

  const layout = await page.locator('header.header').evaluate((header) => {
    const summary = document.querySelector('[data-mle-selected-version-summary]');
    if (!(summary instanceof HTMLElement)) throw new Error('Selected-version summary is missing.');
    return {
      headerHeight: header.getBoundingClientRect().height,
      headerBottom: header.getBoundingClientRect().bottom,
      summaryBottom: summary.getBoundingClientRect().bottom,
    };
  });
  expect(layout.headerHeight).toBeGreaterThanOrEqual(120);
  expect(layout.summaryBottom).toBeLessThanOrEqual(layout.headerBottom);
});

test('skip link is first in the visible focus order and targets the page heading', async (
  { page },
  testInfo,
) => {
  await page.goto(pageUrl('/versions/c1abea3de165/systems/renderer/'));

  const skipLink = page.getByRole('link', { name: 'Skip to content' });
  const focusOrder = [
    skipLink,
    page.locator('header .site-title'),
    page.locator('header site-search button[data-open-modal]'),
    page.locator('header .social-icons a'),
    page.locator('header starlight-theme-select select'),
    page.locator('header starlight-lang-select select'),
    page.locator('[data-mle-version-picker]'),
    page.locator('[data-mle-permanent-link]'),
  ];

  if (testInfo.project.name === 'webkit') {
    // WebKit follows Safari's default Full Keyboard Access setting and skips links during Tab
    // navigation. The skip link must still be explicitly focusable and keyboard-activatable.
    await page.keyboard.press('Tab');
    await expect(page.locator('header site-search button[data-open-modal]')).toBeFocused();
  } else {
    for (const control of focusOrder) {
      await page.keyboard.press('Tab');
      await expect(control).toBeFocused();
      const outlineWidth = await control.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).outlineWidth),
      );
      expect(outlineWidth).toBeGreaterThanOrEqual(2);
    }
  }

  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#_top$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Renderer' })).toBeInViewport();
});

test('desktop and mobile controls have accessible names and valid relationships', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pageUrl('/pt-br/versions/c1abea3de165/systems/renderer/'));

  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('combobox', { name: 'Selecionar tema' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Selecionar língua' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Versão da documentação' })).toBeVisible();

  const menu = page.getByRole('button', { name: 'Menu' });
  const controlledId = await menu.getAttribute('aria-controls');
  expect(controlledId).toBe('starlight__sidebar');
  await expect(page.locator(`#${controlledId}`)).toHaveCount(1);
});

test('fallback and maturity statuses remain explicit without their color or decorative cues', async ({
  page,
}) => {
  await page.goto(pageUrl('/pt-br/versions/c1abea3de165/systems/renderer/'));

  const maturity = page.locator('[data-mle-maturity="in-development"]');
  await expect(maturity).toContainText('Em desenvolvimento');
  await expect(maturity).toHaveAttribute('data-mle-maturity-status', 'in-development');

  const fallback = page.locator('[data-mle-translation-status="fallback"]');
  await expect(fallback).toContainText('Esta página está disponível em inglês');
  await expect(fallback).toContainText('Commit fixado: c1abea3de165');
});

test('renderer source evidence uses pinned links and keyboard disclosure without overflow', async ({
	page,
}) => {
	await page.setViewportSize({ width: 360, height: 800 });
	await page.goto(pageUrl('/versions/c1abea3de165/systems/renderer/'));

	const evidence = page.locator('[data-mle-source-evidence]');
	await expect(evidence).toBeVisible();

	const summary = evidence.locator('summary');
	await summary.focus();
	await expect(summary).toBeFocused();
	await page.keyboard.press('Space');
	await expect(evidence).toHaveAttribute('open', '');
	await expect(
		evidence.getByRole('link', { name: 'src/mle/renderer/Renderer.h', exact: true }),
	).toHaveAttribute(
		'href',
		'https://github.com/MaxMFonseca/MLE/blob/c1abea3de165032fe064300340807b7a6af388f8/src/mle/renderer/Renderer.h',
	);
	await expect(
		evidence.getByRole('link', { name: 'tests/Core/src/renderer/T.FrameRenderer.cpp', exact: true }),
	).toHaveAttribute(
		'href',
		'https://github.com/MaxMFonseca/MLE/blob/c1abea3de165032fe064300340807b7a6af388f8/tests/Core/src/renderer/T.FrameRenderer.cpp',
	);

	const layout = await evidence.evaluate((element) => ({
		overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
		pathOverflow: [...element.querySelectorAll('a')].some(
			(link) => link.scrollWidth > link.clientWidth,
		),
		pathWrapping: [...element.querySelectorAll('a')].every(
			(link) => getComputedStyle(link).overflowWrap !== 'normal',
		),
	}));
	expect(layout.overflow).toBeLessThanOrEqual(1);
	expect(layout.pathOverflow).toBe(false);
	expect(layout.pathWrapping).toBe(true);

	const accessibility = await new AxeBuilder({ page })
		.include('[data-mle-source-evidence]')
		.analyze();
	expect(accessibility.violations).toEqual([]);
});

test('renderer source evidence reflows in both themes at phone and desktop widths', async ({
	page,
}) => {
	for (const { prefix, summaryLabel } of [
		{ prefix: '', summaryLabel: 'Source evidence' },
		{ prefix: '/pt-br', summaryLabel: 'Evidências no código-fonte' },
	]) {
		for (const { width, theme } of [
			{ width: 360, theme: 'dark' },
			{ width: 360, theme: 'light' },
			{ width: 1280, theme: 'dark' },
			{ width: 1280, theme: 'light' },
		]) {
			await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
			await page.goto(pageUrl(`${prefix}/versions/c1abea3de165/systems/renderer/`));
			await page.locator('header starlight-theme-select select').selectOption(theme, { force: true });

			const evidence = page.locator('[data-mle-source-evidence]');
			await expect(evidence.locator('summary')).toHaveText(summaryLabel);
			await evidence.locator('summary').click();
			const layout = await evidence.evaluate((element) => ({
				evidenceRight: element.getBoundingClientRect().right,
				overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
				pathOverflow: [...element.querySelectorAll('a')].some(
					(link) => link.scrollWidth > link.clientWidth,
				),
				viewportWidth: document.documentElement.clientWidth,
			}));

			expect(layout.overflow).toBeLessThanOrEqual(1);
			expect(layout.evidenceRight).toBeLessThanOrEqual(layout.viewportWidth);
			expect(layout.pathOverflow).toBe(false);
		}
	}
});

test('styles dynamically listed unknown-version links with the MLE accent', async ({ page }) => {
  await page.goto(pageUrl('/pt-br/versions/ffffffffffff/guia/'));

  const themePicker = page.locator('header starlight-theme-select select');
  const availableVersion = page
    .locator('[data-mle-available-list]')
    .getByRole('link', { name: /c1abea3de165/ });

  for (const { theme, expectedColor } of [
    { theme: 'dark', expectedColor: 'rgb(237, 101, 173)' },
    { theme: 'light', expectedColor: 'rgb(168, 47, 112)' },
  ]) {
    await themePicker.selectOption(theme);
    await expect(availableVersion).toHaveCSS('color', expectedColor);
  }
});

test('360px renderer reflow keeps controls and technical content inside the viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(pageUrl('/pt-br/versions/c1abea3de165/systems/renderer/'));

  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    pickerRight: document
      .querySelector('[data-mle-version-picker]')!
      .getBoundingClientRect().right,
    noticeRight: document
      .querySelector('[data-mle-translation-status="fallback"]')!
      .getBoundingClientRect().right,
    viewportWidth: document.documentElement.clientWidth,
  }));

  expect(layout.overflow).toBeLessThanOrEqual(1);
  expect(layout.pickerRight).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.noticeRight).toBeLessThanOrEqual(layout.viewportWidth);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('version-aware breadcrumbs remain semantic and axe-clean on exact and fallback routes', async ({ page }) => {
  for (const { path, name } of [
    { path: '/versions/c1abea3de165/systems/renderer/', name: 'Breadcrumb' },
    { path: '/pt-br/versions/c1abea3de165/systems/renderer/', name: 'Caminho de navegação' },
  ]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(pageUrl(path));
    const breadcrumb = page.getByRole('navigation', { name });
    await expect(breadcrumb.locator('ol')).toBeVisible();
    await expect(breadcrumb.locator('[aria-hidden="true"]')).not.toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});

const responsiveWidths = [360, 390, 768, 1280, 1600] as const;
const responsiveLocales = [
  {
    name: 'English',
    prefix: '',
    sectionLabel: 'Engine Systems',
    breadcrumbLabel: 'Breadcrumb',
    searchLabel: 'Search',
    scopeLabel: 'Results context',
    activeScopeLabel: 'Current commit and language',
    themeLabel: 'Select theme',
    languageLabel: 'Select language',
    versionLabel: 'Documentation version',
    plannedLabel: 'Page planned',
  },
  {
    name: 'Brazilian Portuguese',
    prefix: '/pt-br',
    sectionLabel: 'Sistemas do motor',
    breadcrumbLabel: 'Caminho de navegação',
    searchLabel: 'Pesquisar',
    scopeLabel: 'Contexto dos resultados',
    activeScopeLabel: 'Commit e idioma atuais',
    themeLabel: 'Selecionar tema',
    languageLabel: 'Selecionar língua',
    versionLabel: 'Versão da documentação',
    plannedLabel: 'Página planejada',
  },
] as const;

for (const width of responsiveWidths) {
  for (const theme of ['dark', 'light'] as const) {
    for (const locale of responsiveLocales) {
      test(`${locale.name} ${theme} navigation matrix is accessible at ${width}px`, async ({
        page,
      }) => {
        const height = width <= 390 ? 844 : width === 768 ? 900 : 1000;
        await page.setViewportSize({ width, height });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });

        await page.goto(pageUrl(`${locale.prefix}/versions/${versionId}/`));
        const themePicker = page.locator('header starlight-theme-select select');
        await themePicker.selectOption(theme, { force: true });
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('[data-mle-homepage]')).toBeVisible();
        await expectLoadedFontsAndNoOverflow(page);

        const searchOpener = page.locator('header site-search button[data-open-modal]');
        await expect(searchOpener).toHaveAccessibleName(locale.searchLabel);
        await expect(page.locator('[data-mle-version-picker]')).toHaveAccessibleName(
          locale.versionLabel,
        );
        await expectTwoPartFocus(
          page
            .locator('[data-mle-section-directory]')
            .getByRole('link', { name: locale.sectionLabel, exact: true }),
        );
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

        await page.goto(
          pageUrl(`${locale.prefix}/versions/${versionId}/systems/`),
        );
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expectLoadedFontsAndNoOverflow(page);

        const breadcrumb = page.getByRole('navigation', { name: locale.breadcrumbLabel });
        await expect(breadcrumb.locator('ol')).toBeVisible();
        await expect(
          breadcrumb.getByText(locale.sectionLabel, { exact: true }),
        ).toHaveAttribute('aria-current', 'page');

        const expectedPlannedPages = handbookPages.filter(
          ({ publication, sectionId }) =>
            publication === 'planned' && sectionId === 'systems',
        );
        const plannedStatuses = page.locator(
          '[data-mle-navigation-availability="planned"]',
        );
        await expect(plannedStatuses).toHaveCount(expectedPlannedPages.length);
        for (const plannedPage of expectedPlannedPages) {
          const plannedStatus = plannedStatuses.filter({ hasText: plannedPage.title });
          await expect(plannedStatus).toHaveCount(1);
          await expect(plannedStatus).toContainText(locale.plannedLabel);
          await expect(plannedStatus.locator('a')).toHaveCount(0);
        }

        const visibleThemePicker = page.getByRole('combobox', {
          name: locale.themeLabel,
        });
        const visibleLanguagePicker = page.getByRole('combobox', {
          name: locale.languageLabel,
        });
        const menu = page.getByRole('button', { name: 'Menu' });
        if (await menu.isVisible()) {
          const relationship = await menu.getAttribute('aria-controls');
          expect(relationship).toBe('starlight__sidebar');
          await expect(page.locator(`#${relationship}`)).toHaveCount(1);
          await menu.click();
          await expect(menu.locator('xpath=..')).toHaveAttribute('aria-expanded', 'true');
          await expect(page.locator('#starlight__sidebar')).toBeVisible();
          await expect(visibleThemePicker).toBeVisible();
          await expect(visibleLanguagePicker).toBeVisible();
          await expect(visibleThemePicker).toHaveAccessibleName(locale.themeLabel);
          await expect(visibleLanguagePicker).toHaveAccessibleName(locale.languageLabel);
          await menu.click();
          await expect(menu.locator('xpath=..')).toHaveAttribute('aria-expanded', 'false');
        } else {
          await expect(page.locator('#starlight__sidebar')).toBeVisible();
          await expect(visibleThemePicker).toBeVisible();
          await expect(visibleLanguagePicker).toBeVisible();
          await expect(visibleThemePicker).toHaveAccessibleName(locale.themeLabel);
          await expect(visibleLanguagePicker).toHaveAccessibleName(locale.languageLabel);
        }

        await expect(page.locator('#starlight__search .pagefind-ui__search-input')).toHaveCount(1, {
          timeout: 15_000,
        });
        await page.keyboard.press('Control+k');
        const dialog = page.getByRole('dialog', { name: locale.searchLabel });
        await expect(dialog).toBeVisible();
        const scope = dialog.getByRole('group', { name: locale.scopeLabel });
        await expect(scope).toBeVisible();
        const activeScope = scope.getByRole('radio', { name: locale.activeScopeLabel });
        await expect(activeScope).toBeChecked();
        const searchInput = dialog.locator('.pagefind-ui__search-input');
        await expect(searchInput).toHaveAccessibleName(/\S/);
        await expect(searchInput).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expectTwoPartFocus(
          activeScope,
          false,
          activeScope.locator('xpath=ancestor::label'),
        );
        await page.keyboard.press('Tab');
        await expectTwoPartFocus(searchInput, false);

        const motion = await searchInput.evaluate((element) => ({
          animationDuration: getComputedStyle(element).animationDuration,
          transitionDuration: getComputedStyle(element).transitionDuration,
          scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
        }));
        expect(motion.animationDuration).toBe('0s');
        expect(motion.transitionDuration).toBe('0s');
        expect(motion.scrollBehavior).toBe('auto');
        await expectLoadedFontsAndNoOverflow(page);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      });
    }
  }
}

const gettingStartedAccessibilityCases = [
  {
    name: 'requirements desktop Light',
    path: `/versions/${versionId}/start-here/requirements/`,
    width: 1280,
    height: 900,
    theme: 'light',
    title: 'Requirements and platform support',
    maturity: 'In development',
    locale: 'en',
    evidenceLabel: 'Source evidence',
  },
  {
    name: 'build phone Dark',
    path: `/versions/${versionId}/start-here/build/`,
    width: 360,
    height: 844,
    theme: 'dark',
    title: 'Configure and build MLE',
    maturity: 'In development',
    locale: 'en',
    evidenceLabel: 'Source evidence',
    checkCode: true,
  },
  {
    name: 'helper commands phone Light',
    path: `/versions/${versionId}/reference/helper-commands/`,
    width: 390,
    height: 844,
    theme: 'light',
    title: 'Helper command contracts',
    maturity: 'In development',
    locale: 'en',
    evidenceLabel: 'Source evidence',
  },
  {
    name: 'Portuguese requirements fallback phone Dark',
    path: `/pt-br/versions/${versionId}/start-here/requirements/`,
    width: 360,
    height: 844,
    theme: 'dark',
    title: 'Requirements and platform support',
    maturity: 'Em desenvolvimento',
    locale: 'pt-br',
    evidenceLabel: 'Evidências no código-fonte',
  },
] as const;

for (const auditCase of gettingStartedAccessibilityCases) {
  test(`getting started accessibility: ${auditCase.name} has exact reflow, named controls, and no axe violations`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: auditCase.width, height: auditCase.height });
    await page.addInitScript(
      (theme) => localStorage.setItem('starlight-theme', theme),
      auditCase.theme,
    );
    await page.goto(pageUrl(auditCase.path));

    await expect(page.locator('html')).toHaveAttribute('data-theme', auditCase.theme);
    await expectLoadedFontsAndNoOverflow(page);
    expect(
      await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        innerWidth: window.innerWidth,
      })),
    ).toEqual({ clientWidth: auditCase.width, innerWidth: auditCase.width });

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toHaveCount(1);
    await expect(heading).toHaveText(auditCase.title);
    await expect(page.locator('[data-mle-maturity="in-development"]')).toContainText(
      auditCase.maturity,
    );

    const portuguese = auditCase.locale === 'pt-br';
    await expect(page.locator('header site-search button[data-open-modal]')).toHaveAccessibleName(
      portuguese ? 'Pesquisar' : 'Search',
    );
    const menu = page.getByRole('button', { name: 'Menu' });
    if (await menu.isVisible()) await menu.click();
    await expect(
      page.getByRole('combobox', {
        name: portuguese ? 'Selecionar tema' : 'Select theme',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('combobox', {
        name: portuguese ? 'Selecionar língua' : 'Select language',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('combobox', {
        name: portuguese ? 'Versão da documentação' : 'Documentation version',
      }),
    ).toBeVisible();
    if (await menu.isVisible()) await menu.click();

    const fallback = page.locator('[data-mle-translation-status="fallback"]');
    if (portuguese) {
      await expect(fallback).toHaveCount(1);
      await expect(fallback).toContainText(
        `Esta página está disponível em inglês para a mesma versão do MLE. Commit fixado: ${versionId}.`,
      );
      await expect(page.locator('main')).toHaveAttribute('lang', 'en');
    } else {
      await expect(fallback).toHaveCount(0);
    }

    if ('checkCode' in auditCase && auditCase.checkCode) {
      const codeBlocks = page.locator('main pre');
      const codeLayout = await codeBlocks.evaluateAll((blocks) =>
        blocks.map((block) => ({
          contained: block.scrollWidth <= block.clientWidth,
          overflowX: getComputedStyle(block).overflowX,
          role: block.getAttribute('role'),
          scrollLeft: block.scrollLeft,
          tabIndex: block.getAttribute('tabindex'),
        })),
      );
      expect(codeLayout.length).toBeGreaterThan(0);
      expect(
        codeLayout.every(
          ({ contained, overflowX }) => contained || overflowX === 'auto' || overflowX === 'scroll',
        ),
      ).toBe(true);
      expect(
        codeLayout.filter(
          ({ contained, role, tabIndex }) =>
            contained
              ? role !== null || (tabIndex !== null && tabIndex !== '0')
              : (role !== null && role !== 'region') || tabIndex !== '0',
        ),
      ).toEqual([]);

      const overflowingIndex = codeLayout.findIndex(({ contained }) => !contained);
      expect(overflowingIndex).toBeGreaterThanOrEqual(0);
      const overflowingCode = codeBlocks.nth(overflowingIndex);
      await overflowingCode.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expectTwoPartFocus(overflowingCode, false);
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => overflowingCode.evaluate((block) => block.scrollLeft)).toBeGreaterThan(0);

      const containedIndex = codeLayout.findIndex(({ contained }) => contained);
      expect(containedIndex).toBeGreaterThanOrEqual(0);
      const containedCode = codeBlocks.nth(containedIndex);
      expect(await containedCode.textContent()).not.toBe('');
      expect(codeLayout[containedIndex]).toMatchObject({
        contained: true,
        overflowX: 'auto',
        role: null,
        scrollLeft: 0,
      });
    }

    const evidence = page.locator('[data-mle-source-evidence]');
    const summary = evidence.locator('summary');
    expect(await evidence.getAttribute('lang')).toBe(portuguese ? 'pt-BR' : null);
    await expect(summary).toHaveAccessibleName(auditCase.evidenceLabel);
    await summary.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expectTwoPartFocus(summary, false);
    await page.keyboard.press('Enter');
    await expect(evidence).toHaveAttribute('open', '');
    const evidenceLayout = await evidence.evaluate((element) => ({
      right: element.getBoundingClientRect().right,
      viewportWidth: document.documentElement.clientWidth,
      pathOverflow: [...element.querySelectorAll('a')].some(
        (link) => link.scrollWidth > link.clientWidth,
      ),
      pathsWrap: [...element.querySelectorAll('a')].every(
        (link) => getComputedStyle(link).overflowWrap !== 'normal',
      ),
    }));
    expect(evidenceLayout.right).toBeLessThanOrEqual(evidenceLayout.viewportWidth);
    expect(evidenceLayout.pathOverflow).toBe(false);
    expect(evidenceLayout.pathsWrap).toBe(true);

    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
  });
}

for (const handbookCase of [
  {
    name: 'geometry code in Light',
    path: `/versions/${versionId}/systems/math/geometry-and-intersections/`,
    theme: 'light',
    selector: 'main pre',
  },
  {
    name: 'reference table in Dark',
    path: `/versions/${versionId}/reference/core-math-utility-types/`,
    theme: 'dark',
    selector: 'main table',
  },
  {
    name: 'renderer guide code in Light',
    path: `/versions/${versionId}/guides/create-a-shader-and-pipeline/`,
    theme: 'light',
    selector: 'main pre',
  },
	{
		name: 'renderer contracts table in Dark',
    path: `/versions/${versionId}/reference/renderer-and-resource-contracts/`,
    theme: 'dark',
		selector: 'main table',
	},
	{
		name: 'UI hierarchy table in Light',
		path: `/versions/${versionId}/systems/ui/entities-hierarchy-and-layout/`,
		theme: 'light',
		selector: 'main table',
	},
	{
		name: 'UI text input code in Dark',
		path: `/versions/${versionId}/systems/ui/text-input-and-focus/`,
		theme: 'dark',
		selector: 'main pre',
	},
	{
		name: 'UI key reference table in Dark',
		path: `/versions/${versionId}/reference/ui-element-keys/`,
		theme: 'dark',
		selector: 'main table',
	},
	{
		name: 'UI Test catalog in Light',
		path: `/versions/${versionId}/tools/ui-test/`,
		theme: 'light',
		selector: 'main table',
	},
	{
		name: 'Portuguese UI reference fallback in Dark',
		path: `/pt-br/versions/${versionId}/reference/ui-components/`,
		theme: 'dark',
		selector: 'main table',
	},
	{
		name: 'audio command reference in Dark',
		path: `/versions/${versionId}/reference/audio-contracts/`,
		theme: 'dark',
		selector: 'main table',
	},
	{
		name: 'audio playback guide in Light',
		path: `/versions/${versionId}/guides/use-audio-playback/`,
		theme: 'light',
		selector: 'main pre',
	},
	{
		name: 'Client layer guide code in Light',
		path: `/versions/${versionId}/guides/create-a-client-layer/`,
		theme: 'light',
		selector: 'main pre',
	},
	{
		name: 'window and input reference in Dark',
		path: `/versions/${versionId}/reference/window-and-input-contracts/`,
		theme: 'dark',
		selector: 'main table',
	},
	{
		name: 'experimental Server table in Dark',
		path: `/versions/${versionId}/systems/server/`,
		theme: 'dark',
		selector: 'main table',
	},
	{
		name: 'Core test inventory table in Light',
		path: `/versions/${versionId}/tools/core-test-suite/`,
		theme: 'light',
		selector: 'main table',
	},
	{
		name: 'fixture workflow code in Dark',
		path: `/versions/${versionId}/tools/test-fixtures/`,
		theme: 'dark',
		selector: 'main pre',
	},
	{
		name: 'Portuguese contributor test fallback table in Light',
		path: `/pt-br/versions/${versionId}/contributing/tests-and-interactive-pages/`,
		theme: 'light',
		selector: 'main table',
	},
] as const) {
  test(`runtime handbook accessibility: ${handbookCase.name} reflows locally and is axe-clean`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(
      (theme) => localStorage.setItem('starlight-theme', theme),
      handbookCase.theme,
    );
    await page.goto(pageUrl(handbookCase.path));

    await expect(page.locator('html')).toHaveAttribute('data-theme', handbookCase.theme);
    await expectLoadedFontsAndNoOverflow(page);
    const localScroller = page.locator(handbookCase.selector).first();
    await expect(localScroller).toBeVisible();
    const layout = await localScroller.evaluate((element) => ({
      focusable: element.matches(':focus') || element.tabIndex >= 0,
      localOverflow: element.scrollWidth > element.clientWidth,
      overflowX: getComputedStyle(element).overflowX,
      transitionDuration: getComputedStyle(element).transitionDuration,
    }));
    expect(layout.localOverflow).toBe(true);
    expect(layout.overflowX).toMatch(/auto|scroll/);
    expect(layout.focusable).toBe(true);
    expect(layout.transitionDuration).toBe('0s');
    await localScroller.focus();
    await expectTwoPartFocus(localScroller, false);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => localScroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}
