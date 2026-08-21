const fullSha = /^[0-9a-f]{40}$/;

export function buildPinnedSourceUrl(repositoryUrl: string, commit: string, path: string): string {
	if (!fullSha.test(commit)) throw new Error(`Invalid full MLE commit ${commit}.`);
	if (
		path.startsWith('/') ||
		path.includes('\\') ||
		/[?#]/.test(path) ||
		path.split('/').some((part) => part === '' || part === '.' || part === '..')
	) {
		throw new Error(`Unsafe MLE evidence path ${path}.`);
	}
	const encoded = path.split('/').map(encodeURIComponent).join('/');
	return `${repositoryUrl.replace(/\/$/, '')}/blob/${commit}/${encoded}`;
}
