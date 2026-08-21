import type { StarlightRouteData } from '@astrojs/starlight/route-data';
import type { PageRecord } from '../lib/content/page-index.ts';
import { buildPageIndex } from '../lib/content/page-index.ts';
import { docsPath } from '../lib/links/base.ts';
import type { Locale, TranslationStatus } from './taxonomy.ts';
import type { VersionEntry } from './versions.ts';
import {
	handbookGroups,
	type HandbookGroup,
	type HandbookPage,
} from './handbook.ts';

export const navigationPageIds = [
	'start',
	'concepts',
	'systems',
	'guides',
	'reference',
	'tools',
	'contributing',
] as const;

export type NavigationPageId = (typeof navigationPageIds)[number];
export const navigationSegments = [
	'start-here',
	'concepts',
	'systems',
	'guides',
	'reference',
	'tools',
	'contributing',
] as const;
export type NavigationSegment = (typeof navigationSegments)[number];
export type NavigationAccent = 'core' | 'renderer' | 'lua-ui' | 'audio' | 'tools';

export interface NavigationChild {
	readonly pageId: string;
	readonly labels: Readonly<Record<Locale, string>>;
}

export interface NavigationChildGroup {
	readonly id: string;
	readonly labels: Readonly<Record<Locale, string>>;
	readonly children: readonly NavigationChild[];
}

export interface NavigationSection {
	readonly pageId: NavigationPageId;
	readonly segment: NavigationSegment;
	readonly order: number;
	readonly accent: NavigationAccent;
	readonly labels: Readonly<Record<Locale, string>>;
	readonly summaries: Readonly<Record<Locale, string>>;
	readonly audienceGuidance: Readonly<Record<Locale, string>>;
	readonly plannedGroups: readonly NavigationChildGroup[];
}

const child = (pageId: string, en: string, ptBr: string): NavigationChild => ({
	pageId,
	labels: { en, 'pt-br': ptBr },
});

const group = (
	id: string,
	en: string,
	ptBr: string,
	children: readonly NavigationChild[],
): NavigationChildGroup => ({ id, labels: { en, 'pt-br': ptBr }, children });

