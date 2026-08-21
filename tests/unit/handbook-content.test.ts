import { describe, expect, it } from 'vitest';
import { handbookPages } from '../../src/data/handbook';

describe('handbook content contract', () => {
	it('keeps the existing renderer page as the only initially published handbook page', () => {
		expect(handbookPages.filter(({ publication }) => publication === 'published').map(({ pageId, slug }) => ({ pageId, slug }))).toEqual([
			{ pageId: 'renderer-overview', slug: 'systems/renderer' },
		]);
	});
});
