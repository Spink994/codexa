/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import ts from 'typescript';

/**
|--------------------------------------------------
| Result of a behavior-preservation comparison
|--------------------------------------------------
*/
interface BehaviorComparison {
	/**
	|--------------------------------------------------
	| Whether the two sources are behavior-equivalent
	|--------------------------------------------------
	*/
	equivalent: boolean;

	/**
	|--------------------------------------------------
	| Explanation when the sources diverge
	|--------------------------------------------------
	*/
	reason?: string;
}

/**
|--------------------------------------------------
| Significant token signature of a source file
|--------------------------------------------------
*/
interface TokenSignature {
	/**
	|--------------------------------------------------
	| Sorted multiset of identifier names
	|--------------------------------------------------
	*/
	identifiers: string[];

	/**
	|--------------------------------------------------
	| Sorted multiset of string and numeric literals
	|--------------------------------------------------
	*/
	literals: string[];
}

/**
|--------------------------------------------------
| Collect the significant token signature of a source
|--------------------------------------------------
*/
const collectSignature = (source: string): TokenSignature => {
	/**
	|--------------------------------------------------
	| Parse as TSX so JSX, regex, and template literals
	| with ${…} substitutions are all handled correctly.
	| A raw token scanner cannot track template re-scans
	| and falls out of sync, mis-reading code as literals.
	|--------------------------------------------------
	*/
	const sourceFile = ts.createSourceFile('unit.tsx', source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);

	/**
	|--------------------------------------------------
	| Accumulate identifier and literal nodes only
	|--------------------------------------------------
	*/
	const identifiers: string[] = [];
	const literals: string[] = [];

	/**
	|--------------------------------------------------
	| Walk the AST, recording significant leaf values
	|--------------------------------------------------
	*/
	const visit = (node: ts.Node): void => {
		/**
		|--------------------------------------------------
		| Record identifier and private identifier names
		|--------------------------------------------------
		*/
		if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) {
			identifiers.push(node.text);
		} else if (
			/**
			|--------------------------------------------------
			| Record string, numeric, regex, and template values
			|--------------------------------------------------
			*/
			ts.isStringLiteralLike(node) ||
			ts.isNumericLiteral(node) ||
			ts.isBigIntLiteral(node) ||
			node.kind === ts.SyntaxKind.RegularExpressionLiteral ||
			node.kind === ts.SyntaxKind.TemplateHead ||
			node.kind === ts.SyntaxKind.TemplateMiddle ||
			node.kind === ts.SyntaxKind.TemplateTail
		) {
			literals.push((node as ts.LiteralLikeNode).text);
		}

		/**
		|--------------------------------------------------
		| Recurse into the children
		|--------------------------------------------------
		*/
		ts.forEachChild(node, visit);
	};

	visit(sourceFile);

	/**
	|--------------------------------------------------
	| Return the order-independent sorted signature
	|--------------------------------------------------
	*/
	return {
		identifiers: identifiers.sort(),
		literals: literals.sort(),
	};
};

/**
|--------------------------------------------------
| Describe the first difference between two multisets
|--------------------------------------------------
*/
const diffMultiset = (before: string[], after: string[], label: string): string | undefined => {
	/**
	|--------------------------------------------------
	| Compare lengths before comparing membership
	|--------------------------------------------------
	*/
	if (before.length !== after.length) {
		return `${label} count changed from ${before.length} to ${after.length}`;
	}

	/**
	|--------------------------------------------------
	| Find the first positional mismatch in the sorted lists
	|--------------------------------------------------
	*/
	for (let index = 0; index < before.length; index += 1) {
		if (before[index] !== after[index]) {
			return `${label} changed near "${before[index]}" vs "${after[index]}"`;
		}
	}

	/**
	|--------------------------------------------------
	| Report no difference
	|--------------------------------------------------
	*/
	return undefined;
};

/**
|--------------------------------------------------
| Compare two sources for behavior preservation
|--------------------------------------------------
*/
const compareTypeScriptStructure = (before: string, after: string): BehaviorComparison => {
	/**
	|--------------------------------------------------
	| Collect the significant token signatures
	|--------------------------------------------------
	*/
	const beforeSignature = collectSignature(before);
	const afterSignature = collectSignature(after);

	/**
	|--------------------------------------------------
	| Reject when identifier names changed
	|--------------------------------------------------
	*/
	const identifierDiff = diffMultiset(beforeSignature.identifiers, afterSignature.identifiers, 'identifier');
	if (identifierDiff) return { equivalent: false, reason: identifierDiff };

	/**
	|--------------------------------------------------
	| Reject when string or numeric literals changed
	|--------------------------------------------------
	*/
	const literalDiff = diffMultiset(beforeSignature.literals, afterSignature.literals, 'literal');
	if (literalDiff) return { equivalent: false, reason: literalDiff };

	/**
	|--------------------------------------------------
	| Accept behavior-equivalent reformatting
	|--------------------------------------------------
	*/
	return { equivalent: true };
};

/**
|--------------------------------------------------
| Export behavior-preservation comparison
|--------------------------------------------------
*/
export { compareTypeScriptStructure, type BehaviorComparison };
