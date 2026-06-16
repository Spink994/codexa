import ts from 'typescript';
import type { SourceLanguage } from '@codexa/core';
import { analyzeTypeScriptSource } from './analyzer.js';
import { normalizeImportOrder } from './import-order.js';

interface StyleNormalizationResult {
	changed: boolean;
	formattedSource: string;
	transforms: string[];
}

const normalizeTypeScriptStyle = (
	path: string,
	source: string,
	language: SourceLanguage,
): StyleNormalizationResult => {
	if (!analyzeTypeScriptSource(path, source, language).syntaxValid) {
		return { changed: false, formattedSource: source, transforms: [] };
	}
	const importOrder = normalizeImportOrder(path, source, language);
	const sourceWithImports = importOrder.formattedSource;
	const file = ts.createSourceFile(
		path,
		sourceWithImports,
		ts.ScriptTarget.Latest,
		true,
		language === 'typescript' ? ts.ScriptKind.TS : ts.ScriptKind.JS,
	);
	const outermost: ts.ObjectLiteralExpression[] = [];
	const visit = (node: ts.Node, insideObject: boolean): void => {
		if (ts.isObjectLiteralExpression(node)) {
			if (!insideObject) outermost.push(node);
			ts.forEachChild(node, (child) => visit(child, true));
			return;
		}
		ts.forEachChild(node, (child) => visit(child, insideObject));
	};
	visit(file, false);

	const edits = outermost.flatMap((object) => {
		const rendered = renderObject(object, file, sourceWithImports);
		const current = sourceWithImports.slice(object.getStart(file), object.end);
		return rendered === current ? [] : [{ start: object.getStart(file), end: object.end, text: rendered }];
	});
	if (edits.length === 0) {
		return {
			changed: importOrder.changed,
			formattedSource: sourceWithImports,
			transforms: importOrder.changed ? ['import-order', 'import-headings'] : [],
		};
	}

	const formattedSource = edits
		.sort((left, right) => right.start - left.start)
		.reduce(
			(current, edit) => `${current.slice(0, edit.start)}${edit.text}${current.slice(edit.end)}`,
			sourceWithImports,
		);
	if (!analyzeTypeScriptSource(path, formattedSource, language).syntaxValid) {
		return { changed: false, formattedSource: source, transforms: [] };
	}
	return {
		changed: true,
		formattedSource,
		transforms: [
			...(importOrder.changed ? ['import-order', 'import-headings'] : []),
			'full-entry-object-order',
		],
	};
};

const renderObject = (
	node: ts.ObjectLiteralExpression,
	file: ts.SourceFile,
	source: string,
): string => {
	if (!isSortableObject(node, file)) return node.getText(file);
	const newline = source.includes('\r\n') ? '\r\n' : '\n';
	const propertyIndent = readIndent(source, node.properties[0]?.getStart(file) ?? node.getStart(file));
	const closingIndent = readIndent(source, node.end - 1);
	const entries = node.properties.map((property, index) => {
		const core = normalizeCoreIndent(renderProperty(property, file, source), propertyIndent);
		const trivia = source.slice(property.getFullStart(), property.getStart(file)).trim();
		return {
			index,
			core,
			measure: measureEntry(core),
			text: trivia ? `${normalizeCommentTrivia(trivia)}${newline}${core}` : core,
		};
	});
	const ordered = [...entries].sort(
		(left, right) => left.measure - right.measure || left.index - right.index,
	);
	const body = ordered
		.map((entry) =>
			entry.text
				.split(/\r?\n/)
				.map((line) => `${propertyIndent}${line}`)
				.join(newline),
		)
		.join(`,${newline}`);
	return `{${newline}${body},${newline}${closingIndent}}`;
};

const renderProperty = (
	property: ts.ObjectLiteralElementLike,
	file: ts.SourceFile,
	source: string,
): string => {
	if (ts.isPropertyAssignment(property) && ts.isObjectLiteralExpression(property.initializer)) {
		const prefix = source.slice(property.getStart(file), property.initializer.getStart(file));
		const suffix = source.slice(property.initializer.end, property.end);
		return `${prefix}${renderObject(property.initializer, file, source)}${suffix}`.trim();
	}
	return property.getText(file).trim();
};

const isSortableObject = (node: ts.ObjectLiteralExpression, file: ts.SourceFile): boolean => {
	if (
		node.properties.length < 2 ||
		file.getLineAndCharacterOfPosition(node.getStart(file)).line ===
			file.getLineAndCharacterOfPosition(node.end - 1).line
	) {
		return false;
	}
	const keys = new Set<string>();
	for (const property of node.properties) {
		if (
			(!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) ||
			ts.isComputedPropertyName(property.name)
		) {
			return false;
		}
		const key = property.name.getText(file);
		if (keys.has(key)) return false;
		keys.add(key);
	}
	return true;
};

const measureEntry = (text: string): number =>
	text
		.split(/\r?\n/)
		.map((line) => line.trimStart())
		.join('\n').length + 1;

const normalizeCommentTrivia = (text: string): string =>
	text
		.split(/\r?\n/)
		.map((line) => {
			const trimmed = line.trimStart();
			return trimmed.startsWith('|') ? ` ${trimmed}` : trimmed;
		})
		.join('\n');

const normalizeCoreIndent = (text: string, propertyIndent: string): string =>
	text
		.split(/\r?\n/)
		.map((line, index) => (index === 0 || !line.startsWith(propertyIndent) ? line : line.slice(propertyIndent.length)))
		.join('\n');

const readIndent = (source: string, offset: number): string => {
	const lineStart = source.lastIndexOf('\n', offset - 1) + 1;
	return source.slice(lineStart, offset).match(/^[\t ]*/)?.[0] ?? '';
};

export { normalizeTypeScriptStyle, type StyleNormalizationResult };
