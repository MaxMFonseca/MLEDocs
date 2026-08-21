import { describe, expect, it } from 'vitest';
import {
	handbookGroups,
	handbookPages,
	getHandbookPage,
	validateHandbookRegistry,
	type HandbookGroup,
} from '../../src/data/handbook';

describe('handbook registry', () => {
	it('defines the complete handbook inventory with the approved depth and lookup contracts', () => {
		expect(handbookPages).toHaveLength(71);
		expect(new Set(handbookPages.map(({ pageId }) => pageId)).size).toBe(71);
		expect(handbookPages.filter(({ emphasis }) => emphasis === 'deep').every(
			({ subsystem }) => subsystem === 'lua' || subsystem === 'ui',
		)).toBe(true);
		expect(handbookPages.find(({ pageId }) => pageId === 'ui-element-keys')?.slug)
			.toBe('reference/ui-element-keys');
		expect(validateHandbookRegistry(handbookGroups)).toEqual([]);
	});

	it('reports independent malformed registry contracts in stable lexical order', () => {
		const [firstGroup, ...otherGroups] = handbookGroups;
		if (!firstGroup) throw new Error('expected handbook registry group');
		const firstPage = firstGroup.pages[0];
		const referencePage = handbookPages.find(({ kind }) => kind === 'reference');
		if (!firstPage || !referencePage) throw new Error('expected handbook registry pages');

		const invalid: readonly HandbookGroup[] = [
			{
				...firstGroup,
				pages: [
					firstPage,
					{ ...firstPage, slug: 'concepts/another-route', order: 2 },
					{ ...firstPage, pageId: 'duplicate-slug', order: 3 },
					{ ...referencePage, pageId: 'orphan-reference', slug: 'reference/orphan-reference', ownerPageId: 'missing-owner', order: 4 },
					{ ...firstPage, pageId: 'invalid-publication', slug: 'concepts/invalid-publication', publication: 'draft' as never, order: 5 },
				],
			},
			{ ...otherGroups[0]!, sectionId: 'unknown' as never },
			...otherGroups.slice(1),
		];

		expect(validateHandbookRegistry(invalid)).toEqual([
			'Duplicate handbook pageId architecture.',
			'Duplicate handbook slug concepts/architecture.',
			'Handbook group core-foundations references unknown navigation section unknown.',
			'Handbook page invalid-publication has invalid publication draft.',
			'Handbook page orphan-reference references unknown owner missing-owner.',
		]);
	});

	it('fails lookup with the stable page identity diagnostic', () => {
		expect(() => getHandbookPage('not-a-handbook-page')).toThrow(
			'Unknown handbook page not-a-handbook-page.',
		);
	});
});
