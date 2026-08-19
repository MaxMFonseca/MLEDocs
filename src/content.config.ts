import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { z } from 'astro/zod';
import { audiences, maturities, subsystems } from './data/taxonomy';

const translationStatuses = ['canonical', 'current', 'stale', 'fallback'] as const;

export const technicalPageMetadataSchema = z
	.object({
		mleCommit: z.string().regex(/^[0-9a-f]{40}$/),
		maturity: z.enum(maturities),
		audiences: z.array(z.enum(audiences)).min(1),
		subsystems: z.array(z.enum(subsystems)).min(1),
		sourceFiles: z.array(z.string()).default([]),
		testFiles: z.array(z.string()).default([]),
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

const technicalPageSchema = technicalPageMetadataSchema.extend({
	contentType: z.literal('technical'),
});

const landingPageSchema = z.object({
	contentType: z.enum(['homepage', 'redirect']),
});

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.union([technicalPageSchema, landingPageSchema]),
    }),
  }),
};
