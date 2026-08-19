import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	audiences,
	locales,
	maturities,
	translationStatuses,
	versionStatuses,
} from '../../src/data/taxonomy';
import {
	customI18nSchema,
	homepagePageMetadataSchema,
	technicalPageMetadataSchema,
} from '../../src/content.config';

const snapshotDirectory = resolve('src/content/docs/versions/c1abea3de165');
const portugueseSnapshotDirectory = resolve('src/content/docs/pt-br/versions/c1abea3de165');

const parseScalar = (value: string): string => value.replace(/^(['"])(.*)\1$/, '$2');

const readFrontmatter = (path: string): Record<string, unknown> => {
	const source = readFileSync(path, 'utf8');
	const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
	if (!match) throw new Error(`Missing frontmatter in ${path}.`);

	const data: Record<string, unknown> = {};
	let currentArray: string | undefined;
	for (const rawLine of match[1].split(/\r?\n/)) {
		const arrayItem = /^\s+-\s+(.+)$/.exec(rawLine);
		if (arrayItem && currentArray) {
			(data[currentArray] as string[]).push(parseScalar(arrayItem[1]));
			continue;
		}

		const field = /^([A-Za-z][A-Za-z0-9]*):(?:\s*(.*))?$/.exec(rawLine);
		if (!field) continue;
		const [, key, rawValue = ''] = field;
		if (rawValue === '') {
			data[key] = [];
			currentArray = key;
		} else {
			data[key] = parseScalar(rawValue);
			currentArray = undefined;
		}
	}

	return data;
};

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
		expect(translationStatuses).toEqual(['canonical', 'current', 'stale', 'fallback']);
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

	it('validates the representative project-status evidence metadata', () => {
		const metadata = readFrontmatter(resolve(snapshotDirectory, 'start-here/project-status.mdx'));

		expect(technicalPageMetadataSchema.parse(metadata)).toMatchObject({
			mleCommit: 'c1abea3de165032fe064300340807b7a6af388f8',
			maturity: 'in-development',
			audiences: ['integrator', 'contributor'],
			subsystems: ['project'],
			sourceFiles: ['README.md'],
			testFiles: [],
			lastVerified: '2026-08-20',
			translationStatus: 'canonical',
			pageId: 'project-status',
		});
	});

	it('validates pinned renderer sources and matching Core tests', () => {
		const metadata = readFrontmatter(resolve(snapshotDirectory, 'systems/renderer/index.mdx'));
		const parsed = technicalPageMetadataSchema.parse(metadata);

		expect(parsed).toMatchObject({
			mleCommit: 'c1abea3de165032fe064300340807b7a6af388f8',
			maturity: 'in-development',
			audiences: ['integrator', 'contributor'],
			subsystems: ['renderer'],
			lastVerified: '2026-08-20',
			translationStatus: 'canonical',
			pageId: 'renderer-overview',
		});
		expect(parsed.sourceFiles).toEqual(
			expect.arrayContaining([
				'src/mle/renderer/Renderer.h',
				'src/mle/renderer/Renderer.cpp',
				'src/mle/renderer/VkCtx.h',
				'src/mle/renderer/VkCtx.cpp',
				'src/mle/renderer/FrameRenderer.h',
				'src/mle/renderer/FrameRenderer.cpp',
			]),
		);
		expect(parsed.testFiles).toEqual(
			expect.arrayContaining([
				'tests/Core/src/renderer/T.FrameRenderer.cpp',
				'tests/Core/src/renderer/T.Buffer.cpp',
				'tests/Core/src/renderer/T.Image.cpp',
				'tests/Core/src/renderer/T.Pipeline.cpp',
				'tests/Core/src/renderer/T.Shader.cpp',
			]),
		);
	});
});

describe('homepage translation metadata', () => {
	it('marks the English snapshot overview as canonical', () => {
		const metadata = readFrontmatter(resolve(snapshotDirectory, 'index.mdx'));

		expect(homepagePageMetadataSchema.parse(metadata)).toEqual({
			pageId: 'overview',
			lastVerified: '2026-08-20',
			translationStatus: 'canonical',
		});
	});

	it('pins the current Portuguese overview to the exact English revision', () => {
		const english = homepagePageMetadataSchema.parse(
			readFrontmatter(resolve(snapshotDirectory, 'index.mdx')),
		);
		const portuguese = homepagePageMetadataSchema.parse(
			readFrontmatter(resolve(portugueseSnapshotDirectory, 'index.mdx')),
		);

		expect(portuguese).toEqual({
			pageId: 'overview',
			lastVerified: '2026-08-20',
			translationStatus: 'current',
			translationSourceLastVerified: english.lastVerified,
		});
	});
});

describe('custom Portuguese UI strings', () => {
	it('provides every project-specific picker, status, fallback, source, and search label', () => {
		const ui = JSON.parse(
			readFileSync(resolve('src/content/i18n/pt-BR.json'), 'utf8'),
		) as unknown;

		expect(customI18nSchema.parse(ui)).toEqual({
			'mle.versionPicker.label': 'Versão da documentação',
			'mle.versionPicker.current': 'Atual',
			'mle.maturity.label': 'Maturidade',
			'mle.maturity.stableEnough': 'Estável o suficiente',
			'mle.maturity.inDevelopment': 'Em desenvolvimento',
			'mle.maturity.experimental': 'Experimental',
			'mle.translation.fallback': 'Esta página está disponível em inglês para a mesma versão do MLE.',
			'mle.missingPage.title': 'Página indisponível nesta versão',
			'mle.missingPage.overviewLink': 'Voltar para a visão geral desta versão',
			'mle.source.label': 'Evidências no código-fonte',
			'mle.source.tests': 'Testes relacionados',
			'mle.search.scopeLabel': 'Escopo da pesquisa',
			'mle.search.currentSnapshot': 'Versão e idioma atuais',
			'mle.search.allSnapshots': 'Todas as versões e idiomas',
		});
	});
});
