import { expect, test, type Page } from '@playwright/test';
import { handbookPages } from '../../src/data/handbook';
import { getNavigationSection } from '../../src/data/navigation';

const siteOrigin = process.env.MLE_DOCS_E2E_ORIGIN ?? 'http://127.0.0.1:4321';
const versionId = 'c1abea3de165';
const fullCommit = 'c1abea3de165032fe064300340807b7a6af388f8';

function pageUrl(path: string): string {
  return new URL(`/MLEDocs${path}`, siteOrigin).toString();
}

const pages = [
  ['requirements', 'start-here/requirements'],
  ['setup', 'start-here/setup'],
  ['build', 'start-here/build'],
  ['tests', 'start-here/tests'],
  ['client', 'start-here/client'],
  ['repository-tour', 'start-here/repository-tour'],
  ['troubleshooting', 'start-here/troubleshooting'],
  ['contributor-environment', 'contributing/contributor-environment'],
  ['contributor-testing', 'contributing/contributor-testing'],
  ['resources-shaders', 'contributing/resources-shaders'],
  ['documentation', 'contributing/documentation'],
  ['translations', 'contributing/translations'],
  ['build-options', 'reference/build-options'],
  ['helper-commands', 'reference/helper-commands'],
] as const;

const pageTitles: Readonly<Record<(typeof pages)[number][0], string>> = {
  requirements: 'Requirements and platform support',
  setup: 'Set up a working tree',
  build: 'Configure and build MLE',
  tests: 'Run the automated tests',
  client: 'Explore the interactive Client',
  'repository-tour': 'Tour the repository',
  troubleshooting: 'Diagnose setup and build failures',
  'contributor-environment': 'Prepare a contributor environment',
  'contributor-testing': 'Test a contributor change',
  'resources-shaders': 'Work with resources and shaders',
  documentation: 'Document a contributor change',
  translations: 'Maintain translations',
  'build-options': 'Build options and targets',
  'helper-commands': 'Helper command contracts',
};

const requiredEvidencePaths: Readonly<
  Partial<Record<(typeof pages)[number][0], readonly string[]>>
> = {
  requirements: ['external/CMakeLists.txt', 'tests/Core/CMakeLists.txt'],
  'contributor-testing': ['scripts/envsetup.sh'],
};

const orderedSections = ['start', 'contributing'] as const;

function registryRouteSequence(
  sectionId: (typeof orderedSections)[number],
  localePrefix: '' | '/pt-br',
): readonly string[] {
  const section = getNavigationSection(sectionId);
  const pageIds = [
    section.pageId,
    ...section.plannedGroups.flatMap((group) => group.children.map((child) => child.pageId)),
  ].filter((pageId) => pageId !== 'tests-and-interactive-pages');
  return pageIds.map((pageId) =>
    pageId === section.pageId
      ? `/MLEDocs${localePrefix}/versions/${versionId}/${section.segment}/`
      : `/MLEDocs${localePrefix}/versions/${versionId}/${section.segment}/${pageId}/`,
  );
}

async function openSearch(page: Page) {
  await expect(page.locator('#starlight__search .pagefind-ui__search-input')).toHaveCount(1, {
    timeout: 15_000,
  });
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Search' });
  await expect(dialog).toBeVisible();
  return dialog.locator('.pagefind-ui__search-input');
}

