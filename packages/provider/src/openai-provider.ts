/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import type {
	ProviderId,
	CostEstimate,
	FormatProvider,
	ProviderUsage,
	SemanticFormatRequest,
	SemanticFormatResponse,
} from './types.js';
import {
	unchanged,
	parseModelOutput,
	finalizeSemanticResponse,
	MODEL_OUTPUT_JSON_SCHEMA,
	buildSemanticSystemPrompt,
	resolveFormattingOutputTokens,
} from './semantic-format.js';
import { estimateModelCost } from './pricing.js';

/**
|--------------------------------------------------
| Chat completion message
|--------------------------------------------------
*/
interface ChatMessage {
	/**
	|--------------------------------------------------
	| Message author role
	|--------------------------------------------------
	*/
	role: 'system' | 'user' | 'assistant';

	/**
	|--------------------------------------------------
	| Message text content
	|--------------------------------------------------
	*/
	content: string;
}

/**
|--------------------------------------------------
| Chat completion request
|--------------------------------------------------
*/
interface ChatCompletionRequest {
	/**
	|--------------------------------------------------
	| Model identifier to invoke
	|--------------------------------------------------
	*/
	model: string;

	/**
	|--------------------------------------------------
	| Conversation messages sent to the model
	|--------------------------------------------------
	*/
	messages: ChatMessage[];

	/**
	|--------------------------------------------------
	| Maximum output tokens for the response
	|--------------------------------------------------
	*/
	max_tokens?: number;

	/**
	|--------------------------------------------------
	| Structured or JSON response-format constraint
	|--------------------------------------------------
	*/
	response_format?:
		| { type: 'json_object' }
		| { type: 'json_schema'; json_schema: { name: string; strict: boolean; schema: unknown } };
}

/**
|--------------------------------------------------
| Chat completion choice
|--------------------------------------------------
*/
interface ChatCompletionChoice {
	/**
	|--------------------------------------------------
	| Generated assistant message
	|--------------------------------------------------
	*/
	message: { content: string | null };

	/**
	|--------------------------------------------------
	| Reason the choice stopped generating
	|--------------------------------------------------
	*/
	finish_reason?: string;
}

/**
|--------------------------------------------------
| Chat completion response
|--------------------------------------------------
*/
interface ChatCompletionResponse {
	/**
	|--------------------------------------------------
	| Model that produced the response
	|--------------------------------------------------
	*/
	model?: string;

	/**
	|--------------------------------------------------
	| Generated completion choices
	|--------------------------------------------------
	*/
	choices: ChatCompletionChoice[];

	/**
	|--------------------------------------------------
	| Token usage reported for the response
	|--------------------------------------------------
	*/
	usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
|--------------------------------------------------
| Chat completions transport
|--------------------------------------------------
*/
type ChatCompletionsTransport = (request: ChatCompletionRequest) => Promise<ChatCompletionResponse>;

/**
|--------------------------------------------------
| OpenAI-compatible provider options
|--------------------------------------------------
*/
interface OpenAiProviderOptions {
	/**
	|--------------------------------------------------
	| Injected chat completions transport
	|--------------------------------------------------
	*/
	transport: ChatCompletionsTransport;

	/**
	|--------------------------------------------------
	| Model identifier served by the endpoint
	|--------------------------------------------------
	*/
	model: string;

	/**
	|--------------------------------------------------
	| Provider identity for the endpoint variant
	|--------------------------------------------------
	*/
	id?: Extract<ProviderId, 'openai' | 'openai-compatible' | 'ollama'>;

	/**
	|--------------------------------------------------
	| Whether the endpoint supports JSON-schema output
	|--------------------------------------------------
	*/
	structuredOutput?: boolean;

	/**
	|--------------------------------------------------
	| Maximum output tokens for formatting requests
	|--------------------------------------------------
	*/
	maxOutputTokens?: number;

	/**
	|--------------------------------------------------
	| Advertised maximum output tokens
	|--------------------------------------------------
	*/
	capacityOutputTokens?: number;

