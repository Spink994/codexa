/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import process from 'node:process';

/**
|--------------------------------------------------
| Resolved GitHub OAuth and API configuration
|--------------------------------------------------
*/
export interface GithubConfig {
	/**
	|--------------------------------------------------
	| OAuth application client identifier
	|--------------------------------------------------
	*/
	clientId: string;

	/**
	|--------------------------------------------------
	| OAuth application client secret
	|--------------------------------------------------
	*/
	clientSecret: string;

	/**
	|--------------------------------------------------
	| Redirect URI registered with the OAuth app
	|--------------------------------------------------
	*/
	callbackUrl: string;

	/**
	|--------------------------------------------------
	| Space-separated OAuth scopes requested at login
	|--------------------------------------------------
	*/
	scopes: string;

	/**
	|--------------------------------------------------
	| Web origin the callback redirects back to
	|--------------------------------------------------
	*/
	webOrigin: string;
}

/**
|--------------------------------------------------
| Read GitHub configuration from the environment
|--------------------------------------------------
*/
export const readGithubConfig = (): GithubConfig => {
	/**
	|--------------------------------------------------
	| Resolve each value with a sensible local default
	|--------------------------------------------------
	*/
	return {
		clientId: process.env.CODEXA_GITHUB_CLIENT_ID || '',
		clientSecret: process.env.CODEXA_GITHUB_CLIENT_SECRET || '',
		callbackUrl: process.env.CODEXA_GITHUB_CALLBACK_URL || 'http://localhost:4000/auth/github/callback',
		scopes: process.env.CODEXA_GITHUB_SCOPES || 'repo read:user user:email',
		webOrigin: process.env.CODEXA_WEB_ORIGIN || 'http://localhost:3001',
	};
};

/**
|--------------------------------------------------
| Whether GitHub OAuth credentials are configured
|--------------------------------------------------
*/
export const isGithubConfigured = (config: GithubConfig): boolean => {
	/**
	|--------------------------------------------------
	| Both client credentials must be present
	|--------------------------------------------------
	*/
	return Boolean(config.clientId && config.clientSecret);
};
