import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'astro/zod';
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
	sectionPageMetadataSchema,
	technicalPageMetadataSchema,
} from '../../src/content.config';
import { collections } from '../../src/content.config';

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

const englishSection = {
	pageId: 'systems',
	mleCommit: 'c1abea3de165032fe064300340807b7a6af388f8',
	lastVerified: '2026-08-20',
	translationStatus: 'canonical',
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

describe('section page metadata', () => {
	it('accepts canonical English and current Brazilian Portuguese section controls', () => {
		expect(sectionPageMetadataSchema.parse(englishSection)).toEqual(englishSection);
		expect(
			sectionPageMetadataSchema.parse({
				...englishSection,
				translationStatus: 'current',
				translationSourceLastVerified: '2026-08-20',
			}),
		).toMatchObject({
			pageId: 'systems',
			translationStatus: 'current',
			translationSourceLastVerified: '2026-08-20',
		});
	});

	it('rejects malformed section commits and incomplete translated revision metadata', () => {
		expect(
			sectionPageMetadataSchema.safeParse({
				...englishSection,
				mleCommit: 'c1abea3de165',
			}).success,
		).toBe(false);
		expect(
			sectionPageMetadataSchema.safeParse({
				...englishSection,
				translationStatus: 'current',
			}).success,
		).toBe(false);
	});

	it('rejects fallback as authored section metadata', () => {
		expect(
			sectionPageMetadataSchema.safeParse({
				...englishSection,
				translationStatus: 'fallback',
			}).success,
		).toBe(false);
	});

	it('accepts section pages in the Astro docs collection', () => {
		const collectionSchema = collections.docs.schema;
		if (typeof collectionSchema !== 'function') {
			throw new Error('The Starlight docs collection must expose a schema factory.');
		}

		expect(
			collectionSchema({
				image: () =>
					z.object({
						src: z.string(),
						width: z.number(),
						height: z.number(),
						format: z.union([
							z.literal('png'),
							z.literal('jpg'),
							z.literal('jpeg'),
							z.literal('tiff'),
							z.literal('webp'),
							z.literal('gif'),
							z.literal('svg'),
							z.literal('avif'),
						]),
					}),
			}).safeParse({
				title: 'Engine Systems',
				description: 'Navigation for the engine systems documentation area.',
				contentType: 'section',
				...englishSection,
			}).success,
		).toBe(true);
	});
});

describe('custom Portuguese UI strings', () => {
	it('provides every project-specific picker, status, fallback, source, and scoped-search label', () => {
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
			'mle.search.scopeActive': 'Commit e idioma atuais',
			'mle.search.scopeAll': 'Todos os commits e idiomas',
			'mle.search.versionBadge': 'Commit',
			'mle.search.languageBadge': 'Idioma',
			'mle.search.resultsContext': 'Contexto dos resultados',
		});
	});
});
