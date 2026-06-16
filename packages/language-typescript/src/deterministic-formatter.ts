import ts from 'typescript';
import type { SourceLanguage, SourceTextEdit } from '@codexa/core';
import { analyzeTypeScriptSource } from './analyzer.js';
import { renderBlockComment } from './block-comment.js';
import { normalizeImportOrder } from './import-order.js';

interface DeterministicFormatResult {
	changed: boolean;
	complete: boolean;
	formattedSource: string;
	edits: SourceTextEdit[];
	warnings: string[];
	transforms: string[];
}

interface SchemaTarget {
	statement: ts.VariableStatement;
	object: ts.ObjectLiteralExpression;
}

interface DeterministicTargets {
	imports: ts.ImportDeclaration[];
	schemas: SchemaTarget[];
}

const PREPARE_CONFIG = renderBlockComment({ label: 'Prepare config' });
const NPM_IMPORTS = renderBlockComment({ label: 'Npm imports' });
const CUSTOM_IMPORTS = renderBlockComment({ label: 'Custom imports' });

const formatTypeScriptDeterministically = (
	path: string,
	source: string,
	language: SourceLanguage,
): DeterministicFormatResult => {
	const analysis = analyzeTypeScriptSource(path, source, language);
	if (!analysis.syntaxValid) {
		return unchanged(source, false, ['Deterministic formatting skipped because the source contains syntax errors.']);
	}

	const importOrder = normalizeImportOrder(path, source, language);
	const importFormattedSource = importOrder.formattedSource;
	const sourceFile = createSourceFile(path, source, language);
	const targets = collectStandaloneSchemas(sourceFile, source);
	if (!targets) {
		return importOrder.changed
			? {
					changed: true,
					complete: false,
					formattedSource: importFormattedSource,
					edits: importOrder.edit ? [importOrder.edit] : [],
					warnings: [],
					transforms: ['import-order', 'import-headings'],
				}
			: unchanged(source, false);
	}
	const newline = source.includes('\r\n') ? '\r\n' : '\n';
	const prepareConfig = PREPARE_CONFIG.replaceAll('\n', newline);

	const edits: SourceTextEdit[] = [];
	if (targets.imports.length > 0) {
		const importEdit = importOrder.edit ?? renderImports(targets.imports, sourceFile, source, newline);
		if (!importEdit) return unchanged(source, false);
		if (source.slice(importEdit.start, importEdit.end) !== importEdit.text) edits.push(importEdit);
	}

	for (const target of targets.schemas) {
		const rendered = renderObject(target.object, sourceFile, source);
		if (!rendered) return unchanged(source, false);

		const current = source.slice(target.object.getStart(sourceFile), target.object.end);
		if (rendered !== current) {
			edits.push({
				start: target.object.getStart(sourceFile),
				end: target.object.end,
				text: rendered,
			});
		}

		if (!hasPrepareConfigComment(target.statement, source)) {
			edits.push({
				start: target.statement.getStart(sourceFile),
				end: target.statement.getStart(sourceFile),
				text: `${prepareConfig}${newline}`,
			});
		}
	}

	if (edits.length === 0) return unchanged(source, true);
	const formattedSource = applyEdits(source, edits);
	const formattedAnalysis = analyzeTypeScriptSource(path, formattedSource, language);
	if (!formattedAnalysis.syntaxValid) {
		return unchanged(source, false, [
			'Deterministic formatting was discarded because the generated preview failed syntax validation.',
		]);
	}

	return {
		edits,
		complete: true,
		changed: true,
		formattedSource,
		warnings: [],
		transforms: [
			...(targets.imports.length > 0 ? ['import-order', 'import-headings'] : []),
			'zod-object-order',
			'config-heading',
		],
	};
};

const collectStandaloneSchemas = (sourceFile: ts.SourceFile, source: string): DeterministicTargets | null => {
	if (sourceFile.statements.length === 0) return null;
	const schemas: SchemaTarget[] = [];
	const imports: ts.ImportDeclaration[] = [];
	let reachedSchema = false;

	for (const statement of sourceFile.statements) {
		if (ts.isImportDeclaration(statement)) {
			if (reachedSchema || !canFormatImport(statement, sourceFile, source)) return null;
			imports.push(statement);
			continue;
		}

		reachedSchema = true;
		if (!ts.isVariableStatement(statement) || statement.declarationList.declarations.length !== 1) return null;
		const declaration = statement.declarationList.declarations[0];
		if (!declaration || !declaration.initializer) return null;
		const object = zodObjectArgument(declaration.initializer);
		if (!object || !canFormatObject(object, sourceFile, source)) return null;
		schemas.push({ statement, object });
	}

	if (schemas.length === 0 || !hasOnlySupportedComments(sourceFile, source)) return null;
	return { imports, schemas };
};

