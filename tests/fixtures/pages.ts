import type { PageRecord } from '../../src/lib/content/page-index';

export const currentVersionId = 'c1abea3de165';
export const archivedVersionId = 'd2d2d2d2d2d2';

export const pages = [
	{
		pageId: 'overview',
		locale: 'en',
		versionId: currentVersionId,
		slug: '',
		translationStatus: 'canonical',
	},
	{
		pageId: 'overview',
		locale: 'pt-br',
		versionId: currentVersionId,
		slug: '',
		translationStatus: 'current',
	},
	{
		pageId: 'core-overview',
		locale: 'en',
		versionId: currentVersionId,
		slug: 'systems/core',
		translationStatus: 'canonical',
	},
	{
		pageId: 'core-overview',
		locale: 'pt-br',
		versionId: currentVersionId,
		slug: 'sistemas/nucleo',
		translationStatus: 'current',
	},
	{
		pageId: 'renderer-overview',
		locale: 'en',
		versionId: currentVersionId,
		slug: 'systems/renderer',
		translationStatus: 'canonical',
	},
	{
		pageId: 'overview',
		locale: 'en',
		versionId: archivedVersionId,
		slug: '',
		translationStatus: 'canonical',
	},
	{
		pageId: 'legacy-only',
		locale: 'en',
		versionId: archivedVersionId,
		slug: 'reference/legacy',
		translationStatus: 'canonical',
	},
] as const satisfies readonly PageRecord[];
