import type { Locale } from '../../data/taxonomy';

export interface LandingCopy {
	readonly metadata: { readonly title: string; readonly description: string };
	readonly header: {
		readonly homeLabel: string;
		readonly navigationLabel: string;
		readonly languageLabel: string;
		readonly versionLabel: string;
		readonly sourceLabel: string;
	};
	readonly hero: {
		readonly eyebrow: string;
		readonly title: string;
		readonly lede: string;
		readonly note: string;
		readonly start: string;
		readonly systems: string;
		readonly imageAlt: string;
		readonly imageCaption: string;
		readonly imageSource: string;
	};
	readonly features: {
		readonly eyebrow: string;
		readonly title: string;
		readonly bands: readonly [
			{
				readonly number: '01';
				readonly label: string;
				readonly title: string;
				readonly summary: string;
				readonly facts: readonly string[];
				readonly destinationId: 'concepts';
			},
			{
				readonly number: '02';
				readonly label: string;
				readonly title: string;
				readonly summary: string;
				readonly facts: readonly string[];
				readonly destinationId: 'systems';
			},
			{
				readonly number: '03';
				readonly label: string;
				readonly title: string;
				readonly summary: string;
				readonly facts: readonly string[];
				readonly destinationId: 'tools';
			},
		];
		readonly openSection: (sectionLabel: string) => string;
	};
	readonly directory: {
		readonly eyebrow: string;
		readonly title: string;
		readonly registryCount: (count: number) => string;
	};
	readonly evidence: {
		readonly eyebrow: string;
		readonly title: string;
		readonly summary: string;
		readonly snapshot: string;
		readonly commitDate: string;
		readonly status: string;
		readonly languages: string;
		readonly source: string;
	};
	readonly footer: { readonly documentation: string; readonly snapshot: (id: string) => string };
}

type FeatureBand = LandingCopy['features']['bands'][number];

const englishBands = [
	{
		number: '01',
		label: 'Foundation and platform',
		title: 'A C++23 core connected to the host platform',
		summary:
			'MLE organizes runtime ownership, math, utilities, events, and concurrency around a C++23 foundation.',
		facts: [
			'SDL supplies window creation, focus, text, and input boundaries.',
			'The Client layer connects engine systems to an interactive application.',
			'A server subsystem exists in the snapshot and is documented as experimental.',
		],
		destinationId: 'concepts',
	},
	{
		number: '02',
		label: 'Rendering and content',
		title: 'Vulkan rendering with models and animation',
		summary:
			'The renderer covers frame flow, queues, resources, synchronization, shaders, pipelines, render targets, and text composition.',
		facts: [
			'Model workflows load meshes and materials into renderer-owned resources.',
			'Animation support connects skeletons, cameras, and per-frame control.',
			'Guides and references trace the same pinned implementation contracts.',
		],
		destinationId: 'systems',
	},
	{
		number: '03',
		label: 'Runtime integrations',
		title: 'Lua-driven UI, OpenAL audio, and working tools',
		summary:
			'MLE exposes a retained interface system to Lua, with layout, input, events, reusable components, scrolling, and visual effects.',
		facts: [
			'OpenAL-backed audio covers playback, streaming, buses, voices, and command flow.',
			'Tool and test applications exercise Core, models, UI, audio, and the Client layer.',
			'Test fixtures support repeatable development and documentation workflows.',
		],
		destinationId: 'tools',
	},
] as const satisfies readonly FeatureBand[];

const portugueseBands = [
	{
		number: '01',
		label: 'Base e plataforma',
		title: 'Um núcleo C++23 conectado à plataforma hospedeira',
		summary: 'O MLE organiza propriedade de runtime, matemática, utilitários, eventos e concorrência sobre uma base C++23.',
		facts: [
			'O SDL fornece os limites de criação de janela, foco, texto e entrada.',
			'A camada Client conecta os sistemas do motor a um aplicativo interativo.',
			'Um subsistema de servidor existe no snapshot e está documentado como experimental.',
		],
		destinationId: 'concepts',
	},
	{
		number: '02',
		label: 'Renderização e conteúdo',
		title: 'Renderização Vulkan com modelos e animação',
		summary: 'O renderer abrange fluxo de quadros, filas, recursos, sincronização, shaders, pipelines, destinos de renderização e composição de texto.',
		facts: [
			'Os fluxos de modelos carregam malhas e materiais em recursos pertencentes ao renderer.',
			'O suporte a animação conecta esqueletos, câmeras e controle por quadro.',
			'Guias e referências rastreiam os mesmos contratos da implementação fixada.',
		],
		destinationId: 'systems',
	},
	{
		number: '03',
		label: 'Integrações de runtime',
		title: 'UI controlada por Lua, áudio OpenAL e ferramentas funcionais',
		summary: 'O MLE expõe a Lua um sistema de interface retida com layout, entrada, eventos, componentes reutilizáveis, rolagem e efeitos visuais.',
		facts: [
			'O áudio baseado em OpenAL abrange reprodução, streaming, buses, vozes e fluxo de comandos.',
			'Ferramentas e aplicativos de teste exercitam Core, modelos, UI, áudio e a camada Client.',
			'Fixtures de teste sustentam fluxos reproduzíveis de desenvolvimento e documentação.',
		],
		destinationId: 'tools',
	},
] as const satisfies readonly FeatureBand[];

