import { describe, expect, it } from 'vitest';
import { getCurrentVersion } from '../../src/lib/versions/manifest';
import {
	buildLatestAliases,
	buildRootAlias,
	buildVersionedPageRecords,
	pageRecordsFromContentEntries,
	renderLatestAliasHtml,
	type AliasRoute,
} from '../../src/lib/versions/latest-aliases';
import { currentVersionId, pages } from '../fixtures/pages';

const current = getCurrentVersion();

describe('alias content page records', () => {
	it('derives locale, version, slug, and translation state from Starlight content entries', () => {
		expect(
			pageRecordsFromContentEntries([
				{
					id: 'versions/c1abea3de165',
					data: { contentType: 'homepage' },
				},
				{
					id: 'versions/c1abea3de165/systems/core',
					data: {
						contentType: 'technical',
						pageId: 'core-overview',
						translationStatus: 'canonical',
					},
				},
				{
					id: 'versions/c1abea3de165/systems',
					data: {
						contentType: 'section',
						pageId: 'systems',
						translationStatus: 'canonical',
					},
				},
				{
					id: 'pt-br/versions/c1abea3de165/systems/renderer',
					data: { contentType: 'redirect' },
				},
				{
					id: 'release-notes',
					data: { contentType: 'homepage' },
				},
			]),
		).toEqual([
			{
				pageId: 'overview',
				locale: 'en',
				versionId: 'c1abea3de165',
				slug: '',
				translationStatus: 'canonical',
			},
			{
				pageId: 'core-overview',
				locale: 'en',
				versionId: 'c1abea3de165',
				slug: 'systems/core',
				translationStatus: 'canonical',
			},
			{
				pageId: 'systems',
				locale: 'en',
				versionId: 'c1abea3de165',
				slug: 'systems',
				translationStatus: 'canonical',
			},
			{
				pageId: 'systems/renderer',
				locale: 'pt-br',
				versionId: 'c1abea3de165',
				slug: 'systems/renderer',
				translationStatus: 'fallback',
			},
		]);
	});

	it('derives same-commit locale fallbacks from a reordered two-version model', () => {
		const archived = {
			...current,
			commit: 'dddddddddddddddddddddddddddddddddddddddd',
			id: 'dddddddddddd',
			committedAt: '2026-07-01',
			label: { en: 'Previous', 'pt-br': 'Anterior' },
			status: 'archived',
		} as const;
		const contentEntries = [
				{ id: 'versions/c1abea3de165', data: { contentType: 'homepage' } },
				{
					id: 'versions/c1abea3de165/start-here/project-status',
					data: {
						contentType: 'technical',
						pageId: 'project-status',
						translationStatus: 'canonical',
					},
				},
				{
					id: 'versions/c1abea3de165/systems/renderer',
					data: {
						contentType: 'technical',
						pageId: 'renderer-overview',
						translationStatus: 'canonical',
					},
				},
				{
					id: 'versions/c1abea3de165/systems',
					data: {
						contentType: 'section',
						pageId: 'systems',
						translationStatus: 'canonical',
					},
				},
				{ id: 'pt-br/versions/c1abea3de165', data: { contentType: 'homepage' } },
				{ id: 'versions/dddddddddddd', data: { contentType: 'homepage' } },
				{
					id: 'versions/dddddddddddd/reference/legacy',
					data: {
						contentType: 'technical',
						pageId: 'legacy-only',
						translationStatus: 'canonical',
					},
				},
			] as const;
		const records = buildVersionedPageRecords(contentEntries, [archived, current]);
		expect(records).toEqual(buildVersionedPageRecords(contentEntries, [current, archived]));

		expect(
			records
				.filter(({ locale, versionId }) => locale === 'pt-br' && versionId === current.id)
				.map(({ pageId, slug, translationStatus }) => ({ pageId, slug, translationStatus })),
		).toEqual([
			{ pageId: 'overview', slug: '', translationStatus: 'current' },
			{ pageId: 'project-status', slug: 'start-here/project-status', translationStatus: 'fallback' },
			{ pageId: 'systems', slug: 'systems', translationStatus: 'fallback' },
			{ pageId: 'renderer-overview', slug: 'systems/renderer', translationStatus: 'fallback' },
		]);

		const aliases = buildLatestAliases(current, records).filter(({ locale }) => locale === 'pt-br');
		expect(aliases.map(({ slug }) => slug)).toEqual([
			'',
			'start-here/project-status',
			'systems',
			'systems/renderer',
		]);
		expect(aliases.every(({ destination }) => destination.includes(`/versions/${current.id}/`))).toBe(
			true,
		);
		expect(aliases.every(({ destination }) => !destination.includes(archived.id))).toBe(true);
	});
});