const handbookPortugueseLabels: Readonly<Record<string, string>> = {
	architecture: 'Arquitetura', 'lifecycle-and-ownership': 'Ciclo de vida e propriedade', 'errors-and-diagnostics': 'Erros e diagnóstico', 'threading-and-synchronization': 'Threads e sincronização', 'frame-and-resource-flow': 'Fluxo de quadros e recursos', 'cpp-lua-boundary': 'Limite entre C++ e Lua', 'ui-composition': 'Composição de UI', 'audio-and-client-flow': 'Fluxo de áudio e Client',
	core: 'Runtime Core', 'runtime-configuration': 'Configuração de runtime', 'core-threading-and-performance': 'Threads e desempenho', math: 'Matemática', 'geometry-and-intersections': 'Geometria e interseções', 'lua-json-and-numerics': 'Lua, JSON e numéricos', utilities: 'Utilitários', 'events-and-concurrency': 'Eventos e concorrência', 'data-color-and-packing': 'Dados, cores e empacotamento', 'core-math-utility-types': 'Tipos de Core, matemática e utilitários',
	'renderer-overview': 'Renderer', 'frame-vulkan-and-queues': 'Quadro, Vulkan e filas', 'renderer-resources-and-synchronization': 'Recursos e sincronização', 'shaders-and-pipelines': 'Shaders e pipelines', 'targets-text-and-composition': 'Destinos, texto e composição', models: 'Modelos', 'loading-meshes-and-materials': 'Carregamento de malhas e materiais', 'animation-skeletons-and-cameras': 'Animação, esqueletos e câmeras', 'create-a-shader-and-pipeline': 'Criar um shader e pipeline', 'upload-and-render-a-model': 'Enviar e renderizar um modelo', 'control-camera-and-animation': 'Controlar câmera e animação', 'renderer-and-resource-contracts': 'Contratos de renderer e recursos',
	lua: 'Runtime Lua', 'runtime-calls-and-bindings': 'Chamadas e bindings de runtime', ui: 'UI', 'entities-hierarchy-and-layout': 'Entidades, hierarquia e layout', 'rendering-and-visuals': 'Renderização e visuais', 'text-input-and-focus': 'Entrada de texto e foco', 'ui-events-and-callbacks': 'Eventos e callbacks', 'scrolling-and-popups': 'Rolagem e pop-ups', 'animation-and-effects': 'Animação e efeitos', 'reusable-components': 'Componentes reutilizáveis', 'build-a-ui-screen': 'Criar uma tela de UI', 'create-a-reusable-ui-component': 'Criar um componente de UI reutilizável', 'build-a-form-and-handle-input': 'Criar um formulário e tratar entrada', 'add-scrolling-and-popups': 'Adicionar rolagem e pop-ups', 'animate-and-style-ui': 'Animar e estilizar UI', 'use-sprites-images-and-nine-slice': 'Usar sprites, imagens e nove fatias', 'lua-api': 'API Lua', 'ui-element-keys': 'Chaves de elemento de UI', 'ui-components': 'Componentes de UI', 'ui-events-and-callbacks-reference': 'Eventos e callbacks de UI', 'ui-layout-values': 'Valores de layout de UI', 'ui-test': 'Teste de UI',
	audio: 'Áudio', 'audio-lifecycle-and-command-flow': 'Ciclo de vida e fluxo de comandos', 'playback-and-streaming': 'Reprodução e streaming', 'buses-voices-and-limitations': 'Buses, vozes e limitações', 'use-audio-playback': 'Usar reprodução de áudio', 'audio-contracts': 'Contratos de áudio', 'audio-test': 'Teste de áudio', 'client-system': 'Client', window: 'Janela e entrada', server: 'Servidor experimental', 'create-a-client-layer': 'Criar uma camada do Client', 'handle-input-focus-and-text': 'Tratar entrada, foco e texto', 'window-and-input-contracts': 'Contratos de janela e entrada', 'interactive-client': 'Client interativo', 'core-test-suite': 'Suite de testes Core', 'model-test': 'Teste de modelos', 'test-fixtures': 'Fixtures de teste', mlecubes: 'MLECubes', 'tests-and-interactive-pages': 'Testes e páginas interativas',
};

const handbookGroupPortugueseLabels: Readonly<Record<string, string>> = {
	'concepts-foundations': 'Modelo do motor', 'core-foundations': 'Runtime Core', 'math-foundations': 'Matemática', 'utilities-foundations': 'Utilitários', 'foundation-reference': 'Referência de Core, matemática e utilitários', 'renderer-system': 'Renderer', 'models-system': 'Modelos e animação', 'renderer-guides': 'Guias de renderer e modelos', 'renderer-reference': 'Referência de renderer', 'lua-system': 'Runtime Lua', 'ui-system': 'UI', 'ui-guides': 'Guias de UI', 'ui-reference': 'Referência de Lua e UI', 'ui-tools': 'Ferramentas de UI', 'audio-system': 'Áudio', 'audio-guides': 'Guias de áudio', 'audio-reference': 'Referência de áudio', 'audio-tools': 'Ferramentas de áudio', 'client-system': 'Client', 'window-system': 'Janela e entrada', 'server-system': 'Servidor experimental', 'client-guides': 'Guias de Client e entrada', 'window-reference': 'Referência de janela e entrada', 'platform-tools': 'Ferramentas de Client e testes', 'contributing-tests': 'Testes e páginas interativas',
};

const handbookChild = (page: HandbookPage): NavigationChild => ({
	pageId: page.pageId,
	labels: { en: page.title, 'pt-br': handbookPortugueseLabels[page.pageId] ?? page.title },
});

