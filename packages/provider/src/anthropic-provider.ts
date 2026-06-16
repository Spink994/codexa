/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { estimateModelCost } from './pricing.js';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import type {
	CostEstimate,
	FormatProvider,
	ProviderUsage,
	SemanticFormatRequest,
	SemanticFormatResponse,
	ProviderAttempt,
} from './types.js';
import {
	unchanged,
	parseModelOutput,
	buildSemanticSystemPrompt,
	finalizeSemanticResponse,
	MODEL_OUTPUT_JSON_SCHEMA,
	resolveFormattingOutputTokens,
} from './semantic-format.js';

/**
|--------------------------------------------------
| Default Anthropic formatting model
|--------------------------------------------------
*/
const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-4-8';

/**
|--------------------------------------------------
| Anthropic response content block
|--------------------------------------------------
*/
interface AnthropicContentBlock {
	/**
	|--------------------------------------------------
	| Content block discriminator
	|--------------------------------------------------
	*/
	type: string;

	/**
	|--------------------------------------------------
	| Text payload present on text blocks
	|--------------------------------------------------
	*/
	text?: string;
}

/**
|--------------------------------------------------
| Anthropic token usage report
|--------------------------------------------------
*/
interface AnthropicUsage {
	/**
	|--------------------------------------------------
	| Tokens processed from the request input
	|--------------------------------------------------
	*/
	input_tokens: number;

	/**
	|--------------------------------------------------
	| Tokens generated in the response
	|--------------------------------------------------
	*/
	output_tokens: number;

	/**
	|--------------------------------------------------
	| Tokens served from the prompt cache
	|--------------------------------------------------
	*/
	cache_read_input_tokens?: number;

	/**
	|--------------------------------------------------
	| Tokens written to the prompt cache
	|--------------------------------------------------
	*/
	cache_creation_input_tokens?: number;
}

/**
|--------------------------------------------------
| Anthropic message response
|--------------------------------------------------
*/
interface AnthropicMessage {
	/**
	|--------------------------------------------------
	| Model that produced the response
	|--------------------------------------------------
	*/
	model: string;

	/**
	|--------------------------------------------------
	| Response content blocks
	|--------------------------------------------------
	*/
	content: AnthropicContentBlock[];

	/**
	|--------------------------------------------------
	| Token usage reported for the response
	|--------------------------------------------------
	*/
	usage: AnthropicUsage;

	/**
	|--------------------------------------------------
	| Reason the model stopped generating
	|--------------------------------------------------
	*/
	stop_reason?: string;
}

/**
|--------------------------------------------------
| Anthropic message request
|--------------------------------------------------
*/
interface AnthropicMessageRequest {
	/**
	|--------------------------------------------------
	| Model identifier to invoke
	|--------------------------------------------------
	*/
	model: string;

	/**
	|--------------------------------------------------
	| Maximum output tokens for the response
	|--------------------------------------------------
	*/
	max_tokens: number;

	/**
	|--------------------------------------------------
	| System prompt carrying formatting rules
	|--------------------------------------------------
	*/
	system: string;

	/**
	|--------------------------------------------------
	| Conversation messages sent to the model
	|--------------------------------------------------
	*/
	messages: { role: 'user' | 'assistant'; content: string }[];

	/**
	|--------------------------------------------------
	| Adaptive thinking configuration
	|--------------------------------------------------
	*/
	thinking: { type: 'adaptive' };

	/**
	|--------------------------------------------------
	| Output configuration carrying effort and format
	|--------------------------------------------------
	*/
	output_config?: {
		/**
		|--------------------------------------------------
		| Thinking and token effort level
		|--------------------------------------------------
		*/
		effort?: 'low' | 'medium' | 'high' | 'max';

		/**
		|--------------------------------------------------
		| Structured output schema constraint
		|--------------------------------------------------
		*/
		format?: { type: 'json_schema'; schema: unknown };
	};
}

/**
|--------------------------------------------------
| Minimal Anthropic messages client
|--------------------------------------------------
*/
interface AnthropicMessagesClient {
	/**
	|--------------------------------------------------
	| Messages resource exposing create
	|--------------------------------------------------
	*/
	messages: {
		/**
		|--------------------------------------------------
		| Create a single non-streaming message
		|--------------------------------------------------
		*/
		create(request: AnthropicMessageRequest): Promise<AnthropicMessage>;
	};
}

/**
|--------------------------------------------------
| Anthropic provider options
|--------------------------------------------------
*/
interface AnthropicProviderOptions {
	/**
	|--------------------------------------------------
	| Injected messages client used for every request
	|--------------------------------------------------
	*/
	client: AnthropicMessagesClient;

