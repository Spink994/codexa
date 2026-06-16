/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import ts from 'typescript';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import type { SourceDiagnostic, SourceLanguage, SourceSymbol, SourceSymbolKind } from '@codexa/core';

/**
|--------------------------------------------------
| TypeScript source analysis
|--------------------------------------------------
*/
interface TypeScriptSourceAnalysis {
	/**
	|--------------------------------------------------
	| Whether source contains parser diagnostics
	|--------------------------------------------------
	*/
	syntaxValid: boolean;

	/**
	|--------------------------------------------------
	| Parser diagnostics with portable locations
	|--------------------------------------------------
	*/
	diagnostics: SourceDiagnostic[];

	/**
	|--------------------------------------------------
	| Imported module specifiers
	|--------------------------------------------------
	*/
	imports: string[];

	/**
	|--------------------------------------------------
	| Exported declaration names
	|--------------------------------------------------
	*/
	exports: string[];

	/**
	|--------------------------------------------------
	| Top-level source declarations
	|--------------------------------------------------
	*/
	symbols: SourceSymbol[];
}

/**
|--------------------------------------------------
| Analyze TypeScript or JavaScript source
|--------------------------------------------------
*/
const analyzeTypeScriptSource = (path: string, source: string, language: SourceLanguage): TypeScriptSourceAnalysis => {
	/**
	|--------------------------------------------------
	| Parse source using language-appropriate script kind
	|--------------------------------------------------
	*/
	const sourceFile = ts.createSourceFile(
		path,
		source,
		ts.ScriptTarget.Latest,
		true,
		language === 'typescript' ? ts.ScriptKind.TS : ts.ScriptKind.JS,
	);

	/**
	|--------------------------------------------------
	| Collect public compiler diagnostics
	|--------------------------------------------------
	*/
	const transpilation = ts.transpileModule(source, {
		fileName: path,
		reportDiagnostics: true,

		/**
		|--------------------------------------------------
		| Compiler Options
		|--------------------------------------------------
		*/
		compilerOptions: {
			target: ts.ScriptTarget.Latest,
			allowJs: language === 'javascript',
		},
	});

	/**
	|--------------------------------------------------
	| Convert compiler diagnostics into portable
	| metadata
	|--------------------------------------------------
	*/
	const diagnostics = (transpilation.diagnostics || []).map((diagnostic) =>
		createSourceDiagnostic(sourceFile, diagnostic),
	);

	/**
	|--------------------------------------------------
	| Prepare collected source metadata
	|--------------------------------------------------
	*/
	const imports = new Set<string>();
	const exports = new Set<string>();
	const symbols: SourceSymbol[] = [];

	/**
	|--------------------------------------------------
	| Inspect top-level source statements
	|--------------------------------------------------
	*/
	sourceFile.statements.forEach((statement) => {
		/**
		|--------------------------------------------------
		| Collect static imports
		|--------------------------------------------------
		*/
		if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
			imports.add(statement.moduleSpecifier.text);
		}

		/**
		|--------------------------------------------------
		| Collect export declarations
		|--------------------------------------------------
		*/
		if (ts.isExportDeclaration(statement)) {
			if (statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
				imports.add(statement.moduleSpecifier.text);
			}

			/**
			|--------------------------------------------------
			| Guards
			|--------------------------------------------------
			*/
			if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
				statement.exportClause.elements.forEach((element) => {
					exports.add(element.name.text);
				});
			}
		}

		/**
		|--------------------------------------------------
		| Collect named top-level declarations
		|--------------------------------------------------
		*/
		const declarations = collectStatementSymbols(statement);
		declarations.forEach((symbol) => {
			symbols.push(symbol);
			if (symbol.exported) exports.add(symbol.name);
		});
	});

	/**
	|--------------------------------------------------
	| Return deterministic source analysis
	|--------------------------------------------------
	*/
	return {
		symbols,
		diagnostics,
		syntaxValid: diagnostics.length === 0,
		exports: [...exports].sort(),
		imports: [...imports].sort(),
	};
};

