import {
	navigationSections,
	type NavigationAccent,
	type NavigationPageId,
} from '../../data/navigation';
import type { Locale } from '../../data/taxonomy';
import type { VersionEntry } from '../../data/versions';
import { docsPath, withBase } from '../links/base';

export interface LandingVersionOption {
	readonly versionId: string;
	readonly label: string;
	readonly destination: string;
}

export interface LandingSectionDestination {
	readonly pageId: NavigationPageId;
	readonly order: number;
	readonly accent: NavigationAccent;
	readonly label: string;
	readonly summary: string;
	readonly href: string;
}

export interface LandingModel {
	readonly locale: Locale;
	readonly version: VersionEntry;
	readonly options: readonly LandingVersionOption[];
	readonly landingHome: string;
	readonly alternateLanding: string;
	readonly documentationHome: string;
	readonly sourceDestination: string;
	readonly sections: readonly LandingSectionDestination[];
}

const compareByCommittedDate = (left: VersionEntry, right: VersionEntry): number =>
	right.committedAt.localeCompare(left.committedAt) || left.id.localeCompare(right.id);

const landingPath = (locale: Locale): string => withBase(locale === 'en' ? '' : locale);

export function buildLandingModel(
	entries: readonly VersionEntry[],
	selectedId: string,
	locale: Locale,
): LandingModel {
	const version = entries.find((entry) => entry.id === selectedId);
	if (!version) throw new Error(`Unknown landing version: ${selectedId}`);
	if (!version.locales.includes(locale)) {
		throw new Error(`Landing version ${version.id} does not declare locale ${locale}.`);
	}

	return {
		locale,
		version,
		options: entries
			.filter((entry) => entry.locales.includes(locale))
			.sort(compareByCommittedDate)
			.map((entry) => ({
				versionId: entry.id,
				label: `${entry.id} · ${entry.committedAt} · ${entry.label[locale]}`,
				destination: docsPath({ locale, versionId: entry.id }),
			})),
		landingHome: landingPath(locale),
		alternateLanding: landingPath(locale === 'en' ? 'pt-br' : 'en'),
		documentationHome: docsPath({ locale, versionId: version.id }),
		sourceDestination: `${version.repositoryUrl}/tree/${version.commit}`,
		sections: [...navigationSections]
			.sort((left, right) => left.order - right.order)
			.map((section) => ({
				pageId: section.pageId,
				order: section.order,
				accent: section.accent,
				label: section.labels[locale],
				summary: section.summaries[locale],
				href: docsPath({ locale, versionId: version.id, slug: section.segment }),
			})),
	};
}