const handbookGroup = (source: HandbookGroup, pages: readonly HandbookPage[]): NavigationChildGroup => ({
	id: source.id,
	labels: { en: source.label, 'pt-br': handbookGroupPortugueseLabels[source.id] ?? source.label },
	children: [...pages].sort((left, right) => left.order - right.order || left.pageId.localeCompare(right.pageId)).map(handbookChild),
});

const sortedHandbookGroups = (groups: readonly HandbookGroup[]) =>
	[...groups].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));

export function buildHandbookNavigationGroups(
	subsystem: string,
	groups: readonly HandbookGroup[] = handbookGroups,
	_locale: Locale = 'en',
): readonly NavigationChildGroup[] {
	return sortedHandbookGroups(groups)
		.map((source) => handbookGroup(source, source.pages.filter((page) => page.subsystem === subsystem)))
		.filter(({ children }) => children.length > 0);
}

const handbookNavigationGroupsForSection = (sectionId: NavigationPageId): readonly NavigationChildGroup[] =>
	sortedHandbookGroups(handbookGroups)
		.filter((source) => source.sectionId === sectionId)
		.map((source) => handbookGroup(source, source.pages));

const navigationSectionsBase = [
	{
		pageId: 'start',
		segment: 'start-here',
		order: 1,
		accent: 'core',
		labels: { en: 'Start Here', 'pt-br': 'Comece aqui' },
		summaries: {
			en: 'Setup, support boundaries, and the shortest path to a verified first run.',
			'pt-br': 'Preparação do ambiente, limites de suporte e o caminho mais curto para uma primeira execução verificada.',
		},
		audienceGuidance: {
			en: 'Start here if you are evaluating MLE or preparing to build this pinned snapshot.',
			'pt-br': 'Comece aqui se você está avaliando o MLE ou se preparando para compilar este snapshot fixado.',
		},
		plannedGroups: [
			group('orientation', 'Orientation', 'Orientação', [
				child('project-status', 'Project status', 'Estado do projeto'),
				child('requirements', 'Requirements and platform support', 'Requisitos e suporte de plataforma'),
			]),
			group('first-run', 'First verified run', 'Primeira execução verificada', [
				child('setup', 'Clone and setup', 'Clone e preparação'),
				child('build', 'Configure and build', 'Configuração e compilação'),
				child('tests', 'Run the Core tests', 'Execução dos testes Core'),
				child('client', 'Run the interactive Client', 'Execução do Client interativo'),
			]),
			group('repository-help', 'Repository help', 'Ajuda no repositório', [
				child('repository-tour', 'Repository tour', 'Visão geral do repositório'),
				child('troubleshooting', 'Setup troubleshooting', 'Solução de problemas de preparação'),
			]),
		],
	},
	{
		pageId: 'concepts',
		segment: 'concepts',
		order: 2,
		accent: 'core',
		labels: { en: 'Concepts', 'pt-br': 'Conceitos' },
		summaries: {
			en: 'Architecture and lifecycle explanations that connect MLE systems before code-level changes.',
			'pt-br': 'Explicações de arquitetura e ciclo de vida que conectam os sistemas do MLE antes de mudanças no código.',
		},
		audienceGuidance: {
			en: 'Use this section to build a mental model of the engine before changing ownership or control flow.',
			'pt-br': 'Use esta seção para formar um modelo mental do motor antes de alterar propriedade ou fluxo de controle.',
		},
		plannedGroups: [
			group('engine-model', 'Engine model', 'Modelo do motor', [
				child('architecture', 'Architecture', 'Arquitetura'),
				child('lifecycle', 'Startup and shutdown lifecycle', 'Ciclo de inicialização e encerramento'),
				child('ownership-lifetimes', 'Ownership and lifetimes', 'Propriedade e tempo de vida'),
				child('results-errors', 'Results and errors', 'Resultados e erros'),
			]),
			group('concurrency', 'Concurrency', 'Concorrência', [
				child('threading-synchronization', 'Threading and synchronization', 'Threads e sincronização'),
			]),
		],
	},
	{
		pageId: 'systems',
		segment: 'systems',
		order: 3,
		accent: 'renderer',
		labels: { en: 'Engine Systems', 'pt-br': 'Sistemas do motor' },
		summaries: {
			en: 'Implementation-oriented directories for MLE subsystems, ownership, data flow, and tests.',
			'pt-br': 'Diretórios voltados à implementação dos subsistemas do MLE, propriedade, fluxo de dados e testes.',
		},
		audienceGuidance: {
			en: 'Start here when tracing a subsystem through its owners, data flow, source files, and test evidence.',
			'pt-br': 'Comece aqui ao rastrear um subsistema por seus responsáveis, fluxo de dados, arquivos-fonte e evidências de teste.',
		},
		plannedGroups: [
			group('runtime-foundations', 'Runtime foundations', 'Fundamentos do runtime', [
				child('core', 'Core runtime', 'Núcleo do runtime'),
				child('math', 'Math', 'Matemática'),
				child('utilities', 'Utilities', 'Utilitários'),
			]),
			group('rendering-content', 'Rendering and content', 'Renderização e conteúdo', [
				child('renderer-overview', 'Renderer', 'Renderer'),
				child('models-animation', 'Models and animation', 'Modelos e animação'),
			]),
			group('runtime-integrations', 'Runtime integrations', 'Integrações do runtime', [
				child('lua-ui', 'Lua and UI', 'Lua e UI'),
				child('audio', 'Audio', 'Áudio'),
				child('window-input', 'Window and input', 'Janela e entrada'),
			]),
			group('experimental', 'Experimental systems', 'Sistemas experimentais', [
				child('experimental-server', 'Experimental server', 'Servidor experimental'),
			]),
		],
	},
	{
		pageId: 'guides',
		segment: 'guides',
		order: 4,
		accent: 'tools',
		labels: { en: 'Practical Guides', 'pt-br': 'Guias práticos' },
		summaries: {
			en: 'Outcome-driven procedures for completing a concrete integration, asset, or debugging task.',
			'pt-br': 'Procedimentos orientados a resultados para concluir uma tarefa concreta de integração, recurso ou depuração.',
		},
		audienceGuidance: {
			en: 'Choose a guide when you need a verified sequence of actions rather than a subsystem survey.',
			'pt-br': 'Escolha um guia quando precisar de uma sequência verificada de ações, e não de uma visão geral de subsistema.',
		},
		plannedGroups: [
			group('build-integrate', 'Build and integrate', 'Compilar e integrar', [
				child('build-workflow', 'Build workflow', 'Fluxo de compilação'),
				child('first-frame', 'Render a first frame', 'Renderização do primeiro frame'),
			]),
			group('features', 'Feature workflows', 'Fluxos de funcionalidades', [
				child('lua-ui-guide', 'Build a Lua UI', 'Criação de uma UI em Lua'),
				child('audio-guide', 'Add audio', 'Adição de áudio'),
				child('assets-shaders', 'Work with assets and shaders', 'Trabalho com recursos e shaders'),
			]),
			group('diagnostics', 'Diagnostics', 'Diagnóstico', [
				child('debugging', 'Debug a failing run', 'Depuração de uma execução com falha'),
			]),
		],
	},
	{
		pageId: 'reference',
		segment: 'reference',
		order: 5,
		accent: 'lua-ui',
		labels: { en: 'Reference', 'pt-br': 'Referência' },
		summaries: {
			en: 'Precise options, types, bindings, commands, and keys for checking an exact contract.',
			'pt-br': 'Opções, tipos, bindings, comandos e chaves precisos para consultar um contrato exato.',
		},
		audienceGuidance: {
			en: 'Return here when you know the area and need to confirm one exact name, value, or contract.',
			'pt-br': 'Volte a esta seção quando já conhecer a área e precisar confirmar um nome, valor ou contrato exato.',
		},
		plannedGroups: [
			group('build-commands', 'Build and commands', 'Compilação e comandos', [
				child('build-options', 'Build options', 'Opções de compilação'),
				child('helper-commands', 'Helper commands', 'Comandos auxiliares'),
			]),
			group('cpp-renderer', 'C++ and renderer', 'C++ e renderer', [
				child('core-math-utility-types', 'Core, math, and utility types', 'Tipos de Core, matemática e utilitários'),
				child('renderer-reference', 'Renderer reference', 'Referência do renderer'),
			]),
			group('runtime-bindings', 'Runtime bindings', 'Bindings do runtime', [
				child('lua-binding-inventory', 'Lua binding inventory', 'Inventário de bindings Lua'),
				child('ui-keys', 'UI keys', 'Chaves da UI'),
				child('audio-commands', 'Audio commands', 'Comandos de áudio'),
			]),
		],
	},
	{
		pageId: 'tools',
		segment: 'tools',
		order: 6,
		accent: 'tools',
		labels: { en: 'Tools and Test Applications', 'pt-br': 'Ferramentas e aplicativos de teste' },
		summaries: {
			en: 'Executable examples and development tools for validating behavior interactively.',
			'pt-br': 'Exemplos executáveis e ferramentas de desenvolvimento para validar comportamentos de forma interativa.',
		},
		audienceGuidance: {
			en: 'Use these pages when a runnable test or development application is the clearest source of evidence.',
			'pt-br': 'Use estas páginas quando um teste executável ou aplicativo de desenvolvimento for a fonte de evidência mais clara.',
		},
		plannedGroups: [
			group('automated-tests', 'Automated tests', 'Testes automatizados', [
				child('core-suite', 'Core suite', 'Suite Core'),
			]),
			group('interactive-client-pages', 'Interactive Client', 'Client interativo', [
				child('interactive-client', 'Interactive Client pages', 'Páginas do Client interativo'),
			]),
			group('resource-demos', 'Resource demonstrations', 'Demonstrações de recursos', [
				child('resource-demonstrations', 'Resource demonstrations', 'Demonstrações de recursos'),
			]),
			group('sample-applications', 'Sample applications', 'Aplicativos de exemplo', [
				child('mlecubes', 'MLECubes', 'MLECubes'),
			]),
		],
	},
	{
		pageId: 'contributing',
		segment: 'contributing',
		order: 7,
		accent: 'audio',
		labels: { en: 'Contributing', 'pt-br': 'Como contribuir' },
		summaries: {
			en: 'Environment, testing, resource, documentation, and translation practices for reviewable changes.',
			'pt-br': 'Práticas de ambiente, testes, recursos, documentação e tradução para mudanças fáceis de revisar.',
		},
		audienceGuidance: {
			en: 'Start here before preparing a change so its evidence, tests, documentation, and translation status are reviewable.',
			'pt-br': 'Comece aqui antes de preparar uma mudança para que evidências, testes, documentação e estado da tradução possam ser revisados.',
		},
		plannedGroups: [
			group('workflow', 'Contributor workflow', 'Fluxo de contribuição', [
				child('contributor-environment', 'Contributor environment', 'Ambiente de contribuição'),
				child('contributor-testing', 'Testing changes', 'Teste de mudanças'),
			]),
			group('project-assets', 'Project assets', 'Recursos do projeto', [
				child('resources-shaders', 'Resources and shaders', 'Recursos e shaders'),
			]),
			group('docs-localization', 'Documentation and localization', 'Documentação e localização', [
				child('documentation', 'Documentation', 'Documentação'),
				child('translations', 'Translations', 'Traduções'),
			]),
		],
	},
] as const satisfies readonly NavigationSection[];

