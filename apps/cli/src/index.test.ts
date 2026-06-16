/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import assert from 'node:assert/strict';
import test from 'node:test';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { runCli, type CliWriter } from './index.js';

/**
|--------------------------------------------------
| Create captured CLI writer
|--------------------------------------------------
*/
const createWriter = () => {
	/**
	|--------------------------------------------------
	| Prepare captured output collections
	|--------------------------------------------------
	*/
	const errors: string[] = [];
	const logs: string[] = [];

	/**
	|--------------------------------------------------
	| Prepare writer implementation
	|--------------------------------------------------
	*/
	const writer: CliWriter = {
		log: (message) => logs.push(message),
		error: (message) => errors.push(message),
	};

	/**
	|--------------------------------------------------
	| Return writer and captured output
	|--------------------------------------------------
	*/
	return {
		logs,
		errors,
		writer,
	};
};

/**
|--------------------------------------------------
| Reject missing command arguments
|--------------------------------------------------
*/
test('returns general usage failure when command is missing', async () => {
	/**
	|--------------------------------------------------
	| Create captured command writer
	|--------------------------------------------------
	*/
	const output = createWriter();

	/**
	|--------------------------------------------------
	| Run CLI without command arguments
	|--------------------------------------------------
	*/
	const exitCode = await runCli([], output.writer);

	/**
	|--------------------------------------------------
	| Confirm usage error and failed exit code
	|--------------------------------------------------
	*/
	assert.equal(exitCode, 1);
	assert.deepEqual(output.logs, []);
	assert.deepEqual(output.errors, [
		'Usage: codexa <discover [workspace] [--json] [--no-cache] [--no-git] | validate-profile <profile.json>>',
	]);
});

/**
|--------------------------------------------------
| Discover fixture workspace as JSON
|--------------------------------------------------
*/
test('returns discovered backend roots as JSON', async () => {
	/**
	|--------------------------------------------------
	| Create captured command writer
	|--------------------------------------------------
	*/
	const output = createWriter();

	/**
	|--------------------------------------------------
	| Resolve discovery fixture path
	|--------------------------------------------------
	*/
	const fixturePath = new URL('../../../fixtures/discovery/express-workspace', import.meta.url).pathname;

	/**
	|--------------------------------------------------
	| Run JSON discovery command
	|--------------------------------------------------
	*/
	const exitCode = await runCli(['discover', fixturePath, '--json', '--no-cache', '--no-git'], output.writer);

	/**
	|--------------------------------------------------
	| Parse emitted discovery result
	|--------------------------------------------------
	*/
	const result = JSON.parse(output.logs[0] || '{}') as {
		roots?: Array<{ framework?: string }>;
	};

	/**
	|--------------------------------------------------
	| Confirm successful Express discovery
	|--------------------------------------------------
	*/
	assert.equal(exitCode, 0);
	assert.deepEqual(output.errors, []);
	assert.equal(result.roots?.[0]?.framework, 'express');
});
