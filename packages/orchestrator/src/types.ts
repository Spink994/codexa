/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import type { SourceLanguage, SourceTextEdit } from '@codexa/core';
import type {
	FormatProvider,
	ProviderUsage,
	ProviderAttempt,
	SemanticFormatGuidance,
} from '@codexa/provider';

/**
|--------------------------------------------------
| Terminal state of a formatting unit
|--------------------------------------------------
*/
type UnitStatus = 'formatted' | 'unchanged' | 'skipped' | 'failed' | 'stale' | 'cancelled';

/**
|--------------------------------------------------
| Behavior-preservation verifier
|--------------------------------------------------
*/
type VerifyBehavior = (before: string, after: string) => { equivalent: boolean; reason?: string };

interface ConformanceCheck {
	id: string;
	label: string;
	status: 'passed' | 'failed' | 'skipped';
	detail: string;
}

interface ConformanceReport {
	passed: boolean;
	score: number;
	checks: ConformanceCheck[];
}

type VerifyConformance = (unit: FormattingUnit, formattedSource: string) => ConformanceReport;

interface StyleNormalizationResult {
	changed: boolean;
	formattedSource: string;
	transforms: string[];
}

type StyleNormalizer = (unit: FormattingUnit, formattedSource: string) => StyleNormalizationResult;

/**
|--------------------------------------------------
| Conservative deterministic formatting response
|--------------------------------------------------
*/
interface DeterministicFormattingResult {
	changed: boolean;
	complete: boolean;
	formattedSource: string;
	edits: SourceTextEdit[];
	warnings: string[];
	transforms: string[];
}

/**
|--------------------------------------------------
| Deterministic formatter composed into the engine
|--------------------------------------------------
*/
type DeterministicFormatter = (unit: FormattingUnit) => DeterministicFormattingResult;

/**
|--------------------------------------------------
| Single file formatting unit
|--------------------------------------------------
*/
interface FormattingUnit {
	/**
	|--------------------------------------------------
	| Absolute file path owned by the unit
	|--------------------------------------------------
	*/
	path: string;

	/**
	|--------------------------------------------------
	| Module the file belongs to
	|--------------------------------------------------
	*/
	moduleId: string;

	/**
	|--------------------------------------------------
	| Source language of the file
	|--------------------------------------------------
	*/
	language: SourceLanguage;

	/**
	|--------------------------------------------------
	| File source captured when the plan was built
	|--------------------------------------------------
	*/
	source: string;

	/**
	|--------------------------------------------------
	| Content hash expected at execution time
	|--------------------------------------------------
	*/
	contentHash: string;

	/**
	|--------------------------------------------------
	| Exported symbols that must survive formatting
	|--------------------------------------------------
	*/
	symbols: string[];
}

/**
|--------------------------------------------------
| Result of formatting one unit
|--------------------------------------------------
*/
interface UnitResult {
	/**
	|--------------------------------------------------
	| File path the result belongs to
	|--------------------------------------------------
	*/
	path: string;

	/**
	|--------------------------------------------------
	| Module the file belongs to
	|--------------------------------------------------
	*/
	moduleId: string;

	/**
	|--------------------------------------------------
	| Terminal state of the unit
	|--------------------------------------------------
	*/
	status: UnitStatus;

	/**
	|--------------------------------------------------
	| Whether formatting changed the source
	|--------------------------------------------------
	*/
	changed: boolean;

	/**
	|--------------------------------------------------
	| Original source captured before formatting
	|--------------------------------------------------
	*/
	originalSource: string;

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
	| Warnings collected across both formatting passes
	|--------------------------------------------------
	*/
	warnings: string[];

	/**
	|--------------------------------------------------
	| Number of attempts spent on the unit
	|--------------------------------------------------
	*/
	attempts: number;

	/**
	|--------------------------------------------------
	| Model that produced the semantic preview
	|--------------------------------------------------
	*/
	model?: string;

	/**
	|--------------------------------------------------
	| Token usage reported by the provider
	|--------------------------------------------------
	*/
	usage?: ProviderUsage;

	/**
	|--------------------------------------------------
	| Engine path that produced the final preview
	|--------------------------------------------------
	*/
	engine?: 'deterministic' | 'hybrid' | 'ai';

	/**
	|--------------------------------------------------
	| Total wall-clock time spent formatting this unit
	|--------------------------------------------------
	*/
	durationMs?: number;

	/**
	|--------------------------------------------------
	| Individual remote provider attempts
	|--------------------------------------------------
	*/
	providerAttempts?: ProviderAttempt[];

	/**
	|--------------------------------------------------
	| Executable house-style conformance evidence
	|--------------------------------------------------
	*/
	conformance?: ConformanceReport;

	/**
	|--------------------------------------------------
	| Failure message when the unit could not complete
	|--------------------------------------------------
	*/
	error?: string;
}

/**
|--------------------------------------------------
| Dependencies for formatting one unit
|--------------------------------------------------
*/
interface UnitDependencies {
	/**
	|--------------------------------------------------
	| Provider used for the semantic formatting pass
	|--------------------------------------------------
	*/
	provider: FormatProvider;

	/**
	|--------------------------------------------------
	| Comment formatting guidance for the provider
	|--------------------------------------------------
	*/
	guidance: SemanticFormatGuidance;

	/**
	|--------------------------------------------------
	| Optional behavior-preservation verifier
	|--------------------------------------------------
	*/
	verifyBehavior?: VerifyBehavior;

	/**
	|--------------------------------------------------
	| Optional executable style-conformance verifier
	|--------------------------------------------------
	*/
	verifyConformance?: VerifyConformance;

	styleNormalizer?: StyleNormalizer;

