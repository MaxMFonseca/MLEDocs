import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { handbookPages } from '../../src/data/handbook';

export interface TestInventoryRecord {
	readonly path: string;
	readonly kind: 'automated' | 'interactive' | 'fixture' | 'generator' | 'tool';
	readonly ownerPageId: string;
	readonly documentedBy: string;
}

interface TestInventorySourceManifest {
	readonly mleCommit: string;
	readonly groups: readonly (Omit<TestInventoryRecord, 'path'> & { readonly paths: readonly string[] })[];
}

interface TestInventoryDiff {
	readonly missing: readonly string[];
	readonly extra: readonly string[];
	readonly discoveredDuplicates: readonly string[];
	readonly documentedDuplicates: readonly string[];
	readonly mislabeled: readonly string[];
	readonly invalidOwners: readonly string[];
	readonly invalidDocumentationPages: readonly string[];
	readonly ownerDisagreements: readonly string[];
	readonly documentationDisagreements: readonly string[];
}

const manifest = JSON.parse(
	readFileSync(new URL('../fixtures/test-inventory-source-manifest.json', import.meta.url), 'utf8'),
) as TestInventorySourceManifest;

const discoveredRecords: readonly TestInventoryRecord[] = manifest.groups.flatMap(
	({ paths, kind, ownerPageId, documentedBy }) => paths.map((path) => ({ path, kind, ownerPageId, documentedBy })),
);

const documentationSlugs = [
	'tools/core-test-suite',
	'tools/model-test',
	'tools/test-fixtures',
	'tools/mlecubes',
	'contributing/tests-and-interactive-pages',
	'tools/ui-test',
	'tools/audio-test',
	'tools/interactive-client',
] as const;

function documentedRecords(): TestInventoryRecord[] {
	return documentationSlugs.flatMap((slug) => {
		const path = resolve('src/content/docs/versions/c1abea3de165', `${slug}.mdx`);
		let source = '';
		try {
			source = readFileSync(path, 'utf8');
		} catch {
			try {
				source = readFileSync(resolve('src/content/docs/versions/c1abea3de165', slug, 'index.mdx'), 'utf8');
			} catch {
				return [];
			}
		}
		return [...source.matchAll(/\{\/\* test-inventory: (automated|interactive|fixture|generator|tool)\|([^|]+)\|([^|]+)\|([^ ]+) \*\/\}/g)]
			.map((match) => ({ kind: match[1], path: match[2], ownerPageId: match[3], documentedBy: match[4] }) as TestInventoryRecord);
	});
}

function duplicatePaths(records: readonly TestInventoryRecord[]): string[] {
	const counts = new Map<string, number>();
	for (const { path } of records) counts.set(path, (counts.get(path) ?? 0) + 1);
	return [...counts].filter(([, count]) => count > 1).map(([path]) => path).sort();
}

export function compareTestInventory(
	discovered: readonly TestInventoryRecord[],
	documented: readonly TestInventoryRecord[],
): TestInventoryDiff {
	const discoveredByPath = new Map(discovered.map((record) => [record.path, record]));
	const documentedByPath = new Map(documented.map((record) => [record.path, record]));
	const validPages = new Set(handbookPages.map(({ pageId }) => pageId));
	return {
		missing: [...discoveredByPath.keys()].filter((path) => !documentedByPath.has(path)).sort(),
		extra: [...documentedByPath.keys()].filter((path) => !discoveredByPath.has(path)).sort(),
		discoveredDuplicates: duplicatePaths(discovered),
		documentedDuplicates: duplicatePaths(documented),
		mislabeled: documented.filter((record) => discoveredByPath.has(record.path)
			&& discoveredByPath.get(record.path)?.kind !== record.kind).map(({ path }) => path).sort(),
		invalidOwners: documented.filter(({ ownerPageId }) => !validPages.has(ownerPageId)).map(({ path }) => path).sort(),
		invalidDocumentationPages: documented.filter(({ documentedBy }) => !validPages.has(documentedBy)).map(({ path }) => path).sort(),
		ownerDisagreements: documented.filter((record) => discoveredByPath.has(record.path)
			&& discoveredByPath.get(record.path)?.ownerPageId !== record.ownerPageId).map(({ path }) => path).sort(),
		documentationDisagreements: documented.filter((record) => discoveredByPath.has(record.path)
			&& discoveredByPath.get(record.path)?.documentedBy !== record.documentedBy).map(({ path }) => path).sort(),
	};
}

