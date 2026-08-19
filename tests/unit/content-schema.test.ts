import { describe, expect, it } from 'vitest';
import {
	audiences,
	locales,
	maturities,
	versionStatuses,
} from '../../src/data/taxonomy';
import { technicalPageMetadataSchema } from '../../src/content.config';

const technicalPage = {
	mleCommit: 'c1abea3de165032fe064300340807b7a6af388f8',
	maturity: 'stable-enough',
	audiences: ['integrator'],
	subsystems: ['core'],
	lastVerified: '2026-08-18',
	translationStatus: 'canonical',
	pageId: 'core-overview',
};

describe('documentation taxonomy', () => {
	it('keeps the published value sets exact', () => {
		expect(locales).toEqual(['en', 'pt-br']);
		expect(maturities).toEqual(['stable-enough', 'in-development', 'experimental']);
		expect(audiences).toEqual(['integrator', 'contributor']);
		expect(versionStatuses).toEqual(['current', 'archived']);
	});
});

describe('technical page metadata', () => {
	it('rejects an invalid MLE SHA and unknown maturity', () => {
		expect(
		technicalPageMetadataSchema.safeParse({
			...technicalPage,
			mleCommit: 'c1abea3de165',
			maturity: 'unsupported',
		}).success,
	).toBe(false);
	});

	it('rejects a source verification date on canonical English pages', () => {
		expect(
		technicalPageMetadataSchema.safeParse({
			...technicalPage,
			translationSourceLastVerified: '2026-08-18',
		}).success,
	).toBe(false);
	});

	it('requires source verification for current Portuguese translations', () => {
		expect(
		technicalPageMetadataSchema.safeParse({
			...technicalPage,
			translationStatus: 'current',
		}).success,
	).toBe(false);
		expect(
		technicalPageMetadataSchema.safeParse({
			...technicalPage,
			translationStatus: 'current',
			translationSourceLastVerified: '2026-08-18',
		}).success,
	).toBe(true);
	});
});
