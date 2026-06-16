import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTypeScriptStyle } from './style-conformance.js';

test('reports executable style conformance checks', () => {
	const before = `export const getValue = () => {
	// Return the value
	return { longName: 1, id: 2 };
};`;
	const after = `/**
|--------------------------------------------------
| Get value
|--------------------------------------------------
*/
export const getValue = () => {
	/**
	 |--------------------------------------------------
	 | Return the value
	 |--------------------------------------------------
	 */
	return {
		id: 2,
		longName: 1,
	};
};`;
	const report = validateTypeScriptStyle('sample.ts', before, after, 'typescript');

	assert.equal(report.passed, true);
	assert.equal(report.score, 100);
	assert.equal(report.checks.every((entry) => entry.status !== 'failed'), true);
});

test('flags line comments, missing headings, and unordered objects', () => {
	const source = `export const getValue = () => {
	// Return the value
	return {
		longName: 1,
		id: 2,
	};
};`;
	const report = validateTypeScriptStyle('sample.ts', source, source, 'typescript');

	assert.equal(report.passed, false);
	assert.equal(report.checks.find((entry) => entry.id === 'comment-style')?.status, 'failed');
	assert.equal(report.checks.find((entry) => entry.id === 'function-headings')?.status, 'failed');
	assert.equal(report.checks.find((entry) => entry.id === 'object-order')?.status, 'failed');
});
