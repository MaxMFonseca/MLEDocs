import { lstat, realpath } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseFrontmatter } from 'astro/markdown';
import {
	homepagePageMetadataSchema,
	redirectPageSchema,
	sectionPageMetadataSchema,
	technicalPageMetadataSchema,
} from '../src/lib/content/schema.ts';
import { versions } from '../src/data/versions.ts';
import { navigationSections } from '../src/data/navigation.ts';
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

const maskText = (value) => value.replace(/[^\r\n]/g, ' ');

const maskFencedCode = (body) => {
	const ranges = [];
	const openerPattern = /^ {0,3}(?:(`{3,})[^`\r\n]*|(~{3,})[^\r\n]*)(?:\r?\n|$)/gm;
	for (let opener = openerPattern.exec(body); opener; opener = openerPattern.exec(body)) {
		const fence = opener[1] ?? opener[2];
		const closingPattern = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}[ \\t]*\\r?$`, 'gm');
		closingPattern.lastIndex = openerPattern.lastIndex;
		const closing = closingPattern.exec(body);
		const end = closing ? closing.index + closing[0].length : body.length;
		ranges.push({ start: opener.index, end });
		openerPattern.lastIndex = end;
	}
	return maskRanges(body, ranges);
};

const inlineCodeRanges = (source) =>
	[...source.matchAll(/(`+)[^\n]*?\1/g)].map((match) => ({
		start: match.index ?? 0,
		end: (match.index ?? 0) + match[0].length,
	}));

const inRanges = (offset, ranges) =>
	ranges.some((range) => offset >= range.start && offset < range.end);

const maskRanges = (source, ranges) => {
	let masked = source;
	for (const range of [...ranges].reverse()) {
		masked = `${masked.slice(0, range.start)}${maskText(masked.slice(range.start, range.end))}${masked.slice(range.end)}`;
	}
	return masked;
};

const normalizeReferenceLabel = (label) => label.trim().replace(/\s+/g, ' ').toLowerCase();

const referenceLinks = (source) => {
	const definitions = [];
	const definitionRanges = [];
	const definitionPattern = /^ {0,3}\[([^\]\n]+)\]:(?:[ \t]*(?:<([^>\n]+)>|(\S+))|[ \t]*\r?\n[ \t]+(?:<([^>\n]+)>|(\S+)))(?:[ \t]+(?:"[^"]*"|'[^']*'|\([^)]*\)))?[ \t]*$/gm;
	for (const match of source.matchAll(definitionPattern)) {
		const target = match[2] ?? match[3] ?? match[4] ?? match[5];
		const start = match.index ?? 0;
		const destinationStart = match[0].indexOf(target, match[0].indexOf(']:') + 2);
		definitions.push({
			label: normalizeReferenceLabel(match[1]),
			target,
			offset: start + destinationStart,
		});
		definitionRanges.push({ start, end: start + match[0].length });
	}

	const usedLabels = new Set();
	const usagePattern = /!?\[([^\]\n]+)\](?:\[([^\]\n]*)\])?/g;
	for (const match of source.matchAll(usagePattern)) {
		const offset = match.index ?? 0;
		if (inRanges(offset, definitionRanges)) continue;
		if (source[offset + match[0].length] === '(') continue;
		const label = match[2] === undefined || match[2] === '' ? match[1] : match[2];
		usedLabels.add(normalizeReferenceLabel(label));
	}

	return definitions
		.filter((definition) => usedLabels.has(definition.label))
		.map(({ target, offset }) => ({ target, offset }));
};

