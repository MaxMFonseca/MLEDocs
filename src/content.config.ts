import { defineCollection } from 'astro:content';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';
import { z } from 'astro/zod';
import {
	customI18nSchema,
	homepagePageSchema,
	redirectPageSchema,
	technicalPageSchema,
} from './lib/content/schema';

export {
	customI18nSchema,
	homepagePageMetadataSchema,
	technicalPageMetadataSchema,
} from './lib/content/schema';

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
