import type { Locale } from '../../data/taxonomy';

const DEFAULT_BASE = '/MLEDocs';

export interface DocsPathInput {
	base?: string;
	locale: Locale;
	versionId: string;
	slug?: string;
}

const trimSlashes = (value: string): string => value.replace(/^\/+|\/+$/g, '');

export const withBase = (path: string, base: string = DEFAULT_BASE): string => {
	const segments = [trimSlashes(base), trimSlashes(path)].filter(Boolean);
	return `/${segments.join('/')}/`;
};

export const docsPath = ({ base, locale, versionId, slug }: DocsPathInput): string => {
	const segments = [
		...(locale === 'en' ? [] : [locale]),
		'versions',
		versionId,
		...(slug ? [trimSlashes(slug)] : []),
	];

	return withBase(segments.join('/'), base);
};