	/**
	|--------------------------------------------------
	| Formatting model identifier
	|--------------------------------------------------
	*/
	model?: string;

	/**
	|--------------------------------------------------
	| Maximum output tokens for formatting requests
	|--------------------------------------------------
	*/
	maxOutputTokens?: number;

	/**
	|--------------------------------------------------
	| Thinking and token effort level
	|--------------------------------------------------
	*/
	effort?: 'low' | 'medium' | 'high' | 'max';
}

/**
|--------------------------------------------------
| Create the Anthropic semantic formatting provider
|--------------------------------------------------
*/
const createAnthropicProvider = (options: AnthropicProviderOptions): FormatProvider => {
	/**
	|--------------------------------------------------
	| Resolve provider configuration with defaults
	|--------------------------------------------------
	*/
	const client = options.client;
	const effort = options.effort || 'low';
	const model = options.model || DEFAULT_ANTHROPIC_MODEL;
	const maxOutputTokens = options.maxOutputTokens || 16_000;

	/**
	|--------------------------------------------------
	| Return the Anthropic provider implementation
	|--------------------------------------------------
	*/
	return {
		id: 'anthropic',

		/**
		|--------------------------------------------------
		| Advertise Anthropic Opus capabilities
		|--------------------------------------------------
		*/
		capabilities: {
			streaming: true,
			systemPrompt: true,
			structuredOutput: true,
			contextWindow: 1_000_000,
			maxOutputTokens: 128_000,
			models: [model],
		},

		/**
		|--------------------------------------------------
		| Verify the provider can reach Anthropic
		|--------------------------------------------------
		*/
		async testConnection() {
			/**
			|--------------------------------------------------
			| Send a minimal request and report the outcome
			|--------------------------------------------------
			*/
			try {
				const message = await client.messages.create({
					model,
					max_tokens: 16,
					thinking: { type: 'adaptive' },
					system: 'Reply with the word OK.',
					messages: [{ role: 'user', content: 'ping' }],
				});

				/**
				|--------------------------------------------------
				| Report a reachable provider
				|--------------------------------------------------
				*/
				return {
					ok: true,
					model: message.model || model,
					message: 'Connected to Anthropic.',
				};
			} catch (error) {
				/**
				|--------------------------------------------------
				| Report the connection failure
				|--------------------------------------------------
				*/
				return {
					model,
					ok: false,
					message: error instanceof Error ? error.message : String(error),
				};
			}
		},

		/**
		|--------------------------------------------------
		| Estimate the cost of a token exchange
		|--------------------------------------------------
		*/
		estimateCost(usage: ProviderUsage, costModel?: string): CostEstimate {
			/**
			|--------------------------------------------------
			| Return the model-specific cost estimate
			|--------------------------------------------------
			*/
			return estimateModelCost(costModel || model, usage);
		},

		/**
		|--------------------------------------------------
		| Produce a structured semantic formatting response
		|--------------------------------------------------
		*/
		async formatSemantic(request: SemanticFormatRequest): Promise<SemanticFormatResponse> {
			/**
			|--------------------------------------------------
			| Request a structured formatting response
			|--------------------------------------------------
			*/
			const providerAttempts: ProviderAttempt[] = [];
			const initialRequest = buildAnthropicRequest(request, { model, effort, maxOutputTokens });
			let startedAt = Date.now();
			let message = await client.messages.create(initialRequest);
			providerAttempts.push(createAttempt(1, initialRequest, message, Date.now() - startedAt));
			let usage = readUsage(message.usage);

			/**
			|--------------------------------------------------
			| Retry one truncated response with a larger budget
			|--------------------------------------------------
			*/
			if (message.stop_reason === 'max_tokens') {
				const retryTokens = Math.min(
					maxOutputTokens,
					Math.max(initialRequest.max_tokens * 2, initialRequest.max_tokens + 2_048),
				);
				if (retryTokens > initialRequest.max_tokens) {
					const retryRequest = buildAnthropicRequest(request, {
						model,
						effort,
						maxOutputTokens,
						outputTokens: retryTokens,
					});
					startedAt = Date.now();
					const retry = await client.messages.create(retryRequest);
					providerAttempts.push(createAttempt(2, retryRequest, retry, Date.now() - startedAt));
					message = retry;
					usage = combineUsage(usage, readUsage(retry.usage));
				}
			}

			/**
			|--------------------------------------------------
			| Discard refusals and repeated truncation
			|--------------------------------------------------
			*/
			if (message.stop_reason === 'refusal') {
				return withAttempts(
					unchanged(request.source, message.model || model, usage, [
						'Anthropic returned no usable patch because the response stopped with reason "refusal".',
					]),
					providerAttempts,
				);
			}
			if (message.stop_reason === 'max_tokens') {
				return withAttempts(
					unchanged(request.source, message.model || model, usage, [
						'Anthropic returned no usable patch because the response reached the bounded token limit after one retry.',
					]),
					providerAttempts,
				);
			}

			/**
			|--------------------------------------------------
			| Parse the structured model output
			|--------------------------------------------------
			*/
			const output = parseModelOutput(collectText(message.content));
			if (!output) {
				return withAttempts(
					unchanged(request.source, message.model || model, usage, [
						'Anthropic response did not contain a valid structured patch.',
					]),
					providerAttempts,
				);
			}

			/**
			|--------------------------------------------------
			| Finalize the validated semantic patch
			|--------------------------------------------------
			*/
			return withAttempts(
				finalizeSemanticResponse(request, message.model || model, usage, output),
				providerAttempts,
			);
		},
	};
};

