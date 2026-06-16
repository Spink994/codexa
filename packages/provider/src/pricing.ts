/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import type { CostEstimate, ProviderUsage } from './types.js';

/**
|--------------------------------------------------
| Per-million-token model pricing
|--------------------------------------------------
*/
interface ModelPricing {
	/**
	|--------------------------------------------------
	| Cost per one million input tokens
	|--------------------------------------------------
	*/
	inputPerMillion: number;

	/**
	|--------------------------------------------------
	| Cost per one million output tokens
	|--------------------------------------------------
	*/
	outputPerMillion: number;

	/**
	|--------------------------------------------------
	| Cost per one million cache-read tokens
	|--------------------------------------------------
	*/
	cacheReadPerMillion?: number;

	/**
	|--------------------------------------------------
	| Cost per one million cache-write tokens
	|--------------------------------------------------
	*/
	cacheWritePerMillion?: number;
}

/**
|--------------------------------------------------
| Published model pricing in US dollars
|--------------------------------------------------
*/
const MODEL_PRICING: Record<string, ModelPricing> = {
	'reference': {
		inputPerMillion: 0,
		outputPerMillion: 0,
	},
	'claude-haiku-4-5': {
		inputPerMillion: 1,
		outputPerMillion: 5,
	},
	'claude-opus-4-8': {
		inputPerMillion: 5,
		outputPerMillion: 25,
	},
	'claude-sonnet-4-6': {
		inputPerMillion: 3,
		outputPerMillion: 15,
	},
};

/**
|--------------------------------------------------
| Estimate exchange cost for a model
|--------------------------------------------------
*/
const estimateModelCost = (model: string, usage: ProviderUsage): CostEstimate => {
	/**
	|--------------------------------------------------
	| Resolve pricing with a zero-cost fallback
	|--------------------------------------------------
	*/
	const pricing = MODEL_PRICING[model] || {
		inputPerMillion: 0,
		outputPerMillion: 0,
	};

	/**
	|--------------------------------------------------
	| Convert token counts into per-million costs
	|--------------------------------------------------
	*/
	const cacheReadTokens = usage.cacheReadTokens || 0;
	const cacheWriteTokens = usage.cacheWriteTokens || 0;
	const inputCost = perMillion(usage.inputTokens, pricing.inputPerMillion);
	const outputCost = perMillion(usage.outputTokens, pricing.outputPerMillion);
	const cacheReadCost = perMillion(cacheReadTokens, pricing.cacheReadPerMillion ?? pricing.inputPerMillion);
	const cacheWriteCost = perMillion(cacheWriteTokens, pricing.cacheWritePerMillion ?? pricing.inputPerMillion);

	/**
	|--------------------------------------------------
	| Return rounded cost estimate
	|--------------------------------------------------
	*/
	return {
		model,
		currency: 'USD',
		inputCost: round(inputCost + cacheReadCost + cacheWriteCost),
		outputCost: round(outputCost),
		totalCost: round(inputCost + cacheReadCost + cacheWriteCost + outputCost),
	};
};

/**
|--------------------------------------------------
| Convert a token count into a per-million cost
|--------------------------------------------------
*/
const perMillion = (tokens: number, rate: number): number => {
	/**
	|--------------------------------------------------
	| Return scaled token cost
	|--------------------------------------------------
	*/
	return (tokens / 1_000_000) * rate;
};

/**
|--------------------------------------------------
| Round a cost to six decimal places
|--------------------------------------------------
*/
const round = (value: number): number => {
	/**
	|--------------------------------------------------
	| Return stable rounded cost
	|--------------------------------------------------
	*/
	return Math.round(value * 1_000_000) / 1_000_000;
};

/**
|--------------------------------------------------
| Export pricing contracts
|--------------------------------------------------
*/
export { MODEL_PRICING, estimateModelCost, type ModelPricing };
