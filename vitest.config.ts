import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
	resolve: {
		alias: {
			'astro:content': fileURLToPath(
				new URL('./node_modules/astro/dist/content/config.js', import.meta.url),
			),
		},
	},
	test: {
		include: ['tests/unit/**/*.test.ts'],
	},
});
