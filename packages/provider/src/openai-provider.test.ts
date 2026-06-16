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
import { runProviderContract } from './contract.js';
import { createOpenAiProvider, buildChatRequest } from './openai-provider.js';
import type { ChatCompletionRequest, ChatCompletionResponse } from './openai-provider.js';
import type { SemanticFormatRequest } from './types.js';

/**
|--------------------------------------------------
| Sample formatting request
|--------------------------------------------------
*/
const sampleRequest: SemanticFormatRequest = {
	symbols: ['value'],
	path: 'sample.ts',
	language: 'typescript',
	source: 'export const value = 1;\n',
	guidance: {
		style: 'jsdoc',
		detail: 'concise',
		requireFunctionComments: true,
		requirePropertyComments: false,
		requireBlankLineBoundaryComments: false,
	},
};

/**
|--------------------------------------------------
| Build a fake chat completion response
|--------------------------------------------------
*/
const fakeResponse = (output: unknown, finishReason = 'stop'): ChatCompletionResponse => {
	/**
	|--------------------------------------------------
	| Return a single-choice completion
	|--------------------------------------------------
	*/
	return {
		model: 'gpt-4o-mini',
		usage: {
			prompt_tokens: 12,
			completion_tokens: 24,
		},
		choices: [
			{
				finish_reason: finishReason,
				message: {
					content: JSON.stringify(output),
				},
			},
		],
	};
};

/**
|--------------------------------------------------
| Read the user message content
|--------------------------------------------------
*/
const userContent = (request: ChatCompletionRequest): string => {
	/**
	|--------------------------------------------------
	| Return the trailing user message text
	|--------------------------------------------------
	*/
	return request.messages.find((message) => message.role === 'user')?.content || '';
};

/**
|--------------------------------------------------
| Satisfy the shared contract with echoed source
|--------------------------------------------------
*/
test('openai provider satisfies the semantic-formatting contract', async () => {
	/**
	|--------------------------------------------------
	| Build a provider that echoes the source unchanged
	|--------------------------------------------------
	*/
	const provider = createOpenAiProvider({
		model: 'gpt-4o-mini',
		transport: (request) => Promise.resolve(fakeResponse({ formattedSource: userContent(request), warnings: [] })),
	});

	/**
	|--------------------------------------------------
	| Confirm every contract check passed
	|--------------------------------------------------
	*/
	const results = await runProviderContract(provider);
	assert.deepEqual(results.filter((result) => !result.ok), []);
});

/**
|--------------------------------------------------
| Map changed source to a whole-file edit
|--------------------------------------------------
*/
test('returns a whole-file edit when formatting changes the source', async () => {
	/**
	|--------------------------------------------------
	| Build a provider that adds a comment heading
	|--------------------------------------------------
	*/
	const formatted = '/**\n|--------------------------------------------------\n| Value\n|--------------------------------------------------\n*/\nexport const value = 1;\n';
	const provider = createOpenAiProvider({
		model: 'gpt-4o-mini',
		transport: () => Promise.resolve(fakeResponse({ formattedSource: formatted, warnings: [] })),
	});

	/**
	|--------------------------------------------------
	| Format the sample request
	|--------------------------------------------------
	*/
	const response = await provider.formatSemantic(sampleRequest);

	/**
	|--------------------------------------------------
	| Confirm the bounded whole-file patch
	|--------------------------------------------------
	*/
	assert.equal(response.changed, true);
	assert.equal(response.edits.length, 1);
	assert.equal(response.formattedSource, formatted);
	assert.equal(response.usage.inputTokens, 12);
	assert.equal(response.providerAttempts?.length, 1);
	assert.equal(response.providerAttempts?.[0]?.finishReason, 'stop');
});

/**
|--------------------------------------------------
| Protect required symbols from being dropped
|--------------------------------------------------
*/
test('discards formatting that drops a required symbol', async () => {
	/**
	|--------------------------------------------------
	| Build a provider that omits the required symbol
	|--------------------------------------------------
	*/
	const provider = createOpenAiProvider({
		model: 'gpt-4o-mini',
		transport: () => Promise.resolve(fakeResponse({ formattedSource: 'export const renamed = 1;\n', warnings: [] })),
	});

	/**
	|--------------------------------------------------
	| Format the sample request
	|--------------------------------------------------
	*/
	const response = await provider.formatSemantic(sampleRequest);

	/**
	|--------------------------------------------------
	| Confirm the unsafe patch was discarded
	|--------------------------------------------------
	*/
	assert.equal(response.changed, false);
	assert.equal(response.formattedSource, sampleRequest.source);
	assert.equal(response.warnings.some((warning) => warning.includes('value')), true);
});

/**
|--------------------------------------------------
| Discard truncated responses
|--------------------------------------------------
*/
test('discards truncated responses', async () => {
	/**
	|--------------------------------------------------
	| Build a provider that truncates the response
	|--------------------------------------------------
	*/
	const provider = createOpenAiProvider({
		model: 'gpt-4o-mini',
		transport: () => Promise.resolve(fakeResponse({ formattedSource: 'anything' }, 'length')),
	});

	/**
	|--------------------------------------------------
	| Format the sample request
	|--------------------------------------------------
	*/
	const response = await provider.formatSemantic(sampleRequest);

	/**
	|--------------------------------------------------
	| Confirm the source is preserved
	|--------------------------------------------------
	*/
	assert.equal(response.changed, false);
	assert.equal(response.formattedSource, sampleRequest.source);
	assert.equal(response.warnings[0]?.includes('truncated'), true);
});

/**
|--------------------------------------------------
| Build a JSON-schema chat request
|--------------------------------------------------
*/
test('builds a structured chat completions request', () => {
	/**
	|--------------------------------------------------
	| Build the request for the sample input
	|--------------------------------------------------
	*/
	const request = buildChatRequest(sampleRequest, {
		structuredOutput: true,
		maxOutputTokens: 16_000,
		model: 'gpt-4o-mini',
	});

	/**
	|--------------------------------------------------
	| Confirm the documented request shape
	|--------------------------------------------------
	*/
	assert.equal(request.model, 'gpt-4o-mini');
	assert.equal(request.messages[0]?.role, 'system');
	assert.equal(request.messages[1]?.content, sampleRequest.source);
	assert.equal(request.response_format?.type, 'json_schema');
	assert.equal(request.max_tokens, 4_096);
});

/**
|--------------------------------------------------
| Fall back to JSON object responses
|--------------------------------------------------
*/
test('falls back to a json object request when structured output is disabled', () => {
	/**
	|--------------------------------------------------
	| Build a request without structured output
	|--------------------------------------------------
	*/
	const request = buildChatRequest(sampleRequest, {
		structuredOutput: false,
		maxOutputTokens: 16_000,
		model: 'llama3.1',
	});

	/**
	|--------------------------------------------------
	| Confirm the JSON-object fallback
	|--------------------------------------------------
	*/
	assert.equal(request.response_format?.type, 'json_object');
});
