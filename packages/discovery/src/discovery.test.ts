/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { discoverBackends } from './discovery.js';

/**
|--------------------------------------------------
| Fixture directory
|--------------------------------------------------
*/
const fixturesPath = resolve(import.meta.dirname, '../../../fixtures/discovery');

/**
|--------------------------------------------------
| Promise-based process execution
|--------------------------------------------------
*/
const execFileAsync = promisify(execFile);

/**
|--------------------------------------------------
| Discover Nest backend modules
|--------------------------------------------------
*/
test('discovers Nest modules and respects ignore files', async () => {
	/**
	|--------------------------------------------------
	| Scan Nest fixture workspace
	|--------------------------------------------------
	*/
	const result = await discoverBackends(resolve(fixturesPath, 'nest-workspace'), {
		cache: false,
		gitState: false,
	});

	/**
	|--------------------------------------------------
	| Confirm detected backend root
	|--------------------------------------------------
	*/
	assert.equal(result.roots.length, 1);
	assert.equal(result.roots[0]?.path, 'src');
	assert.equal(result.roots[0]?.framework, 'nestjs');
	assert.equal(result.roots[0]?.language, 'typescript');

	/**
	|--------------------------------------------------
	| Confirm explicit modules and ignored paths
	|--------------------------------------------------
	*/
	assert.deepEqual(
		result.roots[0]?.modules.map((module) => module.path),
		['.', 'auth', 'billing'],
	);
	assert.equal(
		result.roots[0]?.modules.some((module) => module.path.includes('private')),
		false,
	);

	/**
	|--------------------------------------------------
	| Confirm parsed source metadata
	|--------------------------------------------------
	*/
	const authService = result.roots[0]?.modules
		.find((module) => module.path === 'auth')
		?.files.find((file) => file.path.endsWith('auth.service.ts'));
	assert.equal(authService?.syntaxValid, true);
	assert.deepEqual(authService?.imports, ['./auth.controller']);
	assert.deepEqual(authService?.exports, ['AuthService']);
});

/**
|--------------------------------------------------
| Discover generic Express modules
|--------------------------------------------------
*/
test('groups generic Express source directories into modules', async () => {
	/**
	|--------------------------------------------------
	| Scan Express fixture workspace
	|--------------------------------------------------
	*/
	const result = await discoverBackends(resolve(fixturesPath, 'express-workspace'), {
		cache: false,
		gitState: false,
	});

	/**
	|--------------------------------------------------
	| Confirm Express backend classification
	|--------------------------------------------------
	*/
	assert.equal(result.roots.length, 1);
	assert.equal(result.roots[0]?.framework, 'express');
	assert.equal(result.roots[0]?.language, 'javascript');

	/**
	|--------------------------------------------------
	| Confirm source-directory module grouping
	|--------------------------------------------------
	*/
	assert.deepEqual(
		result.roots[0]?.modules.map((module) => module.path),
		['generated', 'routes', 'services'],
	);
	assert.equal(
		result.roots[0]?.modules.find((module) => module.path === 'generated')?.files[0]?.generated,
		true,
	);
});

/**
|--------------------------------------------------
| Reuse unchanged source analysis cache
|--------------------------------------------------
*/
test('restores unchanged analysis from content-hash cache', async () => {
	/**
	|--------------------------------------------------
	| Copy fixture into temporary workspace
	|--------------------------------------------------
	*/
	const workspacePath = await mkdtemp(resolve(tmpdir(), 'codexa-cache-'));
	await cp(resolve(fixturesPath, 'express-workspace'), workspacePath, { recursive: true });

	try {
		/**
		|--------------------------------------------------
		| Run initial and repeated cached discovery
		|--------------------------------------------------
		*/
		const first = await discoverBackends(workspacePath, { gitState: false });
		const second = await discoverBackends(workspacePath, { gitState: false });

		/**
		|--------------------------------------------------
		| Change one source file after cached scan
		|--------------------------------------------------
		*/
		await writeFile(
			resolve(workspacePath, 'src', 'routes', 'health.route.js'),
			'export const healthRoute = { changed: true };',
		);
		const third = await discoverBackends(workspacePath, { gitState: false });

		/**
		|--------------------------------------------------
		| Confirm cache reuse and targeted invalidation
		|--------------------------------------------------
		*/
		assert.equal(first.cacheHits, 0);
		assert.equal(first.cacheMisses, 3);
		assert.equal(second.cacheHits, 3);
		assert.equal(second.cacheMisses, 0);
		assert.equal(third.cacheHits, 2);
		assert.equal(third.cacheMisses, 1);
	} finally {
		/**
		|--------------------------------------------------
		| Remove temporary cache workspace
		|--------------------------------------------------
		*/
		await rm(workspacePath, { recursive: true, force: true });
	}
});

/**
|--------------------------------------------------
| Report malformed and dirty source files
|--------------------------------------------------
*/
test('reports parser diagnostics and Git dirty state', async () => {
	/**
	|--------------------------------------------------
	| Create temporary backend workspace
	|--------------------------------------------------
	*/
	const workspacePath = await mkdtemp(resolve(tmpdir(), 'codexa-git-'));
	await mkdir(resolve(workspacePath, 'src'), { recursive: true });
	await writeFile(
		resolve(workspacePath, 'package.json'),
		JSON.stringify({
			name: 'dirty-backend',
			dependencies: {
				express: '5.0.0',
			},
		}),
	);
	await writeFile(resolve(workspacePath, 'src', 'broken.service.ts'), 'export class Broken {');

	try {
		/**
		|--------------------------------------------------
		| Initialize Git repository with untracked source
		|--------------------------------------------------
		*/
		await execFileAsync('git', ['init'], { cwd: workspacePath });

		/**
		|--------------------------------------------------
		| Discover malformed untracked source
		|--------------------------------------------------
		*/
		const result = await discoverBackends(workspacePath, { cache: false });
		const sourceFile = result.roots[0]?.modules[0]?.files[0];

		/**
		|--------------------------------------------------
		| Confirm dirty and invalid source metadata
		|--------------------------------------------------
		*/
		assert.equal(sourceFile?.dirty, true);
		assert.equal(sourceFile?.syntaxValid, false);
		assert.equal((sourceFile?.diagnostics.length || 0) > 0, true);
	} finally {
		/**
		|--------------------------------------------------
		| Remove temporary Git workspace
		|--------------------------------------------------
		*/
		await rm(workspacePath, { recursive: true, force: true });
	}
});
