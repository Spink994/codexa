/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import type { UnitResult, PlanModule } from '@codexa/orchestrator';
import type { CodeFormatPreferences, ProviderId, SemanticFormatGuidance } from '@codexa/provider';

/**
|--------------------------------------------------
| Provider configuration supplied per run
|--------------------------------------------------
*/
interface ProviderConfig {
	/**
	|--------------------------------------------------
	| Provider identifier to instantiate
	|--------------------------------------------------
	*/
	id: ProviderId;

	/**
	|--------------------------------------------------
	| Model identifier when overriding the default
	|--------------------------------------------------
	*/
	model?: string;

	/**
	|--------------------------------------------------
	| Secret API key for remote providers
	|--------------------------------------------------
	*/
	apiKey?: string;

	/**
	|--------------------------------------------------
	| Base URL for compatible or local providers
	|--------------------------------------------------
	*/
	baseURL?: string;

	/**
	|--------------------------------------------------
	| Optional remote-provider organization identifier
	|--------------------------------------------------
	*/
	organization?: string;

	/**
	|--------------------------------------------------
	| Request timeout preference in seconds
	|--------------------------------------------------
	*/
	timeoutSeconds?: number;

	/**
	|--------------------------------------------------
	| Maximum concurrent provider requests
	|--------------------------------------------------
	*/
	maxConcurrency?: number;

	/**
	|--------------------------------------------------
	| Thinking and token effort level
	|--------------------------------------------------
	*/
	effort?: 'low' | 'medium' | 'high' | 'max';
}

/**
|--------------------------------------------------
| Pasted single-file intake
|--------------------------------------------------
*/
interface SnippetIntake {
	/**
	|--------------------------------------------------
	| Intake discriminator
	|--------------------------------------------------
	*/
	kind: 'snippet';

	/**
	|--------------------------------------------------
	| File name used for language detection and display
	|--------------------------------------------------
	*/
	filename: string;

	/**
	|--------------------------------------------------
	| Raw source content to format
	|--------------------------------------------------
	*/
	content: string;
}

/**
|--------------------------------------------------
| Request to create a formatting run
|--------------------------------------------------
*/
interface CreateRunRequest {
	/**
	|--------------------------------------------------
	| Provider configuration for the run
	|--------------------------------------------------
	*/
	provider: ProviderConfig;

	/**
	|--------------------------------------------------
	| Source intake describing what to format
	|--------------------------------------------------
	*/
	intake: SnippetIntake;

	/**
	|--------------------------------------------------
	| Comment guidance overriding the house defaults
	|--------------------------------------------------
	*/
	guidance?: Partial<SemanticFormatGuidance>;

	/**
	|--------------------------------------------------
	| Code layout preferences for semantic formatting
	|--------------------------------------------------
	*/
	formatting?: CodeFormatPreferences;
}

/**
|--------------------------------------------------
| Terminal and transient run status
|--------------------------------------------------
*/
type RunStatus = 'queued' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';

/**
|--------------------------------------------------
| Persisted state of a formatting run
|--------------------------------------------------
*/
interface RunState {
	/**
	|--------------------------------------------------
	| Stable run identifier
	|--------------------------------------------------
	*/
	id: string;

	/**
	|--------------------------------------------------
	| Current run status
	|--------------------------------------------------
	*/
	status: RunStatus;

	/**
	|--------------------------------------------------
	| Epoch milliseconds when the run was created
	|--------------------------------------------------
	*/
	createdAt: number;

	startedAt?: number;

	completedAt?: number;

	durationMs?: number;

	/**
	|--------------------------------------------------
	| Total number of files planned for the run
	|--------------------------------------------------
	*/
	totalUnits: number;

	/**
	|--------------------------------------------------
	| Number of files that have reached a result
	|--------------------------------------------------
	*/
	completedUnits: number;

	/**
	|--------------------------------------------------
	| Per-file results collected so far
	|--------------------------------------------------
	*/
	results: UnitResult[];

	/**
	|--------------------------------------------------
	| Failure message when the run could not complete
	|--------------------------------------------------
	*/
	error?: string;
}

/**
|--------------------------------------------------
| Server-sent run lifecycle event
|--------------------------------------------------
*/
type RunEvent =
	| { type: 'run.created'; runId: string; totalUnits: number }
	| { type: 'run.started'; runId: string }
	| { type: 'unit.completed'; runId: string; result: UnitResult; completedUnits: number; totalUnits: number }
	| { type: 'run.completed'; runId: string; results: UnitResult[] }
	| { type: 'run.cancelled'; runId: string }
	| { type: 'run.failed'; runId: string; error: string };

/**
|--------------------------------------------------
| Export run domain contracts
|--------------------------------------------------
*/
export type {
	RunEvent,
	RunState,
	RunStatus,
	PlanModule,
	ProviderConfig,
	SnippetIntake,
	CreateRunRequest,
};
