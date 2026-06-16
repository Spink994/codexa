/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import type { FormatProvider } from './types.js';
import { createOpenAiProvider } from './openai-provider.js';
import type { ChatCompletionRequest, ChatCompletionResponse, ChatCompletionsTransport } from './openai-provider.js';

/**
|--------------------------------------------------
| Default OpenAI base URL
|--------------------------------------------------
*/
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';

/**
|--------------------------------------------------
| Default Ollama base URL
|--------------------------------------------------
*/
const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434/v1';

/**
|--------------------------------------------------
| Chat completions transport options
|--------------------------------------------------
*/
interface ChatTransportOptions {
	/**
	|--------------------------------------------------
	| Base URL of the chat completions endpoint
	|--------------------------------------------------
	*/
	baseURL: string;

	/**
	|--------------------------------------------------
	| Optional bearer token for authentication
	|--------------------------------------------------
	*/
	apiKey?: string;

	/**
	|--------------------------------------------------
	| Additional request headers
	|--------------------------------------------------
	*/
	headers?: Record<string, string>;
}

/**
|--------------------------------------------------
| Create a fetch-based chat completions transport
|--------------------------------------------------
*/
const createChatCompletionsTransport = (options: ChatTransportOptions): ChatCompletionsTransport => {
	/**
	|--------------------------------------------------
	| Resolve the completions endpoint URL
	|--------------------------------------------------
	*/
	const endpoint = `${options.baseURL.replace(/\/$/, '')}/chat/completions`;

	/**
	|--------------------------------------------------
	| Return the transport implementation
	|--------------------------------------------------
	*/
	return async (request: ChatCompletionRequest): Promise<ChatCompletionResponse> => {
		/**
		|--------------------------------------------------
		| Send the request to the completions endpoint
		|--------------------------------------------------
		*/
		const response = await fetch(endpoint, {
			method: 'POST',
			body: JSON.stringify(request),
			headers: {
				'content-type': 'application/json',
				...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {}),
				...options.headers,
			},
		});

		/**
		|--------------------------------------------------
		| Reject unsuccessful responses
		|--------------------------------------------------
		*/
		if (!response.ok) {
			throw new Error(`Chat completions request failed with status ${response.status}.`);
		}

		/**
		|--------------------------------------------------
		| Return the parsed completion response
		|--------------------------------------------------
		*/
		return (await response.json()) as ChatCompletionResponse;
	};
};

/**
|--------------------------------------------------
| Create an OpenAI provider from an API key
|--------------------------------------------------
*/
const createOpenAiProviderFromApiKey = (options: {
	apiKey: string;
	model?: string;
	baseURL?: string;
	maxOutputTokens?: number;
}): FormatProvider => {
	/**
	|--------------------------------------------------
	| Build the provider over a fetch transport
	|--------------------------------------------------
	*/
	return createOpenAiProvider({
		id: 'openai',
		structuredOutput: true,
		model: options.model || 'gpt-4o-mini',
		maxOutputTokens: options.maxOutputTokens,

		/**
		|--------------------------------------------------
		| Transport
		|--------------------------------------------------
		*/
		transport: createChatCompletionsTransport({
			apiKey: options.apiKey,
			baseURL: options.baseURL || DEFAULT_OPENAI_BASE_URL,
		}),
	});
};

/**
|--------------------------------------------------
| Create a provider for an OpenAI-compatible host
|--------------------------------------------------
*/
const createOpenAiCompatibleProvider = (options: {
	model: string;
	baseURL: string;
	apiKey?: string;
	maxOutputTokens?: number;
	structuredOutput?: boolean;
	headers?: Record<string, string>;
}): FormatProvider => {
	/**
	|--------------------------------------------------
	| Build the provider over a fetch transport
	|--------------------------------------------------
	*/
	return createOpenAiProvider({
		model: options.model,
		id: 'openai-compatible',
		maxOutputTokens: options.maxOutputTokens,
		structuredOutput: options.structuredOutput,

		/**
		|--------------------------------------------------
		| Transport
		|--------------------------------------------------
		*/
		transport: createChatCompletionsTransport({
			apiKey: options.apiKey,
			headers: options.headers,
			baseURL: options.baseURL,
		}),
	});
};

/**
|--------------------------------------------------
| Create a provider for a local Ollama host
|--------------------------------------------------
*/
const createOllamaProvider = (options: {
	model: string;
	baseURL?: string;
	apiKey?: string;
	structuredOutput?: boolean;
	maxOutputTokens?: number;
}): FormatProvider => {
	/**
	|--------------------------------------------------
	| Build the provider over a local fetch transport
	|--------------------------------------------------
	*/
	return createOpenAiProvider({
		id: 'ollama',
		model: options.model,
		maxOutputTokens: options.maxOutputTokens,
		structuredOutput: options.structuredOutput,

		/**
		|--------------------------------------------------
		| Transport
		|--------------------------------------------------
		*/
		transport: createChatCompletionsTransport({
			apiKey: options.apiKey || 'ollama',
			baseURL: options.baseURL || DEFAULT_OLLAMA_BASE_URL,
		}),
	});
};

/**
|--------------------------------------------------
| Export OpenAI-compatible HTTP integration
|--------------------------------------------------
*/
export {
	createOllamaProvider,
	DEFAULT_OPENAI_BASE_URL,
	DEFAULT_OLLAMA_BASE_URL,
	type ChatTransportOptions,
	createOpenAiProviderFromApiKey,
	createChatCompletionsTransport,
	createOpenAiCompatibleProvider,
};
