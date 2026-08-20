import { expect, test } from '@playwright/test';

const siteOrigin = process.env.MLE_DOCS_E2E_ORIGIN ?? 'http://127.0.0.1:4321';
const versionId = 'c1abea3de165';
const fullCommit = 'c1abea3de165032fe064300340807b7a6af388f8';

function pageUrl(path: string): string {
  return new URL(`/MLEDocs${path}`, siteOrigin).toString();
}

const homepageCases = [
  {
    locale: 'English',
    path: `/versions/${versionId}/`,
    useLabel: 'Use MLE',
    contributeLabel: 'Understand and contribute',
    maturity: 'In development',
    alt: 'In-game scene built alongside MLE',
    systemLabels: ['Core runtime', 'Rendering', 'Models and animation', 'Lua and UI', 'Audio', 'Window and input'],
    sidebarLabels: ['Start Here', 'Engine Systems'],
  },
  {
    locale: 'Português (Brasil)',
    path: `/pt-br/versions/${versionId}/`,
    useLabel: 'Usar o MLE',
    contributeLabel: 'Entender e contribuir',
    maturity: 'Em desenvolvimento',
    alt: 'Cena do jogo desenvolvido junto com o MLE',
    systemLabels: ['Núcleo do runtime', 'Renderização', 'Modelos e animação', 'Lua e UI', 'Áudio', 'Janela e entrada'],
    sidebarLabels: ['Comece aqui', 'Sistemas do motor'],
  },
] as const;

for (const homepageCase of homepageCases) {
  test(`presents the editorial homepage journey in ${homepageCase.locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(pageUrl(homepageCase.path));

    const homepage = page.locator('[data-mle-homepage]');
    await expect(homepage).toBeVisible();
    await expect(homepage).toHaveAttribute('data-mle-homepage-version', versionId);

    const hero = homepage.locator('[data-mle-home-hero]');
    const versionPath = homepageCase.path.replace(/\/$/, '');
    await expect(hero.getByRole('link', { name: homepageCase.useLabel })).toHaveAttribute(
      'href',
      `/MLEDocs${versionPath}/start-here/project-status/`,
    );
    await expect(hero.getByRole('link', { name: homepageCase.contributeLabel })).toHaveAttribute(
      'href',
      `/MLEDocs${versionPath}/systems/renderer/`,
    );
    await expect(hero.locator('[data-mle-home-commit]')).toContainText(versionId);
    await expect(hero.locator('[data-mle-home-commit]')).toHaveAttribute(
      'href',
      `https://github.com/MaxMFonseca/MLE/tree/${fullCommit}`,
    );
    await expect(hero.locator('[data-mle-maturity="in-development"]')).toContainText(
      homepageCase.maturity,
    );
    await expect(hero.getByRole('img', { name: homepageCase.alt })).toHaveAttribute(
      'src',
      '/MLEDocs/media/c1abea3de165/gameplay.webp',
    );
    await expect(hero.locator('figcaption a')).toHaveAttribute(
      'href',
      `https://github.com/MaxMFonseca/MLE/blob/${fullCommit}/docs/media/gameplay.png`,
    );

    const heroContextBottom = await hero.locator('[data-mle-home-context]').evaluate(
      (element) => element.getBoundingClientRect().bottom,
    );
    expect(heroContextBottom).toBeLessThanOrEqual(800);

    const systemMap = homepage.locator('[data-mle-system-map]');
    for (const label of homepageCase.systemLabels) {
      await expect(systemMap.getByText(label, { exact: true })).toBeVisible();
    }

    for (const label of homepageCase.sidebarLabels) {
      await expect(page.locator('nav').getByText(label, { exact: true })).toBeVisible();
    }

    await expect(homepage.locator('blockquote')).toHaveCount(0);
    await expect(homepage.locator('[data-mle-metrics], [data-mle-testimonial]')).toHaveCount(0);
  });
}

