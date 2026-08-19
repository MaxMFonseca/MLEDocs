import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const siteOrigin = process.env.MLE_DOCS_E2E_ORIGIN ?? 'http://127.0.0.1:4321';

function pageUrl(path: string): string {
  return new URL(`/MLEDocs${path}`, siteOrigin).toString();
}

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
  await expect(page.getByRole('heading', { level: 1, name: 'Renderer overview' })).toBeInViewport();
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
