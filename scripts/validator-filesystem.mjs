import { constants } from 'node:fs';
import { lstat, open, opendir, realpath } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

export const DEFAULT_VALIDATOR_LIMITS = Object.freeze({
	maxDepth: 32,
	maxFiles: 100_000,
	maxTextBytes: 8 * 1024 * 1024,
	maxAssetBytes: 16 * 1024 * 1024,
});

const slash = (path) => path.split(sep).join('/');
const defaultFilesystem = {
	lstat: (path) => lstat(path),
	realpath: (path) => realpath(path),
	open: (path, flags) => open(path, flags),
	opendir: (path) => opendir(path),
};

export const validatorLimits = (overrides = {}) => {
	const limits = { ...DEFAULT_VALIDATOR_LIMITS, ...overrides };
	for (const [name, value] of Object.entries(limits)) {
		if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${name} must be a positive safe integer`);
	}
	return limits;
};

export const isContainedPath = (root, candidate) => {
	const resolvedRoot = resolve(root);
	const resolvedCandidate = resolve(candidate);
	return resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(`${resolvedRoot}${sep}`);
};

const fileIdentity = (stats) => {
	if ((typeof stats.dev !== 'number' && typeof stats.dev !== 'bigint') ||
		(typeof stats.ino !== 'number' && typeof stats.ino !== 'bigint')) return undefined;
	const isZero = (value) => value === 0 || value === 0n;
	if (isZero(stats.dev) && isZero(stats.ino)) return undefined;
	return `${stats.dev}:${stats.ino}`;
};

const closeQuietly = async (handle) => {
	try { await handle.close(); } catch { /* preserve the original safety result */ }
};

/**
 * Opens a contained regular file and proves that the opened handle is the same
 * file inspected before opening. Callers own the returned handle.
 */
export const openVerifiedFile = async (root, candidate, filesystem = defaultFilesystem) => {
	if (!isContainedPath(root, candidate)) return { ok: false, reason: 'escape' };
	let before;
	try { before = await filesystem.lstat(candidate); }
	catch { return { ok: false, reason: 'missing' }; }
	if (before.isSymbolicLink()) return { ok: false, reason: 'symlink' };
	if (!before.isFile()) return { ok: false, reason: 'not-file' };
	const beforeIdentity = fileIdentity(before);
	if (!beforeIdentity) return { ok: false, reason: 'identity-unavailable' };

	let resolvedCandidate;
	try { resolvedCandidate = await filesystem.realpath(candidate); }
	catch { return { ok: false, reason: 'missing' }; }
	if (!isContainedPath(root, resolvedCandidate)) return { ok: false, reason: 'escape' };

	let handle;
	try {
		const noFollow = typeof constants.O_NOFOLLOW === 'number' ? constants.O_NOFOLLOW : 0;
		handle = await filesystem.open(candidate, constants.O_RDONLY | noFollow);
	} catch (error) {
		return { ok: false, reason: error?.code === 'ELOOP' ? 'symlink' : 'missing' };
	}

	let opened;
	try { opened = await handle.stat(); }
	catch {
		await closeQuietly(handle);
		return { ok: false, reason: 'missing' };
	}
	if (!opened.isFile()) {
		await closeQuietly(handle);
		return { ok: false, reason: 'not-file' };
	}
	const openedIdentity = fileIdentity(opened);
	if (!openedIdentity) {
		await closeQuietly(handle);
		return { ok: false, reason: 'identity-unavailable' };
	}
	if (openedIdentity !== beforeIdentity) {
		await closeQuietly(handle);
		return { ok: false, reason: 'identity-mismatch' };
	}
	return { ok: true, path: resolvedCandidate, stats: opened, handle };
};

export const statVerifiedFile = async (root, candidate, options = {}) => {
	const opened = await openVerifiedFile(root, candidate, options.filesystem ?? defaultFilesystem);
	if (!opened.ok) return opened;
	try { return { ok: true, path: opened.path, stats: opened.stats }; }
	finally { await closeQuietly(opened.handle); }
};

export const readVerifiedFile = async (root, candidate, options = {}) => {
	const maxBytes = options.maxBytes;
	if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new TypeError('maxBytes must be a positive safe integer');
	const opened = await openVerifiedFile(root, candidate, options.filesystem ?? defaultFilesystem);
	if (!opened.ok) return opened;
	try {
		if (opened.stats.size > maxBytes) return { ok: false, reason: 'file-size', size: opened.stats.size, limit: maxBytes };
		const chunks = [];
		let bytesRead = 0;
		while (bytesRead <= maxBytes) {
			const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, maxBytes + 1 - bytesRead));
			let result;
			try { result = await opened.handle.read(buffer, 0, buffer.length, null); }
			catch { return { ok: false, reason: 'read-failed' }; }
			if (result.bytesRead === 0) break;
			chunks.push(buffer.subarray(0, result.bytesRead));
			bytesRead += result.bytesRead;
		}
		if (bytesRead > maxBytes) return { ok: false, reason: 'file-size', size: bytesRead, limit: maxBytes };
		const data = Buffer.concat(chunks, bytesRead);
		return { ok: true, path: opened.path, stats: opened.stats, data: options.encoding ? data.toString(options.encoding) : data };
	} finally {
		await closeQuietly(opened.handle);
	}
};

export const gzipVerifiedFile = async (root, candidate, options = {}) => {
	const read = await readVerifiedFile(root, candidate, options);
	if (!read.ok) return read;
	return { ...read, gzipBytes: gzipSync(read.data, { level: 9 }).length };
};

/**
 * @param {string} root
 * @param {any} options
 */
export const walkBounded = async (root, options = {}) => {
	const { namespace, limits: overrides, filesystem = defaultFilesystem } = options;
	const limits = validatorLimits(overrides);
	const files = [];
	const diagnostics = [];
	let stopped = false;
	const visit = async (directory, depth) => {
		const handle = await filesystem.opendir(directory);
		try {
			while (!stopped) {
				const entry = await handle.read();
				if (!entry) break;
				const path = resolve(directory, entry.name);
				const displayPath = slash(relative(root, path));
				if (entry.isSymbolicLink()) {
					diagnostics.push({ path: displayPath, ruleId: `${namespace}/symlink`, message: 'symbolic links are not followed' });
					continue;
				}
				if (entry.isDirectory()) {
					if (depth + 1 > limits.maxDepth) {
						diagnostics.push({ path: displayPath, ruleId: `${namespace}/max-depth`, message: `traversal depth exceeds limit ${limits.maxDepth}` });
						continue;
					}
					await visit(path, depth + 1);
					continue;
				}
				if (!entry.isFile()) continue;
				if (files.length >= limits.maxFiles) {
					diagnostics.push({ path: '.', ruleId: `${namespace}/max-files`, message: `file count exceeds limit ${limits.maxFiles}` });
					files.length = 0;
					stopped = true;
					break;
				}
				files.push(path);
			}
		} finally {
			await closeQuietly(handle);
		}
	};
	await visit(root, 0);
	files.sort((left, right) => left.localeCompare(right));
	diagnostics.sort((left, right) => `${left.path}:${left.ruleId}:${left.message}`.localeCompare(`${right.path}:${right.ruleId}:${right.message}`));
	return { files, diagnostics, limits };
};