for (const [pageId, slug] of pages) {
  test(`${pageId} permanent route preserves canonical snapshot identity and static evidence`, async ({
    page,
    request,
  }) => {
    const route = `/versions/${versionId}/${slug}/`;
    const href = `/MLEDocs${route}`;
    const response = await request.get(pageUrl(route));
    expect(response.status(), route).toBe(200);

    const html = await response.text();
    expect(html).toContain(`data-mle-source-evidence`);
    expect(html).toContain(`/blob/${fullCommit}/`);
    expect(html).toContain(`data-pagefind-filter="mleVersion" content="${versionId}"`);
    expect(html).toContain('data-pagefind-filter="mleLocale" content="en"');
    const evidenceHtml = html.match(/<details[^>]*data-mle-source-evidence[\s\S]*?<\/details>/)?.[0];
    expect(evidenceHtml, `${pageId} static source evidence`).toBeTruthy();
    expect(evidenceHtml).not.toContain('<script');
    expect(evidenceHtml).not.toContain('<astro-island');
    if (pageId === 'build') {
      const renderedCodeBlocks = html.match(/<pre\b[^>]*data-language="[^"]+"[^>]*>/g) ?? [];
      expect(renderedCodeBlocks.length).toBeGreaterThan(0);
      expect(renderedCodeBlocks.every((codeBlock) => codeBlock.includes('tabindex="0"'))).toBe(
        true,
      );
    }

    const navigation = await page.goto(pageUrl(route));
    expect(navigation?.status(), route).toBe(200);
    await expect(page).toHaveURL(pageUrl(route));
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://maxmfonseca.github.io${href}`,
    );
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(pageTitles[pageId]);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('[data-mle-translation-status]')).toHaveCount(0);
    await expect(page.locator('[data-mle-permanent-link]')).toHaveText(versionId);
    await expect(page.locator('[data-mle-permanent-link]')).toHaveAccessibleName(
      new RegExp(fullCommit),
    );
    await expect(page.locator('[data-mle-permanent-link]')).toHaveAttribute('href', href);
    await expect(page.locator('[data-mle-page-permanent-link]')).toHaveAttribute('href', href);
    await expect(page.locator('[data-mle-source-evidence]')).toHaveCount(1);
    const evidenceLinks = page.locator('[data-mle-source-evidence] a');
    expect(await evidenceLinks.count()).toBeGreaterThan(0);
    expect(
      await evidenceLinks.evaluateAll((links, commit) =>
        links.every((link) => link.getAttribute('href')?.includes(`/blob/${commit}/`)),
      fullCommit),
    ).toBe(true);
    for (const evidencePath of requiredEvidencePaths[pageId] ?? []) {
      await expect(
        page.locator(
          `[data-mle-source-evidence] a[href="https://github.com/MaxMFonseca/MLE/blob/${fullCommit}/${evidencePath}"]`,
        ),
      ).toHaveCount(1);
    }
    await expect(page.locator(`#starlight__sidebar a[href="${href}"]`)).not.toHaveCount(0);
  });

  test(`${pageId} latest alias agrees with its immutable canonical`, async ({ page, request }) => {
    const alias = `/latest/${slug}/`;
    const permanent = `/versions/${versionId}/${slug}/`;
    const permanentHref = `/MLEDocs${permanent}`;
    const response = await request.get(pageUrl(alias), { maxRedirects: 0 });
    expect(response.status(), alias).toBe(200);
    const html = await response.text();
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toContain(`<link rel="canonical" href="${permanentHref}">`);
    expect(html).toContain(`url=${permanentHref}`);
    expect(html).not.toContain('data-pagefind-filter="mleVersion"');
    expect(html).not.toContain('data-pagefind-filter="mleLocale"');

    await page.goto(pageUrl(alias));
    await expect(page).toHaveURL(pageUrl(permanent));
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://maxmfonseca.github.io${permanentHref}`,
    );
    await expect(page.locator('[data-mle-permanent-link]')).toHaveAttribute(
      'href',
      permanentHref,
    );
  });
}

