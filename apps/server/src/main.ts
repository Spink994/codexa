/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import 'reflect-metadata';
import process from 'node:process';
import { NestFactory } from '@nestjs/core';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { AppModule } from './app.module.js';

/**
|--------------------------------------------------
| Bootstrap the Codexa API server
|--------------------------------------------------
*/
const bootstrap = async (): Promise<void> => {
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
