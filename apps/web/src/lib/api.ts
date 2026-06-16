/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { getToken } from './auth-token';
import type {
	RunState,
	AuthUser,
	RunSummary,
	RunHistoryQuery,
	RunHistoryResult,
	AuthResponse,
	ProviderConfig,
	PreviewResponse,
	ProviderDescriptor,
	CreateSnippetRequest,
	ConnectionTestResult,
	AccountSettings,
	SourceConnection,
	CodeFormatPreferences,
} from './types';

/**
|--------------------------------------------------
| Resolve the API base URL
|--------------------------------------------------
*/
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

/**
|--------------------------------------------------
| Error carrying the failed response status
|--------------------------------------------------
*/
export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = 'ApiError';
	}
}

/**
|--------------------------------------------------
| Build request headers with optional auth
|--------------------------------------------------
*/
export const authHeaders = (extra?: HeadersInit): HeadersInit => {
	/**
	|--------------------------------------------------
	| Attach the bearer token when present
	|--------------------------------------------------
	*/
	const token = getToken();
	return { ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra };
};

/**
|--------------------------------------------------
| Perform a JSON request against the API
|--------------------------------------------------
*/
const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
	/**
	|--------------------------------------------------
	| Send the request with JSON and auth headers
	|--------------------------------------------------
	*/
	const response = await fetch(`${API_BASE}${path}`, {
		...init,
		headers: authHeaders({ 'content-type': 'application/json', ...init?.headers }),
	});

	/**
	|--------------------------------------------------
	| Surface a readable error on failure
	|--------------------------------------------------
	*/
	if (!response.ok) {
		const body = await response.json().catch(() => ({}));
		throw new ApiError(body.message || `Request failed with ${response.status}`, response.status);
	}

	/**
	|--------------------------------------------------
	| Return the parsed JSON body
	|--------------------------------------------------
	*/
	return response.json() as Promise<T>;
};

/**
|--------------------------------------------------
| List the available providers
|--------------------------------------------------
*/
export const listProviders = (): Promise<ProviderDescriptor[]> => {
	/**
	|--------------------------------------------------
	| Read the provider catalogue
	|--------------------------------------------------
	*/
	return requestJson<ProviderDescriptor[]>('/providers');
};

/**
|--------------------------------------------------
| Test a provider configuration
|--------------------------------------------------
*/
export const testProvider = (config: ProviderConfig): Promise<ConnectionTestResult> => {
	/**
	|--------------------------------------------------
	| Post the configuration to the test endpoint
	|--------------------------------------------------
	*/
	return requestJson<ConnectionTestResult>('/providers/test', {
		method: 'POST',
		body: JSON.stringify(config),
	});
};

export const getSettings = (): Promise<AccountSettings> => requestJson<AccountSettings>('/settings');

export const updateSettings = (
	provider: ProviderConfig,
	styleProfile: string,
	formatting: CodeFormatPreferences,
): Promise<AccountSettings> =>
	requestJson<AccountSettings>('/settings', {
		method: 'PUT',
		body: JSON.stringify({ provider, styleProfile, formatting }),
	});

export const listConnections = (): Promise<SourceConnection[]> =>
	requestJson<SourceConnection[]>('/connections');

export const connectSource = (
	provider: SourceConnection['provider'],
	accessToken: string,
): Promise<Pick<SourceConnection, 'id' | 'provider' | 'connected'>> =>
	requestJson('/connections', {
		method: 'POST',
		body: JSON.stringify({ provider, accessToken }),
	});

export const disconnectSource = (provider: SourceConnection['provider']): Promise<{ removed: boolean }> =>
	requestJson(`/connections/${provider}`, { method: 'DELETE' });

/**
|--------------------------------------------------
| Create a run from a pasted snippet
|--------------------------------------------------
*/
export const createSnippetRun = (request: CreateSnippetRequest): Promise<RunState> => {
	/**
	|--------------------------------------------------
	| Post the snippet run request
	|--------------------------------------------------
	*/
	return requestJson<RunState>('/runs', {
		method: 'POST',
		body: JSON.stringify(request),
	});
};

/**
|--------------------------------------------------
| Create a run from an uploaded zip archive
|--------------------------------------------------
*/
export const createUploadRun = async (
	file: File,
	provider: ProviderConfig,
	formatting: CodeFormatPreferences,
): Promise<RunState> => {
	/**
	|--------------------------------------------------
	| Build the multipart upload payload
	|--------------------------------------------------
	*/
	const form = new FormData();
	form.append('file', file);
	form.append('provider', JSON.stringify(provider));
	form.append('formatting', JSON.stringify(formatting));

	/**
	|--------------------------------------------------
	| Post the archive and provider configuration
	|--------------------------------------------------
	*/
	const response = await fetch(`${API_BASE}/runs/upload`, {
		method: 'POST',
		body: form,
		headers: authHeaders(),
	});
	if (!response.ok) {
		const body = await response.json().catch(() => ({}));
		throw new Error(body.message || `Upload failed with ${response.status}`);
	}

	/**
	|--------------------------------------------------
	| Return the created run state
	|--------------------------------------------------
	*/
	return response.json() as Promise<RunState>;
};

/**
|--------------------------------------------------
| Create a run by cloning a git repository
|--------------------------------------------------
*/
export const createRepoRun = (
	provider: ProviderConfig,
	formatting: CodeFormatPreferences,
	repoUrl: string,
	token?: string,
): Promise<RunState> => {
	/**
	|--------------------------------------------------
	| Post the repository run request
	|--------------------------------------------------
	*/
	return requestJson<RunState>('/runs/repo', {
		method: 'POST',
		body: JSON.stringify({ provider, formatting, repoUrl, token: token || undefined }),
	});
};

