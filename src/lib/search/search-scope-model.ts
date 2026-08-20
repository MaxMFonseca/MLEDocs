import type { Locale } from '../../data/taxonomy';
import type { VersionEntry } from '../../data/versions';
import { parseDocumentationRoute, type DocumentationRouteContext } from '../navigation/route-context';

const DEFAULT_BASE = '/MLEDocs';

export type SearchScope = 'active' | 'all';

export interface PagefindFilters {
	readonly mleVersion: string;
	readonly mleLocale: Locale;
}

export interface SearchContext {
	readonly base: string;
	readonly route: DocumentationRouteContext;
	readonly versions: readonly VersionEntry[];
	readonly versionId?: string;
	readonly locale?: Locale;
	readonly filters: Readonly<Record<SearchScope, PagefindFilters | undefined>>;
}

export interface SearchLabels {
	readonly versionBadge: string;
	readonly languageBadge: string;
	readonly languageNames: Readonly<Record<Locale, string>>;
}

export type SearchResultContext =
	| {
			readonly kind: 'versioned';
			readonly versionId: string;
			readonly locale: Locale;
			readonly isActive: boolean;
			readonly versionBadge: string;
			readonly languageBadge: string;
	  }
	| {
			readonly kind: 'unknown';
			readonly isActive: false;
	  };

const normalizeBase = (base: string | undefined): string => {
	const normalized = `/${(base ?? DEFAULT_BASE).replace(/^\/+|\/+$/g, '')}`;
	return normalized === '/' ? '' : normalized;
};

const decodePathname = (value: string): string | undefined => {
	try {
		return decodeURIComponent(value.split(/[?#]/, 1)[0]);
	} catch {
		return undefined;
	}
};

const routeIdUnderBase = (pathname: string, base: string): string | undefined => {
	const decoded = decodePathname(pathname);
	if (decoded === undefined) return undefined;

	const normalizedPathname = decoded.startsWith('/') ? decoded : `/${decoded}`;
	if (base && normalizedPathname !== base && !normalizedPathname.startsWith(`${base}/`)) {
		return undefined;
	}

	return normalizedPathname.slice(base.length).replace(/^\/+|\/+$/g, '');
};

const localeForRouteId = (routeId: string): Locale =>
	routeId === 'pt-br' || routeId.startsWith('pt-br/') ? 'pt-br' : 'en';

const uniqueCurrentVersion = (versions: readonly VersionEntry[]): VersionEntry | undefined => {
	const current = versions.filter((version) => version.status === 'current');
	return current.length === 1 ? current[0] : undefined;
};

export function buildSearchContext(input: {
	pathname: string;
	versions: readonly VersionEntry[];
	base?: string;
}): SearchContext {
	const base = normalizeBase(input.base);
	const routeId = routeIdUnderBase(input.pathname, base);
	const requestedLocale = routeId === undefined ? 'en' : localeForRouteId(routeId);
	const route = parseDocumentationRoute(routeId ?? '__outside_base__', requestedLocale);
	const version =
		route.kind === 'versioned'
			? input.versions.find((entry) => entry.id === route.versionId)
			: route.kind === 'latest' || route.kind === 'root'
				? uniqueCurrentVersion(input.versions)
				: undefined;
	const hasLocale = version?.locales.includes(requestedLocale) ?? false;
	const filters =
		version && hasLocale
			? {
					active: { mleVersion: version.id, mleLocale: requestedLocale },
					all: undefined,
				}
			: { active: undefined, all: undefined };

	return {
		base,
		route,
		versions: input.versions,
		...(version && hasLocale ? { versionId: version.id, locale: requestedLocale } : {}),
		filters,
	};
}

const resultPathname = (url: string): string | undefined => {
	try {
		const parsed = new URL(url, 'https://mledocs.invalid');
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
		return parsed.pathname;
	} catch {
		return undefined;
	}
};

export function describeSearchResult(input: {
	url: string;
	active: SearchContext;
	labels: SearchLabels;
}): SearchResultContext {
	const pathname = resultPathname(input.url);
	const routeId = pathname ? routeIdUnderBase(pathname, input.active.base) : undefined;
	if (routeId === undefined) return { kind: 'unknown', isActive: false };

	const locale = localeForRouteId(routeId);
	const route = parseDocumentationRoute(routeId, locale);
	if (route.kind !== 'versioned') return { kind: 'unknown', isActive: false };

	const version = input.active.versions.find((entry) => entry.id === route.versionId);
	if (!version || !version.locales.includes(locale)) {
		return { kind: 'unknown', isActive: false };
	}

	return {
		kind: 'versioned',
		versionId: version.id,
		locale,
		isActive: version.id === input.active.versionId && locale === input.active.locale,
		versionBadge: `${input.labels.versionBadge} ${version.id}`,
		languageBadge: `${input.labels.languageBadge} ${input.labels.languageNames[locale]}`,
	};
}
