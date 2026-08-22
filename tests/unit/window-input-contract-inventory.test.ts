import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { handbookPages } from '../../src/data/handbook';

type ContractKind = 'window-event' | 'sdl-route' | 'key-state' | 'key-modifier' | 'key-enum' | 'key-token' | 'input-contract' | 'text-focus-contract';

interface WindowInputContractRecord {
	readonly kind: ContractKind;
	readonly name: string;
	readonly ownerPageId: string;
}

interface SourceManifest {
	readonly mleCommit: string;
	readonly groups: readonly {
		readonly kind: ContractKind;
		readonly ownerPageId: string;
		readonly sourceFiles: readonly string[];
		readonly names: readonly string[];
	}[];
}

interface ContractDiff {
	readonly missing: readonly string[];
	readonly extra: readonly string[];
	readonly discoveredDuplicates: readonly string[];
	readonly documentedDuplicates: readonly string[];
	readonly invalidOwners: readonly string[];
	readonly ownerDisagreements: readonly string[];
}

const keyOf = ({ kind, name }: Pick<WindowInputContractRecord, 'kind' | 'name'>) => `${kind}:${name}`;

export function compareWindowInputContracts(
	discovered: readonly WindowInputContractRecord[],
	documented: readonly WindowInputContractRecord[],
): ContractDiff {
	const discoveredKeys = new Set(discovered.map(keyOf));
	const documentedKeys = new Set(documented.map(keyOf));
	const discoveredCounts = new Map<string, number>();
	const documentedCounts = new Map<string, number>();
	for (const record of discovered) discoveredCounts.set(keyOf(record), (discoveredCounts.get(keyOf(record)) ?? 0) + 1);
	for (const record of documented) documentedCounts.set(keyOf(record), (documentedCounts.get(keyOf(record)) ?? 0) + 1);
	const validOwners = new Set(handbookPages.map(({ pageId }) => pageId));
	const discoveredOwners = new Map(discovered.map((record) => [keyOf(record), record.ownerPageId]));
	return {
		missing: [...discoveredKeys].filter((key) => !documentedKeys.has(key)).sort(),
		extra: [...documentedKeys].filter((key) => !discoveredKeys.has(key)).sort(),
		discoveredDuplicates: [...discoveredCounts].filter(([, count]) => count > 1).map(([key]) => key).sort(),
		documentedDuplicates: [...documentedCounts].filter(([, count]) => count > 1).map(([key]) => key).sort(),
		invalidOwners: documented.filter(({ ownerPageId }) => !validOwners.has(ownerPageId)).map(keyOf).sort(),
		ownerDisagreements: documented
			.filter((record) => discoveredOwners.has(keyOf(record)) && discoveredOwners.get(keyOf(record)) !== record.ownerPageId)
			.map(keyOf)
			.sort(),
	};
}

const sourceManifest = JSON.parse(
	readFileSync(new URL('../fixtures/window-input-contract-source-manifest.json', import.meta.url), 'utf8'),
) as SourceManifest;
const discoveredRecords = sourceManifest.groups.flatMap(({ kind, ownerPageId, names }) =>
	names.map((name) => ({ kind, name, ownerPageId })));

function documentedRecords(): WindowInputContractRecord[] {
	const referencePath = resolve('src/content/docs/versions/c1abea3de165/reference/window-and-input-contracts.mdx');
	if (!exists(referencePath)) return [];
	const source = readFileSync(referencePath, 'utf8');
	return [...source.matchAll(/data-window-input-contracts="([^"]+)"/g)].flatMap((match) =>
		match[1].trim().split(/\s+/).map((identity) => {
			const separator = identity.indexOf(':');
			return { kind: identity.slice(0, separator) as ContractKind, name: identity.slice(separator + 1), ownerPageId: 'window-and-input-contracts' };
		}),
	);
}

function exists(path: string): boolean {
	try {
		readFileSync(path);
		return true;
	} catch {
		return false;
	}
}

describe('window and input contract comparator', () => {
	it('loads an independent clone-portable pinned source manifest', () => {
		expect(sourceManifest.mleCommit).toBe('c1abea3de165032fe064300340807b7a6af388f8');
		expect(discoveredRecords).toHaveLength(304);
		expect(Object.fromEntries(sourceManifest.groups.map(({ kind, names }) => [kind, names.length]))).toEqual({
			'window-event': 4, 'sdl-route': 11, 'key-state': 4, 'key-modifier': 5, 'key-enum': 100,
			'key-token': 146, 'input-contract': 20, 'text-focus-contract': 14,
		});
		for (const group of sourceManifest.groups) {
			expect(group.sourceFiles.length).toBeGreaterThan(0);
			for (const sourceFile of group.sourceFiles) {
				expect(sourceFile).toMatch(/^src\/mle\/(?:window|ui)\/.+\.(?:h|cpp)$/);
				expect(sourceFile).not.toContain('.local');
			}
		}
	});

	it('reconciles every discovered identity with the published reference', () => {
		expect(compareWindowInputContracts(discoveredRecords, documentedRecords())).toEqual({
			missing: [], extra: [], discoveredDuplicates: [], documentedDuplicates: [], invalidOwners: [], ownerDisagreements: [],
		});
	});

	it('detects missing and extra identities independently', () => {
		const documented = discoveredRecords.map((record) => ({ ...record }));
		const first = keyOf(discoveredRecords[0]);
		expect(compareWindowInputContracts(discoveredRecords, documented.slice(1)).missing).toEqual([first]);
		expect(compareWindowInputContracts(discoveredRecords.slice(1), documented).extra).toEqual([first]);
	});

	it('detects duplicate identities on both sides', () => {
		const first = keyOf(discoveredRecords[0]);
		expect(compareWindowInputContracts([...discoveredRecords, discoveredRecords[0]], discoveredRecords).discoveredDuplicates).toEqual([first]);
		expect(compareWindowInputContracts(discoveredRecords, [...discoveredRecords, discoveredRecords[0]]).documentedDuplicates).toEqual([first]);
	});

	it('detects invalid owners and owner swaps', () => {
		const invalid = discoveredRecords.map((record, index) => index === 0 ? { ...record, ownerPageId: 'not-a-page' } : record);
		const swapped = discoveredRecords.map((record, index) => index === 0 ? { ...record, ownerPageId: 'window' } : record);
		expect(compareWindowInputContracts(discoveredRecords, invalid).invalidOwners).toEqual([keyOf(discoveredRecords[0])]);
		expect(compareWindowInputContracts(discoveredRecords, swapped).ownerDisagreements).toEqual([keyOf(discoveredRecords[0])]);
	});

	it('keeps tracked discovery independent from ignored scout state', () => {
		expect(readFileSync(resolve('tests/unit/window-input-contract-inventory.test.ts'), 'utf8')).not.toContain(['.local', 'research'].join('/'));
	});
});
