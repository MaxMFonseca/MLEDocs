import { describe, expect, expectTypeOf, it } from 'vitest';
import type { StarlightRouteData } from '@astrojs/starlight/route-data';
import {
	buildSidebarPagination,
	buildHandbookNavigationGroups,
	buildSectionIndexModel,
	buildVersionedSidebar,
	filterVersionedSidebarByLocale,
	flattenSingletonSidebarGroups,
	getNavigationSection,
	navigationSections,
	orderVersionedSidebarByRegistry,
	type NavigationSection,
	validateNavigationSections,
} from '../../src/data/navigation';
import { handbookGroups, handbookPages } from '../../src/data/handbook';
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

const resolvedLink = (label: string, href: string, isCurrent = false): ResolvedSidebar[number] => ({
	type: 'link',
	label,
	href,
	isCurrent,
	badge: undefined,
	attrs: {},
});

const registryPageIds = (sectionId: NavigationSection['pageId']): readonly string[] => {
	const section = getNavigationSection(sectionId);
	return [
		section.pageId,
		...section.plannedGroups.flatMap((navigationGroup) =>
			navigationGroup.children.map((navigationChild) => navigationChild.pageId),
		),
	];
};

const registryHrefs = (sectionId: NavigationSection['pageId']): readonly string[] => {
	const section = getNavigationSection(sectionId);
	return registryPageIds(sectionId).map((pageId) => {
		if (pageId === section.pageId) return `/MLEDocs/versions/${currentVersion.id}/${section.segment}/`;
		const handbookPage = handbookPages.find((page) => page.pageId === pageId);
		const slug = handbookPage?.slug ?? `${section.segment}/${pageId}`;
		return `/MLEDocs/versions/${currentVersion.id}/${slug}/`;
	});
};

const alphabetizedResolvedSection = (
	sectionId: NavigationSection['pageId'],
	currentPageId?: string,
): ResolvedSidebar[number] => {
	const section = getNavigationSection(sectionId);
	const links = registryPageIds(sectionId)
		.map((pageId, index) => {
			const href = registryHrefs(sectionId)[index]!;
			return resolvedLink(pageId, href, pageId === currentPageId);
		})
		.sort((left, right) => left.label.localeCompare(right.label));

	return {
		type: 'group',
		label: section.labels.en,
		entries: links,
		collapsed: false,
		badge: undefined,
	};
};

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

	it('derives every handbook navigation child from the single ordered registry', () => {
		const registeredBySection = Object.fromEntries(
			navigationSections.map((section) => [
				section.pageId,
				section.plannedGroups.flatMap((group) => group.children.map((child) => child.pageId)),
			]),
		);

		for (const page of handbookPages) {
			expect(registeredBySection[page.sectionId]).toContain(page.pageId);
		}
		expect(new Set(Object.values(registeredBySection).flat()).size).toBe(
			Object.values(registeredBySection).flat().length,
		);
	});

	it('keeps handbook overview pages first and isolates UI deep pages in their registry group', () => {
		const uiGroups = buildHandbookNavigationGroups('ui', handbookGroups, 'en');
		expect(uiGroups.find(({ id }) => id === 'ui-system')?.children[0]?.pageId).toBe('ui');
		expect(uiGroups.flatMap((group) => group.children)
			.filter(({ pageId }) => handbookPages.find((page) => page.pageId === pageId)?.emphasis === 'deep')
			.every(({ pageId }) => handbookPages.find((page) => page.pageId === pageId)?.subsystem === 'ui')).toBe(true);
	});

	it('resolves handbook navigation independently of input array order', () => {
		const expected = buildHandbookNavigationGroups('ui', handbookGroups, 'pt-br');
		const reversed = buildHandbookNavigationGroups(
			'ui',
			[...handbookGroups].reverse().map((group) => ({ ...group, pages: [...group.pages].reverse() })),
			'pt-br',
		);
		expect(reversed).toEqual(expected);
	});

	it('looks up sections by stable page ID without translating identity', () => {
		const systems = getNavigationSection('systems');
		expect(systems.segment).toBe('systems');
		expect(systems.labels).toEqual({ en: 'Engine Systems', 'pt-br': 'Sistemas do motor' });
	});
});

