import { defineCollection } from 'astro:content';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';
import { z } from 'astro/zod';
import {
	audiences,
	maturities,
	subsystems,
	translationStatuses,
} from './data/taxonomy';

const pageTranslationMetadataSchema = z
	.object({
		lastVerified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
		translationStatus: z.enum(translationStatuses),
		translationSourceLastVerified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
		pageId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
	})
	.superRefine((page, context) => {
		if (page.translationStatus === 'canonical' && page.translationSourceLastVerified) {
			context.addIssue({
				code: 'custom',
				path: ['translationSourceLastVerified'],
				message: 'Canonical English pages must not declare a translation source verification date.',
			});
		}

		if (
			(page.translationStatus === 'current' || page.translationStatus === 'stale') &&
			!page.translationSourceLastVerified
		) {
			context.addIssue({
				code: 'custom',
				path: ['translationSourceLastVerified'],
				message: 'Current and stale Portuguese translations require a source verification date.',
			});
		}
	});

export const homepagePageMetadataSchema = pageTranslationMetadataSchema;

export const technicalPageMetadataSchema = pageTranslationMetadataSchema.extend({
	mleCommit: z.string().regex(/^[0-9a-f]{40}$/),
	maturity: z.enum(maturities),
	audiences: z.array(z.enum(audiences)).min(1),
	subsystems: z.array(z.enum(subsystems)).min(1),
	sourceFiles: z.array(z.string()).default([]),
	testFiles: z.array(z.string()).default([]),
});

const technicalPageSchema = technicalPageMetadataSchema.extend({
	contentType: z.literal('technical'),
});

const homepagePageSchema = homepagePageMetadataSchema.extend({
	contentType: z.literal('homepage'),
});

const redirectPageSchema = z.object({
	contentType: z.literal('redirect'),
});

export const customI18nSchema = z.object({
	'mle.versionPicker.label': z.string(),
	'mle.versionPicker.current': z.string(),
	'mle.maturity.label': z.string(),
	'mle.maturity.stableEnough': z.string(),
	'mle.maturity.inDevelopment': z.string(),
	'mle.maturity.experimental': z.string(),
	'mle.translation.fallback': z.string(),
	'mle.missingPage.title': z.string(),
	'mle.missingPage.overviewLink': z.string(),
	'mle.source.label': z.string(),
	'mle.source.tests': z.string(),
	'mle.search.scopeLabel': z.string(),
	'mle.search.currentSnapshot': z.string(),
	'mle.search.allSnapshots': z.string(),
});

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			extend: z.union([technicalPageSchema, homepagePageSchema, redirectPageSchema]),
		}),
	}),
	i18n: defineCollection({
		loader: i18nLoader(),
		schema: i18nSchema({ extend: customI18nSchema }),
	}),
};