const decodeStaticStringLiteral = (expression) => {
	const value = expression;
	const quote = value[0];
	if (!['"', "'", '`'].includes(quote) || value.at(-1) !== quote) return undefined;

	let decoded = '';
	for (let index = 1; index < value.length - 1; index += 1) {
		const character = value[index];
		if (quote === '`' && character === '$' && value[index + 1] === '{') return undefined;
		if (character !== '\\') {
			decoded += character;
			continue;
		}

		index += 1;
		if (index >= value.length - 1) return undefined;
		const escaped = value[index];
		const simpleEscapes = {
			b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v',
			'0': '\0', '\\': '\\', "'": "'", '"': '"', '`': '`', '$': '$',
		};
		if (Object.hasOwn(simpleEscapes, escaped)) {
			decoded += simpleEscapes[escaped];
			continue;
		}
		if (escaped === '\n') continue;
		if (escaped === '\r') {
			if (value[index + 1] === '\n') index += 1;
			continue;
		}
		if (escaped === 'x') {
			const digits = value.slice(index + 1, index + 3);
			if (!/^[0-9a-f]{2}$/i.test(digits)) return undefined;
			decoded += String.fromCodePoint(Number.parseInt(digits, 16));
			index += 2;
			continue;
		}
		if (escaped === 'u') {
			const braced = /^\{([0-9a-f]+)\}/i.exec(value.slice(index + 1));
			const digits = braced?.[1] ?? value.slice(index + 1, index + 5);
			if (!/^[0-9a-f]{4}$/i.test(digits) && !braced) return undefined;
			const codePoint = Number.parseInt(digits, 16);
			if (codePoint > 0x10ffff) return undefined;
			decoded += String.fromCodePoint(codePoint);
			index += braced ? braced[0].length : 4;
			continue;
		}
		decoded += escaped;
	}
	return decoded;
};

const quotedStringEnd = (source, start, limit) => {
	const quote = source[start];
	for (let index = start + 1; index < limit; index += 1) {
		if (source[index] === '\\') index += 1;
		else if (source[index] === quote) return index + 1;
		else if (source[index] === '\n' || source[index] === '\r') return undefined;
	}
	return undefined;
};

const blockCommentEnd = (source, start, limit) => {
	for (let index = start + 2; index < limit; index += 1) {
		if (source[index] === '*' && source[index + 1] === '/') return index + 2;
	}
	return limit;
};

const lineCommentEnd = (source, start, limit) => {
	let index = start + 2;
	while (index < limit && source[index] !== '\n' && source[index] !== '\r') index += 1;
	return index;
};

const skipJavascriptTrivia = (source, start, limit) => {
	let index = start;
	while (index < limit) {
		if (/\s/.test(source[index])) {
			index += 1;
			continue;
		}
		if (source[index] === '/' && source[index + 1] === '/') {
			index = lineCommentEnd(source, index, limit);
			continue;
		}
		if (source[index] === '/' && source[index + 1] === '*') {
			index = blockCommentEnd(source, index, limit);
			continue;
		}
		break;
	}
	return index;
};

const regexLiteralEnd = (source, start, limit) => {
	let inCharacterClass = false;
	for (let index = start + 1; index < limit; index += 1) {
		const character = source[index];
		if (character === '\\') {
			index += 1;
			continue;
		}
		if (character === '\n' || character === '\r') return undefined;
		if (character === '[') inCharacterClass = true;
		else if (character === ']') inCharacterClass = false;
		else if (character === '/' && !inCharacterClass) {
			index += 1;
			while (index < limit && /[a-z]/i.test(source[index])) index += 1;
			return index;
		}
	}
	return undefined;
};

const REGEX_PREFIX_KEYWORDS = new Set([
	'await', 'case', 'delete', 'do', 'else', 'in', 'instanceof', 'new',
	'of', 'return', 'throw', 'typeof', 'void', 'yield',
]);

