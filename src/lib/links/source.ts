import type { VersionEntry } from '../../data/versions';
import { getVersion } from '../versions/manifest';

const isSafeSourcePath = (path: string): boolean => {
	if (path === '' || path.startsWith('/') || path.includes('\\') || path.includes('://')) {
		return false;
	}

	return path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
};

const encodeSourcePath = (path: string): string =>
	path.split('/').map(encodeURIComponent).join('/');

export const mleSourceUrl = (version: VersionEntry, path: string, line?: number): string => {
	const manifestVersion = getVersion(version.id);
	if (!manifestVersion || manifestVersion.commit !== version.commit) {
		throw new Error(`Version ${version.id} is not in the documentation manifest.`);
	}
	if (!isSafeSourcePath(path)) {
		throw new Error(`Source path must be a safe repository-relative path: ${path}`);
	}
	if (line !== undefined && (!Number.isInteger(line) || line <= 0)) {
		throw new Error(`Source line must be a positive integer: ${line}`);
	}

	const fragment = line === undefined ? '' : `#L${line}`;
	return `${manifestVersion.repositoryUrl}/blob/${version.commit}/${encodeSourcePath(path)}${fragment}`;
};