const canFormatImport = (
	declaration: ts.ImportDeclaration,
	sourceFile: ts.SourceFile,
	source: string,
): boolean => {
	const clause = declaration.importClause;
	if (!clause || clause.isTypeOnly || declaration.attributes) return false;
	if (!ts.isStringLiteral(declaration.moduleSpecifier) || isMultiLine(declaration, sourceFile)) return false;
	if (
		clause.namedBindings &&
		ts.isNamedImports(clause.namedBindings) &&
		clause.namedBindings.elements.some((element) => element.isTypeOnly)
	) {
		return false;
	}

	return !nodeHasComments(declaration, source);
};

const renderImports = (
	imports: ts.ImportDeclaration[],
	sourceFile: ts.SourceFile,
	source: string,
	newline: string,
): SourceTextEdit | null => {
	const records = imports.map((declaration, index) => {
		if (!ts.isStringLiteral(declaration.moduleSpecifier)) return null;
		const text = declaration.getText(sourceFile);
		return {
			index,
			text,
			group: isCustomImport(declaration.moduleSpecifier.text) ? 'custom' : 'npm',
		};
	});
	if (records.some((record) => !record)) return null;

	const renderGroup = (group: 'npm' | 'custom', heading: string): string | null => {
		const grouped = records
			.filter((record): record is NonNullable<typeof record> => record !== null && record.group === group)
			.sort((left, right) => left.text.length - right.text.length || left.index - right.index);
		if (grouped.length === 0) return null;
		return `${heading.replaceAll('\n', newline)}${newline}${grouped.map((record) => record.text).join(newline)}`;
	};
	const sections = [
		renderGroup('npm', NPM_IMPORTS),
		renderGroup('custom', CUSTOM_IMPORTS),
	].filter((section): section is string => section !== null);
	const text = sections.join(`${newline}${newline}`);
	const start = imports[0]?.getFullStart() ?? 0;
	const end = imports.at(-1)?.end ?? start;

	return {
		start,
		end,
		text,
	};
};

const isCustomImport = (moduleSpecifier: string): boolean =>
	moduleSpecifier.startsWith('.') || moduleSpecifier.startsWith('/') || moduleSpecifier.startsWith('@/');

const zodObjectArgument = (node: ts.Expression): ts.ObjectLiteralExpression | null => {
	if (!ts.isCallExpression(node) || node.arguments.length !== 1) return null;
	if (!ts.isPropertyAccessExpression(node.expression)) return null;
	if (node.expression.name.text !== 'object' || !ts.isIdentifier(node.expression.expression)) return null;
	if (node.expression.expression.text !== 'z') return null;
	const argument = node.arguments[0];
	return argument && ts.isObjectLiteralExpression(argument) ? argument : null;
};

const canFormatObject = (node: ts.ObjectLiteralExpression, sourceFile: ts.SourceFile, source: string): boolean => {
	if (!isMultiLine(node, sourceFile) || objectHasComments(node, source)) return false;
	const keys = new Set<string>();

	for (const property of node.properties) {
		if (!ts.isPropertyAssignment(property) || ts.isComputedPropertyName(property.name)) return false;
		const key = property.name.getText(sourceFile);
		if (keys.has(key) || !isZodChain(property.initializer)) return false;
		keys.add(key);
	}

	return true;
};

const isZodChain = (node: ts.Expression): boolean => {
	if (ts.isIdentifier(node)) return node.text === 'z';
	if (ts.isPropertyAccessExpression(node)) return isZodChain(node.expression);
	if (!ts.isCallExpression(node) || !isZodChain(node.expression)) return false;
	return node.arguments.every(isPureArgument);
};

const isPureArgument = (node: ts.Expression): boolean => {
	if (
		ts.isStringLiteralLike(node) ||
		ts.isNumericLiteral(node) ||
		node.kind === ts.SyntaxKind.TrueKeyword ||
		node.kind === ts.SyntaxKind.FalseKeyword ||
		node.kind === ts.SyntaxKind.NullKeyword
	) {
		return true;
	}
	if (ts.isPrefixUnaryExpression(node)) return isPureArgument(node.operand);
	if (ts.isArrayLiteralExpression(node)) {
		return node.elements.every((element) => !ts.isSpreadElement(element) && isPureArgument(element as ts.Expression));
	}
	return false;
};

