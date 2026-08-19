import { lstat, realpath } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readVerifiedFile, statVerifiedFile, walkBounded } from './validator-filesystem.mjs';

const DEFAULT_BASE = '/MLEDocs';
const LOCAL_ORIGIN = 'https://maxmfonseca.github.io';

const slash = (path) => path.split(sep).join('/');
const contains = (root, candidate) => candidate === root || candidate.startsWith(`${root}${sep}`);
const sortDiagnostics = (diagnostics) => diagnostics.sort((left, right) =>
	`${left.path}:${String(left.line ?? 0).padStart(9, '0')}:${left.ruleId}:${left.message}`.localeCompare(
		`${right.path}:${String(right.line ?? 0).padStart(9, '0')}:${right.ruleId}:${right.message}`,
	));

export const formatDiagnostic = ({ path, line, ruleId, message }) =>
	`${path}${line === undefined ? '' : `:${line}`} ${ruleId} ${message}`;

const decodeNumericEntities = (value, onMalformed) => value.replace(/&#([^;]*);/gi, (entity, body) => {
	const hexadecimal = /^x([0-9a-f]+)$/i.exec(body);
	const digits = hexadecimal?.[1] ?? (/^[0-9]+$/.test(body) ? body : undefined);
	if (digits === undefined) return onMalformed(entity);
	const codePoint = Number.parseInt(digits, hexadecimal ? 16 : 10);
	if (codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) return onMalformed(entity);
	return String.fromCodePoint(codePoint);
});

const decodeNamedEntities = (value) => value
	.replace(/&amp;/gi, '&')
	.replace(/&quot;/gi, '"')
	.replace(/&apos;/gi, "'");

const decodeHtml = (value) => {
	let malformed = false;
	const decoded = decodeNamedEntities(decodeNumericEntities(value, (entity) => {
		malformed = true;
		return entity;
	}));
	return { value: decoded, malformed };
};

const prepareSrcset = (source) => {
	// Malformed entities must survive grammar parsing without becoming separators.
	let markerPrefix = '\ue000';
	while (source.includes(markerPrefix)) markerPrefix += '\ue000';
	while (true) {
		const markers = new Map();
		const value = decodeNamedEntities(decodeNumericEntities(source, (entity) => {
			const marker = `${markerPrefix}${markers.size}\ue001`;
			markers.set(marker, entity);
			return marker;
		}));
		const collides = [...markers.keys()].some((marker) => value.indexOf(marker) !== value.lastIndexOf(marker));
		if (collides) {
			markerPrefix += '\ue000';
			continue;
		}
		return {
			value,
			restore(candidate) {
				let restored = candidate;
				let malformed = false;
				for (const [marker, entity] of markers) {
					if (!restored.includes(marker)) continue;
					restored = restored.replaceAll(marker, entity);
					malformed = true;
				}
				return { value: restored, malformed };
			},
		};
	}
};

const parseAttributes = (source) => {
	const attributes = new Map();
	const rawAttributes = new Map();
	const malformedAttributes = new Set();
	const expression = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
	for (const match of source.matchAll(expression)) {
		const name = match[1].toLowerCase();
		const rawValue = match[2] ?? match[3] ?? match[4] ?? '';
		const decoded = decodeHtml(rawValue);
		rawAttributes.set(name, rawValue);
		attributes.set(name, decoded.value);
		if (decoded.malformed) malformedAttributes.add(name);
	}
	return { attributes, rawAttributes, malformedAttributes };
};

const parseSrcset = (source) => {
	const prepared = prepareSrcset(source);
	source = prepared.value;
	const candidates = [];
	let offset = 0;
	while (offset < source.length) {
		while (/[\s,]/.test(source[offset] ?? '')) offset += 1;
		if (offset >= source.length) break;
		const start = offset;
		const dataUrl = source.slice(offset, offset + 5).toLowerCase() === 'data:';
		while (offset < source.length && !/\s/.test(source[offset]) && (dataUrl || source[offset] !== ',')) offset += 1;
		let url = source.slice(start, offset);
		let endedAtComma = false;
		while (url.endsWith(',')) {
			url = url.slice(0, -1);
			endedAtComma = true;
		}
		if (url) candidates.push(prepared.restore(url));
		if (endedAtComma) continue;
		while (offset < source.length && source[offset] !== ',') offset += 1;
		if (source[offset] === ',') offset += 1;
	}
	return candidates;
};

