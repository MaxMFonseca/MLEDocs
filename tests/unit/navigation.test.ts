import { describe, expect, expectTypeOf, it } from 'vitest';
import type { StarlightRouteData } from '@astrojs/starlight/route-data';
import {
	buildSectionIndexModel,
	buildVersionedSidebar,
	filterVersionedSidebarByLocale,
	getNavigationSection,
	navigationSections,
	type NavigationSection,
	validateNavigationSections,
} from '../../src/data/navigation';
import type { VersionEntry } from '../../src/data/versions';
import type { PageRecord } from '../../src/lib/content/page-index';

const currentVersion = {
	commit: 'c1abea3de165032fe064300340807b7a6af388f8',
	id: 'c1abea3de165',
	committedAt: '2026-08-18',
	label: { en: 'Current', 'pt-br': 'Atual' },
	status: 'current',
	locales: ['en', 'pt-br'],
	repositoryUrl: 'https://github.com/MaxMFonseca/MLE',
	corrections: [],
} as const satisfies VersionEntry;

const archivedVersion = {
	commit: 'dddddddddddddddddddddddddddddddddddddddd',
	id: 'dddddddddddd',
	committedAt: '2026-07-01',
	label: { en: 'Previous', 'pt-br': 'Anterior' },
	status: 'archived',
	locales: ['en', 'pt-br'],
	repositoryUrl: 'https://github.com/MaxMFonseca/MLE',
	corrections: [],
} as const satisfies VersionEntry;

const englishOnlyArchivedVersion = {
	...archivedVersion,
	locales: ['en'],
} as const satisfies VersionEntry;

const page = (
	versionId: string,
	locale: PageRecord['locale'],
	pageId: string,
	slug: string,
	translationStatus: PageRecord['translationStatus'],
): PageRecord => ({ versionId, locale, pageId, slug, translationStatus });

type ResolvedSidebar = StarlightRouteData['sidebar'];

const resolvedSectionLabels = [
	'Start Here',
	'Concepts',
	'Engine Systems',
	'Practical Guides',
	'Reference',
	'Tools and Test Applications',
	'Contributing',
] as const;

const resolvedVersionGroup = (label: string): ResolvedSidebar[number] => ({
	type: 'group',
	label,
	entries: resolvedSectionLabels.map((sectionLabel) => ({
		type: 'group',
		label: sectionLabel,
		entries: [],
		collapsed: false,
		badge: undefined,
	})),
	collapsed: false,
	badge: undefined,
});

const independentResolvedGroup = {
	type: 'group',
	label: 'Independent navigation',
	entries: [],
	collapsed: false,
	badge: undefined,
} as const satisfies ResolvedSidebar[number];