function bracedJavascriptExpressionEnd(source, start, limit) {
	let depth = 1;
	let canStartRegex = true;
	let index = start + 1;
	while (index < limit) {
		const character = source[index];
		if (/\s/.test(character)) {
			index += 1;
			continue;
		}
		if (character === '/' && source[index + 1] === '/') {
			index = lineCommentEnd(source, index, limit);
			continue;
		}
		if (character === '/' && source[index + 1] === '*') {
			index = blockCommentEnd(source, index, limit);
			continue;
		}
		if (character === '"' || character === "'") {
			const end = quotedStringEnd(source, index, limit);
			if (end === undefined) return undefined;
			index = end;
			canStartRegex = false;
			continue;
		}
		if (character === '`') {
			const end = templateLiteralEnd(source, index, limit);
			if (end === undefined) return undefined;
			index = end;
			canStartRegex = false;
			continue;
		}
		if (character === '/' && canStartRegex) {
			const end = regexLiteralEnd(source, index, limit);
			if (end === undefined) return undefined;
			index = end;
			canStartRegex = false;
			continue;
		}
		if (/[A-Za-z_$]/.test(character)) {
			const identifierStart = index;
			index += 1;
			while (index < limit && /[\w$]/.test(source[index])) index += 1;
			canStartRegex = REGEX_PREFIX_KEYWORDS.has(source.slice(identifierStart, index));
			continue;
		}
		if (/\d/.test(character)) {
			index += 1;
			while (index < limit && /[\w.]/.test(source[index])) index += 1;
			canStartRegex = false;
			continue;
		}
		if (character === '{') {
			depth += 1;
			index += 1;
			canStartRegex = true;
			continue;
		}
		if (character === '}') {
			depth -= 1;
			if (depth === 0) return index;
			index += 1;
			canStartRegex = false;
			continue;
		}
		if (character === ')' || character === ']') {
			index += 1;
			canStartRegex = false;
			continue;
		}
		if (source.startsWith('...', index)) {
			index += 3;
			canStartRegex = true;
			continue;
		}
		if (source.startsWith('++', index) || source.startsWith('--', index)) {
			index += 2;
			continue;
		}
		canStartRegex = character !== '.';
		index += 1;
	}
	return undefined;
}

function templateLiteralEnd(source, start, limit) {
	let index = start + 1;
	while (index < limit) {
		if (source[index] === '\\') {
			index += 2;
			continue;
		}
		if (source[index] === '`') return index + 1;
		if (source[index] === '$' && source[index + 1] === '{') {
			const interpolationEnd = bracedJavascriptExpressionEnd(source, index + 1, limit);
			if (interpolationEnd === undefined) return undefined;
			index = interpolationEnd + 1;
			continue;
		}
		index += 1;
	}
	return undefined;
}

const decodeStaticStringExpression = (source, start, end) => {
	const literalStart = skipJavascriptTrivia(source, start, end);
	const quote = source[literalStart];
	const literalEnd = quote === '`'
		? templateLiteralEnd(source, literalStart, end)
		: quote === '"' || quote === "'"
			? quotedStringEnd(source, literalStart, end)
			: undefined;
	if (literalEnd === undefined || skipJavascriptTrivia(source, literalEnd, end) !== end) return undefined;
	const target = decodeStaticStringLiteral(source.slice(literalStart, literalEnd));
	return target === undefined ? undefined : { target, offset: literalStart + 1 };
};

const tagAttributeLinks = (source, codeRanges) => {
	const links = [];
	for (let tagStart = source.indexOf('<'); tagStart >= 0; tagStart = source.indexOf('<', tagStart + 1)) {
		if (inRanges(tagStart, codeRanges)) continue;
		if (!/[A-Za-z_$\/]/.test(source[tagStart + 1] ?? '')) continue;
		let index = tagStart + 1;
		if (source[index] === '/') index += 1;
		while (index < source.length && !/[\s/>]/.test(source[index])) index += 1;
		let end;
		while (index < source.length) {
			while (index < source.length && /\s/.test(source[index])) index += 1;
			if (source[index] === '>') {
				end = index;
				break;
			}
			if (source[index] === '/') {
				index += 1;
				continue;
			}
			if (source[index] === '{') {
				const expressionStart = index;
				const spreadMarker = skipJavascriptTrivia(source, expressionStart + 1, source.length);
				if (source.startsWith('...', spreadMarker)) {
					links.push({ dynamicAttribute: 'spread', offset: expressionStart });
				}
				const expressionEnd = bracedJavascriptExpressionEnd(source, expressionStart, source.length);
				if (expressionEnd === undefined) break;
				index = expressionEnd + 1;
				continue;
			}
			const nameStart = index;
			while (index < source.length && !/[\s=/>]/.test(source[index])) index += 1;
			if (nameStart === index) {
				index += 1;
				continue;
			}
			const attribute = source.slice(nameStart, index).toLowerCase();
			while (index < source.length && /\s/.test(source[index])) index += 1;
			if (source[index] !== '=') continue;
			index += 1;
			while (index < source.length && /\s/.test(source[index])) index += 1;

			let target;
			let targetOffset = index;
			let dynamic = false;
			const quote = source[index];
			if (quote === '"' || quote === "'") {
				const valueStart = index + 1;
				const valueEnd = quotedStringEnd(source, index, source.length);
				if (valueEnd === undefined) break;
				target = source.slice(valueStart, valueEnd - 1);
				targetOffset = valueStart;
				index = valueEnd;
			} else if (source[index] === '{') {
				const expressionBrace = index;
				const expressionEnd = bracedJavascriptExpressionEnd(source, expressionBrace, source.length);
				if (expressionEnd === undefined) {
					if (attribute === 'href' || attribute === 'src') {
						links.push({ dynamicAttribute: attribute, offset: nameStart });
					}
					break;
				}
				const expressionStart = index + 1;
				const staticString = decodeStaticStringExpression(source, expressionStart, expressionEnd);
				target = staticString?.target;
				targetOffset = staticString?.offset ?? expressionStart;
				dynamic = staticString === undefined;
				index = expressionEnd + 1;
			} else {
				const valueStart = index;
				while (index < source.length && !/[\s>]/.test(source[index])) index += 1;
				target = source.slice(valueStart, index);
				targetOffset = valueStart;
			}

			if (attribute !== 'href' && attribute !== 'src') continue;
			if (dynamic) links.push({ dynamicAttribute: attribute, offset: nameStart });
			else if (target) links.push({ target, offset: targetOffset });
		}
		if (end !== undefined) tagStart = end;
	}
	return links;
};

