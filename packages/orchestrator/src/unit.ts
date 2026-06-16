/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { buildCacheKey } from './cache.js';
import type { CachedSemanticResponse, FormattingUnit, UnitDependencies, UnitResult } from './types.js';

/**
|--------------------------------------------------
| Format one unit entirely with the AI provider
|--------------------------------------------------
*/
const runFormattingUnit = async (
	unit: FormattingUnit,
	dependencies: UnitDependencies,
): Promise<UnitResult> => {
	const startedAt = Date.now();
	/**
	|--------------------------------------------------
	| Run the conservative deterministic pass first
	|--------------------------------------------------
	*/
	const deterministic = dependencies.deterministicFormatter?.(unit);
	const deterministicWarnings = [...(deterministic?.warnings ?? [])];
	const deterministicVerification =
		deterministic?.changed && dependencies.verifyBehavior
			? dependencies.verifyBehavior(unit.source, deterministic.formattedSource)
			: { equivalent: true };
	const deterministicAccepted = Boolean(deterministic?.changed && deterministicVerification.equivalent);

	if (deterministic?.changed && !deterministicVerification.equivalent) {
		deterministicWarnings.push(
			`Discarded deterministic formatting because it may change behavior: ${
				deterministicVerification.reason ?? 'structure diverged'
			}.`,
		);
	}

	/**
	|--------------------------------------------------
	| Skip AI when the deterministic formatter is complete
	|--------------------------------------------------
	*/
	if (deterministic?.complete && (deterministicAccepted || !deterministic.changed)) {
		const formattedSource = deterministicAccepted ? deterministic.formattedSource : unit.source;
		const changed = formattedSource !== unit.source;
		const conformance = dependencies.verifyConformance?.(unit, formattedSource);
		return {
			changed,
			attempts: 1,
			conformance,
			durationMs: Date.now() - startedAt,
			path: unit.path,
			moduleId: unit.moduleId,
			originalSource: unit.source,
			formattedSource,
			warnings: deterministicWarnings,
			engine: 'deterministic',
			status: changed ? 'formatted' : 'unchanged',
			edits: changed
				? [{ start: 0, end: unit.source.length, text: formattedSource }]
				: [],
		};
	}

	/**
	|--------------------------------------------------
	| Feed accepted mechanical formatting into the AI pass
	|--------------------------------------------------
	*/
	const semanticSource = deterministicAccepted ? deterministic!.formattedSource : unit.source;

	/**
	|--------------------------------------------------
	| Run the cached semantic formatting pass
	|--------------------------------------------------
	*/
	const semantic = await resolveSemanticResponse(unit, dependencies, semanticSource);
	const warnings = [...deterministicWarnings, ...semantic.warnings];
	const normalized =
		semantic.changed && dependencies.styleNormalizer
			? dependencies.styleNormalizer(unit, semantic.formattedSource)
			: { changed: false, formattedSource: semantic.formattedSource, transforms: [] };
	const semanticCandidate = normalized.formattedSource;

	/**
	|--------------------------------------------------
	| Verify the AI preview preserves runtime behavior
	|--------------------------------------------------
	*/
	const verification =
		semantic.changed && dependencies.verifyBehavior
			? dependencies.verifyBehavior(unit.source, semanticCandidate)
			: { equivalent: true };

	/**
	|--------------------------------------------------
	| Discard a preview that changed behavior
	|--------------------------------------------------
	*/
	if (!verification.equivalent) {
		warnings.push(
			`Discarded AI formatting because it may change behavior: ${verification.reason ?? 'structure diverged'}.`,
		);
	}

	/**
	|--------------------------------------------------
	| Resolve the final preview from the AI pass
	|--------------------------------------------------
	*/
	const accepted = semantic.changed && verification.equivalent;
	const formattedSource = accepted ? semanticCandidate : unit.source;
	const changed = formattedSource !== unit.source;
	const conformance = dependencies.verifyConformance?.(unit, formattedSource);
	if (conformance && !conformance.passed) {
		warnings.push(
			`Formatted output scored ${conformance.score}% against the executable style standard; review failed checks in the report.`,
		);
	}

	/**
	|--------------------------------------------------
	| Return the bounded whole-file unit result
	|--------------------------------------------------
	*/
	return {
		changed,
		warnings,
		attempts: 1,
		conformance,
		durationMs: Date.now() - startedAt,
		formattedSource,
		path: unit.path,
		usage: semantic.usage,
		providerAttempts: semantic.providerAttempts,
		model: semantic.model,
		engine: deterministicAccepted || normalized.changed ? 'hybrid' : 'ai',
		moduleId: unit.moduleId,
		originalSource: unit.source,
		status: changed ? 'formatted' : 'unchanged',
		edits: changed
			? [
					{
						start: 0,
						text: formattedSource,
						end: unit.source.length,
					},
				]
			: [],
	};
};

/**
|--------------------------------------------------
| Resolve a cached or fresh semantic response
|--------------------------------------------------
*/
const resolveSemanticResponse = async (
	unit: FormattingUnit,
	dependencies: UnitDependencies,
	source: string,
): Promise<CachedSemanticResponse> => {
	/**
	|--------------------------------------------------
	| Return a cached response when available
	|--------------------------------------------------
	*/
	const key = buildCacheKey(dependencies.provider, dependencies.guidance, source);
	const cached = dependencies.cache?.get(key);
	if (cached) return cached;

	/**
	|--------------------------------------------------
	| Join an identical request already in flight
	|--------------------------------------------------
	*/
	const pending = dependencies.inflight?.get(key);
	if (pending) return pending;

	/**
	|--------------------------------------------------
	| Request and cache a fresh semantic response
	|--------------------------------------------------
	*/
	const request = requestSemanticResponse(unit, dependencies, source, key);
	dependencies.inflight?.set(key, request);

	/**
	|--------------------------------------------------
	| Release the in-flight slot once settled
	|--------------------------------------------------
	*/
	try {
		return await request;
	} finally {
		dependencies.inflight?.delete(key);
	}
};

/**
|--------------------------------------------------
| Request and normalize a semantic response
|--------------------------------------------------
*/
const requestSemanticResponse = async (
	unit: FormattingUnit,
	dependencies: UnitDependencies,
	source: string,
	key: string,
): Promise<CachedSemanticResponse> => {
	/**
	|--------------------------------------------------
	| Request a fresh semantic formatting response
	|--------------------------------------------------
	*/
	const response = await dependencies.provider.formatSemantic({
		source,
		path: unit.path,
		symbols: unit.symbols,
		language: unit.language,
		guidance: dependencies.guidance,
	});

	/**
	|--------------------------------------------------
	| Store and return the normalized response
	|--------------------------------------------------
	*/
	const normalized: CachedSemanticResponse = {
		model: response.model,
		usage: response.usage,
		providerAttempts: response.providerAttempts,
		changed: response.changed,
		warnings: response.warnings,
		formattedSource: response.formattedSource,
	};
	dependencies.cache?.set(key, normalized);
	return normalized;
};

/**
|--------------------------------------------------
| Export formatting unit runner
|--------------------------------------------------
*/
export { runFormattingUnit };