export const navigationSections: readonly NavigationSection[] = navigationSectionsBase.map((section) => {
	if (section.pageId === 'start') return section;
	if (section.pageId === 'contributing') {
		return {
			...section,
			plannedGroups: [...section.plannedGroups, ...handbookNavigationGroupsForSection(section.pageId)],
		};
	}
	if (section.pageId === 'reference') {
		return {
			...section,
			plannedGroups: [
				...section.plannedGroups.filter((plannedGroup) => plannedGroup.id === 'build-commands'),
				...handbookNavigationGroupsForSection(section.pageId),
			],
		};
	}
	return { ...section, plannedGroups: handbookNavigationGroupsForSection(section.pageId) };
});

export function validateNavigationSections(
	sections: readonly Pick<NavigationSection, 'pageId' | 'segment' | 'order'>[],
): readonly string[] {
	const errors: string[] = [];
	const byPageId = new Map<string, NavigationPageId>();
	const bySegment = new Map<string, NavigationPageId>();
	const byOrder = new Map<number, NavigationPageId>();

	for (const section of sections) {
		if (byPageId.has(section.pageId)) {
			errors.push(`Duplicate navigation pageId ${section.pageId}.`);
		} else {
			byPageId.set(section.pageId, section.pageId);
		}
		const segmentOwner = bySegment.get(section.segment);
		if (segmentOwner) {
			errors.push(
				`Duplicate navigation segment ${section.segment} appears for ${segmentOwner} and ${section.pageId}.`,
			);
		} else {
			bySegment.set(section.segment, section.pageId);
		}
		const orderOwner = byOrder.get(section.order);
		if (orderOwner) {
			errors.push(
				`Duplicate navigation order ${section.order} appears for ${orderOwner} and ${section.pageId}.`,
			);
		} else {
			byOrder.set(section.order, section.pageId);
		}
	}

	return errors.sort((left, right) => left.localeCompare(right));
}