const markdownLinks = (body) => {
	const fencedSource = maskFencedCode(body);
	const codeRanges = inlineCodeRanges(fencedSource);
	const source = maskRanges(fencedSource, codeRanges);
	const links = [...referenceLinks(source), ...tagAttributeLinks(fencedSource, codeRanges)];
	const inlinePattern = /!?\[[^\]\n]*\]\(\s*(?:<([^>\n]+)>|([^\s)]+))/g;
	for (const match of source.matchAll(inlinePattern)) {
		const target = match[1] ?? match[2];
		links.push({ target, offset: (match.index ?? 0) + match[0].indexOf(target) });
	}
	const autolinkPattern = /<(https?:\/\/[^>\n]+)>/g;
	for (const match of source.matchAll(autolinkPattern)) {
		links.push({ target: match[1], offset: (match.index ?? 0) + 1 });
	}
	return links.sort((left, right) => left.offset - right.offset);
};

const metadataLine = (source, issue) => {
	const field = issue.path?.[0];
	return typeof field === 'string' ? lineFor(source, `${field}:`) : 1;
};

export const validateContent = async (contentDirectory = resolve('src/content/docs'), options = {}) => {
	const manifest = options.manifest ?? versions;
	const sectionRegistry = options.sectionRegistry ?? navigationSections;
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
		const authoredRoute = match[3] === 'index'
			? ''
			: match[3].endsWith('/index')
				? match[3].slice(0, -'/index'.length)
				: match[3];
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
			: data.contentType === 'section'
				? sectionPageMetadataSchema
				: data.contentType === 'homepage'
					? homepagePageMetadataSchema
					: data.contentType === 'redirect'
						? redirectPageSchema
						: undefined;
		if (!schema) {
			diagnostics.push({ path: displayPath, line: lineFor(source, 'contentType:') ?? 1, ruleId: 'content/schema', message: 'contentType must be technical, section, homepage, or redirect' });
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
		} else if (
			(data.contentType === 'technical' || data.contentType === 'section') &&
			metadata.mleCommit !== version.commit
		) {
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
			const linkLine = lineAt(source, Math.max(0, bodyStart) + link.offset);
			if (link.dynamicAttribute) {
				diagnostics.push({
					path: displayPath,
					line: linkLine,
					ruleId: 'content/dynamic-url',
					message: `${link.dynamicAttribute} uses a dynamic MDX expression; URL attributes must be static so snapshot source and latest-link rules can be verified`,
				});
				continue;
			}
			const sourceMatch = MLE_SOURCE_URL.exec(link.target);
			if (sourceMatch && (!version || sourceMatch[1] !== version.commit || !/^[0-9a-f]{40}$/.test(sourceMatch[1]))) {
				diagnostics.push({ path: displayPath, line: linkLine, ruleId: 'content/source-full-sha', message: `MLE source URL must use snapshot full SHA ${version?.commit ?? versionId}; found ${sourceMatch[1]}` });
			}
			if (version?.status === 'archived' && /(?:^|\/)latest(?:\/|$)/.test(link.target)) {
				diagnostics.push({ path: displayPath, line: linkLine, ruleId: 'content/archived-latest-link', message: 'archived snapshots must not link to /latest/' });
			}
		}

		if (data.contentType !== 'redirect') {
			pages.push({ path: displayPath, locale, versionId, authoredRoute, contentType: data.contentType, metadata });
		}
	}

	const firstByIdentity = new Map();
	const firstByTranslationIdentity = new Map();
	for (const page of pages) {
		const key = JSON.stringify([page.versionId, page.locale, page.metadata.pageId]);
		const existing = firstByIdentity.get(key);
		if (existing) {
			diagnostics.push({ path: page.path, ruleId: 'content/duplicate-page-id', message: `pageId ${page.metadata.pageId} duplicates ${existing.path} for ${page.locale}/${page.versionId}` });
		} else firstByIdentity.set(key, page);

		const translationKey = JSON.stringify([
			page.versionId,
			page.locale,
			page.metadata.pageId,
			page.contentType,
		]);
		if (!firstByTranslationIdentity.has(translationKey)) {
			firstByTranslationIdentity.set(translationKey, page);
		}
	}

	for (const page of pages.filter((candidate) => candidate.locale === 'pt-br')) {
		const identityKey = JSON.stringify([page.versionId, 'en', page.metadata.pageId]);
		const sameCommitEnglish = firstByIdentity.get(identityKey);
		const requiresSectionParity =
			page.contentType === 'section' || sameCommitEnglish?.contentType === 'section';
		const english = requiresSectionParity
			? firstByTranslationIdentity.get(
				JSON.stringify([page.versionId, 'en', page.metadata.pageId, page.contentType]),
			)
			: sameCommitEnglish;
		if (!english) {
			if (requiresSectionParity && sameCommitEnglish) {
				diagnostics.push({
					path: page.path,
					ruleId: 'content/translation-content-type',
					message: `Portuguese page ${page.metadata.pageId} must match English content type ${sameCommitEnglish.contentType}, not ${page.contentType}`,
				});
				continue;
			}
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

	const expectedSectionIds = new Set(sectionRegistry.map((section) => section.pageId));
	for (const page of pages.filter((candidate) => candidate.contentType === 'section')) {
		if (
			versionsById.has(page.versionId) &&
			versionsById.get(page.versionId)?.locales.includes(page.locale) &&
			!expectedSectionIds.has(page.metadata.pageId)
		) {
			diagnostics.push({
				path: page.path,
				ruleId: 'content/section-unexpected',
				message: `section pageId ${page.metadata.pageId} is not declared in the navigation registry`,
			});
		}
	}

	for (const version of manifest) {
		for (const locale of version.locales) {
			const sectionPages = pages.filter(
				(page) =>
					page.contentType === 'section' &&
					page.versionId === version.id &&
					page.locale === locale,
			);
			for (const section of sectionRegistry) {
				const matchingPages = sectionPages.filter(
					(page) => page.metadata.pageId === section.pageId,
				);
				if (matchingPages.length > 0) {
					for (const page of matchingPages) {
						if (page.authoredRoute === section.segment) continue;
						diagnostics.push({
							path: page.path,
							ruleId: 'content/section-route',
							message: `section pageId ${section.pageId} must use route ${section.segment}; found ${page.authoredRoute || '(root)'}`,
						});
					}
					continue;
				}
				const prefix = locale === 'pt-br' ? 'pt-br/' : '';
				diagnostics.push({
					path: `${prefix}versions/${version.id}`,
					ruleId: 'content/section-missing',
					message: `section pageId ${section.pageId} is missing for ${locale}/${version.id}`,
				});
			}
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
