import type { Locale } from './taxonomy';

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