const registryErrors = validateNavigationSections(navigationSections);
if (registryErrors.length > 0) {
	throw new Error(['Invalid navigation section registry:', ...registryErrors].join('\n'));
}

export function getNavigationSection(pageId: NavigationPageId): NavigationSection {
	const section = navigationSections.find((candidate) => candidate.pageId === pageId);
	if (!section) throw new Error(`Unknown navigation section ${pageId}.`);
	return section;
}

export interface SectionIndexAvailableItem {
	readonly pageId: string;
	readonly label: string;
	readonly groupId: string;
	readonly groupLabel: string;
	readonly href: string;
	readonly translationStatus: TranslationStatus;
}

export interface SectionIndexPlannedItem {
	readonly pageId: string;
	readonly label: string;
	readonly availability: 'planned';
}

export interface SectionIndexPlannedGroup {
	readonly id: string;
	readonly label: string;
	readonly children: readonly SectionIndexPlannedItem[];
}

export interface SectionIndexModel {
	readonly section: NavigationSection;
	readonly available: readonly SectionIndexAvailableItem[];
	readonly plannedGroups: readonly SectionIndexPlannedGroup[];
}

export function buildSectionIndexModel(input: {
	sectionId: NavigationPageId;
	version: VersionEntry;
	locale: Locale;
	pages: readonly PageRecord[];
}): SectionIndexModel {
	const { sectionId, version, locale, pages } = input;
	const section = getNavigationSection(sectionId);
	if (!version.locales.includes(locale)) {
		throw new Error(`Version ${version.id} does not declare locale ${locale}.`);
	}

	const index = buildPageIndex(pages);
	const hub = index.find(version.id, locale, section.pageId);
	if (!hub || hub.translationStatus === 'fallback' || hub.slug !== section.segment) {
		throw new Error(
			`Navigation section ${section.pageId} has no physical ${locale} hub for version ${version.id} at ${section.segment}.`,
		);
	}

	const available: SectionIndexAvailableItem[] = [];
	const plannedGroups: SectionIndexPlannedGroup[] = [];
	for (const navigationGroup of section.plannedGroups) {
		const plannedChildren: SectionIndexPlannedItem[] = [];
		for (const navigationChild of navigationGroup.children) {
			const record = index.find(version.id, locale, navigationChild.pageId);
			if (!record) {
				plannedChildren.push({
					pageId: navigationChild.pageId,
					label: navigationChild.labels[locale],
					availability: 'planned',
				});
				continue;
			}

			if (!record.slug.startsWith(`${section.segment}/`)) {
				throw new Error(
					`Navigation child ${navigationChild.pageId} for ${section.pageId} resolves outside ${section.segment} in ${locale}/${version.id}.`,
				);
			}
			available.push({
				pageId: navigationChild.pageId,
				label: navigationChild.labels[locale],
				groupId: navigationGroup.id,
				groupLabel: navigationGroup.labels[locale],
				href: docsPath({ locale, versionId: version.id, slug: record.slug }),
				translationStatus: record.translationStatus,
			});
		}
		if (plannedChildren.length > 0) {
			plannedGroups.push({
				id: navigationGroup.id,
				label: navigationGroup.labels[locale],
				children: plannedChildren,
			});
		}
	}

	return { section, available, plannedGroups };
}

