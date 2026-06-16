/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import ts from 'typescript';
import type { SourceLanguage, SourceTextEdit } from '@codexa/core';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
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

/**
|--------------------------------------------------
| Format TypeScript deterministically
|--------------------------------------------------
*/
const formatTypeScriptDeterministically = (
	path: string,
	source: string,
	language: SourceLanguage,
): DeterministicFormatResult => {
	/**
	 |--------------------------------------------------
	 | Guard clause
	 |--------------------------------------------------
	 */
	const analysis = analyzeTypeScriptSource(path, source, language);
	if (!analysis.syntaxValid) {
		return unchanged(source, false, ['Deterministic formatting skipped because the source contains syntax errors.']);
	}

	/**
	 |--------------------------------------------------
	 | Prepare payload
	 |--------------------------------------------------
	 */
	const importOrder = normalizeImportOrder(path, source, language);
	const importFormattedSource = importOrder.formattedSource;
	const sourceFile = createSourceFile(path, source, language);
	const targets = collectStandaloneSchemas(sourceFile, source);
	if (!targets) {
		return importOrder.changed
			? {
					warnings: [],
					changed: true,
					complete: false,
					formattedSource: importFormattedSource,
					transforms: ['import-order', 'import-headings'],
					edits: importOrder.edit ? [importOrder.edit] : [],
				}
			: unchanged(source, false);
	}

	/**
	 |--------------------------------------------------
	 | Determine value
	 |--------------------------------------------------
	 */
	const newline = source.includes('\r\n') ? '\r\n' : '\n';
	const prepareConfig = PREPARE_CONFIG.replaceAll('\n', newline);

	/**
	 |--------------------------------------------------
	 | Process items
	 |--------------------------------------------------
	 */
	const edits: SourceTextEdit[] = [];
	if (targets.imports.length > 0) {
		const importEdit = importOrder.edit ?? renderImports(targets.imports, sourceFile, source, newline);
		if (!importEdit) return unchanged(source, false);
		if (source.slice(importEdit.start, importEdit.end) !== importEdit.text) edits.push(importEdit);
	}

	/**
	 |--------------------------------------------------
	 | Process data
	 |--------------------------------------------------
	 */
	for (const target of targets.schemas) {
		const rendered = renderObject(target.object, sourceFile, source);
		if (!rendered) return unchanged(source, false);

		const current = source.slice(target.object.getStart(sourceFile), target.object.end);
		if (rendered !== current) {
			edits.push({
				text: rendered,
				end: target.object.end,
				start: target.object.getStart(sourceFile),
			});
		}

		if (!hasPrepareConfigComment(target.statement, source)) {
			edits.push({
				text: `${prepareConfig}${newline}`,
				end: target.statement.getStart(sourceFile),
				start: target.statement.getStart(sourceFile),
			});
		}
	}

	/**
	 |--------------------------------------------------
	 | Guard clause
	 |--------------------------------------------------
	 */
	if (edits.length === 0) return unchanged(source, true);

	/**
	 |--------------------------------------------------
	 | Determine value
	 |--------------------------------------------------
	 */
	const formattedSource = applyEdits(source, edits);
	const formattedAnalysis = analyzeTypeScriptSource(path, formattedSource, language);
	if (!formattedAnalysis.syntaxValid) {
		return unchanged(source, false, [
			'Deterministic formatting was discarded because the generated preview failed syntax validation.',
		]);
	}

	/**
	 |--------------------------------------------------
	 | Return result
	 |--------------------------------------------------
	 */
	return {
		edits,
		warnings: [],
		changed: true,
		complete: true,
		formattedSource,
		transforms: [
			...(targets.imports.length > 0 ? ['import-order', 'import-headings'] : []),
			'zod-object-order',
			'config-heading',
		],
	};
};

/**
|--------------------------------------------------
| Collect standalone schemas
|--------------------------------------------------
*/
const collectStandaloneSchemas = (sourceFile: ts.SourceFile, source: string): DeterministicTargets | null => {
	/**
	 |--------------------------------------------------
	 | Guard clause
	 |--------------------------------------------------
	 */
	if (sourceFile.statements.length === 0) return null;

	/**
	 |--------------------------------------------------
	 | Set loading state
	 |--------------------------------------------------
	 */
	const schemas: SchemaTarget[] = [];
	const imports: ts.ImportDeclaration[] = [];
	let reachedSchema = false;

	/**
	 |--------------------------------------------------
	 | Process items
	 |--------------------------------------------------
	 */
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

	/**
	 |--------------------------------------------------
	 | Return result
	 |--------------------------------------------------
	 */
	if (schemas.length === 0 || !hasOnlySupportedComments(sourceFile, source)) return null;
	return { imports, schemas };
};

