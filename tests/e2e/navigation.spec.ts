import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { handbookPages } from '../../src/data/handbook';
import { navigationSections } from '../../src/data/navigation';

const siteOrigin = process.env.MLE_DOCS_E2E_ORIGIN ?? 'http://127.0.0.1:4321';
const versionId = 'c1abea3de165';
const fullCommit = 'c1abea3de165032fe064300340807b7a6af388f8';

function pageUrl(path: string): string {
  return new URL(`/MLEDocs${path}`, siteOrigin).toString();
}

async function expectMleFavicon(page: Page) {
  const icon = page.locator('link[rel~="icon"]');
  await expect(icon).toHaveCount(1);
  await expect(icon).toHaveAttribute('type', 'image/png');
  await expect(icon).toHaveAttribute('href', '/MLEDocs/favicon.png');
  const response = await page.request.get(new URL((await icon.getAttribute('href'))!, page.url()).toString());
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('image/png');
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
    sidebarLabels: [
      'Start Here',
      'Concepts',
      'Engine Systems',
      'Practical Guides',
      'Reference',
      'Tools and Test Applications',
      'Contributing',
    ],
  },
  {
    locale: 'Português (Brasil)',
    path: `/pt-br/versions/${versionId}/`,
    useLabel: 'Usar o MLE',
    contributeLabel: 'Entender e contribuir',
    maturity: 'Em desenvolvimento',
    alt: 'Cena do jogo desenvolvido junto com o MLE',
    systemLabels: ['Núcleo do runtime', 'Renderização', 'Modelos e animação', 'Lua e UI', 'Áudio', 'Janela e entrada'],
    sidebarLabels: [
      'Comece aqui',
      'Conceitos',
      'Sistemas do motor',
      'Guias práticos',
      'Referência',
      'Ferramentas e aplicativos de teste',
      'Como contribuir',
    ],
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
      await expect(page.locator('nav').getByRole('link', { name: label, exact: true })).toBeVisible();
    }

    await expect(homepage.locator('blockquote')).toHaveCount(0);
    await expect(homepage.locator('[data-mle-metrics], [data-mle-testimonial]')).toHaveCount(0);
  });
}

const sectionCases = [
  { segment: 'start-here', pageId: 'start', en: 'Start Here', pt: 'Comece aqui' },
  { segment: 'concepts', pageId: 'concepts', en: 'Concepts', pt: 'Conceitos' },
  { segment: 'systems', pageId: 'systems', en: 'Engine Systems', pt: 'Sistemas do motor' },
  { segment: 'guides', pageId: 'guides', en: 'Practical Guides', pt: 'Guias práticos' },
  { segment: 'reference', pageId: 'reference', en: 'Reference', pt: 'Referência' },
  { segment: 'tools', pageId: 'tools', en: 'Tools and Test Applications', pt: 'Ferramentas e aplicativos de teste' },
  { segment: 'contributing', pageId: 'contributing', en: 'Contributing', pt: 'Como contribuir' },
] as const;

