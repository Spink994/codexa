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
import { validateTypeScriptStyle } from './style-conformance.js';

/**
|--------------------------------------------------
| Reports executable style conformance checks
|--------------------------------------------------
*/
test('reports executable style conformance checks', () => {
	/**
	 |--------------------------------------------------
	 | Prepare payload
	 |--------------------------------------------------
	 */
	const before = `export const getValue = () => {
	// Return the value
	return { longName: 1, id: 2 };
};`;

	/**
	 |--------------------------------------------------
	 | Prepare payload
	 |--------------------------------------------------
	 */
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

	/**
	 |--------------------------------------------------
	 | Make request
	 |--------------------------------------------------
	 */
	const report = validateTypeScriptStyle('sample.ts', before, after, 'typescript');

	/**
	 |--------------------------------------------------
	 | Handle success response
	 |--------------------------------------------------
	 */
	assert.equal(report.passed, true);
	assert.equal(report.score, 100);
	assert.equal(
		report.checks.every((entry) => entry.status !== 'failed'),
		true,
	);
});

/**
|--------------------------------------------------
| Flags line comments, missing headings, and unordered objects
|--------------------------------------------------
*/
test('flags line comments, missing headings, and unordered objects', () => {
	/**
	 |--------------------------------------------------
	 | Prepare payload
	 |--------------------------------------------------
	 */
	const source = `export const getValue = () => {
	// Return the value
	return {
		longName: 1,
		id: 2,
	};
};`;

	/**
	 |--------------------------------------------------
	 | Make request
	 |--------------------------------------------------
	 */
	const report = validateTypeScriptStyle('sample.ts', source, source, 'typescript');

	/**
	 |--------------------------------------------------
	 | Handle failure response
	 |--------------------------------------------------
	 */
	assert.equal(report.passed, false);
	assert.equal(report.checks.find((entry) => entry.id === 'comment-style')?.status, 'failed');
	assert.equal(report.checks.find((entry) => entry.id === 'function-headings')?.status, 'failed');
	assert.equal(report.checks.find((entry) => entry.id === 'object-order')?.status, 'failed');
});
