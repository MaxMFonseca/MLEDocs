import type { Locale } from './taxonomy';
import type { VersionEntry } from './versions';

export const navigationPageIds = [
	'start',
	'concepts',
	'systems',
	'guides',
	'reference',
	'tools',
	'contributing',
] as const;

export type NavigationPageId = (typeof navigationPageIds)[number];
export type NavigationAvailability = 'available' | 'planned';

export interface NavigationItem {
	readonly pageId: NavigationPageId;
	readonly labels: Readonly<Record<Locale, string>>;
	readonly availability: NavigationAvailability;
	readonly directory?: string;
}

export const navigationItems = [
	{
		pageId: 'start',
		labels: { en: 'Start Here', 'pt-br': 'Comece aqui' },
		availability: 'available',
		directory: 'start-here',
	},
	{
		pageId: 'concepts',
		labels: { en: 'Concepts', 'pt-br': 'Conceitos' },
		availability: 'planned',
	},
	{
		pageId: 'systems',
		labels: { en: 'Engine Systems', 'pt-br': 'Sistemas do motor' },
		availability: 'available',
		directory: 'systems',
	},
	{
		pageId: 'guides',
		labels: { en: 'Practical Guides', 'pt-br': 'Guias práticos' },
		availability: 'planned',
	},
	{
		pageId: 'reference',
		labels: { en: 'Reference', 'pt-br': 'Referência' },
		availability: 'planned',
	},
	{
		pageId: 'tools',
		labels: { en: 'Tools and Test Applications', 'pt-br': 'Ferramentas e aplicativos de teste' },
		availability: 'planned',
	},
	{
		pageId: 'contributing',
		labels: { en: 'Contributing', 'pt-br': 'Como contribuir' },
		availability: 'planned',
	},
] as const satisfies readonly NavigationItem[];

export const buildSnapshotSidebar = (versionId: string) =>
	navigationItems.flatMap((item) =>
		item.availability === 'available' && item.directory
			? [
					{
						label: item.labels.en,
						translations: { 'pt-BR': item.labels['pt-br'] },
						items: [
							{
								autogenerate: {
									directory: `versions/${versionId}/${item.directory}`,
								},
							},
						],
					},
				]
			: [],
	);

const versionStatusLabel = (version: VersionEntry, locale: Locale): string => {
	const status = version.status === 'current'
		? locale === 'pt-br' ? 'atual' : 'current'
		: locale === 'pt-br' ? 'arquivada' : 'archived';
	return `${version.id} · ${version.committedAt} · ${status}`;
};

const compareVersions = (left: VersionEntry, right: VersionEntry): number => {
	if (left.status !== right.status) return left.status === 'current' ? -1 : 1;
	if (left.committedAt !== right.committedAt) return left.committedAt > right.committedAt ? -1 : 1;
	return left.id.localeCompare(right.id);
};

export const buildVersionedSidebar = (entries: readonly VersionEntry[]) =>
	[...entries].sort(compareVersions).map((version) => ({
		label: versionStatusLabel(version, 'en'),
		translations: { 'pt-BR': versionStatusLabel(version, 'pt-br') },
		collapsed: version.status === 'archived',
		items: buildSnapshotSidebar(version.id),
	}));