const renderObject = (
	node: ts.ObjectLiteralExpression,
	sourceFile: ts.SourceFile,
	source: string,
): string | null => {
	if (!canFormatObject(node, sourceFile, source)) return null;
	const newline = source.includes('\r\n') ? '\r\n' : '\n';
	const propertyIndent = readIndent(source, node.properties[0]?.getStart(sourceFile) ?? node.getStart(sourceFile));
	const closingIndent = readIndent(source, node.end - 1);
	const entries = node.properties.map((property, index) => ({
		index,
		text: property.getText(sourceFile).trim(),
	}));
	const ordered = [...entries].sort((left, right) => {
		const difference = measureEntry(left.text) - measureEntry(right.text);
		return difference === 0 ? left.index - right.index : difference;
	});
	const body = ordered.map((entry) => `${propertyIndent}${entry.text}`).join(`,${newline}`);
	return `{${newline}${body},${newline}${closingIndent}}`;
};

const measureEntry = (text: string): number =>
	text
		.split(/\r?\n/)
		.map((line) => line.trimStart())
		.join('\n').length + 1;

const hasPrepareConfigComment = (statement: ts.VariableStatement, source: string): boolean => {
	const leading = source.slice(statement.getFullStart(), statement.getStart());
	return leading.replaceAll('\r\n', '\n').trimEnd().endsWith(PREPARE_CONFIG);
};

const hasOnlySupportedComments = (sourceFile: ts.SourceFile, source: string): boolean => {
	const ranges = [
		...(ts.getLeadingCommentRanges(source, 0) ?? []),
		...sourceFile.statements.flatMap((statement) => ts.getLeadingCommentRanges(source, statement.getFullStart()) ?? []),
	];
	const unique = new Map(ranges.map((range) => [`${range.pos}:${range.end}`, range]));
	const supported = new Set([PREPARE_CONFIG, NPM_IMPORTS, CUSTOM_IMPORTS]);
	return [...unique.values()].every((range) =>
		supported.has(source.slice(range.pos, range.end).replaceAll('\r\n', '\n').trim()),
	);
};

const objectHasComments = (node: ts.ObjectLiteralExpression, source: string): boolean => {
	const start = node.getStart();
	const ranges = [
		...(ts.getLeadingCommentRanges(source, start + 1) ?? []),
		...node.properties.flatMap((property) => [
			...(ts.getLeadingCommentRanges(source, property.getFullStart()) ?? []),
			...(ts.getTrailingCommentRanges(source, property.end) ?? []),
		]),
	];
	return ranges.some((range) => range.pos >= start && range.end <= node.end);
};

const nodeHasComments = (node: ts.Node, source: string): boolean => {
	const scanner = ts.createScanner(
		ts.ScriptTarget.Latest,
		false,
		ts.LanguageVariant.Standard,
		source.slice(node.getStart(), node.end),
	);
	for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
		if (
			token === ts.SyntaxKind.SingleLineCommentTrivia ||
			token === ts.SyntaxKind.MultiLineCommentTrivia
		) {
			return true;
		}
	}
	return false;
};

const createSourceFile = (path: string, source: string, language: SourceLanguage): ts.SourceFile =>
	ts.createSourceFile(
		path,
		source,
		ts.ScriptTarget.Latest,
		true,
		language === 'typescript' ? ts.ScriptKind.TS : ts.ScriptKind.JS,
	);

const isMultiLine = (node: ts.Node, sourceFile: ts.SourceFile): boolean =>
	sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line !==
	sourceFile.getLineAndCharacterOfPosition(node.end - 1).line;

const readIndent = (source: string, offset: number): string => {
	const lineStart = source.lastIndexOf('\n', offset - 1) + 1;
	return source.slice(lineStart, offset).match(/^[\t ]*/)?.[0] ?? '';
};

const applyEdits = (source: string, edits: SourceTextEdit[]): string =>
	[...edits]
		.sort((left, right) => right.start - left.start)
		.reduce((current, edit) => `${current.slice(0, edit.start)}${edit.text}${current.slice(edit.end)}`, source);

const unchanged = (
	source: string,
	complete: boolean,
	warnings: string[] = [],
): DeterministicFormatResult => ({
	complete,
	warnings,
	edits: [],
	changed: false,
	transforms: [],
	formattedSource: source,
});

export {
	formatTypeScriptDeterministically,
	type DeterministicFormatResult,
};
