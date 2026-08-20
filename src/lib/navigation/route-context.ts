import {
	navigationSections,
	type NavigationPageId,
} from '../../data/navigation';
import type { Locale } from '../../data/taxonomy';

export interface DocumentationRouteContext {
	readonly kind: 'versioned' | 'latest' | 'root' | 'other';
	readonly requestedLocale: Locale;
	readonly versionId?: string;
	readonly slug: string;
	readonly sectionId?: NavigationPageId;
}

const VERSION_ID = /^[0-9a-f]{12}$/;

const sectionIdForSlug = (slug: string): NavigationPageId | undefined => {
	const segment = slug.split('/', 1)[0];
	return navigationSections.find((section) => section.segment === segment)?.pageId;
};

const withSection = (
	context: Omit<DocumentationRouteContext, 'sectionId'>,
): DocumentationRouteContext => {
	const sectionId = sectionIdForSlug(context.slug);
	return sectionId ? { ...context, sectionId } : context;
};

export function parseDocumentationRoute(
	routeId: string,
	requestedLocale: Locale,
): DocumentationRouteContext {
	const normalized = routeId.replace(/^\/+|\/+$/g, '');
	const segments = normalized === '' ? [] : normalized.split('/');
	const localePrefix = requestedLocale === 'pt-br' ? ['pt-br'] : [];

	if (
		segments.length === localePrefix.length &&
		segments.every((segment, index) => segment === localePrefix[index])
	) {
		return { kind: 'root', requestedLocale, slug: '' };
	}

	if (!localePrefix.every((segment, index) => segments[index] === segment)) {
		return { kind: 'other', requestedLocale, slug: normalized };
	}

	const routeSegments = segments.slice(localePrefix.length);
	const [root, candidateVersionId, ...slugSegments] = routeSegments;
	const slug = slugSegments.join('/');

	if (root === 'latest') {
		return withSection({ kind: 'latest', requestedLocale, slug: [candidateVersionId, ...slugSegments].filter(Boolean).join('/') });
	}

	if (root === 'versions' && candidateVersionId && VERSION_ID.test(candidateVersionId)) {
		return withSection({
			kind: 'versioned',
			requestedLocale,
			versionId: candidateVersionId,
			slug,
		});
	}

	return { kind: 'other', requestedLocale, slug: normalized };
}
