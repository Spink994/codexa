/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import type { SourceLanguage } from '@codexa/core';
import type { CodeFormatPreferences, SemanticFormatGuidance } from './types.js';
import { STYLE_EXAMPLES } from './style-examples.generated.js';

/**
|--------------------------------------------------
| Style category a worked example belongs to
|--------------------------------------------------
*/
type StyleCategory = 'function' | 'hook' | 'import' | 'view';

/**
|--------------------------------------------------
| Worked input and output example pair
|--------------------------------------------------
*/
interface StyleExample {
	/**
	|--------------------------------------------------
	| Style category the example demonstrates
	|--------------------------------------------------
	*/
	category: StyleCategory;

	/**
	|--------------------------------------------------
	| Human-readable example title
	|--------------------------------------------------
	*/
	title: string;

	/**
	|--------------------------------------------------
	| Source code before formatting
	|--------------------------------------------------
	*/
	input: string;

	/**
	|--------------------------------------------------
	| Source code after formatting in the house style
	|--------------------------------------------------
	*/
	output: string;
}

/**
|--------------------------------------------------
| Hard constraints that protect runtime behavior
|--------------------------------------------------
*/
const HARD_CONSTRAINTS = [
	'Preserve runtime behavior 100%. Never change what the code does.',
	'Do not rename variables, functions, methods, components, props, types, interfaces, enums, or object keys.',
	'Do not refactor, optimize, add, or remove logic.',
	'Do not change import paths, string values, className/Tailwind values, or dependency arrays.',
	'Only change formatting: comments, spacing, line breaks, grouping, and the specific orderings defined below.',
	'Preserve a meaningful existing comment; convert its style but never replace its intent with a generated one.',
	'Every comment in the output MUST use one of the block-comment templates below. Never emit "//" line comments, trailing "//" comments, or plain "/* ... */" comments — rewrite each one into the matching block-comment template, keeping its wording as the title.',
].join('\n');

/**
|--------------------------------------------------
| Block-comment templates emitted by the house style
|--------------------------------------------------
*/
const renderCommentTemplates = (indent: string) => [
	'Top-level / function-title block comment (bars flush with the indentation):',
	'/**',
	'|--------------------------------------------------',
	'| Title in sentence case',
	'|--------------------------------------------------',
	'*/',
	'',
	'Internal section block comment inside a function body (bars carry a leading space):',
	`${indent}/**`,
	`${indent} |--------------------------------------------------`,
	`${indent} | Section title`,
	`${indent} |--------------------------------------------------`,
	`${indent} */`,
	'',
	'JSX block comment for grouped markup:',
	'{/**',
	'|--------------------------------------------------',
	'| Section title',
	'|--------------------------------------------------',
	'*/}',
].join('\n');

/**
|--------------------------------------------------
| Default code layout matching Codexa's house style
|--------------------------------------------------
*/
const DEFAULT_FORMATTING: CodeFormatPreferences = {
	semi: true,
	useTabs: true,
	tabWidth: 4,
	printWidth: 120,
	singleQuote: true,
	trailingComma: 'all',
	bracketSpacing: true,
	arrowParens: 'always',
	endOfLine: 'lf',
};

/**
|--------------------------------------------------
| Render explicit Prettier-compatible layout rules
|--------------------------------------------------
*/
const renderFormattingRules = (guidance: SemanticFormatGuidance): string => {
	const formatting = { ...DEFAULT_FORMATTING, ...guidance.formatting };
	const indentation = formatting.useTabs
		? `tabs (display width ${formatting.tabWidth})`
		: `${formatting.tabWidth} spaces per level`;

	return [
		`- Indentation: ${indentation}; line width: ${formatting.printWidth} columns; semicolons: ${
			formatting.semi ? 'yes' : 'no'
		}; prefer ${formatting.singleQuote ? 'single' : 'double'} quotes.`,
		`- Trailing commas: ${formatting.trailingComma}; bracket spacing: ${
			formatting.bracketSpacing ? 'yes' : 'no'
		}; arrow parentheses: ${formatting.arrowParens}; Line endings: ${formatting.endOfLine}.`,
	].join('\n');
};

/**
|--------------------------------------------------
| Section-title vocabulary shared across categories
|--------------------------------------------------
*/
const SECTION_VOCABULARY = [
	'Guard clause',
	'Prepare payload',
	'Make request',
	'Handle success response',
	'Handle failure response',
	'Handle error',
	'Set loading state',
	'Reset loading state',
	'Determine status',
	'Determine value',
	'Process items',
	'Process data',
	'Sync Redux with server response',
	'Update local state',
	'Return result',
	'Render content',
	'Memoize value',
	'Create callback',
	'Return cleanup',
	'Npm imports',
	'Custom imports',
].join(', ');