test('section hubs expose every finished page while unrelated reference groups remain planned', async ({
  page,
}) => {
  for (const sectionId of ['start', 'contributing', 'reference'] as const) {
    const section = getNavigationSection(sectionId);
    const navigationChildren = section.plannedGroups.flatMap(({ children }) => children);
    const expected = navigationChildren.map((child) => {
      const handbookPage = handbookPages.find(({ pageId }) => pageId === child.pageId);
      const published = sectionId === 'start'
        || pages.some(([pageId]) => pageId === child.pageId)
        || handbookPage?.publication === 'published';
      return {
        label: child.labels.en,
        published,
        href: published
          ? `/MLEDocs/versions/${versionId}/${handbookPage?.slug ?? `${section.segment}/${child.pageId}`}/`
          : undefined,
      };
    });

    await page.goto(pageUrl(`/versions/${versionId}/${section.segment}/`));
    const actualPublished = await page
      .locator('[data-mle-section-available] a')
      .evaluateAll((links) => links.map((link) => ({
        label: link.textContent?.trim() ?? '',
        href: link.getAttribute('href') ?? '',
      })).sort((left, right) => left.label.localeCompare(right.label)));
    expect(actualPublished).toEqual(
      expected
        .filter(({ published }) => published)
        .map(({ label, href }) => ({ label, href: href ?? '' }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    );

    const actualPlanned = (await page
      .locator('[data-mle-navigation-availability="planned"]')
      .allTextContents())
      .map((text) => text.replace(/\s+/g, ' ').trim())
      .sort();
    expect(actualPlanned).toEqual(
      expected
        .filter(({ published }) => !published)
        .map(({ label }) => `${label}Page planned`)
        .sort(),
    );
    await expect(
      page.locator('[data-mle-navigation-availability="planned"] a'),
    ).toHaveCount(0);
  }

  await page.goto(pageUrl(`/versions/${versionId}/reference/`));
  const available = page.locator('[data-mle-section-available]');
  await expect(available.getByRole('link', { name: 'Build options' })).toHaveAttribute(
    'href',
    `/MLEDocs/versions/${versionId}/reference/build-options/`,
  );
  await expect(available.getByRole('link', { name: 'Helper commands' })).toHaveAttribute(
    'href',
    `/MLEDocs/versions/${versionId}/reference/helper-commands/`,
  );
  await expect(available.getByRole('link', { name: 'Audio contracts' })).toHaveAttribute(
    'href',
    `/MLEDocs/versions/${versionId}/reference/audio-contracts/`,
  );
  await expect(available.getByRole('link', { name: 'Core, math, and utility types' })).toHaveAttribute(
    'href',
    `/MLEDocs/versions/${versionId}/reference/core-math-utility-types/`,
  );
  await expect(available.getByRole('link', { name: 'Renderer and resource contracts' })).toHaveAttribute(
    'href',
    `/MLEDocs/versions/${versionId}/reference/renderer-and-resource-contracts/`,
  );
  await expect(available.getByRole('link', { name: 'Lua API' })).toHaveAttribute(
    'href',
    `/MLEDocs/versions/${versionId}/reference/lua-api/`,
  );
  await expect(available.getByRole('link', { name: 'UI element keys' })).toHaveAttribute(
    'href',
    `/MLEDocs/versions/${versionId}/reference/ui-element-keys/`,
  );
  await expect(available.getByRole('link', { name: 'UI components' })).toHaveAttribute(
    'href',
    `/MLEDocs/versions/${versionId}/reference/ui-components/`,
  );
  await expect(available.getByRole('link', { name: 'UI events and callbacks' })).toHaveAttribute(
    'href',
    `/MLEDocs/versions/${versionId}/reference/ui-events-and-callbacks/`,
  );
  await expect(available.getByRole('link', { name: 'UI layout values' })).toHaveAttribute(
    'href',
    `/MLEDocs/versions/${versionId}/reference/ui-layout-values/`,
  );
});

for (const sectionId of orderedSections) {
  test(`${sectionId} sidebar and adjacent pagination follow exact registry identity order`, async ({
    page,
  }) => {
    const section = getNavigationSection(sectionId);
    for (const localePrefix of ['', '/pt-br'] as const) {
      const expectedHrefs = registryRouteSequence(sectionId, localePrefix);
      const sectionPrefix = `/MLEDocs${localePrefix}/versions/${versionId}/${section.segment}/`;

      for (const [index, href] of expectedHrefs.entries()) {
        await page.goto(new URL(href, siteOrigin).toString());
        const sidebarHrefs = await page
          .locator(`#starlight__sidebar a[href^="${sectionPrefix}"]`)
          .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
        expect(sidebarHrefs, `${localePrefix || '/en'} ${sectionId} sidebar at ${href}`).toEqual(
          expectedHrefs,
        );

        if (index > 0) {
          await expect(page.locator('a[rel="prev"]')).toHaveAttribute('href', expectedHrefs[index - 1]);
        }
        if (index < expectedHrefs.length - 1) {
          await expect(page.locator('a[rel="next"]')).toHaveAttribute('href', expectedHrefs[index + 1]);
        }
      }
    }
  });
}

for (const [pageId, slug] of pages.filter(([candidate]) =>
  ['requirements', 'build', 'troubleshooting', 'documentation', 'helper-commands'].includes(
    candidate,
  ),
)) {
  test(`Portuguese ${pageId} request renders exactly one same-commit English fallback`, async ({
    page,
  }) => {
    const route = `/pt-br/versions/${versionId}/${slug}/`;
    const response = await page.goto(pageUrl(route));
    expect(response?.status(), route).toBe(200);
    await expect(page).toHaveURL(pageUrl(route));
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.locator('main')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(pageTitles[pageId]);
    await expect(page.locator('[data-mle-permanent-link]')).toHaveAttribute(
      'href',
      `/MLEDocs${route}`,
    );
    await expect(page.locator('[data-mle-permanent-link]')).toHaveAccessibleName(
      new RegExp(fullCommit),
    );
    const fallback = page.locator('[data-mle-translation-status="fallback"]');
    await expect(fallback).toHaveCount(1);
    await expect(fallback).toHaveText(
      `iEsta página está disponível em inglês para a mesma versão do MLE. Commit fixado: ${versionId}.`,
    );
    await expect(page.locator('[data-mle-source-evidence]')).toHaveCount(1);
  });
}

test('Pagefind discovers all fourteen pages in the active immutable English scope', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto(pageUrl(`/versions/${versionId}/start-here/requirements/`));
  const input = await openSearch(page);

  for (const [pageId, slug] of pages) {
    const href = `/MLEDocs/versions/${versionId}/${slug}/`;
    await input.fill(pageTitles[pageId]);
    const resultLink = page.locator(
      `#starlight__search .pagefind-ui__result-link[href="${href}"]`,
    );
    await expect(resultLink, `Pagefind result for ${pageId}`).toBeVisible({ timeout: 15_000 });
    const result = resultLink.locator(
      'xpath=ancestor::li[contains(concat(" ", normalize-space(@class), " "), " pagefind-ui__result ")][1]',
    );
    await expect(result).toHaveAttribute('data-mle-search-version', versionId);
    await expect(result).toHaveAttribute('data-mle-search-locale', 'en');
  }
});
