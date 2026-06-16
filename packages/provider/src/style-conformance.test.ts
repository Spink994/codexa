/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import test from 'node:test';
import process from 'node:process';
import assert from 'node:assert/strict';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { STYLE_EXAMPLES } from './style-examples.generated.js';
import { createAnthropicProviderFromApiKey } from './anthropic-sdk.js';
import { detectCategories, selectExamples, buildStyleSystemPrompt } from './style-pack.js';
import type { SemanticFormatGuidance } from './types.js';

/**
|--------------------------------------------------
| Default house-style guidance for conformance
|--------------------------------------------------
*/
const guidance: SemanticFormatGuidance = {
	style: 'block',
	detail: 'concise',
	requireFunctionComments: true,
	requirePropertyComments: true,
	requireBlankLineBoundaryComments: true,
};

/**
|--------------------------------------------------
| Build a prompt for a representative source string
|--------------------------------------------------
*/
const promptFor = (source: string): string => {
	/**
	|--------------------------------------------------
	| Assemble the prompt for a TypeScript file
	|--------------------------------------------------
	*/
	return buildStyleSystemPrompt({
		source,
		guidance,
		symbols: [],
		path: 'sample.ts',
		language: 'typescript',
	});
};

/**
|--------------------------------------------------
| Every documented example parses into a pair
|--------------------------------------------------
*/
test('parses every documented example into an input/output pair', () => {
	/**
	|--------------------------------------------------
	| Confirm the generated corpus is non-empty
	|--------------------------------------------------
	*/
	assert.ok(STYLE_EXAMPLES.length >= 50, `expected >= 50 examples, got ${STYLE_EXAMPLES.length}`);

	/**
	|--------------------------------------------------
	| Confirm every example has both sides populated
	|--------------------------------------------------
	*/
	STYLE_EXAMPLES.forEach((example) => {
		assert.ok(example.input.length > 0, `empty input for "${example.title}"`);
		assert.ok(example.output.length > 0, `empty output for "${example.title}"`);
	});
});

/**
|--------------------------------------------------
| Category detection matches file contents
|--------------------------------------------------
*/
test('detects style categories from source contents', () => {
	/**
	|--------------------------------------------------
	| A plain utility exercises only functions
	|--------------------------------------------------
	*/
	assert.deepEqual(detectCategories('const add = (a, b) => a + b;'), ['function']);

	/**
	|--------------------------------------------------
	| Import statements add the import category
	|--------------------------------------------------
	*/
	assert.ok(detectCategories("import x from 'y';\nconst a = 1;").includes('import'));

	/**
	|--------------------------------------------------
	| Hook calls add the hook category
	|--------------------------------------------------
	*/
	assert.ok(detectCategories('useEffect(() => {}, []);').includes('hook'));

	/**
	|--------------------------------------------------
	| JSX markup adds the view category
	|--------------------------------------------------
	*/
	assert.ok(detectCategories('const C = () => <Card />;').includes('view'));
});

/**
|--------------------------------------------------
| Prompt assembly includes relevant rules and examples
|--------------------------------------------------
*/
test('assembles a prompt with relevant rules and few-shot examples', () => {
	/**
	|--------------------------------------------------
	| A function-only file carries the hard constraints
	|--------------------------------------------------
	*/
	const functionPrompt = promptFor('const getUser = (u) => u.name;');
	assert.match(functionPrompt, /HARD CONSTRAINTS/);
	assert.match(functionPrompt, /FUNCTION RULES/);
	assert.match(functionPrompt, /REFERENCE EXAMPLES/);

	/**
	|--------------------------------------------------
	| An import-heavy file pulls in the import rules
	|--------------------------------------------------
	*/
	const importPrompt = promptFor("import React from 'react';\nconst a = 1;");
	assert.match(importPrompt, /IMPORT RULES/);

	/**
	|--------------------------------------------------
	| A hook file pulls in the hook rules
	|--------------------------------------------------
	*/
	const hookPrompt = promptFor('useEffect(() => { getData(); }, []);');
	assert.match(hookPrompt, /HOOK RULES/);
});

test('renders configured Prettier-compatible layout preferences', () => {
	const prompt = buildStyleSystemPrompt({
		source: 'const getUser = (user) => user.name;',
		symbols: [],
		path: 'sample.ts',
		language: 'typescript',
		guidance: {
			...guidance,
			formatting: {
				semi: false,
				useTabs: false,
				tabWidth: 4,
				printWidth: 96,
				singleQuote: false,
				trailingComma: 'none',
				bracketSpacing: false,
				arrowParens: 'avoid',
				endOfLine: 'crlf',
			},
		},
	});

	assert.match(prompt, /4 spaces per level/);
	assert.match(prompt, /96 columns/);
	assert.match(prompt, /prefer double quotes/);
	assert.match(prompt, /Trailing commas: none/);
	assert.match(prompt, /Line endings: crlf/);
	assert.match(prompt, /\n    \/\*\*/);
});

