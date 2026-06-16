import ts from 'typescript';
import type { SourceLanguage, SourceTextEdit } from '@codexa/core';
import { renderBlockComment } from './block-comment.js';

interface ImportOrderResult {
	changed: boolean;
	edit?: SourceTextEdit;
	formattedSource: string;
}

const NPM_IMPORTS = renderBlockComment({ label: 'Npm imports' });
const CUSTOM_IMPORTS = renderBlockComment({ label: 'Custom imports' });
const SUPPORTED_HEADINGS = new Set([NPM_IMPORTS, CUSTOM_IMPORTS]);

const normalizeImportOrder = (
	path: string,
	source: string,
	language: SourceLanguage,
): ImportOrderResult => {
	const sourceFile = ts.createSourceFile(
		path,
		source,
		ts.ScriptTarget.Latest,
		true,
		language === 'typescript' ? ts.ScriptKind.TS : ts.ScriptKind.JS,
	);
	const imports = collectLeadingImports(sourceFile);
	if (imports.length === 0 || !canReorderImports(imports, sourceFile, source)) {
		return { changed: false, formattedSource: source };
	}

	const newline = source.includes('\r\n') ? '\r\n' : '\n';
	const edit = renderImportEdit(imports, sourceFile, source, newline);
	if (!edit || source.slice(edit.start, edit.end) === edit.text) {
		return { changed: false, formattedSource: source };
	}

	return {
		edit,
		changed: true,
		formattedSource: `${source.slice(0, edit.start)}${edit.text}${source.slice(edit.end)}`,
	};
};

const collectLeadingImports = (sourceFile: ts.SourceFile): ts.ImportDeclaration[] => {
	const imports: ts.ImportDeclaration[] = [];
	for (const statement of sourceFile.statements) {
		if (!ts.isImportDeclaration(statement)) break;
		imports.push(statement);
	}
	return imports;
};

const canReorderImports = (
	imports: ts.ImportDeclaration[],
	sourceFile: ts.SourceFile,
	source: string,
): boolean => {
	if (
		imports.some(
			(declaration) =>
				!declaration.importClause ||
				declaration.attributes ||
				!ts.isStringLiteral(declaration.moduleSpecifier),
		)
	) {
		return false;
	}

	const start = imports[0]?.getFullStart() ?? 0;
	const end = imports.at(-1)?.end ?? start;
	const region = source.slice(start, end);
	const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, region);

	for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
		if (
			token !== ts.SyntaxKind.SingleLineCommentTrivia &&
			token !== ts.SyntaxKind.MultiLineCommentTrivia
		) {
			continue;
		}
		const comment = scanner.getTokenText().replaceAll('\r\n', '\n').trim();
		if (!SUPPORTED_HEADINGS.has(comment)) return false;
	}

	const leadingTrivia = source.slice(start, imports[0]?.getStart(sourceFile) ?? start);
	return stripSupportedHeadings(leadingTrivia).trim().length === 0;
};

const renderImportEdit = (
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
			measure: measureImport(text),
			group: isCustomImport(declaration.moduleSpecifier.text) ? 'custom' as const : 'npm' as const,
		};
	});
	if (records.some((record) => !record)) return null;

	const renderGroup = (group: 'npm' | 'custom', heading: string): string | null => {
		const grouped = records
			.filter((record): record is NonNullable<typeof record> => record !== null && record.group === group)
			.sort(
				(left, right) =>
					left.measure - right.measure ||
					left.text.localeCompare(right.text) ||
					left.index - right.index,
			);
		if (grouped.length === 0) return null;
		return `${heading.replaceAll('\n', newline)}${newline}${grouped.map((record) => record.text).join(newline)}`;
	};

	const sections = [
		renderGroup('npm', NPM_IMPORTS),
		renderGroup('custom', CUSTOM_IMPORTS),
	].filter((section): section is string => section !== null);
	const start = imports[0]?.getFullStart() ?? 0;
	const end = imports.at(-1)?.end ?? start;

	return {
		start,
		end,
		text: sections.join(`${newline}${newline}`),
	};
};

const measureImport = (text: string): number =>
	text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.join(' ').length;

const stripSupportedHeadings = (text: string): string =>
	[...SUPPORTED_HEADINGS].reduce(
		(current, heading) => current.replaceAll(heading, ''),
		text.replaceAll('\r\n', '\n'),
	);

const isCustomImport = (moduleSpecifier: string): boolean =>
	['.', '/', '@/', '~/', '#/'].some((prefix) => moduleSpecifier.startsWith(prefix));

export { normalizeImportOrder, type ImportOrderResult };
