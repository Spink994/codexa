/**
|--------------------------------------------------
| Local-storage key for the session token
|--------------------------------------------------
*/
const STORAGE_KEY = 'codexa.token';

/**
|--------------------------------------------------
| Read the stored session token
|--------------------------------------------------
*/
export function getToken(): string | null {
	/**
	|--------------------------------------------------
	| Guard against server-side rendering
	|--------------------------------------------------
	*/
	if (typeof window === 'undefined') return null;

	/**
	|--------------------------------------------------
	| Return the persisted token
	|--------------------------------------------------
	*/
	return window.localStorage.getItem(STORAGE_KEY);
}

/**
|--------------------------------------------------
| Persist the session token
|--------------------------------------------------
*/
export function setToken(token: string): void {
	/**
	|--------------------------------------------------
	| Store the token when running in the browser
	|--------------------------------------------------
	*/
	if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, token);
}

/**
|--------------------------------------------------
| Clear the stored session token
|--------------------------------------------------
*/
export function clearToken(): void {
	/**
	|--------------------------------------------------
	| Remove the token when running in the browser
	|--------------------------------------------------
	*/
	if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
}