describe('latest documentation aliases', () => {
	it('builds locale roots from current overview identities without a hardcoded commit', () => {
		expect(buildRootAlias(current, pages, 'en')).toEqual({
			locale: 'en',
			slug: '',
			destination: '/MLEDocs/versions/c1abea3de165/',
			canonical: '/MLEDocs/versions/c1abea3de165/',
		});
		expect(buildRootAlias(current, pages, 'pt-br')).toEqual({
			locale: 'pt-br',
			slug: '',
			destination: '/MLEDocs/pt-br/versions/c1abea3de165/',
			canonical: '/MLEDocs/pt-br/versions/c1abea3de165/',
		});
	});

	it('builds one base-aware commit alias for every current English page', () => {
		const aliases = buildLatestAliases(current, pages).filter(({ locale }) => locale === 'en');

		expect(aliases).toEqual([
			{
				locale: 'en',
				slug: '',
				destination: '/MLEDocs/versions/c1abea3de165/',
				canonical: '/MLEDocs/versions/c1abea3de165/',
			},
			{
				locale: 'en',
				slug: 'systems/core',
				destination: '/MLEDocs/versions/c1abea3de165/systems/core/',
				canonical: '/MLEDocs/versions/c1abea3de165/systems/core/',
			},
			{
				locale: 'en',
				slug: 'systems/renderer',
				destination: '/MLEDocs/versions/c1abea3de165/systems/renderer/',
				canonical: '/MLEDocs/versions/c1abea3de165/systems/renderer/',
			},
		]);
		expect(aliases.every(({ canonical }) => canonical.includes(currentVersionId))).toBe(true);
		expect(aliases.every(({ canonical }) => !canonical.includes('latest'))).toBe(true);
	});

	it('emits Portuguese aliases only for physical pages and explicit same-version fallbacks', () => {
		const fallbackPage = {
			pageId: 'renderer-overview',
			locale: 'pt-br',
			versionId: currentVersionId,
			slug: 'sistemas/renderizador',
			translationStatus: 'fallback',
		} as const;

		const aliases = buildLatestAliases(current, [...pages, fallbackPage]).filter(
			({ locale }) => locale === 'pt-br',
		);

		expect(aliases.map(({ slug }) => slug)).toEqual([
			'',
			'sistemas/nucleo',
			'sistemas/renderizador',
		]);
		expect(aliases.some(({ slug }) => slug === 'systems/renderer')).toBe(false);
		expect(aliases.at(-1)?.destination).toBe(
			'/MLEDocs/pt-br/versions/c1abea3de165/sistemas/renderizador/',
		);
	});

	it('ignores archived pages and sorts reproducibly by locale then normalized slug', () => {
		const aliases = buildLatestAliases(current, [...pages].reverse());

		expect(aliases.map(({ locale, slug }) => `${locale}:${slug}`)).toEqual([
			'en:',
			'en:systems/core',
			'en:systems/renderer',
			'pt-br:',
			'pt-br:sistemas/nucleo',
		]);
		expect(aliases.some(({ slug }) => slug === 'reference/legacy')).toBe(false);
	});

	it('rejects two current pages that normalize to the same alias path', () => {
		expect(() =>
			buildLatestAliases(current, [
				pages[2],
				{
					...pages[4],
					slug: '/systems/core/',
				},
			]),
		).toThrow(/Duplicate latest alias.*en.*systems\/core/i);
	});
});

describe('latest alias HTML', () => {
	it('renders an immediate noindex redirect with escaped canonical and destination URLs', () => {
		const route: AliasRoute = {
			locale: 'en',
			slug: 'unsafe',
			destination: '/MLEDocs/versions/c1abea3de165/</script><img src=x onerror=alert(1)>"&\'/',
			canonical: '/MLEDocs/versions/c1abea3de165/"canonical&/',
		};

		const html = renderLatestAliasHtml(route);

		expect(html).toContain('<meta charset="utf-8">');
		expect(html).toContain('<meta name="robots" content="noindex">');
		expect(html).toContain('<meta http-equiv="refresh" content="0; url=/MLEDocs/versions/');
		expect(html).toContain('<link rel="canonical" href="/MLEDocs/versions/');
		expect(html).toContain('location.replace(');
		expect(html).toContain('<a href="/MLEDocs/versions/');
		expect(html).toContain('&quot;canonical&amp;');
		expect(html).toContain('&lt;/script&gt;&lt;img');
		expect(html).toContain('\\u003c/script>\\u003cimg');
		expect(html).not.toContain('</script><img');
	});

	it('localizes the visible fallback link for Portuguese readers', () => {
		const html = renderLatestAliasHtml({
			locale: 'pt-br',
			slug: '',
			destination: '/MLEDocs/pt-br/versions/c1abea3de165/',
			canonical: '/MLEDocs/pt-br/versions/c1abea3de165/',
		});

		expect(html).toContain('<html lang="pt-BR">');
		expect(html).toContain('Redirecionando para a versão permanente da documentação.');
		expect(html).toContain('Continuar para a documentação permanente');
	});
});
