import { expect, test } from '@playwright/test';

const siteOrigin = process.env.MLE_DOCS_E2E_ORIGIN ?? 'http://127.0.0.1:4321';
const versionId = 'c1abea3de165';
const fullCommit = 'c1abea3de165032fe064300340807b7a6af388f8';

function pageUrl(path: string): string {
  return new URL(`/MLEDocs${path}`, siteOrigin).toString();
}

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