const lineAt = (source, offset) => source.slice(0, offset).split(/\r?\n/).length;

const parseHtml = (source) => {
	const anchors = new Set();
	const references = [];
	const expression = /<([a-zA-Z][a-zA-Z0-9:-]*)(\s[^<>]*?)?\s*\/?>/g;
	for (const match of source.matchAll(expression)) {
		const tag = match[1].toLowerCase();
		const { attributes, rawAttributes, malformedAttributes } = parseAttributes(match[2] ?? '');
		const line = lineAt(source, match.index ?? 0);
		for (const name of ['id', 'name']) {
			const anchor = attributes.get(name);
			if (anchor) anchors.add(anchor);
		}

		const href = attributes.get('href');
		if (href !== undefined) {
			if (tag === 'a' || tag === 'area') references.push({ target: href, kind: 'route', line, malformed: malformedAttributes.has('href') });
			else if (tag === 'link') {
				const rel = (attributes.get('rel') ?? '').toLowerCase().split(/\s+/);
				if (rel.includes('canonical')) references.push({ target: href, kind: 'canonical', line, malformed: malformedAttributes.has('href') });
				else if (rel.includes('alternate')) references.push({ target: href, kind: 'alternate', line, malformed: malformedAttributes.has('href') });
				else references.push({ target: href, kind: 'asset', line, malformed: malformedAttributes.has('href') });
			}
		}

		const src = attributes.get('src');
		if (src !== undefined && ['img', 'script', 'source', 'video', 'audio', 'iframe'].includes(tag)) {
			references.push({ target: src, kind: 'asset', line, malformed: malformedAttributes.has('src') });
		}
		const srcset = rawAttributes.get('srcset');
		if (srcset !== undefined) {
			for (const candidate of parseSrcset(srcset)) references.push({ target: candidate.value, kind: 'asset', line, malformed: candidate.malformed });
		}

		if (tag === 'meta' && (attributes.get('http-equiv') ?? '').toLowerCase() === 'refresh') {
			const content = attributes.get('content') ?? '';
			const refresh = /(?:^|;)\s*url\s*=\s*(?:"([^"]+)"|'([^']+)'|([^;\s]+))/i.exec(content);
			if (refresh) references.push({ target: refresh[1] ?? refresh[2] ?? refresh[3], kind: 'refresh', line, malformed: malformedAttributes.has('content') });
		}
	}
	return { anchors, references };
};

const routeForFile = (relativePath, base) => {
	if (relativePath === 'index.html') return `${base}/`;
	if (relativePath.endsWith('/index.html')) return `${base}/${relativePath.slice(0, -'index.html'.length)}`;
	return `${base}/${relativePath}`;
};

const isMalformedEncoding = (value) => {
	try {
		decodeURIComponent(value);
		return false;
	} catch {
		return true;
	}
};

const normalizeReference = (target, fromRoute, base, siteOrigin) => {
	if (!target) return { pathname: fromRoute, fragment: '', internal: true, omittedBase: false };
	if (/^(?:mailto|tel|data|javascript):/i.test(target)) return { internal: false };
	if (isMalformedEncoding(target)) return { malformed: true, internal: true };
	if (target.startsWith('#')) {
		return { pathname: fromRoute, fragment: target.slice(1), internal: true, omittedBase: false };
	}
	let url;
	try {
		url = new URL(target, `${siteOrigin}${fromRoute}`);
	} catch {
		return { malformed: true, internal: true };
	}
	if (url.origin !== siteOrigin) return { internal: false, url };
	const rootRelative = target.startsWith('/');
	const omittedBase = rootRelative && url.pathname !== base && !url.pathname.startsWith(`${base}/`);
	return {
		internal: true,
		omittedBase,
		pathname: url.pathname,
		fragment: url.hash ? url.hash.slice(1) : '',
	};
};

