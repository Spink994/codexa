/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import type { SourceLanguage, SourceTextEdit } from '@codexa/core';

/**
|--------------------------------------------------
| Supported AI provider identifier
|--------------------------------------------------
*/
type ProviderId = 'anthropic' | 'openai' | 'openai-compatible' | 'ollama' | 'reference';

/**
|--------------------------------------------------
| Provider capability descriptor
|--------------------------------------------------
*/
interface ProviderCapabilities {
	/**
	|--------------------------------------------------
	| Whether the provider can constrain output to a schema
	|--------------------------------------------------
	*/
	structuredOutput: boolean;

	/**
	|--------------------------------------------------
	| Whether the provider accepts a dedicated system prompt
	|--------------------------------------------------
	*/
	systemPrompt: boolean;

	/**
	|--------------------------------------------------
	| Whether the provider supports incremental streaming
	|--------------------------------------------------
	*/
	streaming: boolean;

	/**
	|--------------------------------------------------
	| Maximum output tokens the provider can return
	|--------------------------------------------------
	*/
	maxOutputTokens: number;

	/**
	|--------------------------------------------------
	| Total context window measured in tokens
	|--------------------------------------------------
	*/
	contextWindow: number;

	/**
	|--------------------------------------------------
	| Model identifiers the provider can serve
	|--------------------------------------------------
	*/
	models: string[];
}

/**
|--------------------------------------------------
| Semantic comment formatting guidance
|--------------------------------------------------
*/
interface SemanticFormatGuidance {
	/**
	|--------------------------------------------------
	| Comment syntax the provider should generate
	|--------------------------------------------------
	*/
	style: 'block' | 'jsdoc' | 'line';

	/**
	|--------------------------------------------------
	| Required amount of semantic detail in comments
	|--------------------------------------------------
	*/
	detail: 'concise' | 'detailed';

	/**
	|--------------------------------------------------
	| Whether every function receives a descriptive heading
	|--------------------------------------------------
	*/
	requireFunctionComments: boolean;

	/**
	|--------------------------------------------------
	| Whether DTO and entity properties receive headings
	|--------------------------------------------------
	*/
	requirePropertyComments: boolean;

	/**
	|--------------------------------------------------
	| Whether blocks after blank lines require headings
	|--------------------------------------------------
	*/
	requireBlankLineBoundaryComments: boolean;

	/**
	|--------------------------------------------------
	| Prettier-compatible code layout preferences
	|--------------------------------------------------
	*/
	formatting?: CodeFormatPreferences;
}

/**
|--------------------------------------------------
| Prettier-compatible code layout preferences
|--------------------------------------------------
*/
interface CodeFormatPreferences {
	tabWidth: number;
	useTabs: boolean;
	printWidth: number;
	semi: boolean;
	singleQuote: boolean;
	trailingComma: 'all' | 'es5' | 'none';
	bracketSpacing: boolean;
	arrowParens: 'always' | 'avoid';
	endOfLine: 'lf' | 'crlf' | 'auto';
}

/**
|--------------------------------------------------
| Semantic formatting request contract
|--------------------------------------------------
*/
interface SemanticFormatRequest {
	/**
	|--------------------------------------------------
	| Source file path used for provider diagnostics
	|--------------------------------------------------
	*/
	path: string;

	/**
	|--------------------------------------------------
	| Source language the provider must respect
	|--------------------------------------------------
	*/
	language: SourceLanguage;

	/**
	|--------------------------------------------------
	| Source text already passed through deterministic
	| formatting
	|--------------------------------------------------
	*/
	source: string;

	/**
	|--------------------------------------------------
	| Comment formatting guidance for the provider
	|--------------------------------------------------
	*/
	guidance: SemanticFormatGuidance;

	/**
	|--------------------------------------------------
	| Exported symbols that must survive formatting
	|--------------------------------------------------
	*/
	symbols: string[];
}

/**
|--------------------------------------------------
| Provider token usage report
|--------------------------------------------------
*/
interface ProviderUsage {
	/**
	|--------------------------------------------------
	| Tokens processed from the request input
	|--------------------------------------------------
	*/
	inputTokens: number;

	/**
	|--------------------------------------------------
	| Tokens generated in the provider response
	|--------------------------------------------------
	*/
	outputTokens: number;

	/**
	|--------------------------------------------------
	| Tokens served from the provider prompt cache
	|--------------------------------------------------
	*/
	cacheReadTokens?: number;

