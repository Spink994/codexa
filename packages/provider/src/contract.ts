/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { applySemanticPatch, safeParseSemanticPatch } from './semantic-patch.js';
import type { FormatProvider, SemanticFormatRequest, SemanticFormatResponse } from './types.js';

/**
|--------------------------------------------------
| Contract check result
|--------------------------------------------------
*/
interface ContractResult {
	/**
	|--------------------------------------------------
	| Name of the contract check
	|--------------------------------------------------
	*/
	name: string;

	/**
	|--------------------------------------------------
	| Whether the provider satisfied the check
	|--------------------------------------------------
	*/
	ok: boolean;

	/**
	|--------------------------------------------------
	| Explanation surfaced when the check fails
	|--------------------------------------------------
	*/
	detail?: string;
}

/**
|--------------------------------------------------
| Standard contract request fixture
|--------------------------------------------------
*/
const CONTRACT_REQUEST: SemanticFormatRequest = {
	path: 'contract.ts',
	symbols: ['value'],
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
| Run the shared semantic-formatting contract
|--------------------------------------------------
*/
const runProviderContract = async (provider: FormatProvider): Promise<ContractResult[]> => {
	/**
	|--------------------------------------------------
	| Collect contract results across every check
	|--------------------------------------------------
	*/
	const results: ContractResult[] = [];

	/**
	|--------------------------------------------------
	| Verify advertised capabilities are coherent
	|--------------------------------------------------
	*/
	const capabilities = provider.capabilities;
	results.push(
		check(
			'advertises usable capabilities',
			capabilities.models.length > 0 && capabilities.maxOutputTokens > 0 && capabilities.contextWindow > 0,
			'Capabilities must list at least one model and positive token limits.',
		),
	);

	/**
	|--------------------------------------------------
	| Verify connection testing returns a usable shape
	|--------------------------------------------------
	*/
	const connection = await provider.testConnection();
	results.push(
		check(
			'returns a connection test result',
			typeof connection.ok === 'boolean' && typeof connection.message === 'string',
			'testConnection must return an ok flag and a message.',
		),
	);

	/**
	|--------------------------------------------------
	| Verify cost estimation is internally consistent
	|--------------------------------------------------
	*/
	const estimate = provider.estimateCost({
		inputTokens: 1_000,
		outputTokens: 1_000,
	});
	results.push(
		check(
			'estimates a consistent cost',
			estimate.inputCost >= 0 &&
				estimate.outputCost >= 0 &&
				approximatelyEqual(estimate.totalCost, estimate.inputCost + estimate.outputCost),
			'totalCost must equal inputCost plus outputCost and never be negative.',
		),
	);

	/**
	|--------------------------------------------------
	| Format the contract fixture for response checks
	|--------------------------------------------------
	*/
	const response = await provider.formatSemantic(CONTRACT_REQUEST);
	results.push(...checkResponse(CONTRACT_REQUEST.source, response));

	/**
	|--------------------------------------------------
	| Verify idempotency across a second formatting pass
	|--------------------------------------------------
	*/
	const second = await provider.formatSemantic({
		...CONTRACT_REQUEST,
		source: response.formattedSource,
	});
	results.push(
		check(
			'produces idempotent formatting',
			second.formattedSource === response.formattedSource,
			'Reformatting an already-formatted source must not change it again.',
		),
	);

	/**
	|--------------------------------------------------
	| Return all contract results
	|--------------------------------------------------
	*/
	return results;
};

/**
|--------------------------------------------------
| Check the structure of a formatting response
|--------------------------------------------------
*/
const checkResponse = (source: string, response: SemanticFormatResponse): ContractResult[] => {
	/**
	|--------------------------------------------------
	| Validate the structured patch payload
	|--------------------------------------------------
	*/
	const patch = safeParseSemanticPatch({
		edits: response.edits,
		warnings: response.warnings,
	});
	const results: ContractResult[] = [
		check('returns a schema-valid patch', patch.success, 'edits and warnings must satisfy the patch schema.'),
	];

	/**
	|--------------------------------------------------
	| Validate usage counts are non-negative integers
	|--------------------------------------------------
	*/
	results.push(
		check(
			'reports non-negative usage',
			Number.isInteger(response.usage.inputTokens) &&
				Number.isInteger(response.usage.outputTokens) &&
				response.usage.inputTokens >= 0 &&
				response.usage.outputTokens >= 0,
			'usage must report non-negative integer token counts.',
		),
	);

	/**
	|--------------------------------------------------
	| Validate the model identifier is present
	|--------------------------------------------------
	*/
	results.push(
		check('names the responding model', response.model.length > 0, 'response.model must not be empty.'),
	);

	/**
	|--------------------------------------------------
	| Stop further checks when the patch is invalid
	|--------------------------------------------------
	*/
	if (!patch.success) return results;

	/**
	|--------------------------------------------------
	| Verify the preview matches the applied patch
	|--------------------------------------------------
	*/
	const previewMatches = safeApply(source, patch.data) === response.formattedSource;
	results.push(
		check(
			'preview matches applied edits',
			previewMatches,
			'formattedSource must equal the source with its own edits applied.',
		),
	);

	/**
	|--------------------------------------------------
	| Verify the changed flag matches the edit count
	|--------------------------------------------------
	*/
	results.push(
		check(
			'changed flag matches edits',
			response.changed === response.edits.length > 0,
			'changed must be true exactly when edits are present.',
		),
	);

	/**
	|--------------------------------------------------
	| Return response checks
	|--------------------------------------------------
	*/
	return results;
};

/**
|--------------------------------------------------
| Apply a patch without throwing on bad edits
|--------------------------------------------------
*/
const safeApply = (source: string, patch: { edits: { start: number; end: number; text: string }[]; warnings: string[] }): string | null => {
	/**
	|--------------------------------------------------
	| Return applied source or null on invalid edits
	|--------------------------------------------------
	*/
	try {
		return applySemanticPatch(source, patch);
	} catch {
		return null;
	}
};

/**
|--------------------------------------------------
| Build a single contract result
|--------------------------------------------------
*/
const check = (name: string, ok: boolean, detail: string): ContractResult => {
	/**
	|--------------------------------------------------
	| Return passing result without a detail message
	|--------------------------------------------------
	*/
	if (ok) {
		return {
			ok,
			name,
		};
	}

	/**
	|--------------------------------------------------
	| Return failing result with an explanation
	|--------------------------------------------------
	*/
	return {
		name,
		detail,
		ok: false,
	};
};

/**
|--------------------------------------------------
| Compare two costs within a rounding tolerance
|--------------------------------------------------
*/
const approximatelyEqual = (left: number, right: number): boolean => {
	/**
	|--------------------------------------------------
	| Return whether the values match within tolerance
	|--------------------------------------------------
	*/
	return Math.abs(left - right) < 0.000001;
};

/**
|--------------------------------------------------
| Export provider contract suite
|--------------------------------------------------
*/
export { runProviderContract, CONTRACT_REQUEST, type ContractResult };
