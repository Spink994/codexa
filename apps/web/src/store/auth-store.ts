'use client';

/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { create } from 'zustand';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import type { AuthUser } from '@/lib/types';
import { setToken, clearToken } from '@/lib/auth-token';
import { listCachedRuns } from '@/lib/run-cache';
import { useUiStore } from '@/store/ui-store';
import { getMe, getSettings, updateSettings, loginUser, registerUser, importRuns } from '@/lib/api';

/**
|--------------------------------------------------
| Claim locally-cached runs into the account
|--------------------------------------------------
*/
const syncLocalRuns = async (): Promise<void> => {
	/**
	|--------------------------------------------------
	| Push any device-local runs to the server
	|--------------------------------------------------
	*/
	try {
		const cached = await listCachedRuns();
		if (cached.length > 0) await importRuns(cached);
	} catch {
		/* non-fatal — claim can be retried on next sign-in */
	}
};

const hydrateSettings = async (): Promise<void> => {
	const settings = await getSettings();
	useUiStore.getState().applySettings(settings.provider, settings.styleProfile, settings.formatting);
};

const promoteLocalSettings = async (): Promise<void> => {
	const { provider, styleProfile, formatting, applySettings } = useUiStore.getState();
	const settings = await updateSettings(provider, styleProfile, formatting);
	applySettings(settings.provider, settings.styleProfile, settings.formatting);
};

/**
|--------------------------------------------------
| Authentication store shape
|--------------------------------------------------
*/
interface AuthState {
	/**
	|--------------------------------------------------
	| Current user, or null when signed out
	|--------------------------------------------------
	*/
	user: AuthUser | null;

	/**
	|--------------------------------------------------
	| Whether the initial session check has resolved
	|--------------------------------------------------
	*/
	ready: boolean;

	/**
	|--------------------------------------------------
	| Resolve the session from a stored token
	|--------------------------------------------------
	*/
	bootstrap: () => Promise<void>;

	/**
	|--------------------------------------------------
	| Register a new account
	|--------------------------------------------------
	*/
	register: (email: string, password: string) => Promise<void>;

	/**
	|--------------------------------------------------
	| Log in to an existing account
	|--------------------------------------------------
	*/
	login: (email: string, password: string) => Promise<void>;

	/**
	|--------------------------------------------------
	| Complete an OAuth sign-in from a returned token
	|--------------------------------------------------
	*/
	completeOauth: (token: string) => Promise<void>;

	/**
	|--------------------------------------------------
	| Sign out and clear the token
	|--------------------------------------------------
	*/
	logout: () => void;
}

/**
|--------------------------------------------------
| Global authentication store
|--------------------------------------------------
*/
export const useAuthStore = create<AuthState>((set) => ({
	user: null,
	ready: false,

	/**
	|--------------------------------------------------
	| Resolve the session from a stored token
	|--------------------------------------------------
	*/
	bootstrap: async () => {
		/**
		|--------------------------------------------------
		| Ask the server who the current session belongs to
		|--------------------------------------------------
		*/
		try {
			const result = await getMe();
			set({ user: result.authenticated ? (result.user ?? null) : null, ready: true });
			if (result.authenticated) {
				try {
					await hydrateSettings();
				} catch {
					/* session remains valid when settings sync is temporarily unavailable */
				}
			}
		} catch {
			set({ user: null, ready: true });
		}
	},

	/**
	|--------------------------------------------------
	| Register a new account
	|--------------------------------------------------
	*/
	register: async (email, password) => {
		/**
		|--------------------------------------------------
		| Persist the token and set the user
		|--------------------------------------------------
		*/
		const result = await registerUser(email, password);
		setToken(result.token);
		set({ user: result.user, ready: true });
		try {
			await promoteLocalSettings();
		} catch {
			/* account exists; settings can sync on the next save */
		}
		void syncLocalRuns();
	},

	/**
	|--------------------------------------------------
	| Log in to an existing account
	|--------------------------------------------------
	*/
	login: async (email, password) => {
		/**
		|--------------------------------------------------
		| Persist the token and set the user
		|--------------------------------------------------
		*/
		const result = await loginUser(email, password);
		setToken(result.token);
		set({ user: result.user, ready: true });
		try {
			await hydrateSettings();
		} catch {
			/* keep the authenticated session and current device settings */
		}
		void syncLocalRuns();
	},

	/**
	|--------------------------------------------------
	| Complete an OAuth sign-in from a returned token
	|--------------------------------------------------
	*/
	completeOauth: async (token) => {
		/**
		|--------------------------------------------------
		| Persist the token, then resolve the session
		|--------------------------------------------------
		*/
		setToken(token);
		const result = await getMe();
		set({ user: result.authenticated ? (result.user ?? null) : null, ready: true });

		/**
		|--------------------------------------------------
		| Hydrate settings and claim any local runs
		|--------------------------------------------------
		*/
		if (result.authenticated) {
			try {
				await hydrateSettings();
			} catch {
				/* session remains valid when settings sync is temporarily unavailable */
			}
			void syncLocalRuns();
		}
	},

	/**
	|--------------------------------------------------
	| Sign out and clear the token
	|--------------------------------------------------
	*/
	logout: () => {
		/**
		|--------------------------------------------------
		| Clear the token and reset the user
		|--------------------------------------------------
		*/
		clearToken();
		set({ user: null });
		useUiStore.getState().applySettings({ id: 'reference' }, 'team-default');
	},
}));
