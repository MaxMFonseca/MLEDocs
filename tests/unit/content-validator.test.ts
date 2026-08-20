import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { constants } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';
import { validateContent } from '../../scripts/validate-content.mjs';
import { validateBuiltLinks } from '../../scripts/validate-links.mjs';
import { validatePerformance } from '../../scripts/validate-performance.mjs';
import {
	readVerifiedFile,
	walkBounded,
} from '../../scripts/validator-filesystem.mjs';

const currentCommit = 'c1abea3de165032fe064300340807b7a6af388f8';
const archivedCommit = 'dddddddddddddddddddddddddddddddddddddddd';
const fixtures = resolve('tests/fixtures');
const temporaryDirectories: string[] = [];
type Diagnostic = { readonly ruleId: string; readonly line?: number };
const require = createRequire(import.meta.url);
const mdxCompilerPath = require.resolve('@mdx-js/mdx', { paths: [require.resolve('astro')] });

const manifest = [
	{
		commit: currentCommit,
		id: currentCommit.slice(0, 12),
		committedAt: '2026-08-18',
		label: { en: 'Current', 'pt-br': 'Atual' },
		status: 'current',
		locales: ['en', 'pt-br'],
		repositoryUrl: 'https://github.com/MaxMFonseca/MLE',
		corrections: [],
	},
	{
		commit: archivedCommit,
		id: archivedCommit.slice(0, 12),
		committedAt: '2026-08-17',
		label: { en: 'Archived', 'pt-br': 'Arquivada' },
		status: 'archived',
		locales: ['en', 'pt-br'],
		repositoryUrl: 'https://github.com/MaxMFonseca/MLE',
		corrections: [],
	},
] as const;

const syntheticSectionRegistry = [{ pageId: 'systems', segment: 'section' }] as const;

const makeTemporaryDirectory = (): string => {
	const directory = mkdtempSync(resolve(tmpdir(), 'mle-docs-validator-'));
	temporaryDirectories.push(directory);
	return directory;
};

const write = (root: string, relativePath: string, contents: string | Uint8Array): void => {
	const path = resolve(root, relativePath);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, contents);
};

const sectionPage = ({
	pageId,
	locale,
	commit = currentCommit,
}: {
	pageId: string;
	locale: 'en' | 'pt-br';
	commit?: string;
}): string => `---
title: ${locale === 'pt-br' ? `Seção ${pageId}` : `${pageId} section`}
description: ${locale === 'pt-br' ? 'Um diretório de documentação para este snapshot.' : 'A documentation directory for this snapshot.'}
contentType: section
pageId: ${pageId}
mleCommit: ${commit}
lastVerified: '2026-08-20'
translationStatus: ${locale === 'pt-br' ? 'current' : 'canonical'}
${locale === 'pt-br' ? "translationSourceLastVerified: '2026-08-20'\n" : ''}---

Section directory.`;

const html = (body: string, head = ''): string =>
	`<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

const deterministicBytes = (size: number): Buffer => {
	const bytes = Buffer.allocUnsafe(size);
	let state = 0x12345678;
	for (let index = 0; index < size; index += 1) {
		state ^= state << 13;
		state ^= state >>> 17;
		state ^= state << 5;
		bytes[index] = state & 0xff;
	}
	return bytes;
};

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

describe('validator filesystem safety', () => {
	it('rejects a mapped symbolic link before resolving or reading it', async () => {
		let realpathCalled = false;
		const result = await readVerifiedFile('C:\\safe-root', 'C:\\safe-root\\asset.js', {
			maxBytes: 1024,
			filesystem: {
				lstat: async () => ({ isSymbolicLink: () => true, isFile: () => true, size: 12 }),
				realpath: async () => {
					realpathCalled = true;
					return 'C:\\outside\\asset.js';
				},
				open: async () => { throw new Error('must not open'); },
			},
		});

		expect(result).toEqual({ ok: false, reason: 'symlink' });
		expect(realpathCalled).toBe(false);
	});

	it('rejects a swapped file identity before consuming bytes and always closes the handle', async () => {
		let bytesConsumed = false;
		let closed = false;
		let openFlags = 0;
		const stats = (ino: number) => ({
			dev: 7,
			ino,
			size: 4,
			isSymbolicLink: () => false,
			isFile: () => true,
		});
		const result = await readVerifiedFile('C:\\safe-root', 'C:\\safe-root\\page.html', {
			maxBytes: 1024,
			encoding: 'utf8',
			filesystem: {
				lstat: async () => stats(11),
				realpath: async () => 'C:\\safe-root\\page.html',
				open: async (_path: string, flags: number) => {
					openFlags = flags;
					return {
						stat: async () => stats(12),
						readFile: async () => {
							bytesConsumed = true;
							return 'race';
						},
						close: async () => { closed = true; },
					};
				},
			},
		});

		expect(result).toEqual({ ok: false, reason: 'identity-mismatch' });
		expect(openFlags).toBe(constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
		expect(bytesConsumed).toBe(false);
		expect(closed).toBe(true);
	});

	it('fails closed when the platform cannot provide a stable file identity', async () => {
		let bytesConsumed = false;
		let closed = false;
		const stats = {
			dev: 0n,
			ino: 0n,
			size: 4,
			isSymbolicLink: () => false,
			isFile: () => true,
		};
		const result = await readVerifiedFile('C:\\safe-root', 'C:\\safe-root\\page.html', {
			maxBytes: 1024,
			filesystem: {
				lstat: async () => stats,
				realpath: async () => 'C:\\safe-root\\page.html',
				open: async () => ({
					stat: async () => stats,
					readFile: async () => { bytesConsumed = true; return Buffer.from('race'); },
					close: async () => { closed = true; },
				}),
			},
		});

		expect(result).toEqual({ ok: false, reason: 'identity-unavailable' });
		expect(bytesConsumed).toBe(false);
		expect(closed).toBe(false);
	});

	it('stops streaming directory entries as soon as the file bound is exceeded', async () => {
		let reads = 0;
		let closed = false;
		const entries = ['one', 'two', 'three'].map((name) => ({
			name,
			isSymbolicLink: () => false,
			isDirectory: () => false,
			isFile: () => true,
		}));
		const result = await walkBounded('C:\\safe-root', {
			namespace: 'test',
			limits: { maxFiles: 1 },
			filesystem: {
				opendir: async () => ({
					read: async () => entries[reads++] ?? null,
					close: async () => { closed = true; },
				}),
			},
		});

		expect(result.files).toEqual([]);
		expect(result.diagnostics).toEqual([
			{ path: '.', ruleId: 'test/max-files', message: 'file count exceeds limit 1' },
		]);
		expect(reads).toBe(2);
		expect(closed).toBe(true);
	});
});

describe('content validation', () => {
	it('compiles supported references, spreads, and direct URL expressions as real MDX', async () => {
		const { compile } = await import(pathToFileURL(mdxCompilerPath).href);
		const compilerValidForms = [
			`[Moving source][engine-source]

