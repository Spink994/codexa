/**
|--------------------------------------------------
| Export provider contracts
|--------------------------------------------------
*/
export type {
	ProviderId,
	SemanticPatch,
	CostEstimate,
	FormatProvider,
	ProviderUsage,
	ProviderAttempt,
	ConnectionTestResult,
	ProviderCapabilities,
	SemanticFormatRequest,
	SemanticFormatGuidance,
	SemanticFormatResponse,
	CodeFormatPreferences,
} from './types.js';

/**
|--------------------------------------------------
| Export semantic patch contracts
|--------------------------------------------------
*/
export {
	semanticPatchSchema,
	parseSemanticPatch,
	safeParseSemanticPatch,
	applySemanticPatch,
} from './semantic-patch.js';

/**
|--------------------------------------------------
| Export pricing contracts
|--------------------------------------------------
*/
export { MODEL_PRICING, estimateModelCost, type ModelPricing } from './pricing.js';

/**
|--------------------------------------------------
| Export reference provider
|--------------------------------------------------
*/
export { createReferenceProvider, REFERENCE_MODEL } from './reference-provider.js';

/**
|--------------------------------------------------
| Export Anthropic provider
|--------------------------------------------------
*/
export {
	createAnthropicProvider,
	buildAnthropicRequest,
	DEFAULT_ANTHROPIC_MODEL,
	type AnthropicMessage,
	type AnthropicMessagesClient,
	type AnthropicMessageRequest,
	type AnthropicProviderOptions,
} from './anthropic-provider.js';

/**
|--------------------------------------------------
| Export Anthropic SDK integration
|--------------------------------------------------
*/
export {
	createAnthropicSdkClient,
	createAnthropicProviderFromApiKey,
	type AnthropicSdkOptions,
	type AnthropicSdkProviderOptions,
} from './anthropic-sdk.js';

/**
|--------------------------------------------------
| Export OpenAI-compatible provider
|--------------------------------------------------
*/
export {
	createOpenAiProvider,
	buildChatRequest,
	type ChatMessage,
	type OpenAiProviderOptions,
	type ChatCompletionRequest,
	type ChatCompletionResponse,
	type ChatCompletionsTransport,
} from './openai-provider.js';

/**
|--------------------------------------------------
| Export OpenAI-compatible HTTP integration
|--------------------------------------------------
*/
export {
	createOllamaProvider,
	createOpenAiProviderFromApiKey,
	createChatCompletionsTransport,
	createOpenAiCompatibleProvider,
	DEFAULT_OPENAI_BASE_URL,
	DEFAULT_OLLAMA_BASE_URL,
	type ChatTransportOptions,
} from './openai-http.js';

/**
|--------------------------------------------------
| Export shared semantic formatting helpers
|--------------------------------------------------
*/
export {
	buildSemanticSystemPrompt,
	MODEL_OUTPUT_JSON_SCHEMA,
} from './semantic-format.js';

/**
|--------------------------------------------------
| Export house-style prompt helpers
|--------------------------------------------------
*/
export {
	selectExamples,
	detectCategories,
	type StyleExample,
	type StyleCategory,
	buildStyleSystemPrompt,
} from './style-pack.js';

/**
|--------------------------------------------------
| Export generated style examples
|--------------------------------------------------
*/
export { STYLE_EXAMPLES } from './style-examples.generated.js';

/**
|--------------------------------------------------
| Export provider contract suite
|--------------------------------------------------
*/
export { runProviderContract, CONTRACT_REQUEST, type ContractResult } from './contract.js';