for (const localeCase of [
  {
    name: 'English',
    prefix: '',
    localeLabel: 'English',
    breadcrumbLabel: 'Breadcrumb',
    searchLabel: 'Search',
    label: (section: (typeof sectionCases)[number]) => section.en,
  },
  {
    name: 'Brazilian Portuguese',
    prefix: '/pt-br',
    localeLabel: 'Português (Brasil)',
    breadcrumbLabel: 'Caminho de navegação',
    searchLabel: 'Pesquisar',
    label: (section: (typeof sectionCases)[number]) => section.pt,
  },
]) {
  test(`homepage exposes seven immutable section destinations in ${localeCase.name}`, async ({ page }) => {
    await page.goto(pageUrl(`${localeCase.prefix}/versions/${versionId}/`));
    const directory = page.locator('[data-mle-section-directory]');
    await expect(directory.getByRole('link')).toHaveCount(7);

    for (const section of sectionCases) {
      await expect(directory.getByRole('link', { name: localeCase.label(section) })).toHaveAttribute(
        'href',
        `/MLEDocs${localeCase.prefix}/versions/${versionId}/${section.segment}/`,
      );
    }
  });

  test(`all seven physical ${localeCase.name} hubs preserve commit and locale`, async ({ page }) => {
    for (const section of sectionCases) {
      const path = `${localeCase.prefix}/versions/${versionId}/${section.segment}/`;
      const response = await page.goto(pageUrl(path));
      expect(response?.ok(), path).toBe(true);
      await expect(page).toHaveURL(pageUrl(path));
      await expect(page.locator('[data-mle-section-index]')).toHaveAttribute(
        'data-mle-section-index',
        section.pageId,
      );
      await expect(page.locator('[data-mle-maturity]')).toHaveCount(0);
      await expect(page.locator('[data-mle-version-picker]')).toBeVisible();
      await expect(page.locator('[data-mle-page-permanent-link]')).toHaveAttribute(
        'href',
        `/MLEDocs${path}`,
      );
      await expect(page.locator('[data-mle-version-picker] option:checked')).toHaveAttribute(
        'value',
        `/MLEDocs${path}`,
      );
      await expect(
        page
          .locator('#starlight__sidebar')
          .getByRole('link', { name: localeCase.label(section), exact: true }),
      ).toHaveAttribute('href', `/MLEDocs${path}`);

      const breadcrumb = page.getByRole('navigation', { name: localeCase.breadcrumbLabel });
      await expect(breadcrumb.locator('[data-mle-breadcrumb-label]')).toHaveText([
        localeCase.localeLabel,
        versionId,
        localeCase.label(section),
      ]);
      await expect(
        breadcrumb.getByText(localeCase.label(section), { exact: true }),
      ).toHaveAttribute('aria-current', 'page');
      if (localeCase.prefix === '/pt-br') {
        await expect(page.locator('[data-mle-translation-status="current"]')).toBeVisible();
      }
      await expect(page.locator('[data-mle-section-planned] a')).toHaveCount(0);

      if (section.pageId === 'systems') {
        await expect(page.locator('[data-mle-section-planned]')).toHaveCount(0);
      }
      if (section.pageId === 'tools' || section.pageId === 'contributing') {
        const registrySection = navigationSections.find(({ pageId }) => pageId === section.pageId);
        if (!registrySection) throw new Error(`Missing registry section ${section.pageId}.`);
        const expectedPageIds = handbookPages
          .filter(({ publication, sectionId }) => publication === 'planned' && sectionId === section.pageId)
          .map(({ pageId }) => pageId);
        const expectedLabels = registrySection.plannedGroups
          .flatMap(({ children }) => children)
          .filter(({ pageId }) => expectedPageIds.includes(pageId))
          .map(({ labels }) => labels[localeCase.prefix === '/pt-br' ? 'pt-br' : 'en']);
        const plannedBlock = page.locator('[data-mle-section-planned]');
        if (expectedLabels.length === 0) {
          await expect(plannedBlock).toHaveCount(0);
        } else {
          await expect(plannedBlock).toHaveCount(1);
          const plannedRows = plannedBlock.locator('[data-mle-navigation-availability="planned"]');
          await expect(plannedRows).toHaveCount(expectedLabels.length);
          for (const label of expectedLabels) {
            await expect(plannedRows.filter({ hasText: label })).toHaveCount(1);
          }
        }
      }

      const reload = await page.reload();
      expect(reload?.ok(), `reload ${path}`).toBe(true);
      await expect(page).toHaveURL(pageUrl(path));
      await expect(page.locator('[data-mle-section-index]')).toHaveAttribute(
        'data-mle-section-index',
        section.pageId,
      );
    }
  });

  test(`${localeCase.name} search agrees with all seven immutable section identities`, async ({ page }) => {
    await page.goto(pageUrl(`${localeCase.prefix}/versions/${versionId}/`));
    await expect(page.locator('#starlight__search .pagefind-ui__search-input')).toHaveCount(1, {
      timeout: 15_000,
    });
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: localeCase.searchLabel });
    await expect(dialog).toBeVisible();
    const input = dialog.locator('.pagefind-ui__search-input');

    for (const section of sectionCases) {
      const href = `/MLEDocs${localeCase.prefix}/versions/${versionId}/${section.segment}/`;
      await input.fill(localeCase.label(section));
      const resultLink = dialog.locator(`.pagefind-ui__result-link[href="${href}"]`);
      await expect(resultLink, `${localeCase.name} search result for ${section.pageId}`).toBeVisible({
        timeout: 15_000,
      });
      const result = resultLink.locator(
        'xpath=ancestor::li[contains(concat(" ", normalize-space(@class), " "), " pagefind-ui__result ")][1]',
      );
      await expect(result).toHaveAttribute('data-mle-search-version', versionId);
      await expect(result).toHaveAttribute(
        'data-mle-search-locale',
        localeCase.prefix === '/pt-br' ? 'pt-br' : 'en',
      );
    }
  });
}

