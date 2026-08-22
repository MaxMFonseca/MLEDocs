import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { handbookPages } from '../../src/data/handbook';
import { navigationSections } from '../../src/data/navigation';

type CoverageDisposition = 'internal/support-only' | 'excluded-obsolete-doxygen';
type EvidenceClass =
	| 'Source-observed'
	| 'Test-backed'
	| 'Demonstrated'
	| 'Fixture'
	| 'Generator'
	| 'Tool'
	| 'Manual'
	| 'Support-only'
	| 'Excluded';

interface SourceInventoryRecord {
	readonly path: string;
	readonly expectedOwnerPageId?: string;
	readonly expectedDisposition?: CoverageDisposition;
}

interface SourceCoverageRecord {
	readonly path: string;
	readonly ownerPageId?: string;
	readonly disposition?: CoverageDisposition;
	readonly evidenceClass: EvidenceClass;
}

interface SourceInventoryFixture {
	readonly mleCommit: string;
	readonly scope: string;
	readonly records: readonly SourceInventoryRecord[];
}

interface SourceCoverageFixture {
	readonly mleCommit: string;
	readonly records: readonly SourceCoverageRecord[];
}

interface SourceCoverageDiff {
	readonly missing: readonly string[];
	readonly extra: readonly string[];
	readonly discoveredDuplicates: readonly string[];
	readonly documentedDuplicates: readonly string[];
	readonly invalidOwners: readonly string[];
	readonly invalidDispositions: readonly string[];
	readonly invalidEvidence: readonly string[];
	readonly ownerDisagreements: readonly string[];
}

const inventory = JSON.parse(
	readFileSync(new URL('../fixtures/mle-source-inventory.json', import.meta.url), 'utf8'),
) as SourceInventoryFixture;
const coverage = JSON.parse(
	readFileSync(new URL('../fixtures/mle-source-coverage.json', import.meta.url), 'utf8'),
) as SourceCoverageFixture;

const validPageIds = new Set([
	...handbookPages.map(({ pageId }) => pageId),
	...navigationSections.flatMap(({ pageId, plannedGroups }) => [
		pageId,
		...plannedGroups.flatMap(({ children }) => children.map(({ pageId: childPageId }) => childPageId)),
	]),
]);
const validDispositions = new Set<CoverageDisposition>(['internal/support-only', 'excluded-obsolete-doxygen']);
const validEvidence = new Set<EvidenceClass>([
	'Source-observed', 'Test-backed', 'Demonstrated', 'Fixture', 'Generator', 'Tool', 'Manual', 'Support-only', 'Excluded',
]);

function duplicates(records: readonly { readonly path: string }[]): string[] {
	const counts = new Map<string, number>();
	for (const { path } of records) counts.set(path, (counts.get(path) ?? 0) + 1);
	return [...counts].filter(([, count]) => count > 1).map(([path]) => path).sort();
}

function ownership(record: SourceInventoryRecord | SourceCoverageRecord): string {
	if ('expectedOwnerPageId' in record && record.expectedOwnerPageId) return `page:${record.expectedOwnerPageId}`;
	if ('expectedDisposition' in record && record.expectedDisposition) return `disposition:${record.expectedDisposition}`;
	if ('ownerPageId' in record && record.ownerPageId) return `page:${record.ownerPageId}`;
	if ('disposition' in record && record.disposition) return `disposition:${record.disposition}`;
	return 'invalid:unowned';
}

export function compareSourceCoverage(
	discovered: readonly SourceInventoryRecord[],
	documented: readonly SourceCoverageRecord[],
): SourceCoverageDiff {
	const discoveredByPath = new Map(discovered.map((record) => [record.path, record]));
	const documentedByPath = new Map(documented.map((record) => [record.path, record]));
	return {
		missing: [...discoveredByPath.keys()].filter((path) => !documentedByPath.has(path)).sort(),
		extra: [...documentedByPath.keys()].filter((path) => !discoveredByPath.has(path)).sort(),
		discoveredDuplicates: duplicates(discovered),
		documentedDuplicates: duplicates(documented),
		invalidOwners: documented
			.filter(({ ownerPageId }) => ownerPageId !== undefined && !validPageIds.has(ownerPageId))
			.map(({ path }) => path).sort(),
		invalidDispositions: documented
			.filter(({ ownerPageId, disposition }) => ownerPageId === undefined && !validDispositions.has(disposition as CoverageDisposition))
			.map(({ path }) => path).sort(),
		invalidEvidence: documented
			.filter(({ evidenceClass }) => !validEvidence.has(evidenceClass))
			.map(({ path }) => path).sort(),
		ownerDisagreements: documented
			.filter((record) => discoveredByPath.has(record.path)
				&& ownership(discoveredByPath.get(record.path) as SourceInventoryRecord) !== ownership(record))
			.map(({ path }) => path).sort(),
	};
}