/**
|--------------------------------------------------
| Preview an uploaded zip archive
|--------------------------------------------------
*/
export const previewUpload = async (file: File): Promise<PreviewResponse> => {
	/**
	|--------------------------------------------------
	| Post the archive for preview
	|--------------------------------------------------
	*/
	const form = new FormData();
	form.append('file', file);
	const response = await fetch(`${API_BASE}/intake/preview/upload`, {
		method: 'POST',
		body: form,
		headers: authHeaders(),
	});
	if (!response.ok) {
		const body = await response.json().catch(() => ({}));
		throw new Error(body.message || `Preview failed with ${response.status}`);
	}
	return response.json() as Promise<PreviewResponse>;
};

/**
|--------------------------------------------------
| Preview a git repository
|--------------------------------------------------
*/
export const previewRepo = (repoUrl: string, token?: string): Promise<PreviewResponse> => {
	/**
	|--------------------------------------------------
	| Post the repository for preview
	|--------------------------------------------------
	*/
	return requestJson<PreviewResponse>('/intake/preview/repo', {
		method: 'POST',
		body: JSON.stringify({ repoUrl, token: token || undefined }),
	});
};

/**
|--------------------------------------------------
| Read the original source files for a preview
|--------------------------------------------------
*/
export const getPreviewSources = (previewId: string): Promise<{ files: { path: string; source: string }[] }> => {
	/**
	|--------------------------------------------------
	| Fetch the full source set behind a preview
	|--------------------------------------------------
	*/
	return requestJson<{ files: { path: string; source: string }[] }>(`/intake/preview/${previewId}/sources`);
};

/**
|--------------------------------------------------
| Create a run from a selected preview
|--------------------------------------------------
*/
export const createFromPreview = (
	previewId: string,
	selectedPaths: string[],
	provider: ProviderConfig,
	formatting: CodeFormatPreferences,
): Promise<RunState> => {
	/**
	|--------------------------------------------------
	| Post the selection to start a run
	|--------------------------------------------------
	*/
	return requestJson<RunState>('/runs/from-preview', {
		method: 'POST',
		body: JSON.stringify({ previewId, selectedPaths, provider, formatting }),
	});
};

/**
|--------------------------------------------------
| Import locally-held runs into the signed-in account
|--------------------------------------------------
*/
export const importRuns = (runs: (RunState & { source?: string })[]): Promise<{ imported: number }> => {
	/**
	|--------------------------------------------------
	| Post the local runs to claim them server-side
	|--------------------------------------------------
	*/
	return requestJson<{ imported: number }>('/runs/import', {
		method: 'POST',
		body: JSON.stringify({ runs }),
	});
};

/**
|--------------------------------------------------
| List the current user's run history
|--------------------------------------------------
*/
export const listRuns = (query: RunHistoryQuery): Promise<RunHistoryResult> => {
	/**
	|--------------------------------------------------
	| Read the run history
	|--------------------------------------------------
	*/
	const params = new URLSearchParams({
		page: String(query.page),
		pageSize: String(query.pageSize),
	});
	if (query.search) params.set('search', query.search);
	if (query.from !== undefined) params.set('from', String(query.from));
	if (query.to !== undefined) params.set('to', String(query.to));
	return requestJson<RunHistoryResult>(`/runs?${params.toString()}`);
};

/**
|--------------------------------------------------
| Register a new account
|--------------------------------------------------
*/
export const registerUser = (email: string, password: string): Promise<AuthResponse> => {
	/**
	|--------------------------------------------------
	| Post the registration request
	|--------------------------------------------------
	*/
	return requestJson<AuthResponse>('/auth/register', {
		method: 'POST',
		body: JSON.stringify({ email, password }),
	});
};

/**
|--------------------------------------------------
| Log in to an existing account
|--------------------------------------------------
*/
export const loginUser = (email: string, password: string): Promise<AuthResponse> => {
	/**
	|--------------------------------------------------
	| Post the login request
	|--------------------------------------------------
	*/
	return requestJson<AuthResponse>('/auth/login', {
		method: 'POST',
		body: JSON.stringify({ email, password }),
	});
};

/**
|--------------------------------------------------
| Read the current authenticated user
|--------------------------------------------------
*/
export const getMe = (): Promise<{ authenticated: boolean; user?: AuthUser }> => {
	/**
	|--------------------------------------------------
	| Resolve the current session
	|--------------------------------------------------
	*/
	return requestJson<{ authenticated: boolean; user?: AuthUser }>('/auth/me');
};

/**
|--------------------------------------------------
| Read the current state of a run
|--------------------------------------------------
*/
export const getRun = (id: string): Promise<RunState> => {
	/**
	|--------------------------------------------------
	| Read the run by identifier
	|--------------------------------------------------
	*/
	return requestJson<RunState>(`/runs/${id}`);
};

/**
|--------------------------------------------------
| Apply a control action to a run
|--------------------------------------------------
*/
export const controlRun = (id: string, action: 'pause' | 'resume' | 'cancel'): Promise<RunState> => {
	/**
	|--------------------------------------------------
	| Post the control action
	|--------------------------------------------------
	*/
	return requestJson<RunState>(`/runs/${id}/${action}`, { method: 'POST' });
};
