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
import { compareTypeScriptStructure } from './behavior-check.js';

/**
|--------------------------------------------------
| Accepts added comments and whitespace
|--------------------------------------------------
*/
test('accepts comment and whitespace only changes', () => {
	/**
	|--------------------------------------------------
	| Compare a function with added block comments
	|--------------------------------------------------
	*/
	const before = 'const getUser = (u) => u.name;';
	const after = [
		'/**',
		'|--------------------------------------------------',
		'| Get user',
		'|--------------------------------------------------',
		'*/',
		'const getUser = (u) => {',
		'\treturn u.name;',
		'};',
	].join('\n');
	assert.equal(compareTypeScriptStructure(before, after).equivalent, true);
});

/**
|--------------------------------------------------
| Accepts reordered imports and object properties
|--------------------------------------------------
*/
test('accepts reordering of imports and properties', () => {
	/**
	|--------------------------------------------------
	| Compare reordered imports
	|--------------------------------------------------
	*/
	const beforeImports = "import axios from 'axios';\nimport React from 'react';";
	const afterImports = "import React from 'react';\nimport axios from 'axios';";
	assert.equal(compareTypeScriptStructure(beforeImports, afterImports).equivalent, true);

	/**
	|--------------------------------------------------
	| Compare reordered object properties
	|--------------------------------------------------
	*/
	const beforeObject = 'const p = { userId: id, name: n };';
	const afterObject = 'const p = { name: n, userId: id };';
	assert.equal(compareTypeScriptStructure(beforeObject, afterObject).equivalent, true);
});

/**
|--------------------------------------------------
| Accepts reformatting around template literals
|--------------------------------------------------
*/
test('accepts reformatting of code with template-literal substitutions', () => {
	/**
	|--------------------------------------------------
	| Template substitutions must not desync the parser
	| and mis-read surrounding code as string literals
	|--------------------------------------------------
	*/
	const before = "const route = (p) => { if (p.type === 'bundle') { return `/b/${p.slug}`; } return `/p/${p.slug}`; };";
	const after = [
		'const route = (p) => {',
		'\t// resolve the product route',
		"\tif (p.type === 'bundle') {",
		'\t\treturn `/b/${p.slug}`;',
		'\t}',
		'',
		'\treturn `/p/${p.slug}`;',
		'};',
	].join('\n');
	assert.equal(compareTypeScriptStructure(before, after).equivalent, true);
});

/**
|--------------------------------------------------
| Rejects a changed template-literal static part
|--------------------------------------------------
*/
test('rejects a changed template-literal static segment', () => {
	/**
	|--------------------------------------------------
	| The static "/b/" path differs, which is a real change
	|--------------------------------------------------
	*/
	const before = 'const route = (p) => `/b/${p.slug}`;';
	const after = 'const route = (p) => `/bundle/${p.slug}`;';
	assert.equal(compareTypeScriptStructure(before, after).equivalent, false);
});

/**
|--------------------------------------------------
| Rejects a renamed identifier
|--------------------------------------------------
*/
test('rejects a renamed identifier', () => {
	/**
	|--------------------------------------------------
	| Compare a function with a renamed variable
	|--------------------------------------------------
	*/
	const before = 'const getUser = (u) => u.name;';
	const after = 'const getUser = (user) => user.name;';
	assert.equal(compareTypeScriptStructure(before, after).equivalent, false);
});

/**
|--------------------------------------------------
| Rejects a changed literal value
|--------------------------------------------------
*/
test('rejects a changed literal value', () => {
	/**
	|--------------------------------------------------
	| Compare a function with a changed numeric literal
	|--------------------------------------------------
	*/
	const before = 'const f = (n) => n.toFixed(2);';
	const after = 'const f = (n) => n.toFixed(3);';
	assert.equal(compareTypeScriptStructure(before, after).equivalent, false);
});

/**
|--------------------------------------------------
| Rejects removed logic
|--------------------------------------------------
*/
test('rejects removed logic', () => {
	/**
	|--------------------------------------------------
	| Compare a function with a dropped statement
	|--------------------------------------------------
	*/
	const before = 'const f = () => { setLoading(true); submit(); };';
	const after = 'const f = () => { submit(); };';
	assert.equal(compareTypeScriptStructure(before, after).equivalent, false);
});
