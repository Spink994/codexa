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
import { isBlockComment } from './block-comment.js';

/**
|--------------------------------------------------
| Comment candidate kind
|--------------------------------------------------
*/
type CommentCandidateKind = 'function' | 'property' | 'section';

/**
|--------------------------------------------------
| Detected comment candidate
|--------------------------------------------------
*/
interface CommentCandidate {
	/**
	|--------------------------------------------------
	| Kind of heading the candidate would receive
	|--------------------------------------------------
	*/
	kind: CommentCandidateKind;

	/**
	|--------------------------------------------------
	| Declared name when one is available
	|--------------------------------------------------
	*/
	name?: string;

	/**
	|--------------------------------------------------
	| One-based line of the target declaration
	|--------------------------------------------------
	*/
	line: number;

	/**
	|--------------------------------------------------
	| Offset where a heading would be inserted
	|--------------------------------------------------
	*/
	offset: number;

	/**
	|--------------------------------------------------
	| Leading whitespace of the target line
	|--------------------------------------------------
	*/
	indent: string;

	/**
	|--------------------------------------------------
	| Whether any comment already precedes the target
	|--------------------------------------------------
	*/
	hasComment: boolean;

	/**
	|--------------------------------------------------
	| Whether a Codexa block comment already precedes it
	|--------------------------------------------------
	*/
	hasBlockComment: boolean;
}

/**
|--------------------------------------------------
| Comment boundary analysis
|--------------------------------------------------
*/
interface CommentBoundaryAnalysis {
	/**
	|--------------------------------------------------
	| Detected candidates ordered by source offset
	|--------------------------------------------------
	*/
	candidates: CommentCandidate[];
}

/**
|--------------------------------------------------
| Detect deterministic comment boundaries
|--------------------------------------------------
*/
const detectCommentBoundaries = (path: string, source: string, language: SourceLanguage): CommentBoundaryAnalysis => {
	/**
	|--------------------------------------------------
	| Parse source with full trivia retained
	|--------------------------------------------------
	*/
	const sourceFile = ts.createSourceFile(
		path,
		source,
		ts.ScriptTarget.Latest,
		true,
		language === 'typescript' ? ts.ScriptKind.TS : ts.ScriptKind.JS,
	);
	const candidates: CommentCandidate[] = [];

	/**
	|--------------------------------------------------
	| Push a candidate for a target node
	|--------------------------------------------------
	*/
	const push = (kind: CommentCandidateKind, node: ts.Node, name?: string) => {
		/**
		|--------------------------------------------------
		| Resolve target position and surrounding trivia
		|--------------------------------------------------
		*/
		const offset = node.getStart(sourceFile);
		const leading = inspectLeadingComments(source, node);

		/**
		|--------------------------------------------------
		| Record the detected candidate
		|--------------------------------------------------
		*/
		candidates.push({
			kind,
			name,
			offset,
			indent: readIndent(source, offset),
			hasComment: leading.hasComment,
			hasBlockComment: leading.hasBlockComment,
			line: sourceFile.getLineAndCharacterOfPosition(offset).line + 1,
		});
	};

	/**
	|--------------------------------------------------
	| Walk the tree collecting candidates
	|--------------------------------------------------
	*/
	const visit = (node: ts.Node) => {
		/**
		|--------------------------------------------------
		| Detect function and property declarations
		|--------------------------------------------------
		*/
		collectDeclaration(node, push);

		/**
		|--------------------------------------------------
		| Detect blank-line boundaries inside bodies
		|--------------------------------------------------
		*/
		const body = getBlockBody(node);
		if (body) collectSections(source, sourceFile, body, push);

		/**
		|--------------------------------------------------
		| Continue traversal into child nodes
		|--------------------------------------------------
		*/
		node.forEachChild(visit);
	};

	/**
	|--------------------------------------------------
	| Return offset-ordered candidates
	|--------------------------------------------------
	*/
	visit(sourceFile);
	candidates.sort((left, right) => left.offset - right.offset);
	return {
		candidates,
	};
};

/**
|--------------------------------------------------
| Collect a function or property candidate
|--------------------------------------------------
*/
const collectDeclaration = (
	node: ts.Node,
	push: (kind: CommentCandidateKind, node: ts.Node, name?: string) => void,
) => {
	/**
	|--------------------------------------------------
	| Detect named function declarations
	|--------------------------------------------------
	*/
	if (ts.isFunctionDeclaration(node) && node.name) {
		push('function', node, node.name.text);
		return;
	}

	/**
	|--------------------------------------------------
	| Detect class methods
	|--------------------------------------------------
	*/
	if (ts.isMethodDeclaration(node)) {
		push('function', node, readNodeName(node.name));
		return;
	}

	/**
	|--------------------------------------------------
	| Detect function-valued variable declarations
	|--------------------------------------------------
	*/
	if (ts.isVariableStatement(node)) {
		const declaration = node.declarationList.declarations.find(
			(entry) => entry.initializer && isFunctionValue(entry.initializer),
		);
		if (declaration) push('function', node, readNodeName(declaration.name));
		return;
	}

	/**
	|--------------------------------------------------
	| Detect DTO and entity property declarations
	|--------------------------------------------------
	*/
	if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) {
		push('property', node, readNodeName(node.name));
	}
};