test('keeps every homepage internal destination base-aware and marks planned sections without links', async ({
  page,
}) => {
  await page.goto(pageUrl(`/versions/${versionId}/`));

  const homepage = page.locator('[data-mle-homepage]');
  const hrefs = await homepage.locator('a[href]').evaluateAll((links) =>
    links.map((link) => link.getAttribute('href')).filter((href): href is string => href !== null),
  );
  const internalHrefs = hrefs.filter((href) => href.startsWith('/'));

  expect(internalHrefs.length).toBeGreaterThan(0);
  expect(internalHrefs.every((href) => href.startsWith('/MLEDocs/'))).toBe(true);
  expect(new Set(internalHrefs)).toEqual(
    new Set([
      `/MLEDocs/versions/${versionId}/start-here/project-status/`,
      `/MLEDocs/versions/${versionId}/systems/renderer/`,
    ]),
  );
  await expect(homepage.locator('[data-mle-navigation-availability="planned"] a')).toHaveCount(0);
  await expect(homepage.locator('[data-mle-navigation-availability="planned"]')).not.toHaveCount(0);
});

test('keeps Portuguese snapshot context above the first phone scroll', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 844 });
  await page.goto(pageUrl(`/pt-br/versions/${versionId}/`));

  const context = page.locator('[data-mle-home-context]');
  await expect(context.locator('[data-mle-home-commit]')).toContainText(versionId);
  await expect(context.locator('[data-mle-maturity="in-development"]')).toContainText(
    'Em desenvolvimento',
  );
  expect(await context.evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(
    844,
  );
});

test('keeps editorial sections readable inside Starlight rails', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(pageUrl(`/versions/${versionId}/`));

  const audienceWidths = await page.locator('.audience-paths article').evaluateAll((articles) =>
    articles.map((article) => article.getBoundingClientRect().width),
  );
  expect(Math.min(...audienceWidths)).toBeGreaterThanOrEqual(240);

  const systemWidths = await page.locator('[data-mle-system-map] li').evaluateAll((items) =>
    items.map((item) => item.getBoundingClientRect().width),
  );
  expect(Math.min(...systemWidths)).toBeGreaterThanOrEqual(220);

  await page.setViewportSize({ width: 360, height: 844 });
  await page.reload();
  expect(
    await page.locator('[data-mle-system-map] h2').evaluate((heading) => heading.getBoundingClientRect().width),
  ).toBeGreaterThanOrEqual(200);
});

test('shows pinned commit, maturity, and a base-aware same-page version destination', async ({
  page,
}) => {
  await page.goto(pageUrl(`/versions/${versionId}/systems/renderer/`));

  const permanentLink = page.locator('[data-mle-permanent-link]');
  await expect(permanentLink).toHaveText(versionId);
  await expect(permanentLink).toHaveAccessibleName(new RegExp(fullCommit));
  await expect(permanentLink).toHaveAttribute(
    'href',
    `/MLEDocs/versions/${versionId}/systems/renderer/`,
  );

  const maturity = page.locator('[data-mle-maturity="in-development"]');
  await expect(maturity).toContainText('In development');
  await expect(maturity.locator('[data-mle-maturity-cue]')).toBeVisible();

  const picker = page.getByLabel('Documentation version');
  await expect(picker.locator('option:checked')).toContainText(
    `${versionId} · 2026-08-18 · current`,
  );
  await expect(picker.locator('option:checked')).toHaveAttribute(
    'value',
    `/MLEDocs/versions/${versionId}/systems/renderer/`,
  );
  await picker.selectOption(`/MLEDocs/versions/${versionId}/systems/renderer/`);
  await expect(page).toHaveURL(pageUrl(`/versions/${versionId}/systems/renderer/`));
});

test('discloses an exact current Portuguese translation', async ({ page }) => {
  await page.goto(pageUrl(`/pt-br/versions/${versionId}/`));

  const notice = page.locator('[data-mle-translation-status="current"]');
  await expect(notice).toContainText('A tradução em português está atualizada para este commit do MLE.');
  await expect(page.locator('[data-mle-permanent-link]')).toHaveAttribute(
    'href',
    `/MLEDocs/pt-br/versions/${versionId}/`,
  );
  await expect(page.getByLabel('Versão da documentação').locator('option:checked')).toContainText(
    `${versionId} · 2026-08-18 · atual`,
  );
});