/**
|--------------------------------------------------
| Can format import
|--------------------------------------------------
*/
const canFormatImport = (declaration: ts.ImportDeclaration, sourceFile: ts.SourceFile, source: string): boolean => {
	/**
	 |--------------------------------------------------
	 | Guard clause
	 |--------------------------------------------------
	 */
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

	/**
	 |--------------------------------------------------
	 | Return result
	 |--------------------------------------------------
	 */
	return !nodeHasComments(declaration, source);
};

/**
|--------------------------------------------------
| Render imports
|--------------------------------------------------
*/
const renderImports = (
	imports: ts.ImportDeclaration[],
	sourceFile: ts.SourceFile,
	source: string,
	newline: string,
): SourceTextEdit | null => {
	/**
	 |--------------------------------------------------
	 | Process items
	 |--------------------------------------------------
	 */
	const records = imports.map((declaration, index) => {
		if (!ts.isStringLiteral(declaration.moduleSpecifier)) return null;
		const text = declaration.getText(sourceFile);
		return {
			text,
			index,
			group: isCustomImport(declaration.moduleSpecifier.text) ? 'custom' : 'npm',
		};
	});
	if (records.some((record) => !record)) return null;

	/**
	 |--------------------------------------------------
	 | Create callback
	 |--------------------------------------------------
	 */
	const renderGroup = (group: 'npm' | 'custom', heading: string): string | null => {
		const grouped = records
			.filter((record): record is NonNullable<typeof record> => record !== null && record.group === group)
			.sort((left, right) => left.text.length - right.text.length || left.index - right.index);
		if (grouped.length === 0) return null;
		return `${heading.replaceAll('\n', newline)}${newline}${grouped.map((record) => record.text).join(newline)}`;
	};

	/**
	 |--------------------------------------------------
	 | Prepare payload
	 |--------------------------------------------------
	 */
	const sections = [renderGroup('npm', NPM_IMPORTS), renderGroup('custom', CUSTOM_IMPORTS)].filter(
		(section): section is string => section !== null,
	);
	const text = sections.join(`${newline}${newline}`);
	const start = imports[0]?.getFullStart() ?? 0;
	const end = imports.at(-1)?.end ?? start;

	/**
	 |--------------------------------------------------
	 | Return result
	 |--------------------------------------------------
	 */
	return {
		end,
		text,
		start,
	};
};

/**
|--------------------------------------------------
| Is custom import
|--------------------------------------------------
*/
const isCustomImport = (moduleSpecifier: string): boolean => {
	/**
	 |--------------------------------------------------
	 | Return result
	 |--------------------------------------------------
	 */
	return moduleSpecifier.startsWith('.') || moduleSpecifier.startsWith('/') || moduleSpecifier.startsWith('@/');
};

/**
|--------------------------------------------------
| Zod object argument
|--------------------------------------------------
*/
const zodObjectArgument = (node: ts.Expression): ts.ObjectLiteralExpression | null => {
	/**
	 |--------------------------------------------------
	 | Guard clause
	 |--------------------------------------------------
	 */
	if (!ts.isCallExpression(node) || node.arguments.length !== 1) return null;
	if (!ts.isPropertyAccessExpression(node.expression)) return null;
	if (node.expression.name.text !== 'object' || !ts.isIdentifier(node.expression.expression)) return null;
	if (node.expression.expression.text !== 'z') return null;

	/**
	 |--------------------------------------------------
	 | Return result
	 |--------------------------------------------------
	 */
	const argument = node.arguments[0];
	return argument && ts.isObjectLiteralExpression(argument) ? argument : null;
};

