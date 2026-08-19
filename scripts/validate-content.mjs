import { lstat, realpath } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseFrontmatter } from 'astro/markdown';
import {
	homepagePageMetadataSchema,
	redirectPageSchema,
	technicalPageMetadataSchema,
} from '../src/lib/content/schema.ts';
import { versions } from '../src/data/versions.ts';
import { validateVersions } from '../src/lib/versions/manifest.ts';
import { readVerifiedFile, walkBounded } from './validator-filesystem.mjs';

const CONTENT_PATH = /^(?:(pt-br)\/)?versions\/([^/]+)\/(.+)\.(md|mdx)$/;
const MLE_SOURCE_URL = /^https:\/\/github\.com\/MaxMFonseca\/MLE\/(?:blob|tree)\/([^/?#]+)(?:[/?#]|$)/;
const SAFE_EVIDENCE_PATH = /^(?!\/)(?!.*\\)(?!.*(?:^|\/)\.\.?\/)[^\0]+$/;

const slash = (path) => path.split(sep).join('/');

const diagnosticSort = (left, right) =>
	`${left.path}:${String(left.line ?? 0).padStart(9, '0')}:${left.ruleId}:${left.message}`.localeCompare(
		`${right.path}:${String(right.line ?? 0).padStart(9, '0')}:${right.ruleId}:${right.message}`,
	);

export const formatDiagnostic = ({ path, line, ruleId, message }) =>
	`${path}${line === undefined ? '' : `:${line}`} ${ruleId} ${message}`;

const contains = (root, candidate) => candidate === root || candidate.startsWith(`${root}${sep}`);

const lineFor = (source, needle) => {
	const index = source.indexOf(needle);
	return index < 0 ? undefined : source.slice(0, index).split(/\r?\n/).length;
};

const lineAt = (source, offset) => source.slice(0, Math.max(0, offset)).split(/\r?\n/).length;

const bodyWithoutCode = (body) =>
	body
		.replace(/^(?: {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1\s*$/gm, '')
		.replace(/`[^`\n]*`/g, '');

const markdownLinks = (body) => {
	const links = [];
	const source = bodyWithoutCode(body);
	const expression = /(?:!?\[[^\]]*\]\(([^\s)]+)(?:\s+["'][^"']*["'])?\)|<(https?:\/\/[^>]+)>|\b(href|src)=["']([^"']+)["'])/g;
	for (const match of source.matchAll(expression)) {
		links.push({ target: match[1] ?? match[2] ?? match[4], offset: match.index ?? 0 });
	}
	return links;
};

const metadataLine = (source, issue) => {
	const field = issue.path?.[0];
	return typeof field === 'string' ? lineFor(source, `${field}:`) : 1;
};

export const validateContent = async (contentDirectory = resolve('src/content/docs'), options = {}) => {
	const manifest = options.manifest ?? versions;
	const root = resolve(contentDirectory);
	const diagnostics = [];
	let rootReal;
	try {
		rootReal = await realpath(root);
		const stats = await lstat(rootReal);
		if (!stats.isDirectory()) throw new Error('not a directory');
	} catch (error) {
		return [{ path: slash(root), ruleId: 'content/directory', message: `cannot read content directory: ${error.message}` }];
	}
	if (!contains(root, rootReal) && !contains(rootReal, root)) {
		return [{ path: slash(root), ruleId: 'content/directory', message: 'resolved content directory is outside the supplied path' }];
	}

	for (const message of validateVersions(manifest)) {
		diagnostics.push({ path: 'src/data/versions.ts', ruleId: 'content/manifest', message });
	}
	const versionsById = new Map(manifest.map((entry) => [entry.id, entry]));
	const { files: walkedFiles, diagnostics: traversalDiagnostics, limits } = await walkBounded(rootReal, {
		namespace: 'content',
		limits: options.limits,
	});
	const files = walkedFiles.filter((path) => /\.(?:md|mdx)$/i.test(path));
	diagnostics.push(...traversalDiagnostics);
	const pages = [];

	for (const path of files) {
		const displayPath = slash(relative(rootReal, path));
		const match = CONTENT_PATH.exec(displayPath);
		if (!match) {
			diagnostics.push({ path: displayPath, ruleId: 'content/path', message: 'content must live under [pt-br/]versions/<12-char-id>/' });
			continue;
		}
		const locale = match[1] ? 'pt-br' : 'en';
		const versionId = match[2];
		const version = versionsById.get(versionId);
		const read = await readVerifiedFile(rootReal, path, { maxBytes: limits.maxTextBytes, encoding: 'utf8' });
		if (!read.ok) {
			const ruleId = read.reason === 'symlink'
				? 'content/symlink'
				: read.reason === 'file-size'
					? 'content/file-size'
					: 'content/path-escape';
			const message = read.reason === 'file-size'
				? `content exceeds bounded parser limit ${limits.maxTextBytes} bytes`
				: `content file is unsafe or unavailable: ${read.reason}`;
			diagnostics.push({ path: displayPath, ruleId, message });
			continue;
		}
		const source = read.data;
		let parsed;
		try {
			parsed = parseFrontmatter(source, { frontmatter: 'empty-with-spaces' });
		} catch (error) {
			diagnostics.push({ path: displayPath, line: 1, ruleId: 'content/frontmatter', message: error.message });
			continue;
		}
		const data = parsed.frontmatter;
		const schema = data.contentType === 'technical'
			? technicalPageMetadataSchema
			: data.contentType === 'homepage'
				? homepagePageMetadataSchema
				: data.contentType === 'redirect'
					? redirectPageSchema
					: undefined;
		if (!schema) {
			diagnostics.push({ path: displayPath, line: lineFor(source, 'contentType:') ?? 1, ruleId: 'content/schema', message: 'contentType must be technical, homepage, or redirect' });
			continue;
		}
		const result = schema.safeParse(data);
		if (!result.success) {
			for (const issue of result.error.issues) {
				diagnostics.push({
					path: displayPath,
					line: metadataLine(source, issue),
					ruleId: 'content/schema',
					message: `${issue.path.join('.') || 'frontmatter'}: ${issue.message}`,
				});
			}
			continue;
		}
		const metadata = result.data;
		if (!version) {
			diagnostics.push({ path: displayPath, line: 1, ruleId: 'content/unknown-version', message: `directory version ${versionId} is not in the manifest` });
		} else if (!version.locales.includes(locale)) {
			diagnostics.push({ path: displayPath, line: 1, ruleId: 'content/locale-manifest', message: `locale ${locale} is not declared for manifest version ${versionId}` });
		} else if (data.contentType === 'technical' && metadata.mleCommit !== version.commit) {
			diagnostics.push({ path: displayPath, line: lineFor(source, 'mleCommit:'), ruleId: 'content/commit-directory', message: `mleCommit ${metadata.mleCommit} does not match directory version ${versionId} (${version.commit})` });
		}

		if (data.contentType === 'technical') {
			if (metadata.sourceFiles.length === 0) {
				diagnostics.push({ path: displayPath, line: lineFor(source, 'contentType:'), ruleId: 'content/technical-source-metadata', message: 'technical pages must declare at least one sourceFiles entry' });
			}
			for (const [field, paths] of [['sourceFiles', metadata.sourceFiles], ['testFiles', metadata.testFiles]]) {
				for (const evidencePath of paths) {
					if (!SAFE_EVIDENCE_PATH.test(evidencePath)) diagnostics.push({ path: displayPath, line: lineFor(source, `${field}:`), ruleId: 'content/evidence-path', message: `${field} contains unsafe repository path ${evidencePath}` });
				}
			}
		}

		if (data.contentType !== 'redirect' && locale === 'en' && metadata.translationStatus !== 'canonical') {
			diagnostics.push({ path: displayPath, line: lineFor(source, 'translationStatus:'), ruleId: 'content/translation-status', message: 'English pages must be canonical' });
		}
		if (data.contentType !== 'redirect' && locale === 'pt-br' && metadata.translationStatus === 'canonical') {
			diagnostics.push({ path: displayPath, line: lineFor(source, 'translationStatus:'), ruleId: 'content/translation-status', message: 'Portuguese pages cannot be canonical' });
		}

		const bodyStart = source.indexOf(parsed.content);
		for (const link of markdownLinks(parsed.content)) {
			const linkOffset = source.indexOf(link.target, Math.max(0, bodyStart));
			const linkLine = lineAt(source, linkOffset < 0 ? bodyStart + link.offset : linkOffset);
			const sourceMatch = MLE_SOURCE_URL.exec(link.target);
			if (sourceMatch && (!version || sourceMatch[1] !== version.commit || !/^[0-9a-f]{40}$/.test(sourceMatch[1]))) {
				diagnostics.push({ path: displayPath, line: linkLine, ruleId: 'content/source-full-sha', message: `MLE source URL must use snapshot full SHA ${version?.commit ?? versionId}; found ${sourceMatch[1]}` });
			}
			if (version?.status === 'archived' && /(?:^|\/)latest(?:\/|$)/.test(link.target)) {
				diagnostics.push({ path: displayPath, line: linkLine, ruleId: 'content/archived-latest-link', message: 'archived snapshots must not link to /latest/' });
			}
		}

		if (data.contentType !== 'redirect') pages.push({ path: displayPath, locale, versionId, metadata });
	}

	const firstByIdentity = new Map();
	for (const page of pages) {
		const key = JSON.stringify([page.versionId, page.locale, page.metadata.pageId]);
		const existing = firstByIdentity.get(key);
		if (existing) {
			diagnostics.push({ path: page.path, ruleId: 'content/duplicate-page-id', message: `pageId ${page.metadata.pageId} duplicates ${existing.path} for ${page.locale}/${page.versionId}` });
		} else firstByIdentity.set(key, page);
	}

	for (const page of pages.filter((candidate) => candidate.locale === 'pt-br')) {
		const english = firstByIdentity.get(JSON.stringify([page.versionId, 'en', page.metadata.pageId]));
		if (!english) {
			const otherEnglish = pages.find((candidate) => candidate.locale === 'en' && candidate.metadata.pageId === page.metadata.pageId);
			diagnostics.push({ path: page.path, ruleId: 'content/translation-same-commit', message: otherEnglish
				? `Portuguese page ${page.metadata.pageId} can only fall back to English in ${page.versionId}, not ${otherEnglish.versionId}`
				: `Portuguese page ${page.metadata.pageId} has no same-commit English canonical page` });
			continue;
		}
		if (page.metadata.translationStatus === 'current' && page.metadata.translationSourceLastVerified !== english.metadata.lastVerified) {
			diagnostics.push({ path: page.path, ruleId: 'content/translation-current', message: `current translation source date must equal English lastVerified ${english.metadata.lastVerified}` });
		}
		if (page.metadata.translationStatus === 'stale' && page.metadata.translationSourceLastVerified === english.metadata.lastVerified) {
			diagnostics.push({ path: page.path, ruleId: 'content/translation-stale', message: 'stale translation source date must differ from the English revision' });
		}
	}

	return diagnostics.sort(diagnosticSort);
};

const runCli = async () => {
	const diagnostics = await validateContent(process.argv[2] ? resolve(process.argv[2]) : resolve('src/content/docs'));
	for (const diagnostic of diagnostics) console.log(formatDiagnostic(diagnostic));
	if (diagnostics.length === 0) console.log('content validation passed');
	process.exitCode = diagnostics.length === 0 ? 0 : 1;
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	runCli().catch((error) => {
		console.error(`content validation failed: ${error.message}`);
		process.exitCode = 1;
	});
}
