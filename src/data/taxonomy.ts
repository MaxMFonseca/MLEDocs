export const locales = ['en', 'pt-br'] as const;
export type Locale = (typeof locales)[number];

export const maturities = ['stable-enough', 'in-development', 'experimental'] as const;
export type Maturity = (typeof maturities)[number];

export const audiences = ['integrator', 'contributor'] as const;
export type Audience = (typeof audiences)[number];

export const subsystems = [
	'project',
	'core',
	'math',
	'utilities',
	'renderer',
	'models',
	'lua',
	'ui',
	'audio',
	'client',
	'window',
	'server',
	'tools',
	'tests',
	'contributing',
] as const;
export type Subsystem = (typeof subsystems)[number];

export const versionStatuses = ['current', 'archived'] as const;
export type VersionStatus = (typeof versionStatuses)[number];