describe('navigation section registry', () => {
	it('limits public section segments to the seven approved route values', () => {
		expectTypeOf<NavigationSection['segment']>().toEqualTypeOf<
			| 'start-here'
			| 'concepts'
			| 'systems'
			| 'guides'
			| 'reference'
			| 'tools'
			| 'contributing'
		>();
	});

	it('keeps the seven stable identities, localized labels, order, and accents exact', () => {
		expect(
			navigationSections.map(({ pageId, segment, order, accent, labels }) => ({
				pageId,
				segment,
				order,
				accent,
				labels,
			})),
		).toEqual([
			{ pageId: 'start', segment: 'start-here', order: 1, accent: 'core', labels: { en: 'Start Here', 'pt-br': 'Comece aqui' } },
			{ pageId: 'concepts', segment: 'concepts', order: 2, accent: 'core', labels: { en: 'Concepts', 'pt-br': 'Conceitos' } },
			{ pageId: 'systems', segment: 'systems', order: 3, accent: 'renderer', labels: { en: 'Engine Systems', 'pt-br': 'Sistemas do motor' } },
			{ pageId: 'guides', segment: 'guides', order: 4, accent: 'tools', labels: { en: 'Practical Guides', 'pt-br': 'Guias práticos' } },
			{ pageId: 'reference', segment: 'reference', order: 5, accent: 'lua-ui', labels: { en: 'Reference', 'pt-br': 'Referência' } },
			{ pageId: 'tools', segment: 'tools', order: 6, accent: 'tools', labels: { en: 'Tools and Test Applications', 'pt-br': 'Ferramentas e aplicativos de teste' } },
			{ pageId: 'contributing', segment: 'contributing', order: 7, accent: 'audio', labels: { en: 'Contributing', 'pt-br': 'Como contribuir' } },
		]);
	});

	it('keeps localized summaries and audience guidance substantive and distinct', () => {
		for (const section of navigationSections) {
			expect(section.summaries.en.trim().length).toBeGreaterThan(20);
			expect(section.summaries['pt-br'].trim().length).toBeGreaterThan(20);
			expect(section.summaries.en).not.toBe(section.summaries['pt-br']);
			expect(section.audienceGuidance.en.trim().length).toBeGreaterThan(20);
			expect(section.audienceGuidance['pt-br'].trim().length).toBeGreaterThan(20);
			expect(section.audienceGuidance.en).not.toBe(section.audienceGuidance['pt-br']);
		}
	});

	it('rejects duplicate page IDs, route segments, and order values deterministically', () => {
		const [first, second, ...rest] = navigationSections;
		expect(first).toBeDefined();
		expect(second).toBeDefined();
		const invalid = [
			first,
			{ ...second, pageId: first.pageId, segment: first.segment, order: first.order },
			...rest,
		];

		expect(validateNavigationSections(invalid)).toEqual([
			'Duplicate navigation order 1 appears for start and start.',
			'Duplicate navigation pageId start.',
			'Duplicate navigation segment start-here appears for start and start.',
		]);
	});

	it('records every approved roadmap child under a stable page ID', () => {
		const childIds = Object.fromEntries(
			navigationSections.map((section) => [
				section.pageId,
				section.plannedGroups.flatMap((group) => group.children.map((child) => child.pageId)),
			]),
		);

		expect(childIds).toEqual({
			start: ['project-status', 'requirements', 'setup', 'build', 'tests', 'client', 'repository-tour', 'troubleshooting'],
			concepts: ['architecture', 'lifecycle', 'ownership-lifetimes', 'results-errors', 'threading-synchronization'],
			systems: ['core', 'math', 'utilities', 'renderer-overview', 'models-animation', 'lua-ui', 'audio', 'window-input', 'experimental-server'],
			guides: ['build-workflow', 'first-frame', 'lua-ui-guide', 'audio-guide', 'assets-shaders', 'debugging'],
			reference: ['build-options', 'helper-commands', 'core-math-utility-types', 'renderer-reference', 'lua-binding-inventory', 'ui-keys', 'audio-commands'],
			tools: ['core-suite', 'interactive-client', 'resource-demonstrations', 'mlecubes'],
			contributing: ['contributor-environment', 'contributor-testing', 'resources-shaders', 'documentation', 'translations'],
		});
	});

	it('looks up sections by stable page ID without translating identity', () => {
		const systems = getNavigationSection('systems');
		expect(systems.segment).toBe('systems');
		expect(systems.labels).toEqual({ en: 'Engine Systems', 'pt-br': 'Sistemas do motor' });
	});
});

describe('versioned snapshot sidebar', () => {
	it('removes an English-only version tree from the resolved Portuguese sidebar', () => {
		const resolvedSidebar = [
			resolvedVersionGroup('c1abea3de165 · 2026-08-18 · atual'),
			resolvedVersionGroup('dddddddddddd · 2026-07-01 · archived'),
			independentResolvedGroup,
		];

		const portuguese = filterVersionedSidebarByLocale(
			resolvedSidebar,
			[currentVersion, englishOnlyArchivedVersion],
			'pt-br',
		);

		expect(portuguese.map((entry) => entry.label)).toEqual([
			'c1abea3de165 · 2026-08-18 · atual',
			'Independent navigation',
		]);
		expect(portuguese[0]?.type).toBe('group');
		if (portuguese[0]?.type !== 'group') throw new Error('expected current version group');
		expect(portuguese[0].entries.map((entry) => entry.label)).toEqual(resolvedSectionLabels);
	});

	it('keeps all version trees and unrelated entries in the resolved English sidebar', () => {
		const resolvedSidebar = [
			resolvedVersionGroup('c1abea3de165 · 2026-08-18 · current'),
			resolvedVersionGroup('dddddddddddd · 2026-07-01 · archived'),
			independentResolvedGroup,
		];

		expect(
			filterVersionedSidebarByLocale(
				resolvedSidebar,
				[currentVersion, englishOnlyArchivedVersion],
				'en',
			).map((entry) => entry.label),
		).toEqual([
			'c1abea3de165 · 2026-08-18 · current',
			'dddddddddddd · 2026-07-01 · archived',
			'Independent navigation',
		]);
	});

	it('is deterministic when a two-version manifest is reordered', () => {
		const currentFirst = buildVersionedSidebar([currentVersion, archivedVersion]);
		const archivedFirst = buildVersionedSidebar([archivedVersion, currentVersion]);

		expect(archivedFirst).toEqual(currentFirst);
		expect(currentFirst.map(({ label }) => label)).toEqual([
			'c1abea3de165 · 2026-08-18 · current',
			'dddddddddddd · 2026-07-01 · archived',
		]);
		expect(currentFirst.map(({ translations }) => translations['pt-BR'])).toEqual([
			'c1abea3de165 · 2026-08-18 · atual',
			'dddddddddddd · 2026-07-01 · arquivada',
		]);
	});

	it('keeps all seven generated section trees inside their owning snapshot', () => {
		const sidebar = buildVersionedSidebar([archivedVersion, currentVersion]);
		const segments = ['start-here', 'concepts', 'systems', 'guides', 'reference', 'tools', 'contributing'];

		for (const group of sidebar) {
			const versionId = group.label.slice(0, 12);
			expect(group.items.map((section) => section.label)).toEqual([
				'Start Here',
				'Concepts',
				'Engine Systems',
				'Practical Guides',
				'Reference',
				'Tools and Test Applications',
				'Contributing',
			]);
			expect(group.items.map((section) => section.translations['pt-BR'])).toEqual([
				'Comece aqui',
				'Conceitos',
				'Sistemas do motor',
				'Guias práticos',
				'Referência',
				'Ferramentas e aplicativos de teste',
				'Como contribuir',
			]);
			expect(
				group.items.flatMap((section) => section.items.map((item) => item.autogenerate.directory)),
			).toEqual(segments.map((segment) => `versions/${versionId}/${segment}`));
		}
	});
});