/**
|--------------------------------------------------
| Per-category formatting rules
|--------------------------------------------------
*/
const CATEGORY_RULES: Record<StyleCategory, string[]> = {
	/**
	|--------------------------------------------------
	| Rules for functions and methods
	|--------------------------------------------------
	*/
	function: [
		'Give every function and method a top-level block-comment title describing what it does (sentence case, no trailing period).',
		'Give every meaningful step inside the body its own internal section block comment, even single statements.',
		'A function title never replaces internal section comments; the body still needs them.',
		'Expand arrow-function shorthand bodies into a block with an explicit return, then comment the return.',
		'When a function or arrow returns JSX, title the return "Render content" (not "Return result"); name the function "Render <thing>".',
		'When a return maps/filters/reduces a collection (.map, .filter, .reduce, .forEach), title it "Process items".',
		'When a return produces a plain value, title it "Return result".',
		'Inside try/catch/finally, place section comments on the statements INSIDE each block, never on the try, catch, or finally keyword line itself.',
		'Internal section comments inside a function or hook body use a leading space before each bar (" |----"), exactly as shown in the templates.',
		'Top-level object/const declarations that are payloads or configs also receive a top-level title block (e.g. "Prepare payload", "Prepare config").',
		'Preserve object-property order in your response. Codexa applies exact full-entry-length ordering locally after your semantic formatting.',
		'Add a block comment titled "Nested <key>" before every meaningful nested object property.',
		'Copy section titles from the reference examples verbatim when an example matches; reuse the closest documented title rather than inventing a new phrasing.',
		'In a switch, put a section block comment above every case and the default, titled for the state or event handled (e.g. "Run started", "Run completed"); never group case labels under one uncommented block.',
		'Expand each branch\'s returned objects, arrays, filters, and maps across multiple lines (even single-property updates), keeping them inside the case section.',
		'Title the default branch "Fallback" unless a more specific meaning exists, and leave a blank line between cases.',
	],

	/**
	|--------------------------------------------------
	| Rules for React hooks
	|--------------------------------------------------
	*/
	hook: [
		'Treat hook bodies (useEffect, useMemo, useCallback, custom hooks) like full functions with internal section comments.',
		'Never modify or reorder dependency arrays.',
		'Label cleanup returns as "Return cleanup".',
		'Order contiguous useState / useRef declaration groups shortest to longest by full declaration length; do not reorder across blank lines.',
	],

	/**
	|--------------------------------------------------
	| Rules for import statements
	|--------------------------------------------------
	*/
	import: [
		'Group imports into "Npm imports" then "Custom imports" sections, each introduced by a top-level block comment.',
		'Preserve import declaration contents and side-effect import order. Codexa applies exact safe import grouping and full-declaration-length ordering locally.',
		'One blank line after each section comment and between groups; no blank lines inside a group.',
		'Never mix npm and custom imports. Do not modify type imports, require, or dynamic imports.',
	],

	/**
	|--------------------------------------------------
	| Rules for UI / JSX views
	|--------------------------------------------------
	*/
	view: [
		'Keep JSX multiline and readable; never compress it.',
		'Use block comments to separate major JSX sections, nested groups, and meaningful child elements.',
		'Use short, human-readable JSX block comment labels such as Heading, Mode toggle, Input field, Source content, Provider summary and submit, Icon, and Label.',
		'Use placeholder block comments with "..." only when the section is temporary, unclear, or intentionally unnamed.',
		'Place JSX block comments immediately before the element or conditional branch they describe.',
		'Add blank lines between visually distinct JSX groups, especially between sibling components, nested form fields, and action areas.',
		'Keep conditional JSX branches readable by wrapping each branch in its own clearly commented block.',
		'Prefer explicit grouped sections for alternate states such as snippet vs upload loading vs empty vs content',
		'Keep component body sections in this order: hooks, local states, store values, mutations, derived values, rendered view.',
		'Keep file-level sections in this order: directive, npm imports, custom imports, types, constants, exported component, local components.',
		'Keep JSX attributes multiline when the element has multiple props, handlers, dynamic classes, or long className values.',
		'Sort JSX attributes shortest to longest by full attribute string length and content where it does not reduce readability.',
		'Sort destructured props shortest to longest by prop name length where it does not break logical grouping.',
		'Keep simple one-line expressions readable, but split long object payloads, function calls, and JSX text across multiple lines.',
		'Prefer descriptive local names and section comments over dense inline logic.',
	],
};

