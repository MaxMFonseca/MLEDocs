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
      loadedFonts: [...document.fonts].map((font) => ({ family: font.family, status: font.status })),
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