/**
|--------------------------------------------------
| Can format object
|--------------------------------------------------
*/
const canFormatObject = (node: ts.ObjectLiteralExpression, sourceFile: ts.SourceFile, source: string): boolean => {
	/**
	 |--------------------------------------------------
	 | Guard clause
	 |--------------------------------------------------
	 */
	if (!isMultiLine(node, sourceFile) || objectHasComments(node, source)) return false;
	const keys = new Set<string>();

	/**
	 |--------------------------------------------------
	 | Process items
	 |--------------------------------------------------
	 */
	for (const property of node.properties) {
		if (!ts.isPropertyAssignment(property) || ts.isComputedPropertyName(property.name)) return false;
		const key = property.name.getText(sourceFile);
		if (keys.has(key) || !isZodChain(property.initializer)) return false;
		keys.add(key);
	}

	/**
	 |--------------------------------------------------
	 | Return result
	 |--------------------------------------------------
	 */
	return true;
};

/**
|--------------------------------------------------
| Is zod chain
|--------------------------------------------------
*/
const isZodChain = (node: ts.Expression): boolean => {
	/**
	 |--------------------------------------------------
	 | Guard clause
	 |--------------------------------------------------
	 */
	if (ts.isIdentifier(node)) return node.text === 'z';
	if (ts.isPropertyAccessExpression(node)) return isZodChain(node.expression);
	if (!ts.isCallExpression(node) || !isZodChain(node.expression)) return false;

	/**
	 |--------------------------------------------------
	 | Return result
	 |--------------------------------------------------
	 */
	return node.arguments.every(isPureArgument);
};

/**
|--------------------------------------------------
| Is pure argument
|--------------------------------------------------
*/
const isPureArgument = (node: ts.Expression): boolean => {
	/**
	 |--------------------------------------------------
	 | Guard clause
	 |--------------------------------------------------
	 */
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

	/**
	 |--------------------------------------------------
	 | Return result
	 |--------------------------------------------------
	 */
	return false;
};

/**
|--------------------------------------------------
| Render object
|--------------------------------------------------
*/
const renderObject = (node: ts.ObjectLiteralExpression, sourceFile: ts.SourceFile, source: string): string | null => {
	/**
	 |--------------------------------------------------
	 | Guard clause
	 |--------------------------------------------------
	 */
	if (!canFormatObject(node, sourceFile, source)) return null;

	/**
	 |--------------------------------------------------
	 | Determine value
	 |--------------------------------------------------
	 */
	const newline = source.includes('\r\n') ? '\r\n' : '\n';
	const propertyIndent = readIndent(source, node.properties[0]?.getStart(sourceFile) ?? node.getStart(sourceFile));
	const closingIndent = readIndent(source, node.end - 1);

	/**
	 |--------------------------------------------------
	 | Process items
	 |--------------------------------------------------
	 */
	const entries = node.properties.map((property, index) => ({
		index,
		text: property.getText(sourceFile).trim(),
	}));
	const ordered = [...entries].sort((left, right) => {
		const difference = measureEntry(left.text) - measureEntry(right.text);
		return difference === 0 ? left.index - right.index : difference;
	});
	const body = ordered.map((entry) => `${propertyIndent}${entry.text}`).join(`,${newline}`);

	/**
	 |--------------------------------------------------
	 | Return result
	 |--------------------------------------------------
	 */
	return `{${newline}${body},${newline}${closingIndent}}`;
};

/**
|--------------------------------------------------
| Measure entry
|--------------------------------------------------
*/
const measureEntry = (text: string): number => {
	/**
	 |--------------------------------------------------
	 | Process items
	 |--------------------------------------------------
	 */
	return (
		text
			.split(/\r?\n/)
			.map((line) => line.trimStart())
			.join('\n').length + 1
	);
};

/**
|--------------------------------------------------
| Has prepare config comment
|--------------------------------------------------
*/
const hasPrepareConfigComment = (statement: ts.VariableStatement, source: string): boolean => {
	/**
	 |--------------------------------------------------
	 | Determine value
	 |--------------------------------------------------
	 */
	const leading = source.slice(statement.getFullStart(), statement.getStart());

	/**
	 |--------------------------------------------------
	 | Return result
	 |--------------------------------------------------
	 */
	return leading.replaceAll('\r\n', '\n').trimEnd().endsWith(PREPARE_CONFIG);
};

