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
import {
	DEFAULT_FORMATTING,
	type CodeFormatPreferences,
	type ProviderConfig,
	type PreviewResponse,
	type RunStatus,
} from '@/lib/types';
import type { FolderFile } from '@/lib/browser-zip';

/**
|--------------------------------------------------
| Transient toast notification
|--------------------------------------------------
*/
interface Toast {
	id: number;
	message: string;
	tone: 'success' | 'error' | 'info';
}

/**
|--------------------------------------------------
| A run the user has visited, kept for navigation
|--------------------------------------------------
*/
export interface RecentRun {
	id: string;
	status?: RunStatus;
	at: number;
}

/**
|--------------------------------------------------
| The original upload kept for folder reconstruction
|--------------------------------------------------
*/
export type UploadSource = { kind: 'folder'; files: FolderFile[] } | { kind: 'zip'; file: File };

/**
|--------------------------------------------------
| Persistence key and cap for recent runs
|--------------------------------------------------
*/
const RECENT_RUNS_KEY = 'codexa.recentRuns';
const RECENT_RUNS_MAX = 6;

/**
|--------------------------------------------------
| Available UI themes
|--------------------------------------------------
*/
export type Theme = 'dark' | 'light' | 'high-contrast';

/**
|--------------------------------------------------
| UI store shape
|--------------------------------------------------
*/
interface UiState {
	/**
	|--------------------------------------------------
	| Active UI theme
	|--------------------------------------------------
	*/
	theme: Theme;

	/**
	|--------------------------------------------------
	| Provider configuration for the next run
	|--------------------------------------------------
	*/
	provider: ProviderConfig;

	/**
	|--------------------------------------------------
	| Selected style profile for future runs
	|--------------------------------------------------
	*/
	styleProfile: string;

	/**
	|--------------------------------------------------
	| Code layout preferences for the next run
	|--------------------------------------------------
	*/
	formatting: CodeFormatPreferences;

	/**
	|--------------------------------------------------
	| Pending intake preview awaiting selection
	|--------------------------------------------------
	*/
	preview: PreviewResponse | null;

	/**
	|--------------------------------------------------
	| Persisted file selection for the current preview
	|--------------------------------------------------
	| Survives navigation so returning to selection keeps
	| the files chosen earlier, scoped to the preview id.
	|--------------------------------------------------
	*/
	selection: { previewId: string; paths: string[] } | null;

	/**
	|--------------------------------------------------
	| Original upload kept for folder reconstruction
	|--------------------------------------------------
	*/
	uploadSource: UploadSource | null;

	/**
	|--------------------------------------------------
	| Active toast notifications
	|--------------------------------------------------
	*/
	toasts: Toast[];

	/**
	|--------------------------------------------------
	| Recently visited runs, kept for navigation
	|--------------------------------------------------
	*/
	recentRuns: RecentRun[];

	/**
	|--------------------------------------------------
	| Apply and persist a theme
	|--------------------------------------------------
	*/
	setTheme: (theme: Theme) => void;

	/**
	|--------------------------------------------------
	| Store the pending intake preview
	|--------------------------------------------------
	*/
	setPreview: (preview: PreviewResponse | null) => void;

	/**
	|--------------------------------------------------
	| Persist the chosen file paths for a preview
	|--------------------------------------------------
	*/
	setSelection: (previewId: string, paths: string[]) => void;

	/**
	|--------------------------------------------------
	| Store the original upload for reconstruction
	|--------------------------------------------------
	*/
	setUploadSource: (source: UploadSource | null) => void;

	/**
	|--------------------------------------------------
	| Replace the provider configuration
	|--------------------------------------------------
	*/
	setProvider: (provider: ProviderConfig) => void;

	/**
	|--------------------------------------------------
	| Replace the selected style profile
	|--------------------------------------------------
	*/
	setStyleProfile: (styleProfile: string) => void;

	setFormatting: (formatting: CodeFormatPreferences) => void;

	/**
	|--------------------------------------------------
	| Apply a complete account settings snapshot
	|--------------------------------------------------
	*/
	applySettings: (
		provider: ProviderConfig,
		styleProfile: string,
		formatting?: CodeFormatPreferences,
	) => void;

	/**
	|--------------------------------------------------
	| Push a toast notification
	|--------------------------------------------------
	*/
	pushToast: (message: string, tone?: Toast['tone']) => void;

	/**
	|--------------------------------------------------
	| Dismiss a toast by identifier
	|--------------------------------------------------
	*/
	dismissToast: (id: number) => void;