describe('section index model', () => {
	const pages = [
		page(currentVersion.id, 'en', 'systems', 'systems', 'canonical'),
		page(currentVersion.id, 'pt-br', 'systems', 'systems', 'current'),
		page(currentVersion.id, 'en', 'renderer-overview', 'systems/renderer', 'canonical'),
		page(currentVersion.id, 'pt-br', 'renderer-overview', 'systems/renderer', 'fallback'),
		page(archivedVersion.id, 'en', 'systems', 'systems', 'canonical'),
		page(archivedVersion.id, 'pt-br', 'systems', 'systems', 'current'),
		page(archivedVersion.id, 'en', 'core', 'systems/core', 'canonical'),
		page(archivedVersion.id, 'pt-br', 'core', 'systems/core', 'fallback'),
	] as const;

	it('derives available rows only from the requested snapshot and same-commit fallback records', () => {
		const current = buildSectionIndexModel({
			sectionId: 'systems',
			version: currentVersion,
			locale: 'pt-br',
			pages: [...pages].reverse(),
		});
		const archived = buildSectionIndexModel({
			sectionId: 'systems',
			version: archivedVersion,
			locale: 'pt-br',
			pages,
		});

		expect(current.available.map(({ pageId, href, translationStatus }) => ({ pageId, href, translationStatus }))).toEqual([
			{
				pageId: 'renderer-overview',
				href: '/MLEDocs/pt-br/versions/c1abea3de165/systems/renderer/',
				translationStatus: 'fallback',
			},
		]);
		expect(archived.available.map(({ pageId, href, translationStatus }) => ({ pageId, href, translationStatus }))).toEqual([
			{
				pageId: 'core',
				href: '/MLEDocs/pt-br/versions/dddddddddddd/systems/core/',
				translationStatus: 'fallback',
			},
		]);
		expect(current.available.every(({ href }) => !href.includes(archivedVersion.id))).toBe(true);
		expect(archived.available.every(({ href }) => !href.includes(currentVersion.id))).toBe(true);
	});

	it('localizes labels while preserving stable section and child identities', () => {
		const english = buildSectionIndexModel({ sectionId: 'systems', version: currentVersion, locale: 'en', pages });
		const portuguese = buildSectionIndexModel({ sectionId: 'systems', version: currentVersion, locale: 'pt-br', pages });

		expect(english.section.pageId).toBe('systems');
		expect(portuguese.section.pageId).toBe('systems');
		expect(english.section.segment).toBe('systems');
		expect(portuguese.section.segment).toBe('systems');
		expect(english.available.map(({ pageId }) => pageId)).toEqual(['renderer-overview']);
		expect(portuguese.available.map(({ pageId }) => pageId)).toEqual(['renderer-overview']);
		expect(english.available[0]?.label).toBe('Renderer');
		expect(portuguese.available[0]?.label).toBe('Renderer');
	});

	it('keeps missing roadmap children non-interactive', () => {
		const model = buildSectionIndexModel({ sectionId: 'systems', version: currentVersion, locale: 'en', pages });
		const planned = model.plannedGroups.flatMap((group) => group.children);

		expect(planned.length).toBeGreaterThan(0);
		expect(planned.some(({ pageId }) => pageId === 'core')).toBe(true);
		expect(planned.every((item) => !('href' in item))).toBe(true);
	});

	it('throws a deterministic registry/page mismatch when the physical locale hub is missing', () => {
		expect(() =>
			buildSectionIndexModel({
				sectionId: 'systems',
				version: currentVersion,
				locale: 'pt-br',
				pages: pages.filter((record) => !(record.pageId === 'systems' && record.locale === 'pt-br' && record.versionId === currentVersion.id)),
			}),
		).toThrow(
			'Navigation section systems has no physical pt-br hub for version c1abea3de165 at systems.',
		);
	});
});
