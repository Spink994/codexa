/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { z } from 'zod';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { buildStyleSystemPrompt } from './style-pack.js';
import type { ProviderUsage, SemanticFormatRequest, SemanticFormatResponse } from './types.js';

/**
|--------------------------------------------------
| Structured model output
|--------------------------------------------------
*/
interface ModelOutput {
	/**
	|--------------------------------------------------
	| Fully formatted source returned by the model
	|--------------------------------------------------
	*/
	formattedSource: string;

	/**
	|--------------------------------------------------
	| Warnings describing skipped or uncertain edits
	|--------------------------------------------------
	*/
	warnings: string[];
}

/**
|--------------------------------------------------
| Structured model output schema
|--------------------------------------------------
*/
const modelOutputSchema = z.object({
	/**
	|--------------------------------------------------
	| Fully formatted source returned by the model
	|--------------------------------------------------
	*/
	formattedSource: z.string(),

	/**
	|--------------------------------------------------
	| Warnings describing skipped or uncertain edits
	|--------------------------------------------------
	*/
	warnings: z.array(z.string()).default([]),
});

/**
|--------------------------------------------------
| Structured output JSON schema sent to providers
|--------------------------------------------------
*/
const MODEL_OUTPUT_JSON_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: ['formattedSource'],
	properties: { formattedSource: { type: 'string' }, warnings: { type: 'array', items: { type: 'string' } } },
};

/**
|--------------------------------------------------
| Size the model output budget to the source file
|--------------------------------------------------
*/
const resolveFormattingOutputTokens = (source: string, configuredMaximum: number): number => {
	/**
	|--------------------------------------------------
	| Leave room for comments without offering excess reasoning
	|--------------------------------------------------
	*/
	const sourceSizedBudget = Math.max(4_096, Math.ceil(source.length * 4));
	return Math.min(configuredMaximum, sourceSizedBudget);
};

/**
|--------------------------------------------------
| Build the semantic formatting system prompt
|--------------------------------------------------
*/
const buildSemanticSystemPrompt = (request: SemanticFormatRequest): string => {
	/**
	|--------------------------------------------------
	| Delegate to the house-style prompt builder
	|--------------------------------------------------
	*/
	return buildStyleSystemPrompt({
		path: request.path,
		source: request.source,
		symbols: request.symbols,
		language: request.language,
		guidance: request.guidance,
	});
};

/**
|--------------------------------------------------
| Parse the structured model output from text
|--------------------------------------------------
*/
const parseModelOutput = (text: string): ModelOutput | null => {
	/**
	|--------------------------------------------------
	| Reject empty model output
	|--------------------------------------------------
	*/
	if (!text.trim()) return null;

	/**
	|--------------------------------------------------
	| Parse and validate the structured JSON payload
	|--------------------------------------------------
	*/
	try {
		const parsed = modelOutputSchema.safeParse(JSON.parse(text));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
};

/**
|--------------------------------------------------
| Build an unchanged formatting response
|--------------------------------------------------
*/
const unchanged = (source: string, model: string, usage: ProviderUsage, warnings: string[]): SemanticFormatResponse => {
	/**
	|--------------------------------------------------
	| Return a behavior-preserving no-op response
	|--------------------------------------------------
	*/
	return {
		model,
		usage,
		edits: [],
		warnings,
		changed: false,
		formattedSource: source,
	};
};

/**
|--------------------------------------------------
| Finalize a structured semantic formatting response
|--------------------------------------------------
*/
const finalizeSemanticResponse = (
	request: SemanticFormatRequest,
	model: string,
	usage: ProviderUsage,
	output: ModelOutput,
): SemanticFormatResponse => {
	/**
	|--------------------------------------------------
	| Protect exported symbols from being dropped
	|--------------------------------------------------
	*/
	const droppedSymbol = request.symbols.find((symbol) => !output.formattedSource.includes(symbol));
	if (droppedSymbol) {
		return unchanged(request.source, model, usage, [
			`Semantic formatting was discarded because it dropped the required symbol "${droppedSymbol}".`,
		]);
	}

	/**
	|--------------------------------------------------
	| Return unchanged result when nothing changed
	|--------------------------------------------------
	*/
	if (output.formattedSource === request.source) {
		return unchanged(request.source, model, usage, output.warnings);
	}

	/**
	|--------------------------------------------------
	| Return a bounded whole-file semantic patch
	|--------------------------------------------------
	*/
	return {
		usage,
		model,
		changed: true,
		warnings: output.warnings,
		formattedSource: output.formattedSource,

		/**
		|--------------------------------------------------
		| ...
		|--------------------------------------------------
		*/
		edits: [
			{
				start: 0,
				end: request.source.length,
				text: output.formattedSource,
			},
		],
	};
};

/**
|--------------------------------------------------
| Export shared semantic formatting helpers
|--------------------------------------------------
*/
export {
	unchanged,
	parseModelOutput,
	type ModelOutput,
	finalizeSemanticResponse,
	MODEL_OUTPUT_JSON_SCHEMA,
	buildSemanticSystemPrompt,
	resolveFormattingOutputTokens,
};