/**
|--------------------------------------------------
| Collect blank-line section boundaries
|--------------------------------------------------
*/
const collectSections = (
	source: string,
	sourceFile: ts.SourceFile,
	body: ts.Block,
	push: (kind: CommentCandidateKind, node: ts.Node, name?: string) => void,
) => {
	/**
	|--------------------------------------------------
	| Flag the first step and blank-line-separated steps
	|--------------------------------------------------
	*/
	body.statements.forEach((statement, index) => {
		/**
		|--------------------------------------------------
		| Skip statements that own a function candidate
		|--------------------------------------------------
		*/
		if (isFunctionStatement(statement)) return;

		/**
		|--------------------------------------------------
		| Treat the first statement as a boundary
		|--------------------------------------------------
		*/
		const previous = body.statements[index - 1];
		if (!previous) {
			push('section', statement);
			return;
		}

		/**
		|--------------------------------------------------
		| Treat blank-line-separated statements as boundaries
		|--------------------------------------------------
		*/
		if (hasBlankLineBetween(source, previous.end, statement.getStart(sourceFile))) {
			push('section', statement);
		}
	});
};

/**
|--------------------------------------------------
| Resolve a block-bodied function node
|--------------------------------------------------
*/
const getBlockBody = (node: ts.Node): ts.Block | undefined => {
	/**
	|--------------------------------------------------
	| Return the block body of function-like nodes
	|--------------------------------------------------
	*/
	if (
		ts.isFunctionDeclaration(node) ||
		ts.isMethodDeclaration(node) ||
		ts.isConstructorDeclaration(node) ||
		ts.isGetAccessorDeclaration(node) ||
		ts.isSetAccessorDeclaration(node) ||
		ts.isFunctionExpression(node) ||
		ts.isArrowFunction(node)
	) {
		return node.body && ts.isBlock(node.body) ? node.body : undefined;
	}

	/**
	|--------------------------------------------------
	| Return nothing for non-function nodes
	|--------------------------------------------------
	*/
	return undefined;
};

/**
|--------------------------------------------------
| Determine whether a statement owns a function
|--------------------------------------------------
*/
const isFunctionStatement = (statement: ts.Statement): boolean => {
	/**
	|--------------------------------------------------
	| Treat function declarations as function owners
	|--------------------------------------------------
	*/
	if (ts.isFunctionDeclaration(statement)) return true;

	/**
	|--------------------------------------------------
	| Treat function-valued variables as function owners
	|--------------------------------------------------
	*/
	if (ts.isVariableStatement(statement)) {
		return statement.declarationList.declarations.some(
			(entry) => entry.initializer && isFunctionValue(entry.initializer),
		);
	}

	/**
	|--------------------------------------------------
	| Treat other statements as plain steps
	|--------------------------------------------------
	*/
	return false;
};

/**
|--------------------------------------------------
| Determine whether an expression is a function
|--------------------------------------------------
*/
const isFunctionValue = (node: ts.Expression): boolean => {
	/**
	|--------------------------------------------------
	| Return whether the value is an arrow or function
	|--------------------------------------------------
	*/
	return ts.isArrowFunction(node) || ts.isFunctionExpression(node);
};

/**
|--------------------------------------------------
| Read a declaration name as text
|--------------------------------------------------
*/
const readNodeName = (name: ts.Node): string | undefined => {
	/**
	|--------------------------------------------------
	| Return identifier or literal names only
	|--------------------------------------------------
	*/
	if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;

	/**
	|--------------------------------------------------
	| Return no name for computed members
	|--------------------------------------------------
	*/
	return undefined;
};

/**
|--------------------------------------------------
| Inspect comments preceding a node
|--------------------------------------------------
*/
const inspectLeadingComments = (source: string, node: ts.Node) => {
	/**
	|--------------------------------------------------
	| Read leading comment ranges for the node
	|--------------------------------------------------
	*/
	const ranges = ts.getLeadingCommentRanges(source, node.getFullStart()) || [];
	if (ranges.length === 0) {
		return {
			hasComment: false,
			hasBlockComment: false,
		};
	}

	/**
	|--------------------------------------------------
	| Detect whether a Codexa block comment is present
	|--------------------------------------------------
	*/
	return {
		hasComment: true,
		hasBlockComment: ranges.some((range) => isBlockComment(source.slice(range.pos, range.end))),
	};
};

/**
|--------------------------------------------------
| Determine whether a blank line separates offsets
|--------------------------------------------------
*/
const hasBlankLineBetween = (source: string, from: number, to: number): boolean => {
	/**
	|--------------------------------------------------
	| Return whether the gap contains a blank line
	|--------------------------------------------------
	*/
	return /\n[ \t]*\n/.test(source.slice(from, to));
};

/**
|--------------------------------------------------
| Read indentation preceding a source offset
|--------------------------------------------------
*/
const readIndent = (source: string, offset: number): string => {
	/**
	|--------------------------------------------------
	| Resolve the start of the offset's line
	|--------------------------------------------------
	*/
	const lineStart = source.lastIndexOf('\n', offset - 1) + 1;

	/**
	|--------------------------------------------------
	| Return leading whitespace before the offset
	|--------------------------------------------------
	*/
	const match = source.slice(lineStart, offset).match(/^[\t ]*/);
	return match ? match[0] : '';
};

/**
|--------------------------------------------------
| Export comment boundary detector
|--------------------------------------------------
*/
export { type CommentCandidate, detectCommentBoundaries, type CommentCandidateKind, type CommentBoundaryAnalysis };
