import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4321/MLEDocs/';

export default defineConfig({
	testDir: '.',
	testMatch: ['tests/**/*.spec.ts'],
	globalSetup: './tests/support/preview-server.mjs',
	fullyParallel: true,
	forbidOnly: true,
	retries: 0,
	reporter: 'line',
	outputDir: 'test-results',
	snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}',
	use: {
		baseURL,
		locale: 'en-US',
		timezoneId: 'UTC',
		viewport: { width: 1280, height: 800 },
		colorScheme: 'dark',
		contextOptions: { reducedMotion: 'reduce' },
		screenshot: 'only-on-failure',
		trace: 'on-first-retry',
		video: 'off',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
		},
		{
			name: 'firefox',
			testIgnore: ['tests/visual/**/*.spec.ts'],
			use: {
				...devices['Desktop Firefox'],
				viewport: { width: 1280, height: 800 },
				launchOptions: { timeout: 10_000 },
			},
		},
		{
			name: 'webkit',
			testIgnore: ['tests/visual/**/*.spec.ts'],
			use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 } },
		},
	],
});
