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
import type { SourceLanguage } from '@codexa/core';
import { analyzeTypeScriptSource } from './analyzer.js';

/**
|--------------------------------------------------
| Semantic change risk level
|--------------------------------------------------
*/
type SemanticRiskLevel = 'low' | 'medium' | 'high';

/**
|--------------------------------------------------
| Semantic change risk reason
|--------------------------------------------------
*/
type SemanticRiskReason =
	| 'syntax-changed'
	| 'imports-changed'
	| 'exports-changed'
	| 'declarations-changed'
	| 'tokens-changed'
	| 'tokens-reordered';

/**
|--------------------------------------------------
| Semantic change risk assessment
|--------------------------------------------------
*/
interface SemanticRiskAssessment {
	level: SemanticRiskLevel;
	reasons: SemanticRiskReason[];
}

/**
|--------------------------------------------------
| Assess semantic risk between source revisions
|--------------------------------------------------
*/
const assessTypeScriptSemanticRisk = (
	path: string,
	before: string,
	after: string,
	language: SourceLanguage,
): SemanticRiskAssessment => {
	/**
	|--------------------------------------------------
	| Analyze both source revisions
	|--------------------------------------------------
	*/
	const beforeAnalysis = analyzeTypeScriptSource(path, before, language);
	const afterAnalysis = analyzeTypeScriptSource(path, after, language);
	const reasons: SemanticRiskReason[] = [];

	/**
	|--------------------------------------------------
	| Detect blocking structural changes
	|--------------------------------------------------
	*/
	if (beforeAnalysis.syntaxValid !== afterAnalysis.syntaxValid || !afterAnalysis.syntaxValid) {
		reasons.push('syntax-changed');
	}
	if (!sameValues(beforeAnalysis.imports, afterAnalysis.imports)) {
		reasons.push('imports-changed');
	}
	if (!sameValues(beforeAnalysis.exports, afterAnalysis.exports)) {
		reasons.push('exports-changed');
	}
	if (!sameValues(symbolSignatures(beforeAnalysis.symbols), symbolSignatures(afterAnalysis.symbols))) {
		reasons.push('declarations-changed');
	}

	/**
	|--------------------------------------------------
	| Compare source tokens without comments or spacing
	|--------------------------------------------------
	*/
	const beforeTokens = scanTokens(path, before);
	const afterTokens = scanTokens(path, after);
	if (!sameTokenInventory(beforeTokens, afterTokens)) {
		reasons.push('tokens-changed');
	} else if (!sameValues(beforeTokens, afterTokens)) {
		reasons.push('tokens-reordered');
	}

	/**
	|--------------------------------------------------
	| Return highest detected risk level
	|--------------------------------------------------
	*/
	return {
		reasons,
		level: reasons.some((reason) => reason !== 'tokens-reordered')
			? 'high'
			: reasons.length > 0
				? 'medium'
				: 'low',
	};
};

/**
|--------------------------------------------------
| Scan significant source tokens
|--------------------------------------------------
*/
const scanTokens = (path: string, source: string): string[] => {
	/**
	|--------------------------------------------------
	| Select JSX-aware scanning when required
	|--------------------------------------------------
	*/
	const languageVariant = /\.[jt]sx$/i.test(path)
		? ts.LanguageVariant.JSX
		: ts.LanguageVariant.Standard;
	const scanner = ts.createScanner(
		ts.ScriptTarget.Latest,
		true,
		languageVariant,
		source,
	);
	const tokens: string[] = [];

	/**
	|--------------------------------------------------
	| Collect token kind and exact token text
	|--------------------------------------------------
	*/
	let token = scanner.scan();
	while (token !== ts.SyntaxKind.EndOfFileToken) {
		tokens.push(`${token}:${scanner.getTokenText()}`);
		token = scanner.scan();
	}

	return tokens;
};

/**
|--------------------------------------------------
| Build stable declaration signatures
|--------------------------------------------------
*/
const symbolSignatures = (
	symbols: ReturnType<typeof analyzeTypeScriptSource>['symbols'],
): string[] =>
	symbols
		.map((symbol) => `${symbol.kind}:${symbol.name}:${symbol.exported}`)
		.sort();

/**
|--------------------------------------------------
| Compare ordered primitive values
|--------------------------------------------------
*/
const sameValues = (left: string[], right: string[]): boolean =>
	left.length === right.length && left.every((value, index) => value === right[index]);

/**
|--------------------------------------------------
| Compare token counts without considering order
|--------------------------------------------------
*/
const sameTokenInventory = (left: string[], right: string[]): boolean => {
	if (left.length !== right.length) return false;

	const counts = new Map<string, number>();
	left.forEach((token) => counts.set(token, (counts.get(token) || 0) + 1));
	right.forEach((token) => counts.set(token, (counts.get(token) || 0) - 1));

	return [...counts.values()].every((count) => count === 0);
};

/**
|--------------------------------------------------
| Export semantic risk contracts
|--------------------------------------------------
*/
export {
	assessTypeScriptSemanticRisk,
	type SemanticRiskLevel,
	type SemanticRiskReason,
	type SemanticRiskAssessment,
};