describe('pinned MLE source coverage', () => {
	it('reconciles the exact clone-portable 474-path inventory and final documentation ownership', () => {
		expect(inventory.mleCommit).toBe('c1abea3de165032fe064300340807b7a6af388f8');
		expect(coverage.mleCommit).toBe(inventory.mleCommit);
		expect(inventory.scope).toContain('non-gitlink first-party paths');
		expect(inventory.records).toHaveLength(474);
		expect(coverage.records).toHaveLength(474);
		expect(compareSourceCoverage(inventory.records, coverage.records)).toEqual({
			missing: [], extra: [], discoveredDuplicates: [], documentedDuplicates: [], invalidOwners: [],
			invalidDispositions: [], invalidEvidence: [], ownerDisagreements: [],
		});
	});

	it('keeps the approved dispositions and evidence classes explicit', () => {
		expect(coverage.records.filter(({ disposition }) => disposition === 'internal/support-only')).toHaveLength(20);
		expect(coverage.records.filter(({ disposition }) => disposition === 'excluded-obsolete-doxygen')).toHaveLength(4);
		expect(coverage.records.filter(({ ownerPageId }) => ownerPageId !== undefined)).toHaveLength(450);
		expect(Object.fromEntries([...validEvidence].map((evidenceClass) => [
			evidenceClass,
			coverage.records.filter((record) => record.evidenceClass === evidenceClass).length,
		]))).toEqual({
			'Source-observed': 199,
			'Test-backed': 54,
			Demonstrated: 101,
			Fixture: 76,
			Generator: 1,
			Tool: 16,
			Manual: 1,
			'Support-only': 22,
			Excluded: 4,
		});
	});

	it('detects omissions, extras, duplicates, invalid values, and owner disagreement', () => {
		const first = coverage.records.find(({ ownerPageId }) => ownerPageId !== undefined) as SourceCoverageRecord;
		const second = coverage.records.find(({ ownerPageId }) => ownerPageId !== undefined && ownerPageId !== first.ownerPageId) as SourceCoverageRecord;
		const discoveredFirst = inventory.records.find(({ path }) => path === first.path) as SourceInventoryRecord;
		const withoutFirst = coverage.records.filter(({ path }) => path !== first.path);
		expect(compareSourceCoverage(inventory.records, withoutFirst).missing).toEqual([first.path]);
		expect(compareSourceCoverage(inventory.records, [...coverage.records, { ...first, path: 'not/in/mle' }]).extra)
			.toEqual(['not/in/mle']);
		expect(compareSourceCoverage([...inventory.records, discoveredFirst], coverage.records).discoveredDuplicates)
			.toEqual([first.path]);
		expect(compareSourceCoverage(inventory.records, [...coverage.records, first]).documentedDuplicates)
			.toEqual([first.path]);
		expect(compareSourceCoverage(inventory.records, [{ ...first, ownerPageId: 'not-a-page', disposition: undefined }, ...withoutFirst]).invalidOwners)
			.toEqual([first.path]);
		expect(compareSourceCoverage(inventory.records, [{ ...first, evidenceClass: 'Unknown' as EvidenceClass }, ...withoutFirst]).invalidEvidence)
			.toEqual([first.path]);
		expect(compareSourceCoverage(inventory.records, [{ ...first, ownerPageId: second.ownerPageId, disposition: second.disposition }, ...withoutFirst]).ownerDisagreements)
			.toEqual([first.path]);
	});
});