	/**
	|--------------------------------------------------
	| Optional conservative mechanical formatting pass
	|--------------------------------------------------
	*/
	deterministicFormatter?: DeterministicFormatter;

	/**
	|--------------------------------------------------
	| Optional response cache shared across units
	|--------------------------------------------------
	*/
	cache?: ResponseCache;

	/**
	|--------------------------------------------------
	| Shared in-flight requests deduplicated by cache key
	|--------------------------------------------------
	*/
	inflight?: Map<string, Promise<CachedSemanticResponse>>;
}

/**
|--------------------------------------------------
| Cached semantic response store
|--------------------------------------------------
*/
interface ResponseCache {
	/**
	|--------------------------------------------------
	| Read a cached semantic response
	|--------------------------------------------------
	*/
	get(key: string): CachedSemanticResponse | undefined;

	/**
	|--------------------------------------------------
	| Store a semantic response
	|--------------------------------------------------
	*/
	set(key: string, value: CachedSemanticResponse): void;
}

/**
|--------------------------------------------------
| Cached semantic response payload
|--------------------------------------------------
*/
interface CachedSemanticResponse {
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
	| Warnings reported by the provider
	|--------------------------------------------------
	*/
	warnings: string[];

	/**
	|--------------------------------------------------
	| Model that produced the response
	|--------------------------------------------------
	*/
	model: string;

	/**
	|--------------------------------------------------
	| Token usage reported by the provider
	|--------------------------------------------------
	*/
	usage: ProviderUsage;

	providerAttempts?: ProviderAttempt[];
}

/**
|--------------------------------------------------
| Pause gate controlling worker execution
|--------------------------------------------------
*/
interface PauseGate {
	/**
	|--------------------------------------------------
	| Pause workers before their next unit
	|--------------------------------------------------
	*/
	pause(): void;

	/**
	|--------------------------------------------------
	| Resume paused workers
	|--------------------------------------------------
	*/
	resume(): void;

	/**
	|--------------------------------------------------
	| Whether workers are currently paused
	|--------------------------------------------------
	*/
	isPaused(): boolean;

	/**
	|--------------------------------------------------
	| Resolve once workers may proceed
	|--------------------------------------------------
	*/
	wait(): Promise<void>;
}

/**
|--------------------------------------------------
| Recoverable run snapshot
|--------------------------------------------------
*/
interface RunSnapshot {
	/**
	|--------------------------------------------------
	| Snapshot schema version
	|--------------------------------------------------
	*/
	version: number;

	/**
	|--------------------------------------------------
	| Unit results keyed by file path
	|--------------------------------------------------
	*/
	results: Record<string, UnitResult>;
}

/**
|--------------------------------------------------
| Options for a formatting run
|--------------------------------------------------
*/
interface RunOptions {
	/**
	|--------------------------------------------------
	| Ordered formatting units to execute
	|--------------------------------------------------
	*/
	plan: FormattingUnit[];

	/**
	|--------------------------------------------------
	| Provider used for the semantic formatting pass
	|--------------------------------------------------
	*/
	provider: FormatProvider;

	/**
	|--------------------------------------------------
	| Comment formatting guidance for the provider
	|--------------------------------------------------
	*/
	guidance: SemanticFormatGuidance;

	/**
	|--------------------------------------------------
	| Optional behavior-preservation verifier
	|--------------------------------------------------
	*/
	verifyBehavior?: VerifyBehavior;

	/**
	|--------------------------------------------------
	| Optional executable style-conformance verifier
	|--------------------------------------------------
	*/
	verifyConformance?: VerifyConformance;

	styleNormalizer?: StyleNormalizer;

	/**
	|--------------------------------------------------
	| Optional conservative mechanical formatting pass
	|--------------------------------------------------
	*/
	deterministicFormatter?: DeterministicFormatter;

	/**
	|--------------------------------------------------
	| Maximum number of units formatted concurrently
	|--------------------------------------------------
	*/
	concurrency?: number;

	/**
	|--------------------------------------------------
	| Additional attempts allowed per failing unit
	|--------------------------------------------------
	*/
	retries?: number;

	/**
	|--------------------------------------------------
	| Shared response cache reused across units
	|--------------------------------------------------
	*/
	cache?: ResponseCache;

	/**
	|--------------------------------------------------
	| Signal that cancels remaining units when aborted
	|--------------------------------------------------
	*/
	signal?: AbortSignal;

	/**
	|--------------------------------------------------
	| Gate that pauses workers between units
	|--------------------------------------------------
	*/
	pause?: PauseGate;

	/**
	|--------------------------------------------------
	| Snapshot whose completed units are resumed
	|--------------------------------------------------
	*/
	snapshot?: RunSnapshot;

	/**
	|--------------------------------------------------
	| Reader used to detect stale files before formatting
	|--------------------------------------------------
	*/
	readSource?: (path: string) => Promise<string> | string;

	/**
	|--------------------------------------------------
	| Callback invoked as each unit reaches a result
	|--------------------------------------------------
	*/
	onResult?: (result: UnitResult) => void;
}

/**
|--------------------------------------------------
| Result of a formatting run
|--------------------------------------------------
*/
interface RunResult {
	/**
	|--------------------------------------------------
	| Unit results ordered by the original plan
	|--------------------------------------------------
	*/
	results: UnitResult[];

	/**
	|--------------------------------------------------
	| Whether the run was cancelled before finishing
	|--------------------------------------------------
	*/
	cancelled: boolean;

	/**
	|--------------------------------------------------
	| Recoverable snapshot of the run state
	|--------------------------------------------------
	*/
	snapshot: RunSnapshot;
}

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
};
