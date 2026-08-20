import { describe, expect, it } from 'vitest';
import { navigationSections } from '../../src/data/navigation';
import type { VersionEntry } from '../../src/data/versions';
import { buildBreadcrumbModel } from '../../src/lib/navigation/breadcrumbs';
import { parseDocumentationRoute } from '../../src/lib/navigation/route-context';

const current: VersionEntry = {
	commit: 'c1abea3de165032fe064300340807b7a6af388f8',
	id: 'c1abea3de165',
	committedAt: '2026-08-18',
	label: { en: 'Current', 'pt-br': 'Atual' },
	status: 'current',
	locales: ['en', 'pt-br'],
	repositoryUrl: 'https://github.com/MaxMFonseca/MLE',
	corrections: [],
};

const archived: VersionEntry = {
	...current,
	commit: 'aaaaaaaaaaaabbbbbbbbbbbbbbbbbbbbbbbbbbbb',
	id: 'aaaaaaaaaaaa',
	committedAt: '2025-01-01',
	label: { en: 'Archived', 'pt-br': 'Arquivada' },
	status: 'archived',
};

describe('version-aware breadcrumb model', () => {
	it('keeps the English renderer hierarchy inside its permanent commit', () => {
		const model = buildBreadcrumbModel({
			route: parseDocumentationRoute('versions/c1abea3de165/systems/renderer', 'en'),
			pageId: 'renderer-overview',
			pageTitle: 'Renderer',
			versions: [current],
			sections: navigationSections,
		});

		expect(model).toEqual([
			{ label: 'English', href: '/MLEDocs/versions/c1abea3de165/' },
			{ label: 'c1abea3de165', href: '/MLEDocs/versions/c1abea3de165/', title: current.commit },
			{ label: 'Engine Systems', href: '/MLEDocs/versions/c1abea3de165/systems/' },
			{ label: 'Renderer', current: true },
		]);
	});

	it('keeps exact Portuguese and same-commit fallback renderer breadcrumbs in requested Portuguese', () => {
		const model = buildBreadcrumbModel({
			route: parseDocumentationRoute('pt-br/versions/c1abea3de165/systems/renderer', 'pt-br'),
			pageId: 'renderer-overview',
			pageTitle: 'Renderer',
			versions: [current],
			sections: navigationSections,
		});

		expect(model).toEqual([
			{ label: 'Português (Brasil)', href: '/MLEDocs/pt-br/versions/c1abea3de165/' },
			{ label: 'c1abea3de165', href: '/MLEDocs/pt-br/versions/c1abea3de165/', title: current.commit },
			{ label: 'Sistemas do motor', href: '/MLEDocs/pt-br/versions/c1abea3de165/systems/' },
			{ label: 'Renderer', current: true },
		]);
	});

	it('makes a section hub the current breadcrumb and omits its duplicate link', () => {
		expect(
			buildBreadcrumbModel({
				route: parseDocumentationRoute('versions/c1abea3de165/systems', 'en'),
				pageId: 'systems',
				pageTitle: 'Engine Systems',
				versions: [current],
				sections: navigationSections,
			}),
		).toEqual([
			{ label: 'English', href: '/MLEDocs/versions/c1abea3de165/' },
			{ label: 'c1abea3de165', href: '/MLEDocs/versions/c1abea3de165/', title: current.commit },
			{ label: 'Engine Systems', current: true },
		]);
	});

	it('keeps a versioned homepage to a non-linking locale and current-commit context', () => {
		expect(
			buildBreadcrumbModel({
				route: parseDocumentationRoute('versions/c1abea3de165', 'en'),
				pageId: 'overview',
				pageTitle: 'MLE documentation',
				versions: [current],
				sections: navigationSections,
			}),
		).toEqual([
			{ label: 'English' },
			{ label: 'c1abea3de165', title: current.commit, current: true },
		]);
	});

	it('resolves an archived non-systems section by stable identities despite reversed fixtures', () => {
		const reversedSections = [...navigationSections].reverse();
		const model = buildBreadcrumbModel({
			route: parseDocumentationRoute('pt-br/versions/aaaaaaaaaaaa/guides/build-workflow', 'pt-br'),
			pageId: 'build-workflow',
			pageTitle: 'Build workflow',
			versions: [archived, current],
			sections: reversedSections,
		});

		expect(model).toEqual([
			{ label: 'Português (Brasil)', href: '/MLEDocs/pt-br/versions/aaaaaaaaaaaa/' },
			{ label: 'aaaaaaaaaaaa', href: '/MLEDocs/pt-br/versions/aaaaaaaaaaaa/', title: archived.commit },
			{ label: 'Guias práticos', href: '/MLEDocs/pt-br/versions/aaaaaaaaaaaa/guides/' },
			{ label: 'Build workflow', current: true },
		]);
	});

	it('never substitutes current-version paths for an archived or unknown version', () => {
		const archivedModel = buildBreadcrumbModel({
			route: parseDocumentationRoute('pt-br/versions/aaaaaaaaaaaa/systems/renderer', 'pt-br'),
			pageId: 'renderer-overview',
			pageTitle: 'Renderer',
			versions: [current, archived],
			sections: navigationSections,
		});
		expect(archivedModel.map((item) => item.href).filter(Boolean)).toEqual([
			'/MLEDocs/pt-br/versions/aaaaaaaaaaaa/',
			'/MLEDocs/pt-br/versions/aaaaaaaaaaaa/',
			'/MLEDocs/pt-br/versions/aaaaaaaaaaaa/systems/',
		]);

		expect(
			buildBreadcrumbModel({
				route: parseDocumentationRoute('versions/ffffffffffff/systems/renderer', 'en'),
				pageId: 'renderer-overview',
				pageTitle: 'Renderer',
				versions: [current],
				sections: navigationSections,
			}),
		).toEqual([]);
	});

	it('returns no hierarchy for root, latest alias, or unrelated 404 routes', () => {
		for (const route of [
			parseDocumentationRoute('', 'en'),
			parseDocumentationRoute('latest/systems/renderer', 'en'),
			parseDocumentationRoute('not-found', 'en'),
		]) {
			expect(
				buildBreadcrumbModel({
					route,
					pageTitle: 'Page not found',
					versions: [current],
					sections: navigationSections,
				}),
			).toEqual([]);
		}
	});
});
