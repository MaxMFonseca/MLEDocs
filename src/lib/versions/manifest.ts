import { versions, type VersionEntry } from '../../data/versions.ts';

const COMMIT_SHA = /^[0-9a-f]{40}$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const VERSIONED_ROUTE_ID = /(?:^|\/)versions\/([0-9a-f]{12})(?:\/|$)/;

const isValidIsoDate = (value: string): boolean => {
	const match = ISO_DATE.exec(value);
	if (!match) return false;

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
	const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

	return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1];
};

export const validateVersions = (entries: readonly VersionEntry[]): readonly string[] => {
	const errors: string[] = [];
	if (entries.length === 0) {
		errors.push('Version manifest must contain at least one entry.');
	}

	const firstByCommit = new Map<string, VersionEntry>();
	const firstById = new Map<string, VersionEntry>();

	for (const entry of entries) {
		const validCommit = COMMIT_SHA.test(entry.commit);
		if (!validCommit) {
			errors.push(
				`Version ${entry.id} has invalid commit ${entry.commit}; expected a 40-character lowercase SHA.`,
			);
		}
		if (entry.id !== entry.commit.slice(0, 12)) {
			errors.push(
				`Version ${entry.id} does not match commit ${entry.commit}; expected ID ${entry.commit.slice(0, 12)}.`,
			);
		}

		const existingCommit = firstByCommit.get(entry.commit);
		if (existingCommit) {
			errors.push(
				`Duplicate commit ${entry.commit} appears in versions ${existingCommit.id} and ${entry.id}.`,
			);
		} else {
			firstByCommit.set(entry.commit, entry);
		}

		const existingId = firstById.get(entry.id);
		if (existingId) {
			errors.push(
				`Duplicate version ID ${entry.id} appears for commits ${existingId.commit} and ${entry.commit}.`,
			);
		} else {
			firstById.set(entry.id, entry);
		}

		if (!isValidIsoDate(entry.committedAt)) {
			errors.push(
				`Version ${entry.id} has invalid committedAt date ${entry.committedAt}; expected YYYY-MM-DD.`,
			);
		}

		if (entry.locales.length === 0) {
			errors.push(`Version ${entry.id} must declare at least one locale.`);
		} else {
			if (!entry.locales.includes('en')) {
				errors.push(`Version ${entry.id} must declare the English locale (en).`);
			}

			if (entry.status === 'archived') {
				for (const locale of entry.locales) {
					if (entry.label[locale].trim() === '') {
						errors.push(
							`Version ${entry.id} has an empty label for declared locale ${locale}.`,
						);
					}
				}
			}
		}
	}

	const currentCount = entries.filter((entry) => entry.status === 'current').length;
	if (currentCount !== 1) {
		errors.push(
			`Version manifest must contain exactly one current entry; found ${currentCount}.`,
		);
	}

	return errors;
};

export const getCurrentVersion = (
	entries: readonly VersionEntry[] = versions,
): VersionEntry => {
	const errors = validateVersions(entries);
	if (errors.length > 0) {
		throw new Error(['Invalid version manifest:', ...errors].join('\n'));
	}

	return entries.find((entry) => entry.status === 'current') as VersionEntry;
};

export const getVersion = (
	id: string,
	entries: readonly VersionEntry[] = versions,
): VersionEntry | undefined => entries.find((entry) => entry.id === id);

export const resolveVersionEntryFromRouteId = (
	routeId: string,
	entries: readonly VersionEntry[] = versions,
): VersionEntry => {
	const versionId = VERSIONED_ROUTE_ID.exec(routeId)?.[1];
	if (!versionId) {
		throw new Error(`Cannot resolve an MLE snapshot from route ID "${routeId}".`);
	}

	const version = getVersion(versionId, entries);
	if (!version) {
		throw new Error(
			`Documentation route "${routeId}" references unknown MLE snapshot "${versionId}".`,
		);
	}

	return version;
};