export interface SidebarGroup {
	readonly label: string;
	readonly translations: Readonly<Partial<Record<'pt-BR', string>>>;
	readonly collapsed?: boolean;
	readonly items: readonly SidebarSection[];
}

export interface SidebarSection {
	readonly label: string;
	readonly translations: Readonly<Partial<Record<'pt-BR', string>>>;
	readonly items: readonly [{ readonly autogenerate: { readonly directory: string } }];
}

type ResolvedSidebarEntry = StarlightRouteData['sidebar'][number];
type ResolvedSidebarLink = Extract<ResolvedSidebarEntry, { type: 'link' }>;

const registryOrderedSectionIds = navigationSections.map(({ pageId }) => pageId);

function registryPageIdForLink(
	entry: ResolvedSidebarEntry,
	version: VersionEntry,
	section: NavigationSection,
): string | undefined {
	if (entry.type !== 'link') return undefined;
	const pathname = new URL(entry.href, 'https://mledocs.invalid').pathname;
	const segments = pathname.split('/').filter(Boolean);
	const versionMarker = segments.findIndex(
		(segment, index) =>
			segment === 'versions' &&
			segments[index + 1] === version.id &&
			segments[index + 2] === section.segment,
	);
	if (versionMarker < 0) return undefined;

	const remainder = segments.slice(versionMarker + 3);
	if (remainder.length === 0) return section.pageId;
	const childPageIds = section.plannedGroups.flatMap((navigationGroup) =>
		navigationGroup.children.map((navigationChild) => navigationChild.pageId),
	);
	const handbookPage = handbookGroups
		.flatMap((handbookGroup) => handbookGroup.pages)
		.find((page) => page.sectionId === section.pageId && page.slug === [section.segment, ...remainder].join('/'));
	if (handbookPage && childPageIds.includes(handbookPage.pageId)) return handbookPage.pageId;
	return remainder.length === 1 && childPageIds.includes(remainder[0] ?? '') ? remainder[0] : undefined;
}

