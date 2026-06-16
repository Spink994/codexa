/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import type { CodeFormatPreferences, SemanticFormatGuidance } from '@codexa/provider';
import type { ProviderConfig, RunState } from '../runs/run.types.js';

/**
|--------------------------------------------------
| Registered user account
|--------------------------------------------------
*/
export interface User {
	/**
	|--------------------------------------------------
	| Stable user identifier
	|--------------------------------------------------
	*/
	id: string;

	/**
	|--------------------------------------------------
	| Login email address
	|--------------------------------------------------
	*/
	email: string;

	/**
	|--------------------------------------------------
	| Salted password hash, absent for OAuth-only accounts
	|--------------------------------------------------
	*/
	passwordHash?: string;

	oauthProvider?: 'github';

	oauthId?: string;

	/**
	|--------------------------------------------------
	| Account creation timestamp in epoch millis
	|--------------------------------------------------
	*/
	createdAt: number;
}

/**
|--------------------------------------------------
| Source control provider for repo intake
|--------------------------------------------------
*/
export type ConnectionProvider = 'github' | 'gitlab';

/**
|--------------------------------------------------
| Stored source-control connection
|--------------------------------------------------
*/
export interface Connection {
	/**
	|--------------------------------------------------
	| Stable connection identifier
	|--------------------------------------------------
	*/
	id: string;

	/**
	|--------------------------------------------------
	| Owning user identifier
	|--------------------------------------------------
	*/
	userId: string;

	/**
	|--------------------------------------------------
	| Source-control provider
	|--------------------------------------------------
	*/
	provider: ConnectionProvider;

	/**
	|--------------------------------------------------
	| Access token used to clone private repositories
	|--------------------------------------------------
	*/
	accessToken: string;

	/**
	|--------------------------------------------------
	| Connection creation timestamp in epoch millis
	|--------------------------------------------------
	*/
	createdAt: number;
}

/**
|--------------------------------------------------
| Per-account application settings
|--------------------------------------------------
*/
export interface AccountSettings {
	/**
	|--------------------------------------------------
	| Owning user identifier and record key
	|--------------------------------------------------
	*/
	userId: string;

	/**
	|--------------------------------------------------
	| Provider selected for future formatting runs
	|--------------------------------------------------
	*/
	provider: ProviderConfig;

	/**
	|--------------------------------------------------
	| Selected style-profile identifier or built-in key
	|--------------------------------------------------
	*/
	styleProfile: string;

	/**
	|--------------------------------------------------
	| Code layout preferences supplied to the AI
	|--------------------------------------------------
	*/
	formatting: CodeFormatPreferences;

	/**
	|--------------------------------------------------
	| Last update timestamp in epoch millis
	|--------------------------------------------------
	*/
	updatedAt: number;
}

/**
|--------------------------------------------------
| Saved style-guidance preset
|--------------------------------------------------
*/
export interface Profile {
	/**
	|--------------------------------------------------
	| Stable profile identifier
	|--------------------------------------------------
	*/
	id: string;

	/**
	|--------------------------------------------------
	| Owning user identifier
	|--------------------------------------------------
	*/
	userId: string;

	/**
	|--------------------------------------------------
	| Human-readable profile name
	|--------------------------------------------------
	*/
	name: string;

	/**
	|--------------------------------------------------
	| Comment guidance overrides for the preset
	|--------------------------------------------------
	*/
	guidance: Partial<SemanticFormatGuidance>;

	/**
	|--------------------------------------------------
	| Profile creation timestamp in epoch millis
	|--------------------------------------------------
	*/
	createdAt: number;
}

/**
|--------------------------------------------------
| Persisted run record owned by a user
|--------------------------------------------------
*/
export interface RunRecord extends RunState {
	/**
	|--------------------------------------------------
	| Owning user identifier ("anonymous" when unauthenticated)
	|--------------------------------------------------
	*/
	userId: string;

	/**
	|--------------------------------------------------
	| Short label describing the intake source
	|--------------------------------------------------
	*/
	source: string;

	repository?: RepositorySource;

	/**
	|--------------------------------------------------
	| URL of the pull request opened from this run
	|--------------------------------------------------
	*/
	pullRequestUrl?: string;
}

export interface RepositorySource {
	provider: ConnectionProvider;
	owner: string;
	repo: string;
	url: string;
	baseBranch: string;
}