const routeCandidates = (pathname) => {
	const candidates = new Set([pathname]);
	if (!pathname.endsWith('/')) candidates.add(`${pathname}/`);
	if (pathname.endsWith('.html')) candidates.add(pathname.slice(0, -'.html'.length) + '/');
	return candidates;
};

const excludedFromReachability = (route, base) =>
	route === `${base}/404.html` ||
	route.startsWith(`${base}/pagefind/`) ||
	/(?:^|\/)latest(?:\/|$)/.test(route);

export const validateBuiltLinks = async (distDirectory, options = {}) => {
	const base = (options.base ?? DEFAULT_BASE).replace(/\/$/, '');
	const siteOrigin = new URL(options.site ?? LOCAL_ORIGIN).origin;
	const suppliedRoot = resolve(distDirectory);
	let root;
	try {
		root = await realpath(suppliedRoot);
		if (!(await lstat(root)).isDirectory()) throw new Error('not a directory');
	} catch (error) {
		return [{ path: slash(suppliedRoot), ruleId: 'links/directory', message: `cannot read dist directory: ${error.message}` }];
	}
	if (!contains(suppliedRoot, root) && !contains(root, suppliedRoot)) {
		return [{ path: slash(suppliedRoot), ruleId: 'links/directory', message: 'resolved dist directory is outside the supplied path' }];
	}

	/** @type {Array<{path: string, line?: number, ruleId: string, message: string}>} */
	const diagnostics = [];
	const { files, diagnostics: traversalDiagnostics, limits } = await walkBounded(root, {
		namespace: 'links',
		limits: options.limits,
	});
	diagnostics.push(...traversalDiagnostics);
	const pages = new Map();
	for (const file of files.filter((path) => extname(path).toLowerCase() === '.html')) {
		const displayPath = slash(relative(root, file));
		const read = await readVerifiedFile(root, file, { maxBytes: limits.maxTextBytes, encoding: 'utf8' });
		if (!read.ok) {
			const ruleId = read.reason === 'symlink' ? 'links/symlink' : read.reason === 'file-size' ? 'links/html-size' : 'links/path-escape';
			const message = read.reason === 'file-size'
				? `HTML exceeds bounded parser limit ${limits.maxTextBytes} bytes`
				: `HTML file is unsafe or unavailable: ${read.reason}`;
			diagnostics.push({ path: displayPath, ruleId, message });
			continue;
		}
		const source = read.data;
		const route = routeForFile(displayPath, base);
		pages.set(route, { path: displayPath, route, ...parseHtml(source) });
	}

	const edges = new Map([...pages.keys()].map((route) => [route, new Set()]));
	for (const page of pages.values()) {
		for (const reference of page.references) {
			if (page.route === `${base}/404.html` && (reference.kind === 'canonical' || reference.kind === 'alternate')) continue;
			if (reference.malformed) {
				diagnostics.push({ path: page.path, line: reference.line, ruleId: 'links/malformed-url', message: `invalid numeric HTML entity in ${reference.target}` });
				continue;
			}
			const decodedCanonical = reference.kind === 'canonical' && !isMalformedEncoding(reference.target)
				? decodeURIComponent(reference.target)
				: reference.target;
			if (reference.kind === 'canonical' && /(?:^|\/)latest(?:\/|$)/.test(decodedCanonical)) {
				diagnostics.push({ path: page.path, line: reference.line, ruleId: 'links/canonical-latest', message: `canonical URL must use a permanent version route: ${reference.target}` });
			}
			const normalized = normalizeReference(reference.target, page.route, base, siteOrigin);
			if (normalized.malformed) {
				diagnostics.push({ path: page.path, line: reference.line, ruleId: 'links/malformed-url', message: `malformed percent encoding in ${reference.target}` });
				if (reference.target.startsWith('/') && !reference.target.startsWith(`${base}/`)) diagnostics.push({ path: page.path, line: reference.line, ruleId: 'links/base-path', message: `root-relative local URL must begin with ${base}: ${reference.target}` });
				continue;
			}
			if (!normalized.internal) {
				if (reference.kind === 'canonical') diagnostics.push({ path: page.path, line: reference.line, ruleId: 'links/canonical-site', message: `canonical URL must use configured site ${siteOrigin} and base ${base}: ${reference.target}` });
				continue;
			}
			if (reference.kind === 'canonical' && normalized.pathname !== base && !normalized.pathname.startsWith(`${base}/`)) {
				diagnostics.push({ path: page.path, line: reference.line, ruleId: 'links/canonical-base', message: `canonical URL must remain under configured base ${base}: ${reference.target}` });
				continue;
			}
			if (normalized.omittedBase) {
				diagnostics.push({ path: page.path, line: reference.line, ruleId: 'links/base-path', message: `root-relative local URL must begin with ${base}: ${reference.target}` });
				continue;
			}
			const relativeTarget = normalized.pathname === base
				? 'index.html'
				: normalized.pathname.startsWith(`${base}/`)
					? decodeURIComponent(normalized.pathname.slice(base.length + 1))
					: undefined;
			if (relativeTarget === undefined) continue;
			const candidatePath = resolve(root, relativeTarget);
			if (!contains(root, candidatePath)) {
				diagnostics.push({ path: page.path, line: reference.line, ruleId: 'links/path-escape', message: `target escapes supplied dist tree: ${reference.target}` });
				continue;
			}

			if (reference.kind === 'asset') {
				const inspected = await statVerifiedFile(root, candidatePath);
				if (!inspected.ok) {
					const ruleId = inspected.reason === 'symlink'
						? 'links/symlink'
						: inspected.reason === 'escape'
							? 'links/path-escape'
							: 'links/missing-asset';
					diagnostics.push({ path: page.path, line: reference.line, ruleId, message: `asset is unsafe or unavailable (${inspected.reason}): ${reference.target}` });
				}
				continue;
			}
			const destination = [...routeCandidates(normalized.pathname)].find((candidate) => pages.has(candidate));
			if (!destination) {
				diagnostics.push({ path: page.path, line: reference.line, ruleId: 'links/broken-route', message: `route does not exist: ${reference.target}` });
				continue;
			}
			edges.get(page.route).add(destination);
			if (normalized.fragment) {
				const fragment = decodeURIComponent(normalized.fragment);
				if (!pages.get(destination).anchors.has(fragment)) diagnostics.push({ path: page.path, line: reference.line, ruleId: 'links/broken-anchor', message: `anchor #${fragment} does not exist at ${destination}` });
			}
		}
	}

	const navigable = [...pages.keys()].filter((route) => !excludedFromReachability(route, base));
	const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const snapshotOverview = new RegExp(`^${escapedBase}(?:/pt-br)?/versions/[^/]+/$`);
	const roots = navigable.filter((route) => snapshotOverview.test(route));
	if (roots.length === 0 && navigable.includes(`${base}/`)) roots.push(`${base}/`);
	const reachable = new Set();
	const queue = [...roots].sort();
	while (queue.length > 0) {
		const route = queue.shift();
		if (reachable.has(route)) continue;
		reachable.add(route);
		for (const destination of [...(edges.get(route) ?? [])].sort()) queue.push(destination);
	}
	for (const route of navigable.sort()) {
		if (!reachable.has(route)) diagnostics.push({ path: pages.get(route).path, ruleId: 'links/orphan-page', message: `navigable page is unreachable from a snapshot overview: ${route}` });
	}

	return sortDiagnostics(diagnostics);
};

const runCli = async () => {
	if (!process.argv[2]) {
		console.error('usage: validate-links.mjs <dist-dir>');
		process.exitCode = 2;
		return;
	}
	const diagnostics = await validateBuiltLinks(resolve(process.argv[2]));
	for (const diagnostic of diagnostics) console.log(formatDiagnostic(diagnostic));
	if (diagnostics.length === 0) console.log('built link validation passed');
	process.exitCode = diagnostics.length === 0 ? 0 : 1;
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	runCli().catch((error) => {
		console.error(`built link validation failed: ${error.message}`);
		process.exitCode = 1;
	});
}