function orderSectionEntriesByRegistry(
	entries: readonly ResolvedSidebarEntry[],
	version: VersionEntry,
	section: NavigationSection,
): ResolvedSidebarEntry[] {
	const pageIds = [
		section.pageId,
		...section.plannedGroups.flatMap((navigationGroup) =>
			navigationGroup.children.map((navigationChild) => navigationChild.pageId),
		),
	];
	const rank = new Map(pageIds.map((pageId, index) => [pageId, index]));
	const orderedKnownEntries = entries
		.map((entry, index) => ({
			entry,
			index,
			pageId: registryPageIdForLink(entry, version, section),
		}))
		.filter(
			(candidate): candidate is typeof candidate & { pageId: string } =>
				candidate.pageId !== undefined,
		)
		.sort((left, right) =>
			(rank.get(left.pageId) ?? Number.MAX_SAFE_INTEGER) -
				(rank.get(right.pageId) ?? Number.MAX_SAFE_INTEGER) || left.index - right.index,
		)
		.map(({ entry }) => entry);
	let orderedIndex = 0;

	return entries.map((entry) =>
		registryPageIdForLink(entry, version, section)
			? (orderedKnownEntries[orderedIndex++] ?? entry)
			: entry,
	);
}

export function orderVersionedSidebarByRegistry(
	sidebar: readonly ResolvedSidebarEntry[],
	entries: readonly VersionEntry[],
	locale: Locale,
): readonly ResolvedSidebarEntry[] {
	return sidebar.map((sidebarEntry) => {
		if (sidebarEntry.type !== 'group') return sidebarEntry;
		const version = entries.find((entry) => sidebarEntry.label.startsWith(`${entry.id} · `));
		if (!version) return sidebarEntry;

		return {
			...sidebarEntry,
			entries: sidebarEntry.entries.map((sectionEntry) => {
				if (sectionEntry.type !== 'group') return sectionEntry;
				const section = registryOrderedSectionIds
					.map((pageId) => getNavigationSection(pageId))
					.find((candidate) => candidate.labels[locale] === sectionEntry.label);
				if (!section) return sectionEntry;

				return {
					...sectionEntry,
					entries: orderSectionEntriesByRegistry(sectionEntry.entries, version, section),
				};
			}),
		};
	});
}

