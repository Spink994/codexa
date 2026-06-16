/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import test from 'node:test';
import assert from 'node:assert/strict';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { estimateModelCost } from './pricing.js';
import { runProviderContract } from './contract.js';
import { createReferenceProvider } from './reference-provider.js';
import { applySemanticPatch, parseSemanticPatch } from './semantic-patch.js';
import { resolveFormattingOutputTokens } from './semantic-format.js';

/**
|--------------------------------------------------
| Run the contract against the reference provider
|--------------------------------------------------
*/
test('reference provider satisfies the semantic-formatting contract', async () => {
	/**
	|--------------------------------------------------
	| Run the shared provider contract suite
	|--------------------------------------------------
	*/
	const results = await runProviderContract(createReferenceProvider());

	/**
	|--------------------------------------------------
	| Confirm every contract check passed
	|--------------------------------------------------
	*/
	const failures = results.filter((result) => !result.ok);
	assert.deepEqual(failures, []);
	assert.ok(results.length >= 7);
});

/**
|--------------------------------------------------
| Estimate published Anthropic Opus pricing
|--------------------------------------------------
*/
test('estimates Opus 4.8 token pricing', () => {
	/**
	|--------------------------------------------------
	| Estimate cost for one million tokens each way
	|--------------------------------------------------
	*/
	const cost = estimateModelCost('claude-opus-4-8', {
		inputTokens: 1_000_000,
		outputTokens: 1_000_000,
	});

	/**
	|--------------------------------------------------
	| Confirm published per-million pricing
	|--------------------------------------------------
	*/
	assert.equal(cost.inputCost, 5);
	assert.equal(cost.outputCost, 25);
	assert.equal(cost.totalCost, 30);
});

/**
|--------------------------------------------------
| Estimate zero cost for unknown models
|--------------------------------------------------
*/
test('estimates zero cost for unknown models', () => {
	/**
	|--------------------------------------------------
	| Estimate cost for an unpriced model
	|--------------------------------------------------
	*/
	const cost = estimateModelCost('mystery-model', {
		inputTokens: 5_000,
		outputTokens: 5_000,
	});

	/**
	|--------------------------------------------------
	| Confirm a safe zero-cost fallback
	|--------------------------------------------------
	*/
	assert.equal(cost.totalCost, 0);
});

/**
|--------------------------------------------------
| Budget for comment-heavy formatting expansion
|--------------------------------------------------
*/
test('sizes formatting output for expanded block comments', () => {
	assert.equal(resolveFormattingOutputTokens('x'.repeat(1_534), 16_000), 6_136);
	assert.equal(resolveFormattingOutputTokens('short', 16_000), 4_096);
	assert.equal(resolveFormattingOutputTokens('x'.repeat(10_000), 16_000), 16_000);
});

/**
|--------------------------------------------------
| Apply bounded semantic patch edits
|--------------------------------------------------
*/
test('applies bounded semantic patch edits', () => {
	/**
	|--------------------------------------------------
	| Prepare a two-edit semantic patch
	|--------------------------------------------------
	*/
	const source = 'const a = 1;\nconst b = 2;\n';
	const patch = parseSemanticPatch({
		warnings: [],
		edits: [
			{
				start: 0,
				end: 5,
				text: 'let',
			},
			{
				start: 13,
				end: 18,
				text: 'let',
			},
		],
	});

	/**
	|--------------------------------------------------
	| Confirm both edits applied without overlap
	|--------------------------------------------------
	*/
	assert.equal(applySemanticPatch(source, patch), 'let a = 1;\nlet b = 2;\n');
});

/**
|--------------------------------------------------
| Reject corrupt semantic patches
|--------------------------------------------------
*/
test('rejects overlapping and out-of-range edits', () => {
	/**
	|--------------------------------------------------
	| Prepare a short source with conflicting edits
	|--------------------------------------------------
	*/
	const source = 'abcdef';

	/**
	|--------------------------------------------------
	| Confirm overlapping edits are rejected
	|--------------------------------------------------
	*/
	assert.throws(() =>
		applySemanticPatch(source, {
			warnings: [],
			edits: [
				{
					start: 0,
					end: 4,
					text: 'x',
				},
				{
					start: 2,
					end: 6,
					text: 'y',
				},
			],
		}),
	);

	/**
	|--------------------------------------------------
	| Confirm out-of-range edits are rejected
	|--------------------------------------------------
	*/
	assert.throws(() =>
		applySemanticPatch(source, {
			warnings: [],
			edits: [
				{
					start: 0,
					end: 99,
					text: 'x',
				},
			],
		}),
	);
});
