/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { runFormattingUnit } from './unit.js';
import { hashSource, createMemoryCache } from './cache.js';
import type { RunOptions, RunResult, PauseGate, UnitResult, FormattingUnit, CachedSemanticResponse } from './types.js';

/**
|--------------------------------------------------
| Create a pause gate for a formatting run
|--------------------------------------------------
*/
const createPauseGate = (): PauseGate => {
	/**
	|--------------------------------------------------
	| Track paused state and waiting resolvers
	|--------------------------------------------------
	*/
	let paused = false;
	let waiters: Array<() => void> = [];

	/**
	|--------------------------------------------------
	| Return the pause gate implementation
	|--------------------------------------------------
	*/
	return {
		pause() {
			paused = true;
		},
		isPaused() {
			return paused;
		},
		resume() {
			/**
			|--------------------------------------------------
			| Release every waiting worker
			|--------------------------------------------------
			*/
			const release = waiters;
			waiters = [];
			paused = false;
			release.forEach((resolve) => resolve());
		},
		wait() {
			/**
			|--------------------------------------------------
			| Resolve immediately unless paused
			|--------------------------------------------------
			*/
			if (!paused) return Promise.resolve();

			/**
			|--------------------------------------------------
			| Return
			|--------------------------------------------------
			*/
			return new Promise<void>((resolve) => {
				waiters.push(resolve);
			});
		},
	};
};

/**
|--------------------------------------------------
| Run a formatting plan with bounded concurrency
|--------------------------------------------------
*/
const runFormatting = async (options: RunOptions): Promise<RunResult> => {
	/**
	|--------------------------------------------------
	| Resolve run configuration with defaults
	|--------------------------------------------------
	*/
	const retries = options.retries ?? 2;
	const results = new Map<string, UnitResult>();
	const cache = options.cache ?? createMemoryCache();
	const inflight = new Map<string, Promise<CachedSemanticResponse>>();

	/**
	|--------------------------------------------------
	| Seed results from a resumed snapshot
	|--------------------------------------------------
	*/
	if (options.snapshot) {
		Object.values(options.snapshot.results).forEach((result) => results.set(result.path, result));
	}

	/**
	|--------------------------------------------------
	| Format only units that are not already complete
	|--------------------------------------------------
	*/
	const pending = options.plan.filter((unit) => !isComplete(results.get(unit.path)));
	const workerCount = Math.max(1, Math.min(options.concurrency ?? 8, pending.length || 1));
	let cursor = 0;
	let cancelled = false;

	/**
	|--------------------------------------------------
	| Define a single bounded worker
	|--------------------------------------------------
	*/
	const worker = async () => {
		/**
		|--------------------------------------------------
		| Pull and format units until the plan is drained
		|--------------------------------------------------
		*/
		for (;;) {
			/**
			|--------------------------------------------------
			| Stop pulling work once cancelled
			|--------------------------------------------------
			*/
			if (options.signal?.aborted) {
				cancelled = true;
				return;
			}

			/**
			|--------------------------------------------------
			| Wait while the run is paused
			|--------------------------------------------------
			*/
			await options.pause?.wait();
			if (options.signal?.aborted) {
				cancelled = true;
				return;
			}

			/**
			|--------------------------------------------------
			| Claim the next unit by advancing the cursor
			|--------------------------------------------------
			*/
			const index = cursor;
			cursor += 1;
			const unit = pending[index];
			if (!unit) return;

			/**
			|--------------------------------------------------
			| Format the claimed unit and record the result
			|--------------------------------------------------
			*/
			const result = await formatUnit(unit, options, cache, inflight, retries);
			results.set(unit.path, result);
			options.onResult?.(result);
		}
	};

	/**
	|--------------------------------------------------
	| Run every worker to completion
	|--------------------------------------------------
	*/
	await Promise.all(Array.from({ length: workerCount }, () => worker()));

	/**
	|--------------------------------------------------
	| Mark unprocessed units as cancelled
	|--------------------------------------------------
	*/
	if (cancelled) {
		pending.forEach((unit) => {
			if (!results.has(unit.path)) results.set(unit.path, cancelledResult(unit));
		});
	}

	/**
	|--------------------------------------------------
	| Return ordered results and a recoverable snapshot
	|--------------------------------------------------
	*/
	const ordered = options.plan.map((unit) => results.get(unit.path)).filter(isResult);
	return {
		cancelled,
		results: ordered,
		snapshot: {
			version: 1,
			results: Object.fromEntries(ordered.map((result) => [result.path, result])),
		},
	};
};