[engine-source]:
  https://github.com/MaxMFonseca/MLE/blob/main/src/MLE/Renderer/Renderer.cpp`,
			`<a {...{href: 'https://github.com/MaxMFonseca/MLE/blob/main/src/MLE/Renderer/Renderer.cpp'}}>source</a>`,
			'<a { ...props}>source</a>',
			'<a {\t...props}>source</a>',
			['<a {', '  ...props', '}>source</a>'].join('\n'),
			'<_Link {...props} />',
			'<$Link {...props} />',
			"<a {...{/* ' } > */ href: 'https://github.com/MaxMFonseca/MLE/blob/main/file'}}>block comment</a>",
			[
				'<a {...{',
					"  // ' } >",
					"  href: 'https://github.com/MaxMFonseca/MLE/blob/main/file'",
				'}}>line comment</a>',
			].join('\n'),
			"<a {...{matcher: /['}>]/, href: 'https://github.com/MaxMFonseca/MLE/blob/main/file'}}>regex</a>",
			"<a {...{href: `https://github.com/MaxMFonseca/MLE/blob/main/${path}`, note: `${value}>`}}>template</a>",
			"<a data-note={/* ' } > */ 'safe'} {...{href: 'https://github.com/MaxMFonseca/MLE/blob/main/file'}}>preceded spread</a>",
			"<a data-config={{...props}} href='https://github.com/MaxMFonseca/MLE/blob/c1abea3de165032fe064300340807b7a6af388f8/file'>nested object spread</a>",
			"<a href={/* ' } > */ 'https://github.com/MaxMFonseca/MLE/blob/main/file'}>source</a>",
			"<a href={/* ' } > */ '/MLEDocs/latest/systems/renderer/'}>archived latest</a>",
			["<a href={// ' } >", "  'https://github.com/MaxMFonseca/MLE/blob/main/file'}>line comment</a>"].join('\n'),
			"<a href={/['}>}]/.test(path) ? sourceUrl : fallbackUrl}>regex</a>",
			'<img src={`https://github.com/MaxMFonseca/MLE/blob/main/${path}>`} />',
			'<a href={({ nested: { value: sourceUrl } }).nested.value}>nested braces</a>',
			"<a data-note={/* ' } > */ note} href={/* before */ 'https://github.com/MaxMFonseca/MLE/blob/main/file'}>preceding attribute</a>",
			"<a href={/* before */ 'https://github.com/MaxMFonseca/MLE/blob/main/file'} data-note={/['}>}]/}>following attribute</a>",
			"<a data-note={/* ' } > */ note}>non-URL expression</a>",
			"<a href={/* ' } > */ 'https://github.com/MaxMFonseca/MLE/blob/c1abea3de165032fe064300340807b7a6af388f8/file'}>pinned source</a>",
		];

		for (const source of compilerValidForms) {
			await expect(compile(source)).resolves.toBeDefined();
		}
	});

	it('compiles longer-closing and unclosed EOF fences as code blocks', async () => {
		const { compile } = await import(pathToFileURL(mdxCompilerPath).href);
		const compilerValidFences = [
			[
				'```mdx',
				'<a href="https://github.com/MaxMFonseca/MLE/blob/main/src/mle/Core.cpp">source</a>',
				'{unterminated',
				'````',
			].join('\n'),
			[
				'~~~mdx',
				'<a {...props}>source</a>',
				'{unterminated',
			].join('\n'),
		];

		for (const source of compilerValidFences) {
			await expect(compile(source)).resolves.toBeDefined();
		}
	});

	it('treats backticks in backtick-fence info as live Markdown but allows them in tilde info', async () => {
		const { compile } = await import(pathToFileURL(mdxCompilerPath).href);
		const movingUrl = 'https://github.com/MaxMFonseca/MLE/blob/main/src/mle/Core.cpp';
		const compiledHrefTargets = async (source: string): Promise<string[]> => {
			const targets: string[] = [];
			await compile(source, {
				rehypePlugins: [() => (tree: any) => {
					const visit = (node: any): void => {
						if (node.type === 'element' && node.tagName === 'a' && typeof node.properties?.href === 'string') {
							targets.push(node.properties.href);
						}
						for (const child of node.children ?? []) visit(child);
					};
					visit(tree);
				}],
			});
			return targets;
		};
		const link = `[Moving source](${movingUrl})`;

		expect(await compiledHrefTargets(['```mdx`not-a-fence', link].join('\n'))).toEqual([movingUrl]);
		for (const fence of [
			['~~~mdx`backticks-allowed`', link, '~~~'].join('\n'),
			['```mdx', link, '```'].join('\n'),
			['```mdx', link].join('\n'),
		]) {
			expect(await compiledHrefTargets(fence)).toEqual([]);
		}
	});

	it('accepts valid multiline references and ignores bypass-looking forms inside code examples', async () => {
		const diagnostics = await validateContent(resolve(fixtures, 'valid-content'), {
			manifest: [manifest[0]],
			sectionRegistry: syntheticSectionRegistry,
		});

		expect(diagnostics).toEqual([]);
	});

	it('rejects a content locale omitted from the matching manifest version', async () => {
		const englishOnlyManifest = [{ ...manifest[0], locales: ['en'] }] as const;

		const diagnostics = await validateContent(resolve(fixtures, 'valid-content'), {
			manifest: englishOnlyManifest,
			sectionRegistry: syntheticSectionRegistry,
		});

		expect(diagnostics).toEqual([
			expect.objectContaining({
				path: 'pt-br/versions/c1abea3de165/index.mdx',
				ruleId: 'content/locale-manifest',
				message: expect.stringContaining('pt-br'),
			}),
			expect.objectContaining({
				path: 'pt-br/versions/c1abea3de165/section.mdx',
				ruleId: 'content/locale-manifest',
				message: expect.stringContaining('pt-br'),
			}),
		]);
	});

	it('accepts redirect content through the exact shared redirect schema', async () => {
		const diagnostics = await validateContent(resolve(fixtures, 'valid-content'), {
			manifest,
			sectionRegistry: syntheticSectionRegistry,
		});

		expect(diagnostics.some(({ path }) => path.endsWith('moved.mdx'))).toBe(false);
	});

	it('accepts canonical English and current same-revision Portuguese section pages', async () => {
		const diagnostics = await validateContent(resolve(fixtures, 'valid-content'), {
			manifest,
			sectionRegistry: syntheticSectionRegistry,
		});

		expect(diagnostics.filter(({ path }) => path.endsWith('section.mdx'))).toEqual([]);
	});

	it('rejects a section page whose MLE commit disagrees with its version directory', async () => {
		const diagnostics = await validateContent(resolve(fixtures, 'invalid-content'), {
			manifest,
			sectionRegistry: syntheticSectionRegistry,
		});

		expect(diagnostics).toContainEqual(expect.objectContaining({
			path: 'versions/c1abea3de165/section-wrong-commit.mdx',
			ruleId: 'content/commit-directory',
			line: 6,
		}));
	});

	it('requires a current translated section revision to match its English section', async () => {
		const content = makeTemporaryDirectory();
		write(content, 'versions/c1abea3de165/section.mdx', `---
title: Systems
description: A section directory.
contentType: section
pageId: systems
mleCommit: ${currentCommit}
lastVerified: '2026-08-20'
translationStatus: canonical
---

Systems.`);
		write(content, 'pt-br/versions/c1abea3de165/section.mdx', `---
title: Sistemas
description: Um diretório de seção.
contentType: section
pageId: systems
mleCommit: ${currentCommit}
lastVerified: '2026-08-20'
translationStatus: current
translationSourceLastVerified: '2026-08-19'
---

Sistemas.`);

		expect(await validateContent(content, { manifest: [manifest[0]], sectionRegistry: syntheticSectionRegistry })).toContainEqual(
			expect.objectContaining({
				path: 'pt-br/versions/c1abea3de165/section.mdx',
				ruleId: 'content/translation-current',
			}),
		);
	});

	it('rejects fallback as an authored Portuguese section translation', async () => {
		const content = makeTemporaryDirectory();
		write(content, 'versions/c1abea3de165/section.mdx', `---
title: Systems
description: A section directory.
contentType: section
pageId: systems
mleCommit: ${currentCommit}
lastVerified: '2026-08-20'
translationStatus: canonical
---

Systems.`);
		write(content, 'pt-br/versions/c1abea3de165/section.mdx', `---
title: Sistemas
description: Um diretório de seção.
contentType: section
pageId: systems
mleCommit: ${currentCommit}
lastVerified: '2026-08-20'
translationStatus: fallback
---

Sistemas.`);

		expect(await validateContent(content, { manifest: [manifest[0]], sectionRegistry: syntheticSectionRegistry })).toContainEqual(
			expect.objectContaining({
				path: 'pt-br/versions/c1abea3de165/section.mdx',
				ruleId: 'content/schema',
			}),
		);
	});

	it('rejects a translated section paired with a same-ID English technical page', async () => {
		const content = makeTemporaryDirectory();
		write(content, 'versions/c1abea3de165/systems.mdx', `---
title: Systems technical page
description: A technical page deliberately sharing the section identity.
contentType: technical
pageId: systems
mleCommit: ${currentCommit}
maturity: in-development
audiences:
  - contributor
subsystems:
  - core
sourceFiles:
  - src/mle/Systems.cpp
lastVerified: '2026-08-20'
translationStatus: canonical
---

Technical systems.`);
		write(content, 'pt-br/versions/c1abea3de165/sistemas.mdx', `---
title: Sistemas
description: Um diretório de seção.
contentType: section
pageId: systems
mleCommit: ${currentCommit}
lastVerified: '2026-08-20'
translationStatus: current
translationSourceLastVerified: '2026-08-20'
---

Sistemas.`);

		expect(await validateContent(content, { manifest: [manifest[0]], sectionRegistry: syntheticSectionRegistry })).toContainEqual(
			expect.objectContaining({
				path: 'pt-br/versions/c1abea3de165/sistemas.mdx',
				ruleId: 'content/translation-content-type',
			}),
		);
	});

	it('rejects a translated technical page paired with a same-ID English section', async () => {
		const content = makeTemporaryDirectory();
		write(content, 'versions/c1abea3de165/systems.mdx', `---
title: Systems
description: A section directory.
contentType: section
pageId: systems
mleCommit: ${currentCommit}
lastVerified: '2026-08-20'
translationStatus: canonical
---

Systems.`);
		write(content, 'pt-br/versions/c1abea3de165/sistemas.mdx', `---
title: Sistemas técnicos
description: Uma página técnica deliberadamente com a identidade da seção.
contentType: technical
pageId: systems
mleCommit: ${currentCommit}
maturity: in-development
audiences:
  - contributor
subsystems:
  - core
sourceFiles:
  - src/mle/Systems.cpp
lastVerified: '2026-08-20'
translationStatus: current
translationSourceLastVerified: '2026-08-20'
---

Sistemas técnicos.`);

		expect(await validateContent(content, { manifest: [manifest[0]], sectionRegistry: syntheticSectionRegistry })).toContainEqual(
			expect.objectContaining({
				path: 'pt-br/versions/c1abea3de165/sistemas.mdx',
				ruleId: 'content/translation-content-type',
			}),
		);
	});

	it('accepts a complete bilingual synthetic section registry', async () => {
		const content = makeTemporaryDirectory();
		const sectionRegistry = [
			{ pageId: 'start', segment: 'start' },
			{ pageId: 'systems', segment: 'systems' },
		] as const;
		for (const pageId of ['start', 'systems']) {
			write(content, `versions/c1abea3de165/${pageId}.mdx`, sectionPage({ pageId, locale: 'en' }));
			write(
				content,
				`pt-br/versions/c1abea3de165/${pageId}.mdx`,
				sectionPage({ pageId, locale: 'pt-br' }),
			);
		}

		expect(
			await validateContent(content, { manifest: [manifest[0]], sectionRegistry }),
		).toEqual([]);
	});

	it('reports a section pageId authored under the wrong registry route', async () => {
		const content = makeTemporaryDirectory();
		write(content, 'versions/c1abea3de165/section.mdx', sectionPage({ pageId: 'systems', locale: 'en' }));
		write(
			content,
			'pt-br/versions/c1abea3de165/section.mdx',
			sectionPage({ pageId: 'systems', locale: 'pt-br' }),
		);

		expect(
			await validateContent(content, {
				manifest: [manifest[0]],
				sectionRegistry: [{ pageId: 'systems', segment: 'systems' }],
			}),
		).toEqual([
			{
				path: 'pt-br/versions/c1abea3de165/section.mdx',
				ruleId: 'content/section-route',
				message: 'section pageId systems must use route systems; found section',
			},
			{
				path: 'versions/c1abea3de165/section.mdx',
				ruleId: 'content/section-route',
				message: 'section pageId systems must use route systems; found section',
			},
		]);
	});

	it('reports a missing English section hub from the explicit registry', async () => {
		const content = makeTemporaryDirectory();
		write(content, 'versions/c1abea3de165/systems.mdx', sectionPage({ pageId: 'systems', locale: 'en' }));
		write(content, 'pt-br/versions/c1abea3de165/systems.mdx', sectionPage({ pageId: 'systems', locale: 'pt-br' }));

		expect(
			await validateContent(content, {
				manifest: [manifest[0]],
				sectionRegistry: [
					{ pageId: 'start', segment: 'start' },
					{ pageId: 'systems', segment: 'systems' },
				],
			}),
		).toContainEqual({
			path: 'versions/c1abea3de165',
			ruleId: 'content/section-missing',
			message: 'section pageId start is missing for en/c1abea3de165',
		});
	});

	it('reports a missing Brazilian Portuguese section hub from the explicit registry', async () => {
		const content = makeTemporaryDirectory();
		write(content, 'versions/c1abea3de165/systems.mdx', sectionPage({ pageId: 'systems', locale: 'en' }));

		expect(
			await validateContent(content, {
				manifest: [manifest[0]],
				sectionRegistry: syntheticSectionRegistry,
			}),
		).toContainEqual({
			path: 'pt-br/versions/c1abea3de165',
			ruleId: 'content/section-missing',
			message: 'section pageId systems is missing for pt-br/c1abea3de165',
		});
	});

	it('reports duplicate and unexpected real section identities without inferring from paths', async () => {
		const content = makeTemporaryDirectory();
		write(content, 'versions/c1abea3de165/first.mdx', sectionPage({ pageId: 'systems', locale: 'en' }));
		write(content, 'versions/c1abea3de165/nested/second.mdx', sectionPage({ pageId: 'systems', locale: 'en' }));
		write(content, 'versions/c1abea3de165/start-here/index.mdx', sectionPage({ pageId: 'unregistered', locale: 'en' }));
		write(content, 'pt-br/versions/c1abea3de165/systems.mdx', sectionPage({ pageId: 'systems', locale: 'pt-br' }));

		const diagnostics = await validateContent(content, {
			manifest: [manifest[0]],
			sectionRegistry: syntheticSectionRegistry,
		});

		expect(diagnostics).toContainEqual(expect.objectContaining({
			path: 'versions/c1abea3de165/nested/second.mdx',
			ruleId: 'content/duplicate-page-id',
		}));
		expect(diagnostics).toContainEqual({
			path: 'versions/c1abea3de165/start-here/index.mdx',
			ruleId: 'content/section-unexpected',
			message: 'section pageId unregistered is not declared in the navigation registry',
		});
	});

	it('reports each content invariant with stable rule IDs and ordering', async () => {
		const diagnostics = await validateContent(resolve(fixtures, 'invalid-content'), {
			manifest,
			sectionRegistry: syntheticSectionRegistry,
		});
		const ruleIds = diagnostics.map((diagnostic: Diagnostic) => diagnostic.ruleId);

		expect(ruleIds).toEqual(expect.arrayContaining([
			'content/commit-directory',
			'content/source-full-sha',
			'content/archived-latest-link',
			'content/dynamic-url',
			'content/translation-same-commit',
			'content/duplicate-page-id',
			'content/technical-source-metadata',
		]));
		const diagnosticOrder = diagnostics.map(
			({ path, line, ruleId }) => `${path}:${String(line ?? 0).padStart(9, '0')}:${ruleId}`,
		);
		expect(diagnosticOrder).toEqual(
			[...diagnosticOrder].sort((left, right) => left.localeCompare(right)),
		);
		expect.soft(
			diagnostics
				.filter(({ ruleId }) => ruleId === 'content/source-full-sha')
				.map(({ path, line }) => ({ path, line })),
		).toEqual([
			{ path: 'versions/c1abea3de165/branch-link.mdx', line: 18 },
			{ path: 'versions/c1abea3de165/branch-link.mdx', line: 23 },
			{ path: 'versions/c1abea3de165/expression-links.mdx', line: 18 },
			{ path: 'versions/c1abea3de165/expression-links.mdx', line: 19 },
			{ path: 'versions/c1abea3de165/expression-links.mdx', line: 21 },
			{ path: 'versions/c1abea3de165/expression-links.mdx', line: 22 },
			{ path: 'versions/c1abea3de165/expression-links.mdx', line: 24 },
			{ path: 'versions/c1abea3de165/expression-links.mdx', line: 28 },
			{ path: 'versions/c1abea3de165/expression-links.mdx', line: 29 },
			{ path: 'versions/c1abea3de165/multiline-reference-branch-link.mdx', line: 21 },
			{ path: 'versions/c1abea3de165/reference-branch-link.mdx', line: 20 },
		]);
		expect.soft(
			diagnostics
				.filter(({ ruleId }) => ruleId === 'content/archived-latest-link')
				.map(({ path, line }) => ({ path, line })),
		).toEqual([
			{ path: 'versions/dddddddddddd/archived-latest.mdx', line: 18 },
			{ path: 'versions/dddddddddddd/archived-latest.mdx', line: 21 },
			{ path: 'versions/dddddddddddd/expression-latest.mdx', line: 18 },
			{ path: 'versions/dddddddddddd/expression-latest.mdx', line: 19 },
			{ path: 'versions/dddddddddddd/expression-latest.mdx', line: 21 },
			{ path: 'versions/dddddddddddd/multiline-reference-latest.mdx', line: 21 },
			{ path: 'versions/dddddddddddd/reference-latest.mdx', line: 20 },
		]);
		expect.soft(
			diagnostics
				.filter(({ ruleId }) => ruleId === 'content/dynamic-url')
				.map(({ path, line, message }) => ({ path, line, message })),
		).toEqual([
			{
				path: 'versions/c1abea3de165/expression-links.mdx',
				line: 20,
				message: expect.stringContaining('href'),
			},
			{
				path: 'versions/c1abea3de165/expression-links.mdx',
				line: 25,
				message: expect.stringContaining('href'),
			},
			{
				path: 'versions/c1abea3de165/expression-links.mdx',
				line: 26,
				message: expect.stringContaining('src'),
			},
			{
				path: 'versions/c1abea3de165/expression-links.mdx',
				line: 27,
				message: expect.stringContaining('href'),
			},
			{
				path: 'versions/c1abea3de165/spread-branch-link.mdx',
				line: 18,
				message: expect.stringContaining('spread'),
			},
			{
				path: 'versions/c1abea3de165/spread-branch-link.mdx',
				line: 19,
				message: expect.stringContaining('spread'),
			},
			{
				path: 'versions/c1abea3de165/spread-branch-link.mdx',
				line: 20,
				message: expect.stringContaining('spread'),
			},
			{
				path: 'versions/c1abea3de165/spread-branch-link.mdx',
				line: 21,
				message: expect.stringContaining('spread'),
			},
			{
				path: 'versions/c1abea3de165/spread-branch-link.mdx',
				line: 24,
				message: expect.stringContaining('spread'),
			},
			{
				path: 'versions/c1abea3de165/spread-branch-link.mdx',
				line: 25,
				message: expect.stringContaining('spread'),
			},
			{
				path: 'versions/c1abea3de165/spread-branch-link.mdx',
				line: 26,
				message: expect.stringContaining('spread'),
			},
			{
				path: 'versions/c1abea3de165/spread-branch-link.mdx',
				line: 27,
				message: expect.stringContaining('spread'),
			},
			{
				path: 'versions/c1abea3de165/spread-branch-link.mdx',
				line: 31,
				message: expect.stringContaining('spread'),
			},
			{
				path: 'versions/c1abea3de165/spread-branch-link.mdx',
				line: 32,
				message: expect.stringContaining('spread'),
			},
			{
				path: 'versions/c1abea3de165/spread-branch-link.mdx',
				line: 33,
				message: expect.stringContaining('spread'),
			},
			{
				path: 'versions/dddddddddddd/spread-latest.mdx',
				line: 18,
				message: expect.stringContaining('spread'),
			},
			{
				path: 'versions/dddddddddddd/spread-latest.mdx',
				line: 19,
				message: expect.stringContaining('spread'),
			},
		]);
		expect(
			diagnostics.find(({ ruleId }) => ruleId === 'content/technical-source-metadata')?.message,
		).toContain('sourceFiles');
	});

	it('returns CLI exit code 1 and formatted diagnostics for invalid content', () => {
		const result = spawnSync(process.execPath, [
			resolve('scripts/validate-content.mjs'),
			resolve(fixtures, 'invalid-content'),
		], { encoding: 'utf8' });

		expect(result.status).toBe(1);
		expect(result.stdout).toContain('content/commit-directory');
		expect(result.stdout).toMatch(/\.mdx:\d+ content\//);
	});

	it('rejects oversized source text before parsing it', async () => {
		const content = makeTemporaryDirectory();
		write(content, 'versions/c1abea3de165/oversized.mdx', Buffer.alloc(8 * 1024 * 1024 + 1, 0x20));

		expect(await validateContent(content, { manifest, sectionRegistry: [] })).toEqual([
			expect.objectContaining({
				path: 'versions/c1abea3de165/oversized.mdx',
				ruleId: 'content/file-size',
			}),
		]);
	});

	it('bounds content traversal depth deterministically', async () => {
		const diagnostics = await validateContent(resolve(fixtures, 'valid-content'), {
			manifest,
			sectionRegistry: [],
			limits: { maxDepth: 1 },
		});

		expect(diagnostics).toContainEqual(expect.objectContaining({ ruleId: 'content/max-depth' }));
	});
});