/**
|--------------------------------------------------
| Build the Anthropic formatting request
|--------------------------------------------------
*/
const buildAnthropicRequest = (
	request: SemanticFormatRequest,
	config: {
		model: string;
		effort: 'low' | 'medium' | 'high' | 'max';
		maxOutputTokens: number;
		outputTokens?: number;
	},
): AnthropicMessageRequest => {
	/**
	|--------------------------------------------------
	| Return the structured formatting request
	|--------------------------------------------------
	*/
	return {
		model: config.model,
		thinking: { type: 'adaptive' },
		max_tokens: config.outputTokens ?? resolveFormattingOutputTokens(request.source, config.maxOutputTokens),
		system: buildSemanticSystemPrompt(request),
		messages: [{ role: 'user', content: request.source }],
		output_config: { effort: config.effort, format: { type: 'json_schema', schema: MODEL_OUTPUT_JSON_SCHEMA } },
	};
};

/**
|--------------------------------------------------
| Collect text from response content blocks
|--------------------------------------------------
*/
const collectText = (content: AnthropicContentBlock[]): string => {
	/**
	|--------------------------------------------------
	| Concatenate every text content block
	|--------------------------------------------------
	*/
	return content
		.filter((block) => block.type === 'text' && typeof block.text === 'string')
		.map((block) => block.text)
		.join('');
};

/**
|--------------------------------------------------
| Convert Anthropic usage into provider usage
|--------------------------------------------------
*/
const readUsage = (usage: AnthropicUsage): ProviderUsage => {
	/**
	|--------------------------------------------------
	| Return normalized provider usage
	|--------------------------------------------------
	*/
	return {
		inputTokens: usage.input_tokens,
		outputTokens: usage.output_tokens,
		cacheReadTokens: usage.cache_read_input_tokens,
		cacheWriteTokens: usage.cache_creation_input_tokens,
	};
};

/**
|--------------------------------------------------
| Combine token usage across a bounded retry
|--------------------------------------------------
*/
const combineUsage = (first: ProviderUsage, second: ProviderUsage): ProviderUsage => ({
	inputTokens: first.inputTokens + second.inputTokens,
	outputTokens: first.outputTokens + second.outputTokens,
	cacheReadTokens:
		first.cacheReadTokens === undefined && second.cacheReadTokens === undefined
			? undefined
			: (first.cacheReadTokens ?? 0) + (second.cacheReadTokens ?? 0),
	cacheWriteTokens:
		first.cacheWriteTokens === undefined && second.cacheWriteTokens === undefined
			? undefined
			: (first.cacheWriteTokens ?? 0) + (second.cacheWriteTokens ?? 0),
});

const createAttempt = (
	index: number,
	request: AnthropicMessageRequest,
	message: AnthropicMessage,
	durationMs: number,
): ProviderAttempt => ({
	index,
	durationMs,
	maxOutputTokens: request.max_tokens,
	inputTokens: message.usage.input_tokens,
	outputTokens: message.usage.output_tokens,
	finishReason: message.stop_reason,
});

const withAttempts = (
	response: SemanticFormatResponse,
	providerAttempts: ProviderAttempt[],
): SemanticFormatResponse => ({
	...response,
	providerAttempts,
});

/**
|--------------------------------------------------
| Export Anthropic provider
|--------------------------------------------------
*/
export {
	buildAnthropicRequest,
	type AnthropicMessage,
	createAnthropicProvider,
	DEFAULT_ANTHROPIC_MODEL,
	type AnthropicMessagesClient,
	type AnthropicMessageRequest,
	type AnthropicProviderOptions,
};