describe('test and tool inventory comparator', () => {
	it('loads a clone-portable source manifest with the complete scoped evidence classes', () => {
		expect(manifest.mleCommit).toBe('c1abea3de165032fe064300340807b7a6af388f8');
		expect(discoveredRecords).toHaveLength(73);
		expect(Object.fromEntries(['automated', 'interactive', 'fixture', 'generator', 'tool'].map((kind) => [
			kind, discoveredRecords.filter((record) => record.kind === kind).length,
		]))).toEqual({ automated: 29, interactive: 29, fixture: 9, generator: 1, tool: 5 });
		expect(discoveredRecords.filter(({ path }) => path.match(/^tests\/Core\/(?:src|shutdown)\/.*T\..*\.cpp$/))).toHaveLength(29);
		expect(discoveredRecords.filter(({ path }) => path.startsWith('tests/Client/res/lua/ui/'))).toHaveLength(13);
		expect(discoveredRecords.filter(({ path }) => path.startsWith('tests/Client/src/layers/'))).toHaveLength(16);
		expect(readFileSync(resolve('tests/unit/test-inventory.test.ts'), 'utf8')).not.toContain(['.local', 'research'].join('/'));
	});

	it('reconciles every source-observed row with independently authored documentation markers', () => {
		expect(compareTestInventory(discoveredRecords, documentedRecords())).toEqual({
			missing: [], extra: [], discoveredDuplicates: [], documentedDuplicates: [], mislabeled: [],
			invalidOwners: [], invalidDocumentationPages: [], ownerDisagreements: [], documentationDisagreements: [],
		});
	});

	it('detects an omitted Core test and a mislabeled interactive page', () => {
		const omitted = documentedRecords().filter(({ path }) => path !== 'tests/Core/src/core/T.ThreadPool.cpp');
		expect(compareTestInventory(discoveredRecords, omitted).missing).toContain('tests/Core/src/core/T.ThreadPool.cpp');
		const mislabeled = documentedRecords().map((record) => record.path === 'tests/Client/res/lua/ui/ui_tests/FormPanel.lua'
			? { ...record, kind: 'automated' as const } : record);
		expect(compareTestInventory(discoveredRecords, mislabeled).mislabeled)
			.toEqual(['tests/Client/res/lua/ui/ui_tests/FormPanel.lua']);
	});

	it('detects discovered and documented duplicates', () => {
		const first = discoveredRecords[0];
		expect(compareTestInventory([...discoveredRecords, first], documentedRecords()).discoveredDuplicates).toEqual([first.path]);
		expect(compareTestInventory(discoveredRecords, [...documentedRecords(), documentedRecords()[0]]).documentedDuplicates)
			.toEqual([documentedRecords()[0].path]);
	});

	it('detects invalid pages, owner disagreement, and documentation-owner disagreement', () => {
		const rows = documentedRecords();
		const invalidOwner = rows.map((record, index) => index === 0 ? { ...record, ownerPageId: 'not-a-page' } : record);
		const invalidDoc = rows.map((record, index) => index === 0 ? { ...record, documentedBy: 'not-a-page' } : record);
		const swappedOwner = rows.map((record, index) => index === 0 ? { ...record, ownerPageId: 'core' } : record);
		const swappedDoc = rows.map((record, index) => index === 0 ? { ...record, documentedBy: 'test-fixtures' } : record);
		expect(compareTestInventory(discoveredRecords, invalidOwner).invalidOwners).toEqual([rows[0].path]);
		expect(compareTestInventory(discoveredRecords, invalidDoc).invalidDocumentationPages).toEqual([rows[0].path]);
		expect(compareTestInventory(discoveredRecords, swappedOwner).ownerDisagreements).toEqual([rows[0].path]);
		expect(compareTestInventory(discoveredRecords, swappedDoc).documentationDisagreements).toEqual([rows[0].path]);
	});
});
