import type { NavigationSection } from '../../data/navigation';
import type { Locale } from '../../data/taxonomy';
import type { VersionEntry } from '../../data/versions';
import { docsPath } from '../links/base';
import type { DocumentationRouteContext } from './route-context';

export interface BreadcrumbItem {
	readonly label: string;
	readonly href?: string;
	readonly title?: string;
	readonly current?: true;
}

const languageLabels: Readonly<Record<Locale, string>> = {
	en: 'English',
	'pt-br': 'Português (Brasil)',
};

export function buildBreadcrumbModel(input: {
	route: DocumentationRouteContext;
	pageId?: string;
	pageTitle: string;
	versions: readonly VersionEntry[];
	sections: readonly NavigationSection[];
	base?: string;
}): readonly BreadcrumbItem[] {
	const { route, pageId, pageTitle, versions, sections, base } = input;
	if (route.kind !== 'versioned' || !route.versionId) return [];

	const version = versions.find((candidate) => candidate.id === route.versionId);
	if (!version) return [];
	if (!version.locales.includes(route.requestedLocale)) {
		throw new Error(`Version ${version.id} does not declare locale ${route.requestedLocale}.`);
	}

	const overviewHref = docsPath({
		base,
		locale: route.requestedLocale,
		versionId: version.id,
	});
	if (route.slug === '') {
		return [
			{ label: languageLabels[route.requestedLocale] },
			{ label: version.id, title: version.commit, current: true },
		];
	}
	const items: BreadcrumbItem[] = [
		{ label: languageLabels[route.requestedLocale], href: overviewHref },
		{ label: version.id, href: overviewHref, title: version.commit },
	];
	const section = route.sectionId
		? sections.find((candidate) => candidate.pageId === route.sectionId)
		: undefined;

	if (route.sectionId && !section) {
		throw new Error(`Route section ${route.sectionId} is not present in the navigation registry.`);
	}
	if (!section) {
		return [...items, { label: pageTitle, current: true }];
	}

	if (pageId === section.pageId) {
		return [...items, { label: section.labels[route.requestedLocale], current: true }];
	}

	return [
		...items,
		{
			label: section.labels[route.requestedLocale],
			href: docsPath({
				base,
				locale: route.requestedLocale,
				versionId: version.id,
				slug: section.segment,
			}),
		},
		{ label: pageTitle, current: true },
	];
}