	/**
	|--------------------------------------------------
	| Record a visited run for quick navigation
	|--------------------------------------------------
	*/
	trackRun: (id: string, status?: RunStatus) => void;

	/**
	|--------------------------------------------------
	| Load recent runs from local storage on the client
	|--------------------------------------------------
	*/
	hydrateRuns: () => void;
}

/**
|--------------------------------------------------
| Monotonic toast identifier source
|--------------------------------------------------
*/
let toastId = 0;

/**
|--------------------------------------------------
| Global UI store
|--------------------------------------------------
*/
export const useUiStore = create<UiState>((set) => ({
	/**
	|--------------------------------------------------
	| Default to the dark theme
	|--------------------------------------------------
	*/
	theme: 'dark',

	/**
	|--------------------------------------------------
	| Default to the offline reference provider
	|--------------------------------------------------
	*/
	provider: { id: 'reference' },
	styleProfile: 'team-default',
	formatting: DEFAULT_FORMATTING,
	preview: null,
	selection: null,
	uploadSource: null,
	toasts: [],
	recentRuns: [],

	/**
	|--------------------------------------------------
	| Store the pending intake preview
	|--------------------------------------------------
	*/
	setPreview: (preview) => set(preview ? { preview } : { preview: null, selection: null }),

	/**
	|--------------------------------------------------
	| Persist the chosen file paths for a preview
	|--------------------------------------------------
	*/
	setSelection: (previewId, paths) => set({ selection: { previewId, paths } }),

	/**
	|--------------------------------------------------
	| Store the original upload for reconstruction
	|--------------------------------------------------
	*/
	setUploadSource: (uploadSource) => set({ uploadSource }),

	/**
	|--------------------------------------------------
	| Apply and persist a theme
	|--------------------------------------------------
	*/
	setTheme: (theme) => {
		/**
		|--------------------------------------------------
		| Reflect the theme on the document and storage
		|--------------------------------------------------
		*/
		if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme;
		if (typeof window !== 'undefined') window.localStorage.setItem('codexa.theme', theme);
		set({ theme });
	},

	/**
	|--------------------------------------------------
	| Replace the provider configuration
	|--------------------------------------------------
	*/
	setProvider: (provider) => set({ provider }),

	setStyleProfile: (styleProfile) => set({ styleProfile }),

	setFormatting: (formatting) => set({ formatting }),

	applySettings: (provider, styleProfile, formatting = DEFAULT_FORMATTING) =>
		set({ provider, styleProfile, formatting }),

	/**
	|--------------------------------------------------
	| Push a toast notification
	|--------------------------------------------------
	*/
	pushToast: (message, tone = 'info') =>
		set((state) => ({ toasts: [...state.toasts, { id: (toastId += 1), message, tone }] })),

	/**
	|--------------------------------------------------
	| Dismiss a toast by identifier
	|--------------------------------------------------
	*/
	dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

	/**
	|--------------------------------------------------
	| Record a visited run for quick navigation
	|--------------------------------------------------
	*/
	trackRun: (id, status) =>
		set((state) => {
			/**
			|--------------------------------------------------
			| Move the run to the front and cap the list
			|--------------------------------------------------
			*/
			const next: RecentRun[] = [
				{ id, status, at: Date.now() },
				...state.recentRuns.filter((run) => run.id !== id),
			].slice(0, RECENT_RUNS_MAX);

			/**
			|--------------------------------------------------
			| Persist for future sessions
			|--------------------------------------------------
			*/
			if (typeof window !== 'undefined') {
				try {
					window.localStorage.setItem(RECENT_RUNS_KEY, JSON.stringify(next));
				} catch {
					/* ignore storage failures */
				}
			}

			return { recentRuns: next };
		}),

	/**
	|--------------------------------------------------
	| Load recent runs from local storage on the client
	|--------------------------------------------------
	*/
	hydrateRuns: () => {
		/**
		|--------------------------------------------------
		| Skip on the server where storage is unavailable
		|--------------------------------------------------
		*/
		if (typeof window === 'undefined') return;

		/**
		|--------------------------------------------------
		| Read and parse the persisted list
		|--------------------------------------------------
		*/
		try {
			const raw = window.localStorage.getItem(RECENT_RUNS_KEY);
			if (raw) set({ recentRuns: JSON.parse(raw) as RecentRun[] });
		} catch {
			/* ignore malformed storage */
		}
	},
}));
