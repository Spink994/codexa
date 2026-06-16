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
import { createAnthropicProvider, buildAnthropicRequest } from './anthropic-provider.js';
import type { AnthropicMessage, AnthropicMessageRequest } from './anthropic-provider.js';
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
| Build a fake Anthropic message
|--------------------------------------------------
*/
const fakeMessage = (output: unknown, stopReason = 'end_turn'): AnthropicMessage => {
	/**
	|--------------------------------------------------
	| Return a structured-output message
	|--------------------------------------------------
	*/
	return {
		model: 'claude-opus-4-8',
		stop_reason: stopReason,
		content: [
			{
				type: 'text',
				text: JSON.stringify(output),
			},
		],
		usage: {
			input_tokens: 10,
			output_tokens: 20,
		},
	};
};

/**
|--------------------------------------------------
| Build a fake client from a response handler
|--------------------------------------------------
*/
const fakeClient = (handler: (request: AnthropicMessageRequest) => AnthropicMessage) => {
	/**
	|--------------------------------------------------
	| Return the minimal messages client
	|--------------------------------------------------
	*/
	return {
		messages: {
			create(request: AnthropicMessageRequest) {
				return Promise.resolve(handler(request));
			},
		},
	};
};

/**
|--------------------------------------------------
| Read the last user message content
|--------------------------------------------------
*/
const lastUserContent = (request: AnthropicMessageRequest): string => {
	/**
	|--------------------------------------------------
	| Return the trailing user message text
	|--------------------------------------------------
	*/
	return request.messages.at(-1)?.content || '';
};

/**
|--------------------------------------------------
| Satisfy the shared contract with echoed source
|--------------------------------------------------
*/
test('anthropic provider satisfies the semantic-formatting contract', async () => {
	/**
	|--------------------------------------------------
	| Build a provider that echoes the source unchanged
	|--------------------------------------------------
	*/
	const provider = createAnthropicProvider({
		client: fakeClient((request) => fakeMessage({ formattedSource: lastUserContent(request), warnings: [] })),
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
	const provider = createAnthropicProvider({
		client: fakeClient(() => fakeMessage({ formattedSource: formatted, warnings: [] })),
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
	assert.deepEqual(response.edits[0], {
		start: 0,
		text: formatted,
		end: sampleRequest.source.length,
	});
	assert.equal(response.usage.outputTokens, 20);
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
	const provider = createAnthropicProvider({
		client: fakeClient(() => fakeMessage({ formattedSource: 'export const renamed = 1;\n', warnings: [] })),
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
| Discard refusals without changing the source
|--------------------------------------------------
*/
test('discards refusals and truncated responses', async () => {
	/**
	|--------------------------------------------------
	| Build a provider that refuses the request
	|--------------------------------------------------
	*/
	const provider = createAnthropicProvider({
		client: fakeClient(() => fakeMessage({ formattedSource: 'anything', warnings: [] }, 'refusal')),
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
	assert.equal(response.warnings[0]?.includes('refusal'), true);
});

/**
|--------------------------------------------------
| Build an adaptive structured request
|--------------------------------------------------
*/
test('builds an adaptive structured-output request', () => {
	/**
	|--------------------------------------------------
	| Build the request for the sample input
	|--------------------------------------------------
	*/
	const request = buildAnthropicRequest(sampleRequest, {
		effort: 'medium',
		maxOutputTokens: 16_000,
		model: 'claude-opus-4-8',
	});

	/**
	|--------------------------------------------------
	| Confirm the documented request shape
	|--------------------------------------------------
	*/
	assert.equal(request.model, 'claude-opus-4-8');
	assert.equal(request.thinking.type, 'adaptive');
	assert.equal(request.output_config?.format?.type, 'json_schema');
	assert.equal(request.messages[0]?.content, sampleRequest.source);
	assert.equal(request.max_tokens, 4_096);
});

/**
|--------------------------------------------------
| Use low effort and a bounded output budget by default
|--------------------------------------------------
*/
test('defaults formatting requests to low effort with source-sized output', async () => {
	let captured: AnthropicMessageRequest | undefined;
	const provider = createAnthropicProvider({
		client: fakeClient((request) => {
			captured = request;
			return fakeMessage({ formattedSource: lastUserContent(request), warnings: [] });
		}),
	});

	await provider.formatSemantic(sampleRequest);

	assert.equal(captured?.output_config?.effort, 'low');
	assert.equal(captured?.max_tokens, 4_096);
});

/**
|--------------------------------------------------
| Retry one truncated formatting response
|--------------------------------------------------
*/
test('retries max-token responses once with a larger bounded budget', async () => {
	const requests: AnthropicMessageRequest[] = [];
	const formatted = '/** Value */\nexport const value = 1;\n';
	const provider = createAnthropicProvider({
		client: fakeClient((request) => {
			requests.push(request);
			return requests.length === 1
				? fakeMessage({ formattedSource: '' }, 'max_tokens')
				: fakeMessage({ formattedSource: formatted, warnings: [] });
		}),
	});

	const response = await provider.formatSemantic(sampleRequest);

	assert.equal(requests.length, 2);
	assert.equal(requests[0]?.max_tokens, 4_096);
	assert.equal(requests[1]?.max_tokens, 8_192);
	assert.equal(response.changed, true);
	assert.equal(response.formattedSource, formatted);
	assert.deepEqual(response.usage, {
		inputTokens: 20,
		outputTokens: 40,
		cacheReadTokens: undefined,
		cacheWriteTokens: undefined,
	});
	assert.equal(response.providerAttempts?.length, 2);
	assert.equal(response.providerAttempts?.[0]?.finishReason, 'max_tokens');
	assert.equal(response.providerAttempts?.[1]?.finishReason, 'end_turn');
});

/**
|--------------------------------------------------
| Stop after one bounded truncation retry
|--------------------------------------------------
*/
test('preserves source when the bounded retry also reaches max tokens', async () => {
	let calls = 0;
	const provider = createAnthropicProvider({
		client: fakeClient(() => {
			calls += 1;
			return fakeMessage({ formattedSource: '' }, 'max_tokens');
		}),
	});

	const response = await provider.formatSemantic(sampleRequest);

	assert.equal(calls, 2);
	assert.equal(response.changed, false);
	assert.equal(response.formattedSource, sampleRequest.source);
	assert.match(response.warnings[0] ?? '', /after one retry/);
	assert.equal(response.usage.inputTokens, 20);
	assert.equal(response.usage.outputTokens, 40);
});
