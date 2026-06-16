/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import Anthropic from '@anthropic-ai/sdk';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import type { FormatProvider } from './types.js';
import { createAnthropicProvider } from './anthropic-provider.js';
import type { AnthropicMessage, AnthropicMessageRequest, AnthropicMessagesClient } from './anthropic-provider.js';

/**
|--------------------------------------------------
| Anthropic SDK client options
|--------------------------------------------------
*/
interface AnthropicSdkOptions {
	/**
	|--------------------------------------------------
	| API key used to authenticate requests
	|--------------------------------------------------
	*/
	apiKey: string;

	/**
	|--------------------------------------------------
	| Optional base URL override for compatible hosts
	|--------------------------------------------------
	*/
	baseURL?: string;
}

/**
|--------------------------------------------------
| Anthropic provider options backed by the SDK
|--------------------------------------------------
*/
interface AnthropicSdkProviderOptions extends AnthropicSdkOptions {
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
| Adapt the official SDK to the messages client
|--------------------------------------------------
*/
const createAnthropicSdkClient = (options: AnthropicSdkOptions): AnthropicMessagesClient => {
	/**
	|--------------------------------------------------
	| Construct the official Anthropic SDK client
	|--------------------------------------------------
	*/
	const sdk = new Anthropic({
		apiKey: options.apiKey,
		baseURL: options.baseURL,
	});

	/**
	|--------------------------------------------------
	| Return the minimal messages-client adapter
	|--------------------------------------------------
	*/
	return {
		messages: {
			async create(request: AnthropicMessageRequest): Promise<AnthropicMessage> {
				/**
				|--------------------------------------------------
				| Forward the request through the official SDK
				|--------------------------------------------------
				*/
				const message = await sdk.messages.create(request as Parameters<typeof sdk.messages.create>[0]);

				/**
				|--------------------------------------------------
				| Return the response in the provider shape
				|--------------------------------------------------
				*/
				return message as unknown as AnthropicMessage;
			},
		},
	};
};

/**
|--------------------------------------------------
| Create an SDK-backed Anthropic provider
|--------------------------------------------------
*/
const createAnthropicProviderFromApiKey = (options: AnthropicSdkProviderOptions): FormatProvider => {
	/**
	|--------------------------------------------------
	| Build the provider over a live SDK client
	|--------------------------------------------------
	*/
	return createAnthropicProvider({
		model: options.model,
		effort: options.effort,
		maxOutputTokens: options.maxOutputTokens,

		/**
		|--------------------------------------------------
		| Client
		|--------------------------------------------------
		*/
		client: createAnthropicSdkClient({
			apiKey: options.apiKey,
			baseURL: options.baseURL,
		}),
	});
};

/**
|--------------------------------------------------
| Export Anthropic SDK integration
|--------------------------------------------------
*/
export {
	createAnthropicSdkClient,
	type AnthropicSdkOptions,
	createAnthropicProviderFromApiKey,
	type AnthropicSdkProviderOptions,
};