describe('built link validation', () => {
	it('accepts contained routes, relative anchors, assets, srcset, and permanent canonicals', async () => {
		const dist = makeTemporaryDirectory();
		write(dist, 'versions/c1abea3de165/index.html', html(
			'<a href="guide/#details">Guide</a><img src="/MLEDocs/assets/image.webp" srcset="/MLEDocs/assets/image.webp 1x, /MLEDocs/assets/image@2x.webp 2x">',
			'<link rel="canonical" href="https://maxmfonseca.github.io/MLEDocs/versions/c1abea3de165/">',
		));
		write(dist, 'versions/c1abea3de165/guide/index.html', html('<h2 id="details">Details</h2><a href="../">Home</a>'));
		write(dist, 'assets/image.webp', 'one');
		write(dist, 'assets/image@2x.webp', 'two');

		expect(await validateBuiltLinks(dist)).toEqual([]);
	});

	it('uses the configured base when selecting reachability roots', async () => {
		const dist = makeTemporaryDirectory();
		write(dist, 'versions/c1abea3de165/index.html', html('<h1>Snapshot root</h1>'));

		expect(await validateBuiltLinks(dist, { base: '/Docs' })).toEqual([]);
	});

	it('reports broken routes, anchors, assets, latest canonicals, base omissions, malformed encodings, and orphans', async () => {
		const dist = makeTemporaryDirectory();
		write(dist, 'versions/c1abea3de165/index.html', html(
			'<a href="missing/">Missing</a><a href="guide/#absent">Anchor</a><a href="/%ZZ">Bad encoding</a><img src="/MLEDocs/assets/missing.webp">',
			'<link rel="canonical" href="https://maxmfonseca.github.io/MLEDocs/latest/">',
		));
		write(dist, 'versions/c1abea3de165/guide/index.html', html('<h2 id="present">Present</h2>'));
		write(dist, 'versions/c1abea3de165/orphan/index.html', html('<h1>Orphan</h1>'));

		const diagnostics = await validateBuiltLinks(dist);
		const ruleIds = diagnostics.map((diagnostic: Diagnostic) => diagnostic.ruleId);

		expect(ruleIds).toEqual(expect.arrayContaining([
			'links/broken-route',
			'links/broken-anchor',
			'links/missing-asset',
			'links/canonical-latest',
			'links/base-path',
			'links/malformed-url',
			'links/orphan-page',
		]));
		expect(diagnostics).toEqual([...diagnostics].sort((left, right) =>
			`${left.path}:${left.line ?? 0}:${left.ruleId}:${left.message}`.localeCompare(
				`${right.path}:${right.line ?? 0}:${right.ruleId}:${right.message}`,
			),
		));
	});

	it('reports malformed fragment-only URLs without throwing', async () => {
		const dist = makeTemporaryDirectory();
		write(dist, 'versions/c1abea3de165/index.html', html('<a href="#%ZZ">Bad fragment</a>'));

		expect(await validateBuiltLinks(dist)).toEqual([
			expect.objectContaining({
				path: 'versions/c1abea3de165/index.html',
				line: 1,
				ruleId: 'links/malformed-url',
			}),
		]);
	});

	it('reports out-of-range decimal and surrogate hexadecimal URL entities without throwing', async () => {
		const dist = makeTemporaryDirectory();
		write(dist, 'versions/c1abea3de165/index.html', html([
			'<a href="/MLEDocs/&#1114112;/">Decimal</a>',
			'<a href="/MLEDocs/&#xD800;/">Hex</a>',
		].join('\n')));

		expect(await validateBuiltLinks(dist)).toEqual([
			expect.objectContaining({ path: 'versions/c1abea3de165/index.html', line: 1, ruleId: 'links/malformed-url' }),
			expect.objectContaining({ path: 'versions/c1abea3de165/index.html', line: 2, ruleId: 'links/malformed-url' }),
		]);
	});

	it('reports malformed numeric entity syntax in every URL-bearing attribute path', async () => {
		const dist = makeTemporaryDirectory();
		write(dist, 'versions/c1abea3de165/index.html', html([
			'<a href="/MLEDocs/&#xZZ;/">Href</a>',
			'<img src="/MLEDocs/&#12x;/">',
			'<img srcset="/MLEDocs/&#;/ 1x">',
			'<link rel="canonical" href="/MLEDocs/&#XZZ;/">',
			'<meta http-equiv="refresh" content="0;url=/MLEDocs/&#12x;/">',
		].join('\n')));

		const diagnostics = await validateBuiltLinks(dist);
		expect(diagnostics).toEqual([1, 2, 3, 4, 5].map((line) => expect.objectContaining({
			path: 'versions/c1abea3de165/index.html',
			line,
			ruleId: 'links/malformed-url',
		})));
		expect(diagnostics.some(({ ruleId }: Diagnostic) => ruleId === 'links/broken-route')).toBe(false);
	});

	it('preserves valid named, decimal, lowercase-hex, and uppercase-hex entity decoding', async () => {
		const dist = makeTemporaryDirectory();
		write(dist, 'versions/c1abea3de165/index.html', html([
			'<h2 id="ok">OK</h2><h2 id="ok&amp;">Named</h2>',
			'<a href="#&#111;&#x6b;">Numeric</a>',
			'<a href="#&#X6F;&#107;">Uppercase hex</a>',
			'<a href="#ok&amp;">Named</a>',
		].join('\n')));

		expect(await validateBuiltLinks(dist)).toEqual([]);
	});

	it('isolates malformed entity state to its srcset candidate and still validates later candidates', async () => {
		const dist = makeTemporaryDirectory();
		write(dist, 'versions/c1abea3de165/index.html', html(
			'<img srcset="/MLEDocs/&#xZZ; 1x, /MLEDocs/assets/good.webp 2x">',
		));
		write(dist, 'assets/good.webp', 'good');

		expect(await validateBuiltLinks(dist)).toEqual([
			expect.objectContaining({
				path: 'versions/c1abea3de165/index.html',
				line: 1,
				ruleId: 'links/malformed-url',
				message: expect.stringContaining('/MLEDocs/&#xZZ;'),
			}),
		]);
	});

	it.each([
		['decimal', '&#44;'],
		['lowercase hex', '&#x2c;'],
		['uppercase hex', '&#X2C;'],
	])('treats a valid %s comma entity as a srcset candidate separator', async (_label, separator) => {
		const dist = makeTemporaryDirectory();
		write(dist, 'versions/c1abea3de165/index.html', html(
			`<img srcset="/MLEDocs/assets/one.webp 1x${separator}   /MLEDocs/assets/two.webp 2x">`,
		));
		write(dist, 'assets/one.webp', 'one');
		write(dist, 'assets/two.webp', 'two');

		expect(await validateBuiltLinks(dist)).toEqual([]);
		rmSync(resolve(dist, 'assets/two.webp'));
		expect(await validateBuiltLinks(dist)).toEqual([
			expect.objectContaining({
				ruleId: 'links/missing-asset',
				message: expect.stringContaining('/MLEDocs/assets/two.webp'),
			}),
		]);
	});

	it('keeps malformed srcset markers candidate-local in first, middle, last, and repeated positions', async () => {
		const dist = makeTemporaryDirectory();
		write(dist, 'versions/c1abea3de165/index.html', html([
			'<img srcset="/MLEDocs/assets/g&#111;od.webp 1x, /MLEDocs/assets/good.webp 2x">',
			'<img srcset="/MLEDocs/&#xZZ; 1x, /MLEDocs/assets/good.webp 2x">',
			'<img srcset="/MLEDocs/assets/good.webp 1x, /MLEDocs/&#; 2x, /MLEDocs/assets/good.webp 3x">',
			'<img srcset="/MLEDocs/assets/good.webp 1x, /MLEDocs/&#12x; 2x">',
			'<img srcset="/MLEDocs/&#xNO; 1x, /MLEDocs/assets/good.webp 2x, /MLEDocs/&#99z; 3x">',
			'<img srcset="/MLEDocs/&#XBADZ; 1x, /MLEDocs/assets/missing.webp 2x">',
			'<img srcset="/MLEDocs/assets/&#xE000;0&#xE001;.webp 1x, /MLEDocs/&#xZZ; 2x">',
		].join('\n')));
		write(dist, 'assets/good.webp', 'good');
		write(dist, 'assets/\ue0000\ue001.webp', 'marker-like');

		const diagnostics = await validateBuiltLinks(dist);
		expect(diagnostics.map(({ line, ruleId }: Diagnostic) => [line, ruleId])).toEqual([
			[2, 'links/malformed-url'],
			[3, 'links/malformed-url'],
			[4, 'links/malformed-url'],
			[5, 'links/malformed-url'],
			[5, 'links/malformed-url'],
			[6, 'links/malformed-url'],
			[6, 'links/missing-asset'],
			[7, 'links/malformed-url'],
		]);
		expect(diagnostics.some(({ message }: { readonly message: string }) => message.includes('/MLEDocs/assets/missing.webp'))).toBe(true);
	});

	it('rejects latest and unrelated-origin canonicals before external-link filtering', async () => {
		const dist = makeTemporaryDirectory();
		write(dist, 'versions/c1abea3de165/index.html', html('', [
			'<link rel="canonical" href="https://foreign.example/latest/page/">',
			'<link rel="canonical" href="https://foreign.example/permanent/page/">',
			'<link rel="canonical" href="https://foreign.example/lat%65st/encoded/">',
			'<link rel="canonical" href="https://maxmfonseca.github.io/outside-base/">',
		].join('')));

		const diagnostics = await validateBuiltLinks(dist);
		expect(diagnostics.map((diagnostic: Diagnostic) => diagnostic.ruleId)).toEqual([
			'links/canonical-base',
			'links/canonical-latest',
			'links/canonical-latest',
			'links/canonical-site',
			'links/canonical-site',
			'links/canonical-site',
		]);
	});

	it('tokenizes data URI srcset candidates without phantom local assets', async () => {
		const dist = makeTemporaryDirectory();
		write(dist, 'versions/c1abea3de165/index.html', html(
			'<img src="/MLEDocs/assets/image.webp" srcset="data:image/svg+xml,%3Csvg%3E 1x, /MLEDocs/assets/image.webp 2x">',
		));
		write(dist, 'assets/image.webp', 'image');

		expect(await validateBuiltLinks(dist)).toEqual([]);
	});

	it('continues srcset parsing after a descriptor-free data URI candidate', async () => {
		const dist = makeTemporaryDirectory();
		write(dist, 'versions/c1abea3de165/index.html', html(
			'<img srcset="data:image/png;base64,AAAA, /MLEDocs/assets/missing.webp 2x">',
		));

		expect(await validateBuiltLinks(dist)).toEqual([
			expect.objectContaining({
				ruleId: 'links/missing-asset',
				message: expect.stringContaining('/MLEDocs/assets/missing.webp'),
			}),
		]);
	});

	it('bounds built-output file traversal deterministically', async () => {
		const dist = makeTemporaryDirectory();
		write(dist, 'versions/c1abea3de165/index.html', html('<h1>Home</h1>'));
		write(dist, 'asset.txt', 'second file');

		const diagnostics = await validateBuiltLinks(dist, { limits: { maxFiles: 1 } });
		expect(diagnostics).toContainEqual(expect.objectContaining({ ruleId: 'links/max-files' }));
	});

	it('returns CLI exit code 1 without executing scripts', () => {
		const dist = makeTemporaryDirectory();
		write(dist, 'versions/c1abea3de165/index.html', html('<script>throw new Error("must not run")</script><img src="/MLEDocs/missing.png">'));

		const result = spawnSync(process.execPath, [resolve('scripts/validate-links.mjs'), dist], {
			encoding: 'utf8',
		});

		expect(result.status).toBe(1);
		expect(result.stdout).toContain('links/missing-asset');
		expect(result.stderr).not.toContain('must not run');
	});
});