test('discloses same-commit English fallback without changing locale or commit', async ({ page }) => {
  await page.goto(pageUrl(`/pt-br/versions/${versionId}/systems/renderer/`));

  const notice = page.locator('[data-mle-translation-status="fallback"]');
  await expect(notice).toContainText(
    `Esta página está disponível em inglês para a mesma versão do MLE. Commit fixado: ${versionId}.`,
  );
  await expect(page.locator('main')).toHaveAttribute('lang', 'en');
  await expect(page.locator('[data-mle-permanent-link]')).toHaveAttribute(
    'href',
    `/MLEDocs/pt-br/versions/${versionId}/systems/renderer/`,
  );
  await expect(page.locator('[data-mle-page-permanent-link]')).toHaveAttribute(
    'href',
    `/MLEDocs/pt-br/versions/${versionId}/systems/renderer/`,
  );
  await expect(page.getByText('Este conteúdo não está disponível em sua língua ainda.')).toHaveCount(0);
  await expect(page).toHaveURL(pageUrl(`/pt-br/versions/${versionId}/systems/renderer/`));
});

test('explains a page missing from a known version and offers only explicit repair choices', async ({
  page,
}) => {
  await page.goto(pageUrl(`/versions/${versionId}/reference/not-in-this-snapshot/`));

  const state = page.locator('[data-mle-not-found="missing-page"]');
  await expect(state).toBeVisible();
  await expect(state.getByRole('heading', { level: 1 })).toHaveText(
    'Page unavailable in this version',
  );
  await expect(state).toContainText(versionId);
  await expect(state.getByRole('link', { name: 'Open this version overview' })).toHaveAttribute(
    'href',
    `/MLEDocs/versions/${versionId}/`,
  );
  await expect(state.locator('a[href*="/latest/"]')).toHaveCount(0);
});

test('localizes an unknown Portuguese version and lists permanent available versions', async ({
  page,
}) => {
  await page.goto(pageUrl('/pt-br/versions/ffffffffffff/guia/'));

  const state = page.locator('[data-mle-not-found="unknown-version"]');
  await expect(state).toBeVisible();
  await expect(state.getByRole('heading', { level: 1 })).toHaveText(
    'Versão da documentação não encontrada',
  );
  await expect(state).toContainText('ffffffffffff');
  const availableVersion = state.getByRole('link', { name: new RegExp(versionId) });
  await expect(availableVersion).toContainText(`${versionId} · 2026-08-18 · atual`);
  await expect(availableVersion).toHaveAttribute(
    'href',
    `/MLEDocs/pt-br/versions/${versionId}/`,
  );
  await expect(state.getByRole('link', { name: 'Abrir a documentação atual' })).toHaveAttribute(
    'href',
    `/MLEDocs/pt-br/versions/${versionId}/`,
  );
  await expect(state.locator('a[href*="/latest/"]')).toHaveCount(0);
});

test('keeps unrelated missing paths as an ordinary localized 404', async ({ page }) => {
  await page.goto(pageUrl('/pt-br/nao-existe/'));

  const state = page.locator('[data-mle-not-found="generic"]');
  await expect(state).toBeVisible();
  await expect(state.getByRole('heading', { level: 1 })).toHaveText('Página não encontrada');
  await expect(state).not.toContainText('ffffffffffff');
  await expect(state.getByRole('link', { name: 'Abrir a documentação atual' })).toHaveAttribute(
    'href',
    `/MLEDocs/pt-br/versions/${versionId}/`,
  );
});

test('does not classify nested versions segments as canonical version routes', async ({ page }) => {
  await page.goto(pageUrl(`/arbitrary/versions/${versionId}/missing/`));

  const state = page.locator('[data-mle-not-found="generic"]');
  await expect(state).toBeVisible();
  await expect(state.getByRole('heading', { level: 1 })).toHaveText('Page not found');
  await expect(page.locator('[data-mle-not-found="missing-page"]')).toHaveCount(0);
});

for (const { name, alias, permanent } of [
  {
    name: 'English',
    alias: '/',
    permanent: `/versions/${versionId}/`,
  },
  {
    name: 'Brazilian Portuguese',
    alias: '/pt-br/',
    permanent: `/pt-br/versions/${versionId}/`,
  },
]) {
  test(`${name} root alias resolves to the immutable current snapshot`, async ({ page }) => {
    await page.goto(pageUrl(alias));

    await expect(page).toHaveURL(pageUrl(permanent));
    await expect(page.locator('[data-mle-homepage]')).toHaveAttribute(
      'data-mle-homepage-version',
      versionId,
    );
  });
}