export const landingCopy: Readonly<Record<Locale, LandingCopy>> = {
	en: {
		metadata: { title: 'MLE · C++23 game engine documentation', description: 'MLE is a C++23 game engine with Vulkan rendering, Lua-driven UI, OpenAL audio, SDL window and input, and development tools.' },
		header: { homeLabel: 'MLE documentation home', navigationLabel: 'Documentation and source links', languageLabel: 'Language', versionLabel: 'Documentation version', sourceLabel: 'GitHub' },
		hero: { eyebrow: 'Engine overview · pinned source documentation', title: 'A C++23 game engine for building real-time experiences', lede: 'MLE brings Vulkan rendering, model and animation systems, a Lua-driven retained UI, OpenAL audio, and SDL window and input into one documented codebase.', note: 'The repository also includes development tools, test applications, and an experimental server subsystem.', start: 'Start here', systems: 'Explore systems', imageAlt: 'Gameplay scene rendered by MLE', imageCaption: 'Gameplay output from the pinned MLE snapshot.', imageSource: 'View source image' },
		features: { eyebrow: 'Engine capabilities', title: 'Follow the systems from foundation to feedback', bands: englishBands, openSection: (label) => `Open ${label}` },
		directory: { eyebrow: 'Documentation directory', title: 'Choose a route through the handbook', registryCount: (count) => `${count} sections from the navigation registry` },
		evidence: { eyebrow: 'Snapshot evidence', title: 'Documentation tied to one source state', summary: 'This handbook records an in-development snapshot instead of a moving branch.', snapshot: 'Selected snapshot', commitDate: 'Commit date', status: 'Status', languages: 'Languages', source: 'Inspect the full commit' },
		footer: { documentation: 'MLE documentation', snapshot: (id) => `Snapshot ${id}` },
	},
	'pt-br': {
		metadata: { title: 'MLE · Documentação do motor de jogos C++23', description: 'MLE é um motor de jogos C++23 com renderização Vulkan, UI controlada por Lua, áudio OpenAL, janela e entrada SDL e ferramentas de desenvolvimento.' },
		header: { homeLabel: 'Página inicial da documentação do MLE', navigationLabel: 'Links da documentação e do código-fonte', languageLabel: 'Idioma', versionLabel: 'Versão da documentação', sourceLabel: 'GitHub' },
		hero: { eyebrow: 'Visão geral do motor · documentação vinculada ao código-fonte', title: 'Um motor de jogos C++23 para criar experiências em tempo real', lede: 'O MLE reúne renderização Vulkan, sistemas de modelos e animação, uma UI retida controlada por Lua, áudio OpenAL e janela e entrada SDL em uma única base de código documentada.', note: 'O repositório também inclui ferramentas de desenvolvimento, aplicativos de teste e um subsistema de servidor experimental.', start: 'Comece aqui', systems: 'Explore os sistemas', imageAlt: 'Cena de jogo renderizada pelo MLE', imageCaption: 'Resultado de jogo do snapshot fixado do MLE.', imageSource: 'Ver imagem de origem' },
		features: { eyebrow: 'Recursos do motor', title: 'Acompanhe os sistemas da base ao resultado', bands: portugueseBands, openSection: (label) => `Abrir ${label}` },
		directory: { eyebrow: 'Diretório da documentação', title: 'Escolha um caminho pelo manual', registryCount: (count) => `${count} seções do registro de navegação` },
		evidence: { eyebrow: 'Evidência do snapshot', title: 'Documentação vinculada a um estado do código-fonte', summary: 'Este manual registra um snapshot em desenvolvimento, e não um branch em movimento.', snapshot: 'Snapshot selecionado', commitDate: 'Data do commit', status: 'Estado', languages: 'Idiomas', source: 'Inspecionar o commit completo' },
		footer: { documentation: 'Documentação do MLE', snapshot: (id) => `Snapshot ${id}` },
	},
};
