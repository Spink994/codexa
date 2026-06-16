import ts from 'typescript';
import type { SourceLanguage } from '@codexa/core';
import { analyzeTypeScriptSource } from './analyzer.js';
import { compareTypeScriptStructure } from './behavior-check.js';
import { detectCommentBoundaries } from './comment-boundaries.js';

type ConformanceCheckStatus = 'passed' | 'failed' | 'skipped';

interface ConformanceCheck {
	id: string;
	label: string;
	status: ConformanceCheckStatus;
	detail: string;
}

interface StyleConformanceReport {
	passed: boolean;
	score: number;
	checks: ConformanceCheck[];
}

const validateTypeScriptStyle = (
	path: string,
	before: string,
	after: string,
	language: SourceLanguage,
): StyleConformanceReport => {
	const analysis = analyzeTypeScriptSource(path, after, language);
	const behavior = compareTypeScriptStructure(before, after);
	const boundaries = analysis.syntaxValid ? detectCommentBoundaries(path, after, language) : { candidates: [] };
	const comments = scanComments(after);
	const ordering = analysis.syntaxValid ? validateObjectOrdering(path, after, language) : null;
	const functionCandidates = boundaries.candidates.filter((candidate) => candidate.kind === 'function');
	const sectionCandidates = boundaries.candidates.filter((candidate) => candidate.kind === 'section');

	const checks: ConformanceCheck[] = [
		check('syntax', 'Valid TypeScript syntax', analysis.syntaxValid, analysis.syntaxValid ? 'No parser errors.' : 'Parser errors remain.'),
		check(
			'behavior',
			'Runtime tokens preserved',
			behavior.equivalent,
			behavior.equivalent ? 'Identifiers and literal values are preserved.' : behavior.reason ?? 'Structure changed.',
		),
		check(
			'comment-style',
			'Canonical block comments',
			comments.lineComments === 0 && comments.plainBlockComments === 0,
			comments.lineComments === 0 && comments.plainBlockComments === 0
				? 'All comments use Codexa block-comment syntax.'
				: `${comments.lineComments} line and ${comments.plainBlockComments} plain block comments remain.`,
		),
		check(
			'function-headings',
			'Function headings',
			functionCandidates.every((candidate) => candidate.hasBlockComment),
			functionCandidates.length === 0
				? 'No functions detected.'
				: `${functionCandidates.filter((candidate) => candidate.hasBlockComment).length}/${functionCandidates.length} functions have headings.`,
			functionCandidates.length === 0,
		),
		check(
			'section-headings',
			'Section headings',
			sectionCandidates.every((candidate) => candidate.hasBlockComment),
			sectionCandidates.length === 0
				? 'No section boundaries detected.'
				: `${sectionCandidates.filter((candidate) => candidate.hasBlockComment).length}/${sectionCandidates.length} sections have headings.`,
			sectionCandidates.length === 0,
		),
		ordering
			? check(
					'object-order',
					'Full-entry object ordering',
					ordering.unordered === 0,
					ordering.objects === 0
						? 'No sortable multiline objects detected.'
						: `${ordering.objects - ordering.unordered}/${ordering.objects} objects are ordered shortest to longest.`,
					ordering.objects === 0,
				)
			: skipped('object-order', 'Full-entry object ordering', 'Skipped because syntax is invalid.'),
	];
	const scored = checks.filter((entry) => entry.status !== 'skipped');
	const passed = scored.filter((entry) => entry.status === 'passed').length;

	return {
		checks,
		passed: checks.every((entry) => entry.status !== 'failed'),
		score: scored.length === 0 ? 100 : Math.round((passed / scored.length) * 100),
	};
};

const check = (
	id: string,
	label: string,
	passed: boolean,
	detail: string,
	skip = false,
): ConformanceCheck => ({
	id,
	label,
	detail,
	status: skip ? 'skipped' : passed ? 'passed' : 'failed',
});

const skipped = (id: string, label: string, detail: string): ConformanceCheck => ({
	id,
	label,
	detail,
	status: 'skipped',
});

const scanComments = (source: string): { lineComments: number; plainBlockComments: number } => {
	const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.JSX, source);
	let lineComments = 0;
	let plainBlockComments = 0;
	for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
		if (token === ts.SyntaxKind.SingleLineCommentTrivia) lineComments += 1;
		if (token === ts.SyntaxKind.MultiLineCommentTrivia) {
			const text = scanner.getTokenText();
			if (!text.startsWith('/**') || !text.includes('|--------------------------------------------------')) {
				plainBlockComments += 1;
			}
		}
	}
	return { lineComments, plainBlockComments };
};

const validateObjectOrdering = (
	path: string,
	source: string,
	language: SourceLanguage,
): { objects: number; unordered: number } => {
	const file = ts.createSourceFile(
		path,
		source,
		ts.ScriptTarget.Latest,
		true,
		language === 'typescript' ? ts.ScriptKind.TS : ts.ScriptKind.JS,
	);
	let objects = 0;
	let unordered = 0;
	const visit = (node: ts.Node): void => {
		if (ts.isObjectLiteralExpression(node) && isSortableObject(node, file)) {
			objects += 1;
			const lengths = node.properties.map((property) => measureEntry(property.getText(file)));
			if (lengths.some((length, index) => index > 0 && lengths[index - 1]! > length)) unordered += 1;
		}
		ts.forEachChild(node, visit);
	};
	visit(file);
	return { objects, unordered };
};

const isSortableObject = (node: ts.ObjectLiteralExpression, file: ts.SourceFile): boolean =>
	node.properties.length > 1 &&
	file.getLineAndCharacterOfPosition(node.getStart(file)).line !==
		file.getLineAndCharacterOfPosition(node.end - 1).line &&
	node.properties.every(
		(property) =>
			(ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) &&
			!ts.isComputedPropertyName(property.name),
	);

const measureEntry = (text: string): number =>
	text
		.split(/\r?\n/)
		.map((line) => line.trimStart())
		.join('\n').length + 1;

export {
	validateTypeScriptStyle,
	type ConformanceCheck,
	type ConformanceCheckStatus,
	type StyleConformanceReport,
};