for (const journey of [
  {
    section: 'Start Here',
    child: 'Project status',
    sectionPath: `/versions/${versionId}/start-here/`,
    childPath: `/versions/${versionId}/start-here/project-status/`,
  },
  {
    section: 'Engine Systems',
    child: 'Renderer',
    sectionPath: `/versions/${versionId}/systems/`,
    childPath: `/versions/${versionId}/systems/renderer/`,
  },
  {
    section: 'Comece aqui',
    child: 'Estado do projeto',
    sectionPath: `/pt-br/versions/${versionId}/start-here/`,
    childPath: `/pt-br/versions/${versionId}/start-here/project-status/`,
  },
  {
    section: 'Sistemas do motor',
    child: 'Renderer',
    sectionPath: `/pt-br/versions/${versionId}/systems/`,
    childPath: `/pt-br/versions/${versionId}/systems/renderer/`,
  },
]) {
  test(`${journey.section} reaches its authored child within two homepage decisions`, async ({ page }) => {
    const localePrefix = journey.sectionPath.startsWith('/pt-br/') ? '/pt-br' : '';
    await page.goto(pageUrl(`${localePrefix}/versions/${versionId}/`));
    await page.locator('[data-mle-section-directory]').getByRole('link', { name: journey.section }).click();
    await expect(page).toHaveURL(pageUrl(journey.sectionPath));
    await page.locator('[data-mle-section-available]').getByRole('link', { name: journey.child }).click();
    await expect(page).toHaveURL(pageUrl(journey.childPath));
    await expect(page.locator('[data-mle-page-permanent-link]')).toHaveAttribute(
      'href',
      `/MLEDocs${journey.childPath}`,
    );
  });
}

test('language switching preserves all seven section page IDs within the selected commit', async ({ page }) => {
  for (const section of sectionCases) {
    await page.goto(pageUrl(`/versions/${versionId}/${section.segment}/`));
    await page
      .locator('header starlight-lang-select select')
      .selectOption(`/MLEDocs/pt-br/versions/${versionId}/${section.segment}/`);
    await expect(page).toHaveURL(pageUrl(`/pt-br/versions/${versionId}/${section.segment}/`));
    await expect(page.locator('[data-mle-section-index]')).toHaveAttribute(
      'data-mle-section-index',
      section.pageId,
    );
    await expect(page.locator('[data-mle-page-permanent-link]')).toHaveAttribute(
      'href',
      `/MLEDocs/pt-br/versions/${versionId}/${section.segment}/`,
    );
  }
});

for (const localeCase of [
  { name: 'English', prefix: '' },
  { name: 'Brazilian Portuguese', prefix: '/pt-br' },
]) {
  test(`all seven ${localeCase.name} latest hub aliases canonicalize to permanent routes`, async ({
    page,
    request,
  }) => {
    for (const section of sectionCases) {
      const alias = `${localeCase.prefix}/latest/${section.segment}/`;
      const permanent = `${localeCase.prefix}/versions/${versionId}/${section.segment}/`;
      const permanentHref = `/MLEDocs${permanent}`;
      const response = await request.get(pageUrl(alias), { maxRedirects: 0 });
      expect(response.ok(), alias).toBe(true);
      expect(await response.text(), alias).toContain(
        `<link rel="canonical" href="${permanentHref}">`,
      );

      await page.goto(pageUrl(alias));
      await expect(page).toHaveURL(pageUrl(permanent));
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `https://maxmfonseca.github.io${permanentHref}`,
      );
      await expect(page.locator('[data-mle-section-index]')).toHaveAttribute(
        'data-mle-section-index',
        section.pageId,
      );
    }
  });
}

