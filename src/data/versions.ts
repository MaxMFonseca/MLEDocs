import type { Locale, VersionStatus } from './taxonomy';

export interface VersionEntry {
	readonly commit: string;
	readonly id: string;
	readonly committedAt: `${number}-${number}-${number}`;
	readonly label: Readonly<Record<Locale, string>>;
	readonly status: VersionStatus;
	readonly locales: readonly Locale[];
	readonly repositoryUrl: 'https://github.com/MaxMFonseca/MLE';
	readonly corrections: readonly {
		date: `${number}-${number}-${number}`;
		summary: string;
	}[];
}

export const versions = [
	{
		commit: 'c1abea3de165032fe064300340807b7a6af388f8',
		id: 'c1abea3de165',
		committedAt: '2026-08-18',
		label: { en: 'Current', 'pt-br': 'Atual' },
		status: 'current',
		locales: ['en', 'pt-br'],
		repositoryUrl: 'https://github.com/MaxMFonseca/MLE',
		corrections: [],
	},
] as const satisfies readonly VersionEntry[];
