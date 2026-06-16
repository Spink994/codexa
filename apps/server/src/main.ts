/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import 'reflect-metadata';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { NestFactory } from '@nestjs/core';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { AppModule } from './app.module.js';

/**
|--------------------------------------------------
| Load environment variables from a .env file
|--------------------------------------------------
| Reads the repo-root .env first, then the current
| working directory, so secrets like the GitHub OAuth
| credentials need not be exported by hand. Real shell
| variables still take precedence over file values.
|--------------------------------------------------
*/
const loadEnv = (): void => {
	/**
	|--------------------------------------------------
	| Skip when the runtime lacks .env file support
	|--------------------------------------------------
	*/
	if (typeof process.loadEnvFile !== 'function') return;

	/**
	|--------------------------------------------------
	| Resolve the repo root relative to this file
	|--------------------------------------------------
	*/
	const here = dirname(fileURLToPath(import.meta.url));
	const candidates = [join(here, '..', '..', '..', '.env'), join(process.cwd(), '.env')];

	/**
	|--------------------------------------------------
	| Apply each candidate file that exists
	|--------------------------------------------------
	*/
	for (const candidate of candidates) {
		try {
			process.loadEnvFile(candidate);
		} catch {
			/* missing or unreadable .env — fall through to the next candidate */
		}
	}
};

/**
|--------------------------------------------------
| Bootstrap the Codexa API server
|--------------------------------------------------
*/
const bootstrap = async (): Promise<void> => {
	/**
	|--------------------------------------------------
	| Load .env before reading any configuration
	|--------------------------------------------------
	*/
	loadEnv();

	/**
	|--------------------------------------------------
	| Create the Nest application
	|--------------------------------------------------
	*/
	const app = await NestFactory.create(AppModule);

	/**
	|--------------------------------------------------
	| Allow the frontend origin during development
	|--------------------------------------------------
	*/
	app.enableCors({ origin: process.env.CODEXA_WEB_ORIGIN || true });

	/**
	|--------------------------------------------------
	| Listen on the configured port
	|--------------------------------------------------
	*/
	const port = Number(process.env.PORT) || 4000;
	await app.listen(port);
	console.log(`Codexa API listening on http://localhost:${port}`);
};

/**
|--------------------------------------------------
| Start the server
|--------------------------------------------------
*/
void bootstrap();
