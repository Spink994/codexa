/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import test from 'node:test';
import assert from 'node:assert/strict';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { assessTypeScriptSemanticRisk } from './semantic-risk.js';

/**
|--------------------------------------------------
| Accept comment-only formatting
|--------------------------------------------------
*/
test('classifies comment-only formatting as low risk', () => {
	const result = assessTypeScriptSemanticRisk(
		'service.ts',
		'export const value = 1;\n',
		'/** Value */\nexport const value = 1;\n',
		'typescript',
	);

	assert.deepEqual(result, {
		level: 'low',
		reasons: [],
	});
});

/**
|--------------------------------------------------
| Flag token reordering for review
|--------------------------------------------------
*/
test('classifies token reordering as medium risk', () => {
	const result = assessTypeScriptSemanticRisk(
		'service.ts',
		"import longer from 'longer';\nimport a from 'a';\n",
		"import a from 'a';\nimport longer from 'longer';\n",
		'typescript',
	);

	assert.deepEqual(result, {
		level: 'medium',
		reasons: ['tokens-reordered'],
	});
});

/**
|--------------------------------------------------
| Block changed runtime tokens
|--------------------------------------------------
*/
test('classifies changed runtime tokens as high risk', () => {
	const result = assessTypeScriptSemanticRisk(
		'service.ts',
		'export const value = 1;\n',
		'export const value = 2;\n',
		'typescript',
	);

	assert.equal(result.level, 'high');
	assert.deepEqual(result.reasons, ['tokens-changed']);
});

/**
|--------------------------------------------------
| Block changed exported declarations
|--------------------------------------------------
*/
test('classifies changed exports and declarations as high risk', () => {
	const result = assessTypeScriptSemanticRisk(
		'service.ts',
		'export const value = 1;\n',
		'export const renamed = 1;\n',
		'typescript',
	);

	assert.equal(result.level, 'high');
	assert.deepEqual(result.reasons, [
		'exports-changed',
		'declarations-changed',
		'tokens-changed',
	]);
});