describe('versioned snapshot sidebar', () => {
	it('flattens one-link autogenerated folders without removing meaningful groups or changing pagination', () => {
		const architecture = resolvedLink(
			'Architecture',
			`/MLEDocs/versions/${currentVersion.id}/concepts/architecture/`,
			true,
		);
		const rendererOverview = resolvedLink(
			'Renderer',
			`/MLEDocs/versions/${currentVersion.id}/systems/renderer/`,
		);
		const rendererQueues = resolvedLink(
			'Frame, Vulkan, and queues',
			`/MLEDocs/versions/${currentVersion.id}/systems/renderer/frame-vulkan-and-queues/`,
		);
		const audioFlow = resolvedLink(
			'Audio and Client flow',
			`/MLEDocs/versions/${currentVersion.id}/guides/audio-and-client-flow/`,
		);
		const sidebar: ResolvedSidebar = [{
			type: 'group',
			label: 'Current version',
			entries: [{
				type: 'group',
				label: 'Documentation',
				entries: [
					{
						type: 'group',
						label: 'architecture',
						entries: [architecture],
						collapsed: false,
						badge: undefined,
					},
					{
						type: 'group',
						label: 'Renderer',
						entries: [rendererOverview, rendererQueues],
						collapsed: false,
						badge: undefined,
					},
					audioFlow,
				],
				collapsed: false,
				badge: undefined,
			}],
			collapsed: false,
			badge: undefined,
		}];

		const flattened = flattenSingletonSidebarGroups(sidebar);
		const versionGroup = flattened[0];
		if (versionGroup?.type !== 'group') throw new Error('expected version group');
		const documentationGroup = versionGroup.entries[0];
		if (documentationGroup?.type !== 'group') throw new Error('expected documentation group');

		expect(documentationGroup.entries.map((entry) => entry.label)).toEqual([
			'Architecture',
			'Renderer',
			'Audio and Client flow',
		]);
		expect(documentationGroup.entries[1]).toEqual(expect.objectContaining({
			type: 'group',
			entries: [rendererOverview, rendererQueues],
		}));
		expect(buildSidebarPagination(flattened)).toEqual(buildSidebarPagination(sidebar));
	});

	it('orders nested autogenerated UI page groups by registry identity without moving unrelated groups', () => {
		const nestedPageGroup = (pageId: string): ResolvedSidebar[number] => {
			const handbookPage = handbookPages.find((page) => page.pageId === pageId);
			if (!handbookPage) throw new Error(`missing handbook page ${pageId}`);
			return {
				type: 'group',
				label: pageId,
				entries: [resolvedLink(pageId, `/MLEDocs/versions/${currentVersion.id}/${handbookPage.slug}/`)],
				collapsed: false,
				badge: undefined,
			};
		};
		const unrelatedNestedGroup = {
			type: 'group',
			label: 'Generated notes',
			entries: [resolvedLink('Notes', `/MLEDocs/versions/${currentVersion.id}/systems/generated-notes/`)],
			collapsed: false,
			badge: undefined,
		} as const satisfies ResolvedSidebar[number];
		const systems = getNavigationSection('systems');
		const sidebar: ResolvedSidebar = [{
			type: 'group',
			label: 'c1abea3de165 · 2026-08-18 · current',
			entries: [{
				type: 'group',
				label: systems.labels.en,
				entries: [
					resolvedLink('UI', `/MLEDocs/versions/${currentVersion.id}/systems/ui/`),
					nestedPageGroup('entities-hierarchy-and-layout'),
					unrelatedNestedGroup,
					nestedPageGroup('ui-events-and-callbacks'),
					nestedPageGroup('rendering-and-visuals'),
					nestedPageGroup('text-input-and-focus'),
				],
				collapsed: false,
				badge: undefined,
			}],
			collapsed: false,
			badge: undefined,
		}];

		const ordered = orderVersionedSidebarByRegistry(sidebar, [currentVersion], 'en');
		const versionGroup = ordered[0];
		if (versionGroup?.type !== 'group') throw new Error('expected version group');
		const systemsGroup = versionGroup.entries[0];
		if (systemsGroup?.type !== 'group') throw new Error('expected systems group');
		expect(systemsGroup.entries.map((entry) => entry.label)).toEqual([
			'UI',
			'entities-hierarchy-and-layout',
			'Generated notes',
			'rendering-and-visuals',
			'text-input-and-focus',
			'ui-events-and-callbacks',
		]);
		expect(systemsGroup.entries[2]).toEqual(unrelatedNestedGroup);
	});

	it('orders every handbook section by registry identity and keeps pagination adjacent to the ordered links', () => {
		for (const sectionId of ['concepts', 'systems', 'guides', 'reference', 'tools'] as const) {
			const pageIds = registryPageIds(sectionId);
			const currentPageId = pageIds.at(-1);
			const sidebar: ResolvedSidebar = [{
				type: 'group',
				label: 'c1abea3de165 · 2026-08-18 · current',
				entries: [alphabetizedResolvedSection(sectionId, currentPageId)],
				collapsed: false,
				badge: undefined,
			}];
			const ordered = orderVersionedSidebarByRegistry(sidebar, [currentVersion], 'en');
			const versionGroup = ordered[0];
			if (versionGroup?.type !== 'group') throw new Error('expected version group');
			const sectionGroup = versionGroup.entries[0];
			if (sectionGroup?.type !== 'group') throw new Error('expected section group');
			const hrefs = sectionGroup.entries
				.filter((entry) => entry.type === 'link')
				.map((entry) => entry.href);

			expect(hrefs).toEqual(registryHrefs(sectionId));
			expect(buildSidebarPagination(ordered)).toEqual({
				prev: expect.objectContaining({ href: registryHrefs(sectionId).at(-2) }),
				next: undefined,
			});
		}
	});

	it('orders Start Here and Contributing links by registry identity and derives matching pagination', () => {
		const unrelatedSection = {
			type: 'group',
			label: 'Concepts',
			entries: [resolvedLink('Architecture', `/MLEDocs/versions/${currentVersion.id}/concepts/architecture/`)],
			collapsed: false,
			badge: undefined,
		} as const satisfies ResolvedSidebar[number];
		const resolvedSidebar: ResolvedSidebar = [
			{
				type: 'group',
				label: 'c1abea3de165 · 2026-08-18 · current',
				entries: [
					alphabetizedResolvedSection('start', 'tests'),
					unrelatedSection,
					alphabetizedResolvedSection('contributing'),
				],
				collapsed: false,
				badge: undefined,
			},
			independentResolvedGroup,
		];

		const ordered = orderVersionedSidebarByRegistry(resolvedSidebar, [currentVersion], 'en');
		const versionGroup = ordered.find(
			(entry) => entry.label === 'c1abea3de165 · 2026-08-18 · current',
		);
		expect(versionGroup?.type).toBe('group');
		if (versionGroup?.type !== 'group') throw new Error('expected current version group');
		const linkHrefs = (label: string): readonly string[] => {
			const sectionGroup = versionGroup.entries.find(
				(entry) => entry.type === 'group' && entry.label === label,
			);
			if (sectionGroup?.type !== 'group') throw new Error(`expected ${label} section group`);
			return sectionGroup.entries
				.filter((entry) => entry.type === 'link')
				.map((entry) => entry.href);
		};

		expect(linkHrefs(getNavigationSection('start').labels.en)).toEqual(registryHrefs('start'));
		expect(linkHrefs(getNavigationSection('contributing').labels.en)).toEqual(
			registryHrefs('contributing'),
		);
		expect(versionGroup.entries.find((entry) => entry.label === 'Concepts')).toEqual(
			unrelatedSection,
		);
		expect(ordered.find((entry) => entry.label === 'Independent navigation')).toEqual(
			independentResolvedGroup,
		);

		const expectedStartHrefs = registryHrefs('start');
		const currentIndex = registryPageIds('start').indexOf('tests');
		expect(buildSidebarPagination(ordered)).toEqual({
			prev: expect.objectContaining({ href: expectedStartHrefs[currentIndex - 1] }),
			next: expect.objectContaining({ href: expectedStartHrefs[currentIndex + 1] }),
		});
	});

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

	it('derives zero planned Systems rows from the published handbook registry while retaining planned Tools rows', () => {
		const systemPages = [
			page(currentVersion.id, 'en', 'systems', 'systems', 'canonical'),
			...handbookPages
				.filter(({ publication, sectionId }) => publication === 'published' && sectionId === 'systems')
				.map(({ pageId, slug }) => page(currentVersion.id, 'en', pageId, slug, 'canonical')),
		];
		const systems = buildSectionIndexModel({ sectionId: 'systems', version: currentVersion, locale: 'en', pages: systemPages });
		const tools = buildSectionIndexModel({
			sectionId: 'tools',
			version: currentVersion,
			locale: 'en',
			pages: [
				page(currentVersion.id, 'en', 'tools', 'tools', 'canonical'),
				...handbookPages
					.filter(({ publication, sectionId }) => publication === 'published' && sectionId === 'tools')
					.map(({ pageId, slug }) => page(currentVersion.id, 'en', pageId, slug, 'canonical')),
			],
		});

		expect(systems.plannedGroups).toEqual([]);
		expect(tools.plannedGroups.flatMap(({ children }) => children.map(({ pageId, label, availability }) => ({ pageId, label, availability })))).toEqual(
			handbookPages
				.filter(({ publication, sectionId }) => publication === 'planned' && sectionId === 'tools')
				.map(({ pageId, title }) => ({ pageId, label: title, availability: 'planned' })),
		);
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
