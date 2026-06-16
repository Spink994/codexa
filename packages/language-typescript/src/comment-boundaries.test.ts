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
import { detectCommentBoundaries, type CommentCandidate } from './comment-boundaries.js';

/**
|--------------------------------------------------
| Sample source with mixed declarations
|--------------------------------------------------
*/
const source = [
	'export interface UserDto {',
	'\tid: string;',
	'\tname: string;',
	'}',
	'',
	'export function getUser(id: string) {',
	'\tconst user = load(id);',
	'',
	'\treturn user.name;',
	'}',
	'',
	'/**',
	'|--------------------------------------------------',
	'| Already documented',
	'|--------------------------------------------------',
	'*/',
	'const open = () => {',
	'\t// keep this',
	'\tsetOpen(true);',
	'};',
	'',
].join('\n');

/**
|--------------------------------------------------
| Find candidates by kind
|--------------------------------------------------
*/
const byKind = (candidates: CommentCandidate[], kind: CommentCandidate['kind']) => {
	/**
	|--------------------------------------------------
	| Return candidates matching the kind
	|--------------------------------------------------
	*/
	return candidates.filter((candidate) => candidate.kind === kind);
};

/**
|--------------------------------------------------
| Detect DTO and entity property boundaries
|--------------------------------------------------
*/
test('detects property boundaries on interface members', () => {
	/**
	|--------------------------------------------------
	| Detect comment boundaries in the sample
	|--------------------------------------------------
	*/
	const analysis = detectCommentBoundaries('sample.ts', source, 'typescript');

	/**
	|--------------------------------------------------
	| Confirm the property candidates
	|--------------------------------------------------
	*/
	const properties = byKind(analysis.candidates, 'property');
	assert.deepEqual(properties.map((candidate) => candidate.name), ['id', 'name']);
});

/**
|--------------------------------------------------
| Detect function and method boundaries
|--------------------------------------------------
*/
test('detects function declarations and arrow assignments', () => {
	/**
	|--------------------------------------------------
	| Detect comment boundaries in the sample
	|--------------------------------------------------
	*/
	const analysis = detectCommentBoundaries('sample.ts', source, 'typescript');

	/**
	|--------------------------------------------------
	| Confirm the function candidates
	|--------------------------------------------------
	*/
	const functions = byKind(analysis.candidates, 'function');
	assert.deepEqual(functions.map((candidate) => candidate.name), ['getUser', 'open']);
});

/**
|--------------------------------------------------
| Detect blank-line section boundaries
|--------------------------------------------------
*/
test('detects blank-line section boundaries', () => {
	/**
	|--------------------------------------------------
	| Detect comment boundaries in the sample
	|--------------------------------------------------
	*/
	const analysis = detectCommentBoundaries('sample.ts', source, 'typescript');

	/**
	|--------------------------------------------------
	| Confirm the section candidate count
	|--------------------------------------------------
	*/
	const sections = byKind(analysis.candidates, 'section');
	assert.equal(sections.length, 3);
});

/**
|--------------------------------------------------
| Preserve existing meaningful comments
|--------------------------------------------------
*/
test('flags existing comments so they are preserved', () => {
	/**
	|--------------------------------------------------
	| Detect comment boundaries in the sample
	|--------------------------------------------------
	*/
	const analysis = detectCommentBoundaries('sample.ts', source, 'typescript');

	/**
	|--------------------------------------------------
	| Confirm the documented function is recognized
	|--------------------------------------------------
	*/
	const open = analysis.candidates.find((candidate) => candidate.name === 'open');
	assert.equal(open?.hasBlockComment, true);

	/**
	|--------------------------------------------------
	| Confirm the undocumented function needs a heading
	|--------------------------------------------------
	*/
	const getUser = analysis.candidates.find((candidate) => candidate.name === 'getUser');
	assert.equal(getUser?.hasBlockComment, false);
	assert.equal(getUser?.hasComment, false);
});

/**
|--------------------------------------------------
| Flag line comments inside function bodies
|--------------------------------------------------
*/
test('flags line comments on section boundaries', () => {
	/**
	|--------------------------------------------------
	| Detect comment boundaries in the sample
	|--------------------------------------------------
	*/
	const analysis = detectCommentBoundaries('sample.ts', source, 'typescript');

	/**
	|--------------------------------------------------
	| Confirm a commented section is preserved
	|--------------------------------------------------
	*/
	const sections = byKind(analysis.candidates, 'section');
	assert.equal(sections.some((candidate) => candidate.hasComment), true);
});