function flattenResolvedSidebar(sidebar: readonly ResolvedSidebarEntry[]): ResolvedSidebarLink[] {
	return sidebar.flatMap((entry) =>
		entry.type === 'group' ? flattenResolvedSidebar(entry.entries) : [entry],
	);
}

export function buildSidebarPagination(
	sidebar: readonly ResolvedSidebarEntry[],
): StarlightRouteData['pagination'] {
	const links = flattenResolvedSidebar(sidebar);
	const currentIndex = links.findIndex((entry) => entry.isCurrent);
	return {
		prev: currentIndex > 0 ? links[currentIndex - 1] : undefined,
		next: currentIndex >= 0 ? links[currentIndex + 1] : undefined,
	};
}

export function filterVersionedSidebarByLocale(
	sidebar: readonly ResolvedSidebarEntry[],
	entries: readonly VersionEntry[],
	locale: Locale,
): readonly ResolvedSidebarEntry[] {
	return sidebar.filter((sidebarEntry) => {
		if (sidebarEntry.type !== 'group') return true;
		const version = entries.find((entry) => sidebarEntry.label.startsWith(`${entry.id} · `));
		return !version || version.locales.includes(locale);
	});
}

const versionStatusLabel = (version: VersionEntry, locale: Locale): string => {
	const status = version.status === 'current'
		? locale === 'pt-br' ? 'atual' : 'current'
		: locale === 'pt-br' ? 'arquivada' : 'archived';
	return `${version.id} · ${version.committedAt} · ${status}`;
};

const compareVersions = (left: VersionEntry, right: VersionEntry): number => {
	if (left.status !== right.status) return left.status === 'current' ? -1 : 1;
	if (left.committedAt !== right.committedAt) return left.committedAt > right.committedAt ? -1 : 1;
	return left.id.localeCompare(right.id);
};

export function buildVersionedSidebar(
	entries: readonly VersionEntry[],
): readonly SidebarGroup[] {
	return [...entries].sort(compareVersions).map((version) => {
		const hasPortuguese = version.locales.includes('pt-br');
		return {
			label: versionStatusLabel(version, 'en'),
			translations: hasPortuguese ? { 'pt-BR': versionStatusLabel(version, 'pt-br') } : {},
			collapsed: version.status === 'archived',
			items: navigationSections.map((section) => ({
				label: section.labels.en,
				translations: hasPortuguese ? { 'pt-BR': section.labels['pt-br'] } : {},
				items: [
					{
						autogenerate: {
							directory: `versions/${version.id}/${section.segment}`,
						},
					},
				],
			})),
		};
	});
}