test('homepage primary path opens project status without changing the selected commit', async ({
  page,
}) => {
  await page.goto(pageUrl(`/versions/${versionId}/`));

  await page.getByRole('link', { name: 'Use MLE', exact: true }).click();

  await expect(page).toHaveURL(pageUrl(`/versions/${versionId}/start-here/project-status/`));
  await expect(page.getByRole('heading', { level: 1, name: 'Project status' })).toBeVisible();
  await expect(page.locator('[data-mle-permanent-link]')).toHaveText(versionId);
});

test('latest renderer alias declares and resolves to the permanent canonical route', async ({
  page,
}) => {
  const permanentPath = `/MLEDocs/versions/${versionId}/systems/renderer/`;
  const aliasResponse = await page.request.get(pageUrl('/latest/systems/renderer/'));

  expect(aliasResponse.ok()).toBe(true);
  expect(await aliasResponse.text()).toContain(`<link rel="canonical" href="${permanentPath}">`);

  await page.goto(pageUrl('/latest/systems/renderer/'));
  await expect(page).toHaveURL(pageUrl(`/versions/${versionId}/systems/renderer/`));
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `https://maxmfonseca.github.io${permanentPath}`,
  );
});

for (const { name, slug } of [
  { name: 'project status', slug: 'start-here/project-status' },
  { name: 'renderer', slug: 'systems/renderer' },
]) {
  test(`Portuguese latest ${name} fallback stays on the current commit`, async ({ page }) => {
    const permanentPath = `/MLEDocs/pt-br/versions/${versionId}/${slug}/`;
    const aliasResponse = await page.request.get(pageUrl(`/pt-br/latest/${slug}/`));

    expect(aliasResponse.ok()).toBe(true);
    expect(await aliasResponse.text()).toContain(`<link rel="canonical" href="${permanentPath}">`);

    await page.goto(pageUrl(`/pt-br/latest/${slug}/`));
    await expect(page).toHaveURL(pageUrl(`/pt-br/versions/${versionId}/${slug}/`));
    await expect(page.locator('[data-mle-translation-status="fallback"]')).toContainText(versionId);
    await expect(page.locator('[data-mle-permanent-link]')).toHaveAttribute('href', permanentPath);
  });
}

test('language control opens the exact Portuguese homepage for the same commit', async ({ page }) => {
  await page.goto(pageUrl(`/versions/${versionId}/`));

  await page
    .locator('header starlight-lang-select select')
    .selectOption(`/MLEDocs/pt-br/versions/${versionId}/`);

  await expect(page).toHaveURL(pageUrl(`/pt-br/versions/${versionId}/`));
  await expect(page.getByRole('heading', { level: 1, name: 'Documentação do MLE' })).toBeVisible();
  await expect(page.locator('[data-mle-translation-status="current"]')).toBeVisible();
});

test('direct renderer deep link survives reload without changing commit or route', async ({ page }) => {
  const deepLink = pageUrl(`/versions/${versionId}/systems/renderer/`);
  await page.goto(deepLink);
  await expect(page.getByRole('heading', { level: 1, name: 'Renderer overview' })).toBeVisible();

  await page.reload();

  await expect(page).toHaveURL(deepLink);
  await expect(page.getByRole('heading', { level: 1, name: 'Renderer overview' })).toBeVisible();
  await expect(page.locator('[data-mle-permanent-link]')).toHaveText(versionId);
});

test('mobile menu opens from the keyboard and Escape restores focus to its named control', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pageUrl(`/versions/${versionId}/systems/renderer/`));

  const menu = page.getByRole('button', { name: 'Menu' });
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('body')).toHaveAttribute('data-mobile-menu-expanded', '');
  await expect(menu.locator('xpath=..')).toHaveAttribute('aria-expanded', 'true');

  await page.keyboard.press('Escape');

  await expect(page.locator('body')).not.toHaveAttribute('data-mobile-menu-expanded', '');
  await expect(menu.locator('xpath=..')).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toBeFocused();
});
