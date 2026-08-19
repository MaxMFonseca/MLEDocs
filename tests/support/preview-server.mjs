import { preview } from 'astro';
import { createServer } from 'node:net';

const host = '127.0.0.1';
const port = 4321;

const assertPortAvailable = () =>
	new Promise((resolve, reject) => {
		const probe = createServer();
		probe.once('error', (error) => {
			reject(
				new Error(`Production preview requires ${host}:${port} to be unused.`, {
					cause: error,
				}),
			);
		});
		probe.listen({ host, port, exclusive: true }, () => probe.close(resolve));
	});

export default async function startProductionPreview() {
	await assertPortAvailable();
	const server = await preview({ server: { host, port } });
	if (server.host !== host || server.port !== port) {
		await server.stop();
		throw new Error(
			`Production preview started at ${server.host ?? 'unknown'}:${server.port}, expected ${host}:${port}.`,
		);
	}

	return async () => {
		await server.stop();
	};
}