/**
|--------------------------------------------------
| Format a unit with staleness and retry handling
|--------------------------------------------------
*/
const formatUnit = async (
	unit: FormattingUnit,
	options: RunOptions,
	cache: NonNullable<RunOptions['cache']>,
	inflight: Map<string, Promise<CachedSemanticResponse>>,
	retries: number,
): Promise<UnitResult> => {
	/**
	|--------------------------------------------------
	| Detect files that changed since the plan was built
	|--------------------------------------------------
	*/
	let source = unit.source;
	if (options.readSource) {
		const current = await options.readSource(unit.path);
		if (hashSource(current) !== unit.contentHash) return staleResult(unit, current);
		source = current;
	}

	/**
	|--------------------------------------------------
	| Attempt formatting until it succeeds or exhausts retries
	|--------------------------------------------------
	*/
	let lastError = '';
	for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
		try {
			const result = await runFormattingUnit(
				{
					...unit,
					source,
				},
				{
					cache,
					inflight,
					provider: options.provider,
					guidance: options.guidance,
					verifyBehavior: options.verifyBehavior,
					verifyConformance: options.verifyConformance,
					styleNormalizer: options.styleNormalizer,
					deterministicFormatter: options.deterministicFormatter,
				},
			);

			/**
			|--------------------------------------------------
			| Return the successful result with attempt count
			|--------------------------------------------------
			*/
			return {
				...result,
				attempts: attempt,
			};
		} catch (error) {
			lastError = error instanceof Error ? error.message : String(error);
		}
	}

	/**
	|--------------------------------------------------
	| Return a failed result after exhausting retries
	|--------------------------------------------------
	*/
	return failedResult(unit, source, retries + 1, lastError);
};

/**
|--------------------------------------------------
| Determine whether a unit result is complete
|--------------------------------------------------
*/
const isComplete = (result: UnitResult | undefined): boolean => {
	/**
	|--------------------------------------------------
	| Treat formatted and unchanged units as complete
	|--------------------------------------------------
	*/
	return result?.status === 'formatted' || result?.status === 'unchanged';
};

/**
|--------------------------------------------------
| Narrow defined unit results
|--------------------------------------------------
*/
const isResult = (result: UnitResult | undefined): result is UnitResult => {
	/**
	|--------------------------------------------------
	| Return whether the result is defined
	|--------------------------------------------------
	*/
	return result !== undefined;
};

/**
|--------------------------------------------------
| Build a stale unit result
|--------------------------------------------------
*/
const staleResult = (unit: FormattingUnit, currentSource: string): UnitResult => {
	/**
	|--------------------------------------------------
	| Return a skipped result for a changed file
	|--------------------------------------------------
	*/
	return {
		edits: [],
		attempts: 0,
		changed: false,
		status: 'stale',
		path: unit.path,
		moduleId: unit.moduleId,
		originalSource: unit.source,
		formattedSource: currentSource,
		warnings: ['Formatting skipped because the file changed after the plan was built.'],
	};
};

/**
|--------------------------------------------------
| Build a cancelled unit result
|--------------------------------------------------
*/
const cancelledResult = (unit: FormattingUnit): UnitResult => {
	/**
	|--------------------------------------------------
	| Return a cancelled result preserving the source
	|--------------------------------------------------
	*/
	return {
		edits: [],
		warnings: [],
		attempts: 0,
		changed: false,
		path: unit.path,
		status: 'cancelled',
		moduleId: unit.moduleId,
		originalSource: unit.source,
		formattedSource: unit.source,
	};
};

/**
|--------------------------------------------------
| Build a failed unit result
|--------------------------------------------------
*/
const failedResult = (unit: FormattingUnit, source: string, attempts: number, error: string): UnitResult => {
	/**
	|--------------------------------------------------
	| Return a failed result preserving the source
	|--------------------------------------------------
	*/
	return {
		error,
		attempts,
		edits: [],
		changed: false,
		status: 'failed',
		path: unit.path,
		formattedSource: source,
		moduleId: unit.moduleId,
		originalSource: unit.source,
		warnings: [`Formatting failed after ${attempts} attempts: ${error}`],
	};
};

/**
|--------------------------------------------------
| Export formatting run engine
|--------------------------------------------------
*/
export { runFormatting, createPauseGate };