	/**
	|--------------------------------------------------
	| Advertised context window in tokens
	|--------------------------------------------------
	*/
	contextWindow?: number;
}

/**
|--------------------------------------------------
| Create an OpenAI-compatible formatting provider
|--------------------------------------------------
*/
const createOpenAiProvider = (options: OpenAiProviderOptions): FormatProvider => {
	/**
	|--------------------------------------------------
	| Resolve provider configuration with defaults
	|--------------------------------------------------
	*/
	const model = options.model;
	const id = options.id || 'openai';
	const transport = options.transport;
	const contextWindow = options.contextWindow || 128_000;
	const maxOutputTokens = options.maxOutputTokens || 16_000;
	const structuredOutput = options.structuredOutput !== false;
	const capacityOutputTokens = options.capacityOutputTokens || 16_000;

	/**
	|--------------------------------------------------
	| Return the OpenAI-compatible provider
	|--------------------------------------------------
	*/
	return {
		id,

		/**
		|--------------------------------------------------
		| Advertise endpoint capabilities
		|--------------------------------------------------
		*/
		capabilities: {
			contextWindow,
			models: [model],
			structuredOutput,
			streaming: false,
			systemPrompt: true,
			maxOutputTokens: capacityOutputTokens,
		},

		/**
		|--------------------------------------------------
		| Verify the endpoint is reachable
		|--------------------------------------------------
		*/
		async testConnection() {
			/**
			|--------------------------------------------------
			| Send a minimal request and report the outcome
			|--------------------------------------------------
			*/
			try {
				const response = await transport({
					model,
					max_tokens: 16,
					messages: [
						{
							role: 'user',
							content: 'ping',
						},
					],
				});

				/**
				|--------------------------------------------------
				| Report a reachable endpoint
				|--------------------------------------------------
				*/
				return {
					ok: response.choices.length > 0,
					model: response.model || model,
					message:
						response.choices.length > 0
							? 'Connected to the chat completions endpoint.'
							: 'Endpoint returned no choices.',
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
			const chatRequest = buildChatRequest(request, {
				model,
				maxOutputTokens,
				structuredOutput,
			});
			const startedAt = Date.now();
			const response = await transport(chatRequest);
			const choice = response.choices[0];
			const usage = readUsage(response.usage);
			const responseModel = response.model || model;
			const providerAttempts = [
				{
					index: 1,
					inputTokens: usage.inputTokens,
					outputTokens: usage.outputTokens,
					maxOutputTokens: chatRequest.max_tokens ?? maxOutputTokens,
					durationMs: Date.now() - startedAt,
					finishReason: choice?.finish_reason,
				},
			];

			/**
			|--------------------------------------------------
			| Discard truncated responses
			|--------------------------------------------------
			*/
			if (choice?.finish_reason === 'length') {
				return {
					...unchanged(request.source, responseModel, usage, [
						'The endpoint returned no usable patch because the response was truncated.',
					]),
					providerAttempts,
				};
			}

			/**
			|--------------------------------------------------
			| Parse the structured model output
			|--------------------------------------------------
			*/
			const output = parseModelOutput(choice?.message.content || '');
			if (!output) {
				return {
					...unchanged(request.source, responseModel, usage, [
						'The endpoint response did not contain a valid structured patch.',
					]),
					providerAttempts,
				};
			}

			/**
			|--------------------------------------------------
			| Finalize the validated semantic patch
			|--------------------------------------------------
			*/
			return {
				...finalizeSemanticResponse(request, responseModel, usage, output),
				providerAttempts,
			};
		},
	};
};

/**
|--------------------------------------------------
| Build the chat completions formatting request
|--------------------------------------------------
*/
const buildChatRequest = (
	request: SemanticFormatRequest,
	config: { model: string; maxOutputTokens: number; structuredOutput: boolean },
): ChatCompletionRequest => {
	/**
	|--------------------------------------------------
	| Resolve the response-format constraint
	|--------------------------------------------------
	*/
	const responseFormat = config.structuredOutput
		? ({
				type: 'json_schema',
				json_schema: { strict: false, name: 'semantic_patch', schema: MODEL_OUTPUT_JSON_SCHEMA },
			} as const)
		: ({ type: 'json_object' } as const);

	/**
	|--------------------------------------------------
	| Return the structured formatting request
	|--------------------------------------------------
	*/
	return {
		model: config.model,
		response_format: responseFormat,
		max_tokens: resolveFormattingOutputTokens(request.source, config.maxOutputTokens),
		/**
		|--------------------------------------------------
		| Messages
		|--------------------------------------------------
		*/
		messages: [
			{ role: 'system', content: buildSemanticSystemPrompt(request) },
			{ role: 'user', content: request.source },
		],
	};
};

/**
|--------------------------------------------------
| Convert chat usage into provider usage
|--------------------------------------------------
*/
const readUsage = (usage: ChatCompletionResponse['usage']): ProviderUsage => {
	/**
	|--------------------------------------------------
	| Return normalized provider usage
	|--------------------------------------------------
	*/
	return {
		inputTokens: usage?.prompt_tokens || 0,
		outputTokens: usage?.completion_tokens || 0,
	};
};

/**
|--------------------------------------------------
| Export OpenAI-compatible provider
|--------------------------------------------------
*/
export {
	buildChatRequest,
	type ChatMessage,
	createOpenAiProvider,
	type OpenAiProviderOptions,
	type ChatCompletionRequest,
	type ChatCompletionResponse,
	type ChatCompletionsTransport,
};
