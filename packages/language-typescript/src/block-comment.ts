/**
|--------------------------------------------------
| Canonical Codexa block-comment rule line
|--------------------------------------------------
*/
const BLOCK_COMMENT_RULE = '--------------------------------------------------';

/**
|--------------------------------------------------
| Codexa block-comment template contract
|--------------------------------------------------
*/
interface BlockCommentTemplate {
	/**
	|--------------------------------------------------
	| Heading title rendered between the rule lines
	|--------------------------------------------------
	*/
	label: string;

	/**
	|--------------------------------------------------
	| Leading whitespace prefixed to every comment line
	|--------------------------------------------------
	*/
	indent?: string;
}

/**
|--------------------------------------------------
| Render canonical Codexa block comment
|--------------------------------------------------
*/
const renderBlockComment = (template: BlockCommentTemplate): string => {
	/**
	|--------------------------------------------------
	| Resolve indentation applied to every line
	|--------------------------------------------------
	*/
	const indent = template.indent || '';

	/**
	|--------------------------------------------------
	| Return indented five-line block comment
	|--------------------------------------------------
	*/
	return [
		`${indent}/**`,
		`${indent}|${BLOCK_COMMENT_RULE}`,
		`${indent}| ${template.label}`,
		`${indent}|${BLOCK_COMMENT_RULE}`,
		`${indent}*/`,
	].join('\n');
};

/**
|--------------------------------------------------
| Determine whether trivia is a Codexa block comment
|--------------------------------------------------
*/
const isBlockComment = (value: string): boolean => {
	/**
	|--------------------------------------------------
	| Reject trivia without the canonical rule line
	|--------------------------------------------------
	*/
	if (!value.includes(BLOCK_COMMENT_RULE)) return false;

	/**
	|--------------------------------------------------
	| Return whether trivia is a single block comment
	|--------------------------------------------------
	*/
	const trimmed = value.trim();
	return trimmed.startsWith('/**') && trimmed.endsWith('*/');
};

/**
|--------------------------------------------------
| Read block-comment label when present
|--------------------------------------------------
*/
const readBlockCommentLabel = (value: string): string | null => {
	/**
	|--------------------------------------------------
	| Guard non-block-comment trivia
	|--------------------------------------------------
	*/
	if (!isBlockComment(value)) return null;

	/**
	|--------------------------------------------------
	| Match the heading line between the rule lines
	|--------------------------------------------------
	*/
	const match = value.match(/\|\s*([^|\n]+?)\s*\n[^\n]*\|-+/);
	if (!match || !match[1]) return null;

	/**
	|--------------------------------------------------
	| Return trimmed heading label
	|--------------------------------------------------
	*/
	return match[1].trim();
};

/**
|--------------------------------------------------
| Export block-comment template contracts
|--------------------------------------------------
*/
export {
	isBlockComment,
	renderBlockComment,
	BLOCK_COMMENT_RULE,
	readBlockCommentLabel,
	type BlockCommentTemplate,
};