/**
|--------------------------------------------------
| Object ordering measures complete property entries
|--------------------------------------------------
*/
test('delegates exact object ordering to the local normalizer', () => {
	const prompt = promptFor(`const schema = z.object({
		SHORT_KEY: z.string().min(12).default('a-long-default-value'),
		MUCH_LONGER_KEY: z.string(),
	});`);

	assert.match(prompt, /preserve object-property order/i);
	assert.match(prompt, /applies exact full-entry-length ordering locally/i);
	assert.doesNotMatch(prompt, /never sort by property-name or key length alone/i);
});

/**
|--------------------------------------------------
| Few-shot selection stays bounded per category
|--------------------------------------------------
*/
test('selects a bounded few-shot set per category', () => {
	/**
	|--------------------------------------------------
	| Limit examples to the configured per-category cap
	|--------------------------------------------------
	*/
	const examples = selectExamples("import React from 'react';\nconst getUser = (u) => u.name;");
	const functionCount = examples.filter((example) => example.category === 'function').length;
	const importCount = examples.filter((example) => example.category === 'import').length;
	assert.equal(functionCount, 1);
	assert.equal(importCount, 1);
});

/**
|--------------------------------------------------
| Keep utility prompts within the compact budget
|--------------------------------------------------
*/
test('keeps a representative object-transform prompt compact', () => {
	const source = `export const transformBundles = (bundle?: any) => {
	// Transform bundle to match ProductCard interface
	const hasDiscount = Boolean(bundle.originalPrice && bundle.originalPrice > bundle.price);
	const transformedBundle = {
		_id: bundle._id,
		name: bundle.name,
		unitPrice: Number(hasDiscount && bundle.originalPrice ? bundle.originalPrice : bundle.price || 0),
		stockQuantity: 1, // Assuming bundles are always in stock for simplicity
		bundleId: bundle._id, // Add bundleId so ProductCard knows it's a bundle
	};

	return transformedBundle;
};`;
	const prompt = promptFor(source);

	assert.ok(prompt.length < 5_500, `expected a compact prompt, got ${prompt.length} characters`);
	assert.match(prompt, /Convert line comments and order a returned object/);
});

/**
|--------------------------------------------------
| Live golden conformance against the real model
|--------------------------------------------------
*/
test('matches documented output for every example (live)', { skip: liveSkipReason() }, async () => {
	/**
	|--------------------------------------------------
	| Create a live Anthropic provider from the API key
	|--------------------------------------------------
	*/
	const provider = createAnthropicProviderFromApiKey({
		effort: 'high',
		apiKey: process.env.ANTHROPIC_API_KEY as string,
	});

	/**
	|--------------------------------------------------
	| Format each example input and compare to its output
	|--------------------------------------------------
	*/
	const failures: string[] = [];
	for (const example of STYLE_EXAMPLES) {
		/**
		|--------------------------------------------------
		| Request a formatted version of the example input
		|--------------------------------------------------
		*/
		const response = await provider.formatSemantic({
			guidance,
			symbols: [],
			path: 'sample.ts',
			source: example.input,
			language: 'typescript',
		});

		/**
		|--------------------------------------------------
		| Record a failure when the output diverges
		|--------------------------------------------------
		*/
		if (response.formattedSource.trim() !== example.output.trim()) {
			failures.push(`[${example.category}] ${example.title}`);
		}
	}

	/**
	|--------------------------------------------------
	| Report the conformance rate and assert no failures
	|--------------------------------------------------
	*/
	const passed = STYLE_EXAMPLES.length - failures.length;
	console.log(`Golden conformance: ${passed}/${STYLE_EXAMPLES.length} passed`);
	if (failures.length > 0) console.log(`Failed:\n- ${failures.join('\n- ')}`);
	assert.equal(failures.length, 0, `${failures.length} examples did not match the documented output`);
});

/**
|--------------------------------------------------
| Resolve whether the live golden test should skip
|--------------------------------------------------
*/
function liveSkipReason(): string | false {
	/**
	|--------------------------------------------------
	| Require an explicit opt-in flag and an API key
	|--------------------------------------------------
	*/
	if (process.env.CODEXA_LIVE_GOLDENS !== '1') return 'set CODEXA_LIVE_GOLDENS=1 to run live golden conformance';
	if (!process.env.ANTHROPIC_API_KEY) return 'set ANTHROPIC_API_KEY to run live golden conformance';

	/**
	|--------------------------------------------------
	| Otherwise run the live conformance test
	|--------------------------------------------------
	*/
	return false;
}