/**
|--------------------------------------------------
| Collect symbols declared by statement
|--------------------------------------------------
*/
const collectStatementSymbols = (statement: ts.Statement) => {
	/**
	|--------------------------------------------------
	| Determine statement export state
	|--------------------------------------------------
	*/
	const exported = hasExportModifier(statement);

	/**
	|--------------------------------------------------
	| Collect variable declaration names
	|--------------------------------------------------
	*/
	if (ts.isVariableStatement(statement)) {
		return statement.declarationList.declarations.flatMap((declaration) =>
			collectBindingNames(declaration.name).map((name) => ({
				name,
				exported,
				kind: 'variable' as const,
			})),
		);
	}

	/**
	|--------------------------------------------------
	| Collect supported named declaration
	|--------------------------------------------------
	*/
	const declaration = getNamedDeclaration(statement);
	if (!declaration) return [];

	/**
	|--------------------------------------------------
	| Return named declaration metadata
	|--------------------------------------------------
	*/
	return [
		{
			exported,
			kind: declaration.kind,
			name: declaration.name.text,
		},
	];
};

/**
|--------------------------------------------------
| Resolve supported named declaration
|--------------------------------------------------
*/
const getNamedDeclaration = (statement: ts.Statement) => {
	/**
	|--------------------------------------------------
	| Return matching declaration metadata
	|--------------------------------------------------
	*/
	if (ts.isClassDeclaration(statement) && statement.name) return createNamedDeclaration('class', statement.name);
	/**
	|--------------------------------------------------
	| Guard
	|--------------------------------------------------
	*/
	if (ts.isEnumDeclaration(statement)) return createNamedDeclaration('enum', statement.name);
	/**
	|--------------------------------------------------
	| Guard
	|--------------------------------------------------
	*/
	if (ts.isFunctionDeclaration(statement) && statement.name)
		return createNamedDeclaration('function', statement.name);
	/**
	|--------------------------------------------------
	| Guard
	|--------------------------------------------------
	*/
	if (ts.isInterfaceDeclaration(statement)) return createNamedDeclaration('interface', statement.name);
	/**
	|--------------------------------------------------
	| Guard
	|--------------------------------------------------
	*/
	if (ts.isTypeAliasDeclaration(statement)) return createNamedDeclaration('type', statement.name);

	/**
	|--------------------------------------------------
	| Return no declaration for unsupported statement
	|--------------------------------------------------
	*/
	return null;
};

/**
|--------------------------------------------------
| Create named declaration metadata
|--------------------------------------------------
*/
const createNamedDeclaration = (kind: SourceSymbolKind, name: ts.Identifier) => {
	/**
	|--------------------------------------------------
	| Return declaration metadata
	|--------------------------------------------------
	*/
	return {
		kind,
		name,
	};
};

/**
|--------------------------------------------------
| Collect names from binding pattern
|--------------------------------------------------
*/
const collectBindingNames = (name: ts.BindingName): string[] => {
	/**
	|--------------------------------------------------
	| Return direct identifier
	|--------------------------------------------------
	*/
	if (ts.isIdentifier(name)) return [name.text];

	/**
	|--------------------------------------------------
	| Recursively collect destructured binding names
	|--------------------------------------------------
	*/
	return name.elements.flatMap((element) =>
		ts.isOmittedExpression(element) ? [] : collectBindingNames(element.name),
	);
};

/**
|--------------------------------------------------
| Determine whether statement is exported
|--------------------------------------------------
*/
const hasExportModifier = (statement: ts.Statement) => {
	/**
	|--------------------------------------------------
	| Guard nodes that cannot own modifiers
	|--------------------------------------------------
	*/
	if (!ts.canHaveModifiers(statement)) return false;

	/**
	|--------------------------------------------------
	| Return export-modifier result
	|--------------------------------------------------
	*/
	return Boolean(ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
};

/**
|--------------------------------------------------
| Create portable parser diagnostic
|--------------------------------------------------
*/
const createSourceDiagnostic = (sourceFile: ts.SourceFile, diagnostic: ts.Diagnostic) => {
	/**
	|--------------------------------------------------
	| Return message-only diagnostic without location
	|--------------------------------------------------
	*/
	if (diagnostic.start === undefined) {
		return {
			message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
		};
	}

	/**
	|--------------------------------------------------
	| Resolve one-based diagnostic location
	|--------------------------------------------------
	*/
	const location = sourceFile.getLineAndCharacterOfPosition(diagnostic.start);

	/**
	|--------------------------------------------------
	| Return located source diagnostic
	|--------------------------------------------------
	*/
	return {
		line: location.line + 1,
		column: location.character + 1,
		message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
	};
};

/**
|--------------------------------------------------
| Export TypeScript source analyzer
|--------------------------------------------------
*/
export { analyzeTypeScriptSource, type TypeScriptSourceAnalysis };
