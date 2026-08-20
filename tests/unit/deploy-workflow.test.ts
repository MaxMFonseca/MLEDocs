import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const yamlPath = require.resolve('yaml', { paths: [require.resolve('astro')] });
const { parse } = require(yamlPath) as { parse(source: string): Record<string, any> };

const loadWorkflow = (): Record<string, any> =>
	parse(readFileSync('.github/workflows/deploy.yml', 'utf8'));

describe('GitHub Pages workflow permissions', () => {
	it('gives the build job only repository read access and no publication credentials', () => {
		const workflow = loadWorkflow();

		expect(workflow.permissions).toEqual({});
		expect(workflow.jobs.build.permissions).toEqual({ contents: 'read' });
		expect(workflow.jobs.build.steps.map((step: { uses?: string }) => step.uses)).toEqual([
			'actions/checkout@v5',
			'withastro/action@v5',
		]);
		expect(JSON.stringify(workflow.jobs.build)).not.toMatch(/pages|id-token/);
	});

	it('grants publication credentials only to the dependent deploy job', () => {
		const workflow = loadWorkflow();

		expect(Object.keys(workflow.jobs)).toEqual(['build', 'deploy']);
		expect(workflow.jobs.deploy.needs).toBe('build');
		expect(workflow.jobs.deploy.permissions).toEqual({
			pages: 'write',
			'id-token': 'write',
		});
		expect(workflow.jobs.deploy.steps).toEqual([
			{ id: 'deployment', uses: 'actions/deploy-pages@v4' },
		]);
	});
});
