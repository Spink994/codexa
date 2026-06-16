/**
|--------------------------------------------------
| Supported provider identifier
|--------------------------------------------------
*/
export type ProviderId = 'reference' | 'anthropic' | 'openai' | 'openai-compatible' | 'ollama';

/**
|--------------------------------------------------
| Provider configuration for a run
|--------------------------------------------------
*/
export interface ProviderConfig {
	id: ProviderId;
	model?: string;
	apiKey?: string;
	baseURL?: string;
	organization?: string;
	timeoutSeconds?: number;
	maxConcurrency?: number;
	effort?: 'low' | 'medium' | 'high' | 'max';
}

/**
|--------------------------------------------------
| Provider descriptor returned by the catalogue
|--------------------------------------------------
*/
export interface ProviderDescriptor {
	id: ProviderId;
	remote: boolean;
	requiresApiKey: boolean;
}

/**
|--------------------------------------------------
| Prettier-compatible code layout preferences
|--------------------------------------------------
*/
export interface CodeFormatPreferences {
	tabWidth: number;
	useTabs: boolean;
	printWidth: number;
	semi: boolean;
	singleQuote: boolean;
	trailingComma: 'all' | 'es5' | 'none';
	bracketSpacing: boolean;
	arrowParens: 'always' | 'avoid';
	endOfLine: 'lf' | 'crlf' | 'auto';
}

export const DEFAULT_FORMATTING: CodeFormatPreferences = {
	semi: true,
	useTabs: true,
	tabWidth: 4,
	printWidth: 120,
	singleQuote: true,
	trailingComma: 'all',
	bracketSpacing: true,
	arrowParens: 'always',
	endOfLine: 'lf',
};

/**
|--------------------------------------------------
| Connection test result
|--------------------------------------------------
*/
export interface ConnectionTestResult {
	ok: boolean;
	message: string;
	model?: string;
}

/**
|--------------------------------------------------
| Synced per-account application settings
|--------------------------------------------------
*/
export interface AccountSettings {
	userId: string;
	provider: ProviderConfig;
	styleProfile: string;
	formatting: CodeFormatPreferences;
	updatedAt: number;
}

/**
|--------------------------------------------------
| Redacted source-control connection summary
|--------------------------------------------------
*/
export interface SourceConnection {
	id: string;
	provider: 'github' | 'gitlab';
	createdAt: number;
	connected: true;
}

/**
|--------------------------------------------------
| Terminal and transient run status
|--------------------------------------------------
*/
export type RunStatus = 'queued' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';

/**
|--------------------------------------------------
| Per-file formatting result
|--------------------------------------------------
*/
export interface UnitResult {
	path: string;
	moduleId: string;
	status: 'formatted' | 'unchanged' | 'skipped' | 'failed' | 'stale' | 'cancelled';
	changed: boolean;
	originalSource: string;
	formattedSource: string;
	warnings: string[];
	attempts: number;
	model?: string;
	error?: string;
	usage?: { inputTokens: number; outputTokens: number };
	engine?: 'deterministic' | 'hybrid' | 'ai';
	durationMs?: number;
	providerAttempts?: {
		index: number;
		durationMs: number;
		inputTokens: number;
		outputTokens: number;
		maxOutputTokens: number;
		finishReason?: string;
	}[];
	conformance?: {
		passed: boolean;
		score: number;
		checks: {
			id: string;
			label: string;
			status: 'passed' | 'failed' | 'skipped';
			detail: string;
		}[];
	};
}

/**
|--------------------------------------------------
| Persisted state of a run
|--------------------------------------------------
*/
export interface RunState {
	id: string;
	status: RunStatus;
	createdAt: number;
	startedAt?: number;
	completedAt?: number;
	durationMs?: number;
	totalUnits: number;
	completedUnits: number;
	results: UnitResult[];
	error?: string;
}

/**
|--------------------------------------------------
| Server-sent run lifecycle event
|--------------------------------------------------
*/
export type RunEvent =
	| { type: 'run.created'; runId: string; totalUnits: number }
	| { type: 'run.started'; runId: string }
	| { type: 'unit.completed'; runId: string; result: UnitResult; completedUnits: number; totalUnits: number }
	| { type: 'run.completed'; runId: string; results: UnitResult[] }
	| { type: 'run.cancelled'; runId: string }
	| { type: 'run.failed'; runId: string; error: string };

/**
|--------------------------------------------------
| Snippet run creation request
|--------------------------------------------------
*/
export interface CreateSnippetRequest {
	provider: ProviderConfig;
	formatting: CodeFormatPreferences;
	intake: { kind: 'snippet'; filename: string; content: string };
}

/**
|--------------------------------------------------
| Authenticated user
|--------------------------------------------------
*/
export interface AuthUser {
	id: string;
	email: string;
}

/**
|--------------------------------------------------
| Authentication response
|--------------------------------------------------
*/
export interface AuthResponse {
	token: string;
	user: AuthUser;
}

/**
|--------------------------------------------------
| Previewed file metadata
|--------------------------------------------------
*/
export interface PreviewFile {
	path: string;
	language: string;
	estTokens: number;
}

/**
|--------------------------------------------------
| Previewed module
|--------------------------------------------------
*/
export interface PreviewModule {
	id: string;
	files: PreviewFile[];
}

/**
|--------------------------------------------------
| Intake preview response
|--------------------------------------------------
*/
export interface PreviewResponse {
	previewId: string;
	modules: PreviewModule[];
	totals: { files: number; estTokens: number };
}

/**
|--------------------------------------------------
| Run history summary
|--------------------------------------------------
*/
export interface RunSummary {
	id: string;
	source: string;
	status: RunStatus;
	createdAt: number;
	totalUnits: number;
	completedUnits: number;
	durationMs?: number;
}

export interface RunHistoryQuery {
	page: number;
	pageSize: number;
	search?: string;
	from?: number;
	to?: number;
}

export interface RunHistoryResult {
	items: RunSummary[];
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
}
