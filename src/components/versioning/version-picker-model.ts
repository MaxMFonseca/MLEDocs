import type { Locale } from '../../data/taxonomy';
import type { VersionEntry } from '../../data/versions';
import type { PageIndex } from '../../lib/content/page-index';
import { docsPath } from '../../lib/links/base';
import { resolveEquivalentPage } from '../../lib/versions/equivalent';

interface VersionPickerModelInput {
	readonly versions: readonly VersionEntry[];
	readonly pageIndex: PageIndex;
	readonly pageId: string;
	readonly locale: Locale;
	readonly activeVersionId: string;
	readonly base?: string;
}

export interface NavigateVersionOption {
	readonly kind: 'navigate';
	readonly version: VersionEntry;
	readonly label: string;
	readonly selectionValue: string;
	readonly destination: string;
}

export interface MissingVersionOption {
	readonly kind: 'missing';
	readonly version: VersionEntry;
	readonly label: string;
	readonly selectionValue: string;
	readonly explanationId: string;
	readonly missingPageId: string;
	readonly overviewDestination: string;
}

export type VersionPickerOption = NavigateVersionOption | MissingVersionOption;

export interface VersionPickerModel {
	readonly active: NavigateVersionOption;
	readonly options: readonly VersionPickerOption[];
}

const versionLabel = (version: VersionEntry, locale: Locale): string => {
	const status =
		version.status === 'current'
			? locale === 'pt-br'
				? 'atual'
				: 'current'
			: locale === 'pt-br'
				? 'arquivada'
				: 'archived';

	return `${version.id} · ${version.committedAt} · ${status}`;
};

export const buildVersionPickerModel = ({
	versions,
	pageIndex,
	pageId,
	locale,
	activeVersionId,
	base,
}: VersionPickerModelInput): VersionPickerModel => {
	const options = versions.map<VersionPickerOption>((version) => {
		const equivalent = resolveEquivalentPage(pageIndex, {
			pageId,
			locale,
			versionId: version.id,
		});
		const label = versionLabel(version, locale);

		if (equivalent.kind === 'missing') {
			const explanationId = `mle-version-missing-${version.id}`;
			return {
				kind: 'missing',
				version,
				label,
				selectionValue: `#${explanationId}`,
				explanationId,
				missingPageId: equivalent.missingPageId,
				overviewDestination: docsPath({
					base,
					locale,
					versionId: version.id,
					slug: equivalent.overview.slug,
				}),
			};
		}

		const destination = docsPath({
			base,
			locale,
			versionId: version.id,
			slug: equivalent.page.slug,
		});
		return {
			kind: 'navigate',
			version,
			label,
			selectionValue: destination,
			destination,
		};
	});

	const active = options.find((option) => option.version.id === activeVersionId);
	if (!active || active.kind !== 'navigate') {
		throw new Error(
			`Page ${pageId} is not indexed for active documentation version ${activeVersionId}.`,
		);
	}

	return { active, options };
};