for (const { name, path } of [
  { name: 'English', path: `/versions/${versionId}/concepts/` },
  { name: 'Brazilian Portuguese', path: `/pt-br/versions/${versionId}/tools/` },
]) {
  test(`360px ${name} section hub has no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(pageUrl(path));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
  });
}

for (const { name, path } of [
  { name: 'English systems hub', path: `/versions/${versionId}/systems/` },
  { name: 'Brazilian Portuguese tools hub', path: `/pt-br/versions/${versionId}/tools/` },
]) {
  test(`${name} is axe-clean`, async ({ page }) => {
    await page.goto(pageUrl(path));
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
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
      `/MLEDocs/versions/${versionId}/start-here/`,
      `/MLEDocs/versions/${versionId}/concepts/`,
      `/MLEDocs/versions/${versionId}/systems/`,
      `/MLEDocs/versions/${versionId}/guides/`,
      `/MLEDocs/versions/${versionId}/reference/`,
      `/MLEDocs/versions/${versionId}/tools/`,
      `/MLEDocs/versions/${versionId}/contributing/`,
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

test('repository root is a stable landing page', async ({ page }) => {
  const response = await page.goto(pageUrl('/'));

  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(pageUrl('/'));
  await expect(page.locator('[data-mle-landing]')).toHaveAttribute(
    'data-mle-landing-version',
    versionId,
  );
  await expect(page.getByRole('heading', { level: 1, name: /C\+\+23 game engine/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start here', exact: true })).toHaveAttribute(
    'href',
    `/MLEDocs/versions/${versionId}/start-here/`,
  );
  await expect(page.getByRole('link', { name: 'Explore systems' })).toHaveAttribute(
    'href',
    `/MLEDocs/versions/${versionId}/systems/`,
  );
  const picker = page.locator('[data-mle-landing-version-picker]');
  await expect(picker).toHaveAccessibleName('Documentation version');
  await expect(picker.locator('option:checked')).toHaveValue(`/MLEDocs/versions/${versionId}/`);
  await expect(page.locator('[data-mle-landing-selected-version]')).toHaveText(versionId);
  await expect(page.locator('[data-mle-landing-feature]')).toHaveCount(3);
  await expect(page.locator('[data-mle-landing-section]')).toHaveCount(7);
  await expect(
    page.locator('[data-mle-landing-section="start"]').getByRole('link'),
  ).toHaveAccessibleName(/Start Here/);
  await expect(page.locator('[data-mle-landing-evidence]')).toContainText(versionId);
  const gameplay = page.getByRole('img', { name: 'Gameplay scene rendered by MLE' });
  await expect(gameplay).toHaveAttribute('src', `/MLEDocs/media/${versionId}/gameplay.webp`);
  await expect
    .poll(() =>
      gameplay.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    )
    .toBe(true);
  await expect(page.locator('[data-mle-not-found]')).toHaveCount(0);
  await expectMleFavicon(page);
});

test('immutable documentation route exposes the MLE favicon', async ({ page }) => {
  await page.goto(pageUrl(`/versions/${versionId}/systems/renderer/`));

  await expectMleFavicon(page);
});

for (const journey of [
  {
    path: '/',
    locale: 'en',
    heading: 'A C++23 game engine for building real-time experiences',
    absent: 'Um motor de jogos C++23',
    description:
      'MLE is a C++23 game engine with Vulkan rendering, Lua-driven UI, OpenAL audio, SDL window and input, and development tools.',
    canonical: 'https://maxmfonseca.github.io/MLEDocs/',
    evidenceLanguages: 'English and Brazilian Portuguese',
  },
  {
    path: '/pt-br/',
    locale: 'pt-BR',
    heading: 'Um motor de jogos C++23 para criar experiências em tempo real',
    absent: 'A C++23 game engine',
    description:
      'MLE é um motor de jogos C++23 com renderização Vulkan, UI controlada por Lua, áudio OpenAL, janela e entrada SDL e ferramentas de desenvolvimento.',
    canonical: 'https://maxmfonseca.github.io/MLEDocs/pt-br/',
    evidenceLanguages: 'inglês e português do Brasil',
  },
]) {
  test(`${journey.locale} root is a localized landing document`, async ({ page }) => {
    const response = await page.goto(pageUrl(journey.path));

    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(pageUrl(journey.path));
    await expect(page.locator('html')).toHaveAttribute('lang', journey.locale);
    await expect(page.getByRole('heading', { level: 1, name: journey.heading })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(journey.absent);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      journey.description,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      journey.canonical,
    );
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
      'href',
      'https://maxmfonseca.github.io/MLEDocs/',
    );
    await expect(page.locator('link[rel="alternate"][hreflang="pt-BR"]')).toHaveAttribute(
      'href',
      'https://maxmfonseca.github.io/MLEDocs/pt-br/',
    );
    await expect(
      page
        .locator('[data-mle-landing-evidence] dl > div')
        .filter({
          has: page.getByText(journey.locale === 'en' ? 'Languages' : 'Idiomas', {
            exact: true,
          }),
        })
        .locator('dd'),
    ).toHaveText(journey.evidenceLanguages);
  });
}

for (const journey of [
  {
    name: 'English',
    path: '/',
    lang: 'en',
    requiredPhrase: 'A C++23 game engine for building real-time experiences',
    forbiddenPhrases: [
      'Idioma',
      'Um motor de jogos C++23 para criar experiências em tempo real',
      'Comece aqui',
      'Explore os sistemas',
      'Um núcleo C++23 conectado à plataforma hospedeira',
      'Renderização Vulkan com modelos e animação',
      'UI controlada por Lua, áudio OpenAL e ferramentas funcionais',
      'Escolha um caminho pelo manual',
      'Sistemas do motor',
      'Documentação vinculada a um estado do código-fonte',
      'Snapshot selecionado',
      'Documentação do MLE',
    ],
  },
  {
    name: 'Brazilian Portuguese',
    path: '/pt-br/',
    lang: 'pt-BR',
    requiredPhrase: 'Um motor de jogos C++23 para criar experiências em tempo real',
    forbiddenPhrases: [
      'Language',
      'A C++23 game engine for building real-time experiences',
      'Start here',
      'Explore systems',
      'A C++23 core connected to the host platform',
      'Vulkan rendering with models and animation',
      'Lua-driven UI, OpenAL audio, and working tools',
      'Choose a route through the handbook',
      'Engine Systems',
      'Documentation tied to one source state',
      'Selected snapshot',
      'MLE documentation',
    ],
  },
] as const) {
  test(`${journey.name} landing keeps visible copy isolated to its active locale`, async ({ page }) => {
    await page.goto(pageUrl(journey.path));

    await expect(page.locator('[data-mle-landing-section]')).toHaveCount(7);
    await expect(page.locator('[data-mle-landing-feature]')).toHaveCount(3);
    await expect(page.locator('html')).toHaveAttribute('lang', journey.lang);
    await expect(page.locator('body')).toContainText(journey.requiredPhrase);
    for (const forbidden of journey.forbiddenPhrases) {
      await expect(page.locator('body')).not.toContainText(forbidden);
    }
    await expect(page.locator('[data-mle-landing-language-picker] option')).toHaveText([
      'English',
      'Português (Brasil)',
    ]);

    const copyOutsideLanguagePicker = await page.locator('body').evaluate((body) => {
      const bodyWithoutLanguagePicker = body.cloneNode(true) as HTMLElement;
      bodyWithoutLanguagePicker.querySelector('[data-mle-landing-language-picker]')?.remove();
      return bodyWithoutLanguagePicker.textContent;
    });
    expect(copyOutsideLanguagePicker).not.toContain('Português (Brasil)');
  });
}

for (const journey of [
  {
    from: '/',
    destination: '/pt-br/',
    title: 'MLE · Documentação do motor de jogos C++23',
  },
  {
    from: '/pt-br/',
    destination: '/',
    title: 'MLE · C++23 game engine documentation',
  },
]) {
  test(`landing language picker navigates from ${journey.from} to ${journey.destination}`, async ({
    page,
  }) => {
    await page.goto(pageUrl(journey.from));

    const picker = page.locator('[data-mle-landing-language-picker]');
    await expect(picker.locator('option')).toHaveText(['English', 'Português (Brasil)']);
    await picker.selectOption(`/MLEDocs${journey.destination}`);

    await expect(page).toHaveURL(pageUrl(journey.destination));
    await expect(page).toHaveTitle(journey.title);
  });
}

test('page outline stays compact at normal desktop widths and slim on wide screens', async ({
  page,
}) => {
  const articlePath = `/versions/${versionId}/systems/renderer/`;

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(pageUrl(articlePath));
  const compactOutline = page.locator('[data-mle-compact-toc]');
  await expect(compactOutline).toBeVisible();
  await expect(page.locator('[data-mle-wide-toc]')).toBeHidden();
  const compactBox = await compactOutline.boundingBox();
  expect(compactBox?.height).toBeLessThanOrEqual(56);

  const compactToggle = compactOutline.locator('summary');
  await expect(compactToggle).toContainText('On this page');
  await compactToggle.focus();
  await page.keyboard.press('Enter');
  await expect(compactOutline.locator('details')).toHaveAttribute('open', '');
  await page.keyboard.press('Escape');
  await expect(compactOutline.locator('details')).not.toHaveAttribute('open', '');
  await expect(compactToggle).toBeFocused();

  await page.setViewportSize({ width: 1600, height: 900 });
  await expect(page.locator('[data-mle-compact-toc]')).toBeHidden();
  const wideOutline = page.locator('[data-mle-wide-toc]');
  await expect(wideOutline).toBeVisible();
  const [outlineBox, mainBox] = await Promise.all([
    wideOutline.boundingBox(),
    page.locator('.main-pane').boundingBox(),
  ]);
  expect(outlineBox?.width).toBeLessThanOrEqual(224);
  expect(mainBox?.width).toBeGreaterThanOrEqual(760);
});

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
  await expect(page.getByRole('heading', { level: 1, name: 'Renderer' })).toBeVisible();

  await page.reload();

  await expect(page).toHaveURL(deepLink);
  await expect(page.getByRole('heading', { level: 1, name: 'Renderer' })).toBeVisible();
  await expect(page.locator('[data-mle-permanent-link]')).toHaveText(versionId);
});

for (const breadcrumbCase of [
  {
    name: 'English renderer',
    path: `/versions/${versionId}/systems/renderer/`,
    ariaLabel: 'Breadcrumb',
    labels: ['English', versionId, 'Engine Systems', 'Renderer'],
    hrefs: [
      `/MLEDocs/versions/${versionId}/`,
      `/MLEDocs/versions/${versionId}/`,
      `/MLEDocs/versions/${versionId}/systems/`,
    ],
  },
  {
    name: 'Portuguese fallback renderer',
    path: `/pt-br/versions/${versionId}/systems/renderer/`,
    ariaLabel: 'Caminho de navegação',
    labels: ['Português (Brasil)', versionId, 'Sistemas do motor', 'Renderer'],
    hrefs: [
      `/MLEDocs/pt-br/versions/${versionId}/`,
      `/MLEDocs/pt-br/versions/${versionId}/`,
      `/MLEDocs/pt-br/versions/${versionId}/systems/`,
    ],
  },
] as const) {
  test(`${breadcrumbCase.name} breadcrumb preserves label order, commit, and focus`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(pageUrl(breadcrumbCase.path));

    const breadcrumb = page.getByRole('navigation', { name: breadcrumbCase.ariaLabel });
    await expect(breadcrumb.locator('[data-mle-breadcrumb-label]')).toHaveText(breadcrumbCase.labels);
    await expect(breadcrumb.locator('a')).toHaveCount(3);
    for (const [index, href] of breadcrumbCase.hrefs.entries()) {
      await expect(breadcrumb.locator('a').nth(index)).toHaveAttribute('href', href);
    }
    await expect(breadcrumb.getByText(breadcrumbCase.labels[3], { exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(breadcrumb.locator('a').nth(1)).toHaveAttribute('title', fullCommit);
    await breadcrumb.locator('a').nth(2).focus();
    await expect(breadcrumb.locator('a').nth(2)).toBeFocused();
    expect(
      await breadcrumb.locator('a').nth(2).evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).outlineWidth),
      ),
    ).toBeGreaterThanOrEqual(2);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    ).toBeLessThanOrEqual(1);
  });
}

test('unknown-version and unrelated 404 routes do not invent a breadcrumb hierarchy', async ({ page }) => {
  for (const path of ['/pt-br/versions/ffffffffffff/guia/', '/pt-br/nao-existe/']) {
    await page.goto(pageUrl(path));
    await expect(page.locator('[data-mle-version-breadcrumbs]')).toHaveCount(0);
  }
});

test('Portuguese section hubs keep their exact translation breadcrumb current', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(pageUrl(`/pt-br/versions/${versionId}/systems/`));

  const breadcrumb = page.getByRole('navigation', { name: 'Caminho de navegação' });
  await expect(breadcrumb.locator('[data-mle-breadcrumb-label]')).toHaveText([
    'Português (Brasil)',
    versionId,
    'Sistemas do motor',
  ]);
  await expect(breadcrumb.locator('a')).toHaveCount(2);
  await expect(breadcrumb.getByText('Sistemas do motor', { exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('version overview breadcrumbs retain locale and commit context without self-links', async ({ page }) => {
  await page.goto(pageUrl(`/versions/${versionId}/`));

  const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(breadcrumb.locator('[data-mle-breadcrumb-label]')).toHaveText(['English', versionId]);
  await expect(breadcrumb.locator('a')).toHaveCount(0);
  await expect(breadcrumb.getByText(versionId, { exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(breadcrumb.getByText(versionId, { exact: true })).toHaveAttribute('title', fullCommit);
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