/**
|--------------------------------------------------
| Has only supported comments
|--------------------------------------------------
*/
const hasOnlySupportedComments = (sourceFile: ts.SourceFile, source: string): boolean => {
	/**
	 |--------------------------------------------------
	 | Prepare payload
	 |--------------------------------------------------
	 */
	const ranges = [
		...(ts.getLeadingCommentRanges(source, 0) ?? []),
		...sourceFile.statements.flatMap((statement) => ts.getLeadingCommentRanges(source, statement.getFullStart()) ?? []),
	];
	const unique = new Map(ranges.map((range) => [`${range.pos}:${range.end}`, range]));
	const supported = new Set([PREPARE_CONFIG, NPM_IMPORTS, CUSTOM_IMPORTS]);

	/**
	 |--------------------------------------------------
	 | Return result
	 |--------------------------------------------------
	 */
	return [...unique.values()].every((range) =>
		supported.has(source.slice(range.pos, range.end).replaceAll('\r\n', '\n').trim()),
	);
};

/**
|--------------------------------------------------
| Object has comments
|--------------------------------------------------
*/
const objectHasComments = (node: ts.ObjectLiteralExpression, source: string): boolean => {
	/**
	 |--------------------------------------------------
	 | Prepare payload
	 |--------------------------------------------------
	 */
	const start = node.getStart();
	const ranges = [
		...(ts.getLeadingCommentRanges(source, start + 1) ?? []),
		...node.properties.flatMap((property) => [
			...(ts.getLeadingCommentRanges(source, property.getFullStart()) ?? []),
			...(ts.getTrailingCommentRanges(source, property.end) ?? []),
		]),
	];

	/**
	 |--------------------------------------------------
	 | Return result
	 |--------------------------------------------------
	 */
	return ranges.some((range) => range.pos >= start && range.end <= node.end);
};

/**
|--------------------------------------------------
| Node has comments
|--------------------------------------------------
*/
const nodeHasComments = (node: ts.Node, source: string): boolean => {
	/**
	 |--------------------------------------------------
	 | Prepare payload
	 |--------------------------------------------------
	 */
	const scanner = ts.createScanner(
		ts.ScriptTarget.Latest,
		false,
		ts.LanguageVariant.Standard,
		source.slice(node.getStart(), node.end),
	);

	/**
	 |--------------------------------------------------
	 | Process items
	 |--------------------------------------------------
	 */
	for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
		if (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia) {
			return true;
		}
	}

	/**
	 |--------------------------------------------------
	 | Return result
	 |--------------------------------------------------
	 */
	return false;
};

/**
|--------------------------------------------------
| Create source file
|--------------------------------------------------
*/
const createSourceFile = (path: string, source: string, language: SourceLanguage): ts.SourceFile => {
	/**
	 |--------------------------------------------------
	 | Return result
	 |--------------------------------------------------
	 */
	return ts.createSourceFile(
		path,
		source,
		ts.ScriptTarget.Latest,
		true,
		language === 'typescript' ? ts.ScriptKind.TS : ts.ScriptKind.JS,
	);
};

/**
|--------------------------------------------------
| Is multi line
|--------------------------------------------------
*/
const isMultiLine = (node: ts.Node, sourceFile: ts.SourceFile): boolean => {
	/**
	 |--------------------------------------------------
	 | Return result
	 |--------------------------------------------------
	 */
	return (
		sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line !==
		sourceFile.getLineAndCharacterOfPosition(node.end - 1).line
	);
};

/**
|--------------------------------------------------
| Read indent
|--------------------------------------------------
*/
const readIndent = (source: string, offset: number): string => {
	/**
	 |--------------------------------------------------
	 | Determine value
	 |--------------------------------------------------
	 */
	const lineStart = source.lastIndexOf('\n', offset - 1) + 1;

	/**
	 |--------------------------------------------------
	 | Return result
	 |--------------------------------------------------
	 */
	return source.slice(lineStart, offset).match(/^[\t ]*/)?.[0] ?? '';
};

/**
|--------------------------------------------------
| Apply edits
|--------------------------------------------------
*/
const applyEdits = (source: string, edits: SourceTextEdit[]): string => {
	/**
	 |--------------------------------------------------
	 | Process items
	 |--------------------------------------------------
	 */
	return [...edits]
		.sort((left, right) => right.start - left.start)
		.reduce((current, edit) => `${current.slice(0, edit.start)}${edit.text}${current.slice(edit.end)}`, source);
};

/**
|--------------------------------------------------
| Unchanged
|--------------------------------------------------
*/
const unchanged = (source: string, complete: boolean, warnings: string[] = []): DeterministicFormatResult => ({
	complete,
	warnings,
	edits: [],
	changed: false,
	transforms: [],
	formattedSource: source,
});

export { formatTypeScriptDeterministically, type DeterministicFormatResult };