/**
|--------------------------------------------------
| Detect which categories a source file exercises
|--------------------------------------------------
*/
const detectCategories = (source: string): StyleCategory[] => {
	/**
	|--------------------------------------------------
	| Always include functions; they appear everywhere
	|--------------------------------------------------
	*/
	const categories = new Set<StyleCategory>(['function']);

	/**
	|--------------------------------------------------
	| Include imports when the file has import statements
	|--------------------------------------------------
	*/
	if (/^\s*import\s/m.test(source)) categories.add('import');

	/**
	|--------------------------------------------------
	| Include hooks when React hook calls are present
	|--------------------------------------------------
	*/
	if (/\b(useEffect|useMemo|useCallback|useState|useRef)\s*\(/.test(source)) categories.add('hook');

	/**
	|--------------------------------------------------
	| Include views for files containing JSX markup
	|--------------------------------------------------
	*/
	if (/return\s*\(?\s*</.test(source) || /<[A-Z][A-Za-z0-9]*[\s/>]/.test(source)) categories.add('view');

	/**
	|--------------------------------------------------
	| Return the detected categories in a stable order
	|--------------------------------------------------
	*/
	return (['import', 'function', 'hook', 'view'] as StyleCategory[]).filter((category) => categories.has(category));
};

/**
|--------------------------------------------------
| Select a bounded few-shot example set for a file
|--------------------------------------------------
*/
const selectExamples = (source: string, perCategory = 1): StyleExample[] => {
	/**
	|--------------------------------------------------
	| Take a bounded sample from each relevant category
	|--------------------------------------------------
	*/
	const categories = detectCategories(source);
	const selected = categories.flatMap((category) =>
		STYLE_EXAMPLES.filter((example) => example.category === category).slice(0, perCategory),
	);

	/**
	|--------------------------------------------------
	| Surface a switch example when the source has one
	|--------------------------------------------------
	*/
	if (/\bswitch\s*\(/.test(source)) {
		const switchExamples = STYLE_EXAMPLES.filter(
			(example) => example.category === 'function' && /switch/i.test(example.title),
		);
		const switchExample =
			switchExamples.find((example) => /multiline/i.test(example.title)) ?? switchExamples[0];
		if (switchExample && !selected.includes(switchExample)) selected.push(switchExample);
	}

	/**
	|--------------------------------------------------
	| Return the bounded few-shot set for the file
	|--------------------------------------------------
	*/
	return selected;
};

/**
|--------------------------------------------------
| Render the rule sections for the relevant categories
|--------------------------------------------------
*/
const renderRules = (categories: StyleCategory[]): string => {
	/**
	|--------------------------------------------------
	| Join each category's bullet list under a heading
	|--------------------------------------------------
	*/
	return categories
		.map((category) => {
			const heading = `${category.toUpperCase()} RULES`;
			const bullets = CATEGORY_RULES[category].map((rule) => `- ${rule}`).join('\n');
			return `${heading}:\n${bullets}`;
		})
		.join('\n\n');
};

/**
|--------------------------------------------------
| Render the few-shot examples as Input/Output blocks
|--------------------------------------------------
*/
const renderExamples = (examples: StyleExample[]): string => {
	/**
	|--------------------------------------------------
	| Format each pair as a fenced before/after block
	|--------------------------------------------------
	*/
	return examples
		.map((example, index) => {
			const fence = example.category === 'view' ? 'tsx' : 'ts';
			return [
				`Example ${index + 1} (${example.category}) — ${example.title}`,
				'Input:',
				`\`\`\`${fence}`,
				example.input,
				'```',
				'Output:',
				`\`\`\`${fence}`,
				example.output,
				'```',
			].join('\n');
		})
		.join('\n\n');
};

/**
|--------------------------------------------------
| Build the complete house-style system prompt
|--------------------------------------------------
*/
const buildStyleSystemPrompt = (input: {
	path: string;
	source: string;
	symbols: string[];
	language: SourceLanguage;
	guidance: SemanticFormatGuidance;
}): string => {
	/**
	|--------------------------------------------------
	| Resolve the relevant categories and examples
	|--------------------------------------------------
	*/
	const categories = detectCategories(input.source);
	const examples = selectExamples(input.source);
	const formatting = { ...DEFAULT_FORMATTING, ...input.guidance.formatting };
	const indent = formatting.useTabs ? '\t' : ' '.repeat(formatting.tabWidth);

	/**
	|--------------------------------------------------
	| Assemble the full prompt from fixed and selected parts
	|--------------------------------------------------
	*/
	return [
		'You reformat source code to a fixed house style without changing its behavior.',
		`The file is "${input.path}" written in ${input.language}.`,
		'',
		'HARD CONSTRAINTS:',
		HARD_CONSTRAINTS,
		'',
		'CODE LAYOUT (Prettier-compatible preferences):',
		renderFormattingRules(input.guidance),
		'',
		'BLOCK-COMMENT TEMPLATES (reproduce these bar widths and indentation exactly):',
		renderCommentTemplates(indent),
		'',
		`PREFERRED SECTION TITLES (reuse these; do not invent new styles): ${SECTION_VOCABULARY}.`,
		'',
		renderRules(categories),
		'',
		'REFERENCE EXAMPLES (copy these patterns exactly; never invent a different style):',
		renderExamples(examples),
		'',
		`These exported symbols must remain present: ${input.symbols.join(', ') || '(none)'}.`,
		'',
		'Return only the structured result: the complete formatted file in "formattedSource" and any notes in "warnings". Do not wrap the code in markdown fences.',
	].join('\n');
};

/**
|--------------------------------------------------
| Export style pack helpers
|--------------------------------------------------
*/
export { selectExamples, type StyleExample, detectCategories, type StyleCategory, buildStyleSystemPrompt };
