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
import { analyzeTypeScriptSource } from './analyzer.js';

/**
|--------------------------------------------------
| Analyze valid TypeScript source
|--------------------------------------------------
*/
test('collects imports, exports, and declarations', () => {
	/**
	|--------------------------------------------------
	| Analyze representative TypeScript source
	|--------------------------------------------------
	*/
	const result = analyzeTypeScriptSource(
		'example.ts',
		`
			import { Injectable } from '@nestjs/common';
			export { helper } from './helper.js';
			export class ExampleService {}
			const internalValue = true;
		`,
		'typescript',
	);

	/**
	|--------------------------------------------------
	| Confirm collected source metadata
	|--------------------------------------------------
	*/
	assert.equal(result.syntaxValid, true);
	assert.deepEqual(result.imports, ['./helper.js', '@nestjs/common']);
	assert.deepEqual(result.exports, ['ExampleService', 'helper']);
	assert.deepEqual(
		result.symbols.map((symbol) => [symbol.name, symbol.kind, symbol.exported]),
		[
			['ExampleService', 'class', true],
			['internalValue', 'variable', false],
		],
	);
});

/**
|--------------------------------------------------
| Report malformed TypeScript source
|--------------------------------------------------
*/
test('returns parser diagnostics for malformed source', () => {
	/**
	|--------------------------------------------------
	| Analyze malformed TypeScript source
	|--------------------------------------------------
	*/
	const result = analyzeTypeScriptSource('broken.ts', 'export class Broken {', 'typescript');

	/**
	|--------------------------------------------------
	| Confirm parser failure metadata
	|--------------------------------------------------
	*/
	assert.equal(result.syntaxValid, false);
	assert.equal(result.diagnostics.length > 0, true);
});