describe('performance validation', () => {
	it('counts inline executable scripts at the inclusive JavaScript budget boundary', async () => {
		const dist = makeTemporaryDirectory();
		const executable = ['globalThis.mleClassic = true;', 'globalThis.mleModule = true;'];
		const inlineHead = [
			`<script>${executable[0]}</script>`,
			`<script type="module">${executable[1]}</script>`,
			`<script type="application/json">${'0'.repeat(20_000)}</script>`,
			`<script type="application/ld+json">${'1'.repeat(20_000)}</script>`,
		].join('');
		write(dist, 'versions/c1abea3de165/index.html', html('<h1>Home</h1>', inlineHead));
		write(dist, 'versions/c1abea3de165/systems/renderer/index.html', html('<h1>Renderer</h1>'));
		const expectedBytes = gzipSync(Buffer.from(executable.join('\n'), 'utf8')).length;

		const atBoundary = await validatePerformance(dist, {
			budgets: { javascript: expectedBytes },
		});
		expect(atBoundary.diagnostics).toEqual([]);
		expect(
			atBoundary.measurements.find(
				({ kind, path }) => kind === 'javascript' && path === 'versions/c1abea3de165/index.html',
			),
		).toEqual({
			kind: 'javascript',
			path: 'versions/c1abea3de165/index.html',
			measured: expectedBytes,
			limit: expectedBytes,
		});

		const overBoundary = await validatePerformance(dist, {
			budgets: { javascript: expectedBytes - 1 },
		});
		expect(overBoundary.diagnostics).toContainEqual({
			path: 'versions/c1abea3de165/index.html',
			ruleId: 'performance/javascript-gzip',
			message: `initial local javascript gzip: measured ${expectedBytes} bytes; limit ${expectedBytes - 1} bytes`,
		});
	});

	it('measures unique initial assets and accepts a build within every budget', async () => {
		const dist = makeTemporaryDirectory();
		const head = '<script src="/MLEDocs/assets/app.js"></script><script src="/MLEDocs/assets/app.js"></script><link rel="stylesheet" href="/MLEDocs/assets/app.css">';
		write(dist, 'versions/c1abea3de165/index.html', html('<img fetchpriority="high" src="/MLEDocs/media/hero.webp">', head));
		write(dist, 'versions/c1abea3de165/systems/renderer/index.html', html('<h1>Renderer</h1>', head));
		write(dist, 'assets/app.js', 'console.log("small")');
		write(dist, 'assets/app.css', '@font-face{src:url("/MLEDocs/fonts/site.woff2")}');
		write(dist, 'fonts/site.woff2', deterministicBytes(1024));
		write(dist, 'media/hero.webp', deterministicBytes(2048));

		const result = await validatePerformance(dist);

		expect(result.diagnostics).toEqual([]);
		expect(result.measurements.filter(({ kind }) => kind === 'javascript')).toHaveLength(2);
		expect(result.measurements.every(({ measured, limit }) => measured <= limit)).toBe(true);
	});

	it('resolves co-located relative entry assets from each representative HTML route', async () => {
		const dist = makeTemporaryDirectory();
		write(dist, 'versions/c1abea3de165/index.html', html(
			'<img fetchpriority="high" src="./hero.webp">',
			'<script src="./home.js"></script><link rel="stylesheet" href="./home.css">',
		));
		write(dist, 'versions/c1abea3de165/home.js', 'console.log("home")');
		write(dist, 'versions/c1abea3de165/home.css', 'body{}');
		write(dist, 'versions/c1abea3de165/hero.webp', deterministicBytes(100));
		write(dist, 'versions/c1abea3de165/systems/renderer/index.html', html(
			'<h1>Renderer</h1>',
			'<script src="./renderer.js"></script><link rel="stylesheet" href="./renderer.css">',
		));
		write(dist, 'versions/c1abea3de165/systems/renderer/renderer.js', 'console.log("renderer")');
		write(dist, 'versions/c1abea3de165/systems/renderer/renderer.css', 'h1{}');

		const result = await validatePerformance(dist);

		expect(result.diagnostics).toEqual([]);
		const javascript = result.measurements.filter(({ kind }) => kind === 'javascript');
		expect(javascript).toHaveLength(2);
		expect(javascript.every(({ measured }) => measured > 0)).toBe(true);
	});

	it('bounds performance traversal and mapped asset reads deterministically', async () => {
		const dist = makeTemporaryDirectory();
		write(dist, 'versions/c1abea3de165/index.html', html('', '<script src="/MLEDocs/assets/app.js"></script>'));
		write(dist, 'versions/c1abea3de165/systems/renderer/index.html', html('<h1>Renderer</h1>'));
		write(dist, 'assets/app.js', deterministicBytes(128));

		const result = await validatePerformance(dist, {
			limits: { maxFiles: 2, maxAssetBytes: 64 },
		});

		expect(result.diagnostics).toEqual(expect.arrayContaining([
			expect.objectContaining({ ruleId: 'performance/max-files' }),
			expect.objectContaining({ ruleId: 'performance/file-size' }),
		]));
	});

	it.skipIf(process.platform === 'win32')('rejects a mapped filesystem symlink without reading its target', async () => {
		const dist = makeTemporaryDirectory();
		const outside = makeTemporaryDirectory();
		write(dist, 'versions/c1abea3de165/index.html', html('', '<script src="/MLEDocs/assets/app.js"></script>'));
		write(dist, 'versions/c1abea3de165/systems/renderer/index.html', html('<h1>Renderer</h1>'));
		write(outside, 'outside.js', 'throw new Error("must not read")');
		mkdirSync(resolve(dist, 'assets'), { recursive: true });
		symlinkSync(resolve(outside, 'outside.js'), resolve(dist, 'assets/app.js'));

		const result = await validatePerformance(dist);
		expect(result.diagnostics).toContainEqual(expect.objectContaining({
			path: 'assets/app.js',
			ruleId: 'performance/symlink',
		}));
	});

	it('reports measured bytes and exact limits for JavaScript, CSS, fonts, hero, and other rasters', async () => {
		const dist = makeTemporaryDirectory();
		write(dist, 'versions/c1abea3de165/index.html', html(
			'<img fetchpriority="high" src="/MLEDocs/media/hero.webp"><img loading="lazy" src="/MLEDocs/media/large.png">',
			'<script src="/MLEDocs/assets/app.js"></script><link rel="stylesheet" href="/MLEDocs/assets/app.css">',
		));
		write(dist, 'versions/c1abea3de165/systems/renderer/index.html', html('<h1>Renderer</h1>', '<script src="/MLEDocs/assets/app.js"></script><link rel="stylesheet" href="/MLEDocs/assets/app.css">'));
		write(dist, 'assets/app.js', deterministicBytes(121 * 1024));
		write(dist, 'assets/app.css', deterministicBytes(101 * 1024));
		write(dist, 'fonts/one.woff2', deterministicBytes(126 * 1024));
		write(dist, 'fonts/two.woff2', deterministicBytes(126 * 1024));
		write(dist, 'media/hero.webp', deterministicBytes(501 * 1024));
		write(dist, 'media/large.png', deterministicBytes(751 * 1024));

		const result = await validatePerformance(dist);
		const ruleIds = result.diagnostics.map((diagnostic: Diagnostic) => diagnostic.ruleId);

		expect(ruleIds).toEqual(expect.arrayContaining([
			'performance/javascript-gzip',
			'performance/css-gzip',
			'performance/fonts-total',
			'performance/homepage-hero',
			'performance/raster-size',
		]));
		for (const diagnostic of result.diagnostics) {
			expect(diagnostic.message).toMatch(/measured \d+ bytes; limit \d+ bytes/);
		}
	});

	it('returns CLI exit code 1 for an oversized shipped raster', () => {
		const dist = makeTemporaryDirectory();
		write(dist, 'versions/c1abea3de165/index.html', html('<h1>Home</h1>'));
		write(dist, 'versions/c1abea3de165/systems/renderer/index.html', html('<h1>Renderer</h1>'));
		write(dist, 'media/oversized.jpg', deterministicBytes(751 * 1024));

		const result = spawnSync(process.execPath, [resolve('scripts/validate-performance.mjs'), dist], {
			encoding: 'utf8',
		});

		expect(result.status).toBe(1);
		expect(result.stdout).toContain('performance/raster-size');
		expect(result.stdout).toContain('limit 768000 bytes');
	});
});