	/**
	|--------------------------------------------------
	| Tokens written to the provider prompt cache
	|--------------------------------------------------
	*/
	cacheWriteTokens?: number;
}

/**
|--------------------------------------------------
| One provider request made while formatting a file
|--------------------------------------------------
*/
interface ProviderAttempt {
	index: number;
	durationMs: number;
	inputTokens: number;
	outputTokens: number;
	maxOutputTokens: number;
	finishReason?: string;
}

/**
|--------------------------------------------------
| Structured semantic patch
|--------------------------------------------------
*/
interface SemanticPatch {
	/**
	|--------------------------------------------------
	| Bounded source edits proposed by the provider
	|--------------------------------------------------
	*/
	edits: SourceTextEdit[];

	/**
	|--------------------------------------------------
	| Warnings describing skipped or uncertain edits
	|--------------------------------------------------
	*/
	warnings: string[];
}

/**
|--------------------------------------------------
| Semantic formatting response contract
|--------------------------------------------------
*/
interface SemanticFormatResponse {
	/**
	|--------------------------------------------------
	| Whether the provider changed the source
	|--------------------------------------------------
	*/
	changed: boolean;

	/**
	|--------------------------------------------------
	| Complete formatted source preview
	|--------------------------------------------------
	*/
	formattedSource: string;

	/**
	|--------------------------------------------------
	| Bounded edits used to create the preview
	|--------------------------------------------------
	*/
	edits: SourceTextEdit[];

	/**
	|--------------------------------------------------
	| Warnings that do not invalidate the preview
	|--------------------------------------------------
	*/
	warnings: string[];

	/**
	|--------------------------------------------------
	| Model identifier that produced the response
	|--------------------------------------------------
	*/
	model: string;

	/**
	|--------------------------------------------------
	| Token usage reported for the response
	|--------------------------------------------------
	*/
	usage: ProviderUsage;

	/**
	|--------------------------------------------------
	| Individual provider calls including bounded retries
	|--------------------------------------------------
	*/
	providerAttempts?: ProviderAttempt[];
}

/**
|--------------------------------------------------
| Provider connection test result
|--------------------------------------------------
*/
interface ConnectionTestResult {
	/**
	|--------------------------------------------------
	| Whether the provider is reachable and usable
	|--------------------------------------------------
	*/
	ok: boolean;

	/**
	|--------------------------------------------------
	| Human-readable connection diagnostic
	|--------------------------------------------------
	*/
	message: string;

	/**
	|--------------------------------------------------
	| Model confirmed reachable when available
	|--------------------------------------------------
	*/
	model?: string;
}

/**
|--------------------------------------------------
| Estimated provider cost
|--------------------------------------------------
*/
interface CostEstimate {
	/**
	|--------------------------------------------------
	| Model the estimate was calculated for
	|--------------------------------------------------
	*/
	model: string;

	/**
	|--------------------------------------------------
	| Currency the estimate is denominated in
	|--------------------------------------------------
	*/
	currency: 'USD';

	/**
	|--------------------------------------------------
	| Estimated cost of the request input tokens
	|--------------------------------------------------
	*/
	inputCost: number;

	/**
	|--------------------------------------------------
	| Estimated cost of the response output tokens
	|--------------------------------------------------
	*/
	outputCost: number;

	/**
	|--------------------------------------------------
	| Estimated total cost of the exchange
	|--------------------------------------------------
	*/
	totalCost: number;
}

/**
|--------------------------------------------------
| Semantic formatting provider contract
|--------------------------------------------------
*/
interface FormatProvider {
	/**
	|--------------------------------------------------
	| Stable provider identifier
	|--------------------------------------------------
	*/
	id: ProviderId;

	/**
	|--------------------------------------------------
	| Capabilities advertised by the provider
	|--------------------------------------------------
	*/
	capabilities: ProviderCapabilities;

	/**
	|--------------------------------------------------
	| Verify the provider is reachable and usable
	|--------------------------------------------------
	*/
	testConnection(): Promise<ConnectionTestResult>;

	/**
	|--------------------------------------------------
	| Estimate the cost of a token exchange
	|--------------------------------------------------
	*/
	estimateCost(usage: ProviderUsage, model?: string): CostEstimate;

	/**
	|--------------------------------------------------
	| Produce a structured semantic formatting response
	|--------------------------------------------------
	*/
	formatSemantic(request: SemanticFormatRequest): Promise<SemanticFormatResponse>;
}

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
};
