/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { estimateModelCost } from './pricing.js';
import type {
	CostEstimate,
	FormatProvider,
	ProviderUsage,
	SemanticFormatRequest,
	SemanticFormatResponse,
} from './types.js';

/**
|--------------------------------------------------
| Reference provider model identifier
|--------------------------------------------------
*/
const REFERENCE_MODEL = 'reference';

/**
|--------------------------------------------------
| Create the offline reference provider
|--------------------------------------------------
*/
const createReferenceProvider = (): FormatProvider => {
	/**
	|--------------------------------------------------
	| Return the conformance-baseline provider
	|--------------------------------------------------
	*/
	return {
		id: 'reference',

		/**
		|--------------------------------------------------
		| Advertise deterministic offline capabilities
		|--------------------------------------------------
		*/
		capabilities: {
			streaming: false,
			systemPrompt: true,
			contextWindow: 1_000_000,
			structuredOutput: true,
			maxOutputTokens: 128_000,
			models: [REFERENCE_MODEL],
		},

		/**
		|--------------------------------------------------
		| Report the offline provider as always reachable
		|--------------------------------------------------
		*/
		testConnection() {
			/**
			|--------------------------------------------------
			| Return a successful offline connection result
			|--------------------------------------------------
			*/
			return Promise.resolve({
				ok: true,
				model: REFERENCE_MODEL,
				message: 'Reference provider is available offline.',
			});
		},

		/**
		|--------------------------------------------------
		| Estimate the cost of a token exchange
		|--------------------------------------------------
		*/
		estimateCost(usage: ProviderUsage, model?: string): CostEstimate {
			/**
			|--------------------------------------------------
			| Return zero-cost estimate for the reference model
			|--------------------------------------------------
			*/
			return estimateModelCost(model || REFERENCE_MODEL, usage);
		},

		/**
		|--------------------------------------------------
		| Return a behavior-preserving no-op response
		|--------------------------------------------------
		*/
		formatSemantic(request: SemanticFormatRequest): Promise<SemanticFormatResponse> {
			/**
			|--------------------------------------------------
			| Return the source unchanged with empty usage
			|--------------------------------------------------
			*/
			return Promise.resolve({
				edits: [],
				changed: false,
				model: REFERENCE_MODEL,
				formattedSource: request.source,
				warnings: ['Reference provider performs no semantic formatting.'],
				usage: {
					inputTokens: 0,
					outputTokens: 0,
				},
			});
		},
	};
};

/**
|--------------------------------------------------
| Export reference provider
|--------------------------------------------------
*/
export { createReferenceProvider, REFERENCE_MODEL };
