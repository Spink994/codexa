/**
|--------------------------------------------------
| Export orchestrator contracts
|--------------------------------------------------
*/
export type {
	RunOptions,
	RunResult,
	PauseGate,
	UnitStatus,
	UnitResult,
	RunSnapshot,
	ResponseCache,
	VerifyBehavior,
	ConformanceCheck,
	ConformanceReport,
	VerifyConformance,
	StyleNormalizer,
	StyleNormalizationResult,
	FormattingUnit,
	UnitDependencies,
	CachedSemanticResponse,
	DeterministicFormatter,
	DeterministicFormattingResult,
} from './types.js';

/**
|--------------------------------------------------
| Export cache contracts
|--------------------------------------------------
*/
export { hashSource, buildCacheKey, createMemoryCache } from './cache.js';

/**
|--------------------------------------------------
| Export formatting unit runner
|--------------------------------------------------
*/
export { runFormattingUnit } from './unit.js';

/**
|--------------------------------------------------
| Export job plan builder
|--------------------------------------------------
*/
export { buildJobPlan, type PlanFile, type PlanModule, type JobPlan } from './plan.js';

/**
|--------------------------------------------------
| Export formatting run engine
|--------------------------------------------------
*/
export { runFormatting, createPauseGate } from './run.js';
