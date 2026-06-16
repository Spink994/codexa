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
import type { SemanticPatch } from './types.js';

/**
|--------------------------------------------------
| Bounded source-edit schema
|--------------------------------------------------
*/
const sourceTextEditSchema = z.object({
	/**
	|--------------------------------------------------
	| Zero-based offset where replacement begins
	|--------------------------------------------------
	*/
	start: z.number().int().nonnegative(),

	/**
	|--------------------------------------------------
	| Zero-based offset where replacement ends
	|--------------------------------------------------
	*/
	end: z.number().int().nonnegative(),

	/**
	|--------------------------------------------------
	| Replacement source text
	|--------------------------------------------------
	*/
	text: z.string(),
});

/**
|--------------------------------------------------
| Structured semantic patch schema
|--------------------------------------------------
*/
const semanticPatchSchema = z.object({
	/**
	|--------------------------------------------------
	| Bounded edits proposed by the provider
	|--------------------------------------------------
	*/
	edits: z.array(sourceTextEditSchema),

	/**
	|--------------------------------------------------
	| Warnings describing skipped or uncertain edits
	|--------------------------------------------------
	*/
	warnings: z.array(z.string()).default([]),
});

/**
|--------------------------------------------------
| Parse and validate a semantic patch
|--------------------------------------------------
*/
const parseSemanticPatch = (input: unknown): SemanticPatch => {
	/**
	|--------------------------------------------------
	| Return validated structured patch
	|--------------------------------------------------
	*/
	return semanticPatchSchema.parse(input);
};

/**
|--------------------------------------------------
| Safely validate a semantic patch
|--------------------------------------------------
*/
const safeParseSemanticPatch = (input: unknown) => {
	/**
	|--------------------------------------------------
	| Return validation result without throwing
	|--------------------------------------------------
	*/
	return semanticPatchSchema.safeParse(input);
};

/**
|--------------------------------------------------
| Apply a bounded semantic patch to source
|--------------------------------------------------
*/
const applySemanticPatch = (source: string, patch: SemanticPatch): string => {
	/**
	|--------------------------------------------------
	| Return unchanged source when patch is empty
	|--------------------------------------------------
	*/
	if (patch.edits.length === 0) return source;

	/**
	|--------------------------------------------------
	| Sort edits from last to first for safe splicing
	|--------------------------------------------------
	*/
	const ordered = [...patch.edits].sort((left, right) => right.start - left.start);

	/**
	|--------------------------------------------------
	| Reject edits that fall outside the source bounds
	|--------------------------------------------------
	*/
	let previousStart = source.length + 1;
	for (const edit of ordered) {
		if (edit.start > edit.end || edit.end > source.length) {
			throw new Error('Semantic patch contains an out-of-range edit.');
		}

		/**
		|--------------------------------------------------
		| Reject edits that overlap a later edit
		|--------------------------------------------------
		*/
		if (edit.end > previousStart) {
			throw new Error('Semantic patch contains overlapping edits.');
		}
		previousStart = edit.start;
	}

	/**
	|--------------------------------------------------
	| Apply edits from right to left
	|--------------------------------------------------
	*/
	return ordered.reduce(
		(current, edit) => `${current.slice(0, edit.start)}${edit.text}${current.slice(edit.end)}`,
		source,
	);
};

/**
|--------------------------------------------------
| Export semantic patch contracts
|--------------------------------------------------
*/
export { semanticPatchSchema, parseSemanticPatch, safeParseSemanticPatch, applySemanticPatch };
