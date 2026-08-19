import { lstat, realpath } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { versions } from '../src/data/versions.ts';
import { gzipVerifiedFile, readVerifiedFile, statVerifiedFile, walkBounded } from './validator-filesystem.mjs';

const DEFAULT_BASE = '/MLEDocs';
const LIMITS = Object.freeze({
	javascript: 120 * 1024,
	css: 100 * 1024,
	fonts: 250 * 1024,
	hero: 500 * 1024,
	raster: 750 * 1024,
});
const RASTER_EXTENSIONS = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp']);

const slash = (path) => path.split(sep).join('/');
const contains = (root, candidate) => candidate === root || candidate.startsWith(`${root}${sep}`);
const sortDiagnostics = (items) => items.sort((left, right) =>
	`${left.path}:${left.ruleId}:${left.message}`.localeCompare(`${right.path}:${right.ruleId}:${right.message}`),
);

const parseAttributes = (source) => {
	const attributes = new Map();
	const expression = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
	for (const match of source.matchAll(expression)) attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '');
	return attributes;
};

const localAsset = (target, root, fromRoute, base) => {
	if (!target || /^(?:https?:|\/\/|data:)/i.test(target)) return undefined;
	let pathname;
	try {
		decodeURIComponent(target);
		pathname = new URL(target, `https://local.invalid${fromRoute}`).pathname;
	} catch {
		return undefined;
	}
	if (pathname !== base && !pathname.startsWith(`${base}/`)) return undefined;
	const relativePath = decodeURIComponent(pathname.slice(base.length).replace(/^\//, ''));
	const path = resolve(root, relativePath);
	return contains(root, path) ? { path, relativePath: slash(relativePath) } : undefined;
};

const parseInitialAssets = (source, root, fromRoute, base) => {
	const scripts = new Map();
	const stylesheets = new Map();
	let hero;
	const expression = /<([a-zA-Z][a-zA-Z0-9:-]*)(\s[^<>]*?)?\s*\/?>/g;
	for (const match of source.matchAll(expression)) {
		const tag = match[1].toLowerCase();
		const attributes = parseAttributes(match[2] ?? '');
		if (tag === 'script' && attributes.has('src')) {
			const asset = localAsset(attributes.get('src'), root, fromRoute, base);
			if (asset) scripts.set(asset.relativePath, asset.path);
		}
		if (tag === 'link' && (attributes.get('rel') ?? '').toLowerCase().split(/\s+/).includes('stylesheet')) {
			const asset = localAsset(attributes.get('href'), root, fromRoute, base);
			if (asset) stylesheets.set(asset.relativePath, asset.path);
		}
		if (tag === 'img' && !hero && ((attributes.get('fetchpriority') ?? '').toLowerCase() === 'high' || (attributes.get('loading') ?? '').toLowerCase() === 'eager')) {
			hero = localAsset(attributes.get('src'), root, fromRoute, base);
		}
	}
	return { scripts, stylesheets, hero };
};

const measuredMessage = (label, measured, limit) => `${label}: measured ${measured} bytes; limit ${limit} bytes`;

export const validatePerformance = async (distDirectory, options = {}) => {
	const base = (options.base ?? DEFAULT_BASE).replace(/\/$/, '');
	const suppliedRoot = resolve(distDirectory);
	let root;
	try {
		root = await realpath(suppliedRoot);
		if (!(await lstat(root)).isDirectory()) throw new Error('not a directory');
	} catch (error) {
		return { diagnostics: [{ path: slash(suppliedRoot), ruleId: 'performance/directory', message: `cannot read dist directory: ${error.message}` }], measurements: [] };
	}
	if (!contains(suppliedRoot, root) && !contains(root, suppliedRoot)) {
		return { diagnostics: [{ path: slash(suppliedRoot), ruleId: 'performance/directory', message: 'resolved dist directory is outside the supplied path' }], measurements: [] };
	}

	const current = versions.find((entry) => entry.status === 'current');
	const representativePages = options.representativePages ?? [
		{ label: 'homepage', path: `versions/${current.id}/index.html`, homepage: true },
		{ label: 'renderer', path: `versions/${current.id}/systems/renderer/index.html`, homepage: false },
	];
	const allowlist = options.rasterAllowlist ?? {};
	/** @type {Array<{path: string, ruleId: string, message: string}>} */
	const diagnostics = [];
	/** @type {Array<{kind: string, path: string, measured: number, limit: number}>} */
	const measurements = [];
	const { files, diagnostics: traversalDiagnostics, limits } = await walkBounded(root, {
		namespace: 'performance',
		limits: options.limits,
	});
	diagnostics.push(...traversalDiagnostics);

	let homepageHero;
	for (const page of representativePages) {
		const path = resolve(root, page.path);
		if (!contains(root, path)) {
			diagnostics.push({ path: slash(page.path), ruleId: 'performance/path-escape', message: 'representative page escapes supplied dist tree' });
			continue;
		}
		const readPage = await readVerifiedFile(root, path, { maxBytes: limits.maxTextBytes, encoding: 'utf8' });
		if (!readPage.ok) {
			const ruleId = readPage.reason === 'symlink'
				? 'performance/symlink'
				: readPage.reason === 'escape'
					? 'performance/path-escape'
					: readPage.reason === 'file-size'
						? 'performance/html-size'
					: 'performance/missing-page';
			const message = readPage.reason === 'file-size'
				? `representative HTML exceeds ${limits.maxTextBytes} bytes`
				: `representative ${page.label} page is unsafe or unavailable: ${readPage.reason}`;
			diagnostics.push({ path: slash(page.path), ruleId, message });
			continue;
		}
		const pageRoute = `${base}/${slash(page.path).replace(/^\//, '')}`;
		const assets = parseInitialAssets(readPage.data, root, pageRoute, base);
		if (page.homepage) homepageHero = assets.hero;
		for (const [kind, assetMap, limit, ruleId] of [
			['javascript', assets.scripts, LIMITS.javascript, 'performance/javascript-gzip'],
			['css', assets.stylesheets, LIMITS.css, 'performance/css-gzip'],
		]) {
			let measured = 0;
			for (const [relativePath, assetPath] of assetMap) {
				const compressed = await gzipVerifiedFile(root, assetPath, { maxBytes: limits.maxAssetBytes });
				if (!compressed.ok) {
					const rule = compressed.reason === 'symlink'
						? 'performance/symlink'
						: compressed.reason === 'escape'
							? 'performance/path-escape'
							: compressed.reason === 'file-size'
								? 'performance/file-size'
							: 'performance/missing-asset';
					const message = compressed.reason === 'file-size'
						? `mapped asset exceeds read limit ${limits.maxAssetBytes} bytes`
						: `initial ${kind} asset is unsafe or unavailable: ${compressed.reason}`;
					diagnostics.push({ path: relativePath, ruleId: rule, message });
					continue;
				}
				measured += compressed.gzipBytes;
			}
			measurements.push({ kind, path: slash(page.path), measured, limit });
			if (measured > limit) diagnostics.push({ path: slash(page.path), ruleId, message: measuredMessage(`initial local ${kind} gzip`, measured, limit) });
		}
	}

	const fontFiles = files.filter((path) => extname(path).toLowerCase() === '.woff2');
	let fontBytes = 0;
	for (const path of fontFiles) {
		const inspected = await statVerifiedFile(root, path);
		if (inspected.ok) fontBytes += inspected.stats.size;
	}
	measurements.push({ kind: 'fonts', path: 'fonts/**/*.woff2', measured: fontBytes, limit: LIMITS.fonts });
	if (fontBytes > LIMITS.fonts) diagnostics.push({ path: 'fonts/**/*.woff2', ruleId: 'performance/fonts-total', message: measuredMessage('all shipped WOFF2', fontBytes, LIMITS.fonts) });

	if (homepageHero) {
		let heroBytes = 0;
		const inspectedHero = await statVerifiedFile(root, homepageHero.path);
		if (inspectedHero.ok) heroBytes = inspectedHero.stats.size;
		else diagnostics.push({ path: homepageHero.relativePath, ruleId: inspectedHero.reason === 'symlink' ? 'performance/symlink' : 'performance/missing-asset', message: `homepage hero is unsafe or unavailable: ${inspectedHero.reason}` });
		measurements.push({ kind: 'hero', path: homepageHero.relativePath, measured: heroBytes, limit: LIMITS.hero });
		if (heroBytes > LIMITS.hero) diagnostics.push({ path: homepageHero.relativePath, ruleId: 'performance/homepage-hero', message: measuredMessage('homepage hero', heroBytes, LIMITS.hero) });
	}

	for (const path of files.filter((candidate) => RASTER_EXTENSIONS.has(extname(candidate).toLowerCase())).sort()) {
		const relativePath = slash(relative(root, path));
		const inspected = await statVerifiedFile(root, path);
		if (!inspected.ok) continue;
		const measured = inspected.stats.size;
		measurements.push({ kind: 'raster', path: relativePath, measured, limit: LIMITS.raster });
		if (homepageHero?.relativePath === relativePath || measured <= LIMITS.raster) continue;
		const entry = allowlist[relativePath];
		if (entry && typeof entry.reason === 'string' && entry.reason.trim() && typeof entry.pageId === 'string' && entry.pageId.trim()) continue;
		diagnostics.push({ path: relativePath, ruleId: 'performance/raster-size', message: measuredMessage('raster asset', measured, LIMITS.raster) });
	}

	measurements.sort((left, right) => `${left.kind}:${left.path}`.localeCompare(`${right.kind}:${right.path}`));
	return { diagnostics: sortDiagnostics(diagnostics), measurements };
};

const runCli = async () => {
	if (!process.argv[2]) {
		console.error('usage: validate-performance.mjs <dist-dir>');
		process.exitCode = 2;
		return;
	}
	const result = await validatePerformance(resolve(process.argv[2]));
	for (const measurement of result.measurements) console.log(`${measurement.path} performance/measurement ${measuredMessage(measurement.kind, measurement.measured, measurement.limit)}`);
	for (const diagnostic of result.diagnostics) console.log(`${diagnostic.path} ${diagnostic.ruleId} ${diagnostic.message}`);
	process.exitCode = result.diagnostics.length === 0 ? 0 : 1;
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	runCli().catch((error) => {
		console.error(`performance validation failed: ${error.message}`);
		process.exitCode = 1;
	});
}
