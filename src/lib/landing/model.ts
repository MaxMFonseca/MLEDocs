import { navigationSections, type NavigationSection } from '../../data/navigation';
import type { VersionEntry } from '../../data/versions';
import { docsPath } from '../links/base';

export interface LandingVersionOption {
	readonly versionId: string;
	readonly label: string;
	readonly destination: string;
}

export interface LandingSectionDestination {
	readonly section: NavigationSection;
	readonly href: string;
}

export interface LandingModel {
	readonly version: VersionEntry;
	readonly options: readonly LandingVersionOption[];
	readonly englishHome: string;
	readonly portugueseHome: string;
	readonly sourceDestination: string;
	readonly sections: readonly LandingSectionDestination[];
}

const compareByCommittedDate = (left: VersionEntry, right: VersionEntry): number =>
	right.committedAt.localeCompare(left.committedAt) || left.id.localeCompare(right.id);

const englishStatus = (version: VersionEntry): string =>
	version.status === 'current' ? 'current' : 'archived';

export function buildLandingModel(
	entries: readonly VersionEntry[],
	selectedId: string,
): LandingModel {
	const version = entries.find((entry) => entry.id === selectedId);
	if (!version) throw new Error(`Unknown landing version: ${selectedId}`);

	return {
		version,
		options: [...entries].sort(compareByCommittedDate).map((entry) => ({
			versionId: entry.id,
			label: `${entry.id} · ${entry.committedAt} · ${englishStatus(entry)}`,
			destination: docsPath({ locale: 'en', versionId: entry.id }),
		})),
		englishHome: docsPath({ locale: 'en', versionId: version.id }),
		portugueseHome: docsPath({ locale: 'pt-br', versionId: version.id }),
		sourceDestination: `${version.repositoryUrl}/tree/${version.commit}`,
		sections: [...navigationSections]
			.sort((left, right) => left.order - right.order)
			.map((section) => ({
				section,
				href: docsPath({ locale: 'en', versionId: version.id, slug: section.segment }),
			})),
	};
}
