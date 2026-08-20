import { describe, expect, it } from 'vitest';
import { parseDocumentationRoute } from '../../src/lib/navigation/route-context';

describe('documentation route context', () => {
	it('parses permanent English and exact Brazilian Portuguese routes from the site route root', () => {
		expect(parseDocumentationRoute('versions/c1abea3de165/systems/renderer', 'en')).toEqual({
			kind: 'versioned',
			requestedLocale: 'en',
			versionId: 'c1abea3de165',
			slug: 'systems/renderer',
			sectionId: 'systems',
		});
		expect(parseDocumentationRoute('pt-br/versions/c1abea3de165/systems', 'pt-br')).toEqual({
			kind: 'versioned',
			requestedLocale: 'pt-br',
			versionId: 'c1abea3de165',
			slug: 'systems',
			sectionId: 'systems',
		});
	});

	it('retains the requested Portuguese route context when content falls back to English', () => {
		expect(parseDocumentationRoute('pt-br/versions/c1abea3de165/systems/renderer', 'pt-br')).toEqual({
			kind: 'versioned',
			requestedLocale: 'pt-br',
			versionId: 'c1abea3de165',
			slug: 'systems/renderer',
			sectionId: 'systems',
		});
	});

	it('recognizes latest aliases without inventing a permanent version', () => {
		expect(parseDocumentationRoute('pt-br/latest/systems/renderer', 'pt-br')).toEqual({
			kind: 'latest',
			requestedLocale: 'pt-br',
			slug: 'systems/renderer',
			sectionId: 'systems',
		});
	});

	it('keeps known-version missing-page and unknown-version identities intact', () => {
		expect(parseDocumentationRoute('versions/c1abea3de165/reference/not-in-this-snapshot', 'en')).toEqual({
			kind: 'versioned',
			requestedLocale: 'en',
			versionId: 'c1abea3de165',
			slug: 'reference/not-in-this-snapshot',
			sectionId: 'reference',
		});
		expect(parseDocumentationRoute('pt-br/versions/ffffffffffff/guia', 'pt-br')).toEqual({
			kind: 'versioned',
			requestedLocale: 'pt-br',
			versionId: 'ffffffffffff',
			slug: 'guia',
		});
	});

	it('treats root and unrelated 404 route IDs as non-versioned and rejects nested versions segments', () => {
		expect(parseDocumentationRoute('', 'en')).toEqual({
			kind: 'root',
			requestedLocale: 'en',
			slug: '',
		});
		expect(parseDocumentationRoute('pt-br', 'pt-br')).toEqual({
			kind: 'root',
			requestedLocale: 'pt-br',
			slug: '',
		});
		expect(parseDocumentationRoute('arbitrary/versions/c1abea3de165/missing', 'en')).toEqual({
			kind: 'other',
			requestedLocale: 'en',
			slug: 'arbitrary/versions/c1abea3de165/missing',
		});
	});
});
