'use client';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import type { RunState, RunSummary } from './types';

/**
|--------------------------------------------------
| IndexedDB configuration for cached runs
|--------------------------------------------------
*/
const DB_NAME = 'codexa-runs';
const STORE = 'runs';
const VERSION = 1;
const MAX_RUNS = 50;

/**
|--------------------------------------------------
| A run cached locally, with its intake label
|--------------------------------------------------
*/
export type CachedRun = RunState & { source?: string; savedAt: number };

/**
|--------------------------------------------------
| Promisify an IndexedDB request
|--------------------------------------------------
*/
const promisify = <T>(request: IDBRequest<T>): Promise<T> => {
	/**
	|--------------------------------------------------
	| Resolve on success, reject on error
	|--------------------------------------------------
	*/
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
};

/**
|--------------------------------------------------
| Open (and upgrade) the run cache database
|--------------------------------------------------
*/
const openDb = (): Promise<IDBDatabase> => {
	/**
	|--------------------------------------------------
	| Create the run object store on first use
	|--------------------------------------------------
	*/
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
};

/**
|--------------------------------------------------
| Cache a run locally, pruning the oldest beyond the cap
|--------------------------------------------------
*/
export async function saveRun(run: RunState & { source?: string }): Promise<void> {
	/**
	|--------------------------------------------------
	| Skip when storage is unavailable
	|--------------------------------------------------
	*/
	if (typeof indexedDB === 'undefined') return;

	/**
	|--------------------------------------------------
	| Write the run, then prune the oldest records
	|--------------------------------------------------
	*/
	const db = await openDb();
	try {
		const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
		await promisify(store.put({ ...run, savedAt: Date.now() } satisfies CachedRun));
		const all = (await promisify(store.getAll())) as CachedRun[];
		for (const stale of all.sort((a, b) => b.savedAt - a.savedAt).slice(MAX_RUNS)) store.delete(stale.id);
	} finally {
		db.close();
	}
}

/**
|--------------------------------------------------
| Load a single cached run by id
|--------------------------------------------------
*/
export async function loadRun(id: string): Promise<CachedRun | null> {
	/**
	|--------------------------------------------------
	| Skip when storage is unavailable
	|--------------------------------------------------
	*/
	if (typeof indexedDB === 'undefined') return null;

	/**
	|--------------------------------------------------
	| Read the run record
	|--------------------------------------------------
	*/
	const db = await openDb();
	try {
		const store = db.transaction(STORE, 'readonly').objectStore(STORE);
		return ((await promisify(store.get(id))) as CachedRun | undefined) ?? null;
	} finally {
		db.close();
	}
}

/**
|--------------------------------------------------
| List all cached runs, newest first
|--------------------------------------------------
*/
export async function listCachedRuns(): Promise<CachedRun[]> {
	/**
	|--------------------------------------------------
	| Skip when storage is unavailable
	|--------------------------------------------------
	*/
	if (typeof indexedDB === 'undefined') return [];

	/**
	|--------------------------------------------------
	| Read and sort every cached run
	|--------------------------------------------------
	*/
	const db = await openDb();
	try {
		const store = db.transaction(STORE, 'readonly').objectStore(STORE);
		const all = (await promisify(store.getAll())) as CachedRun[];
		return all.sort((a, b) => b.savedAt - a.savedAt);
	} finally {
		db.close();
	}
}

/**
|--------------------------------------------------
| Summarize a cached run for history listings
|--------------------------------------------------
*/
export const toSummary = (run: CachedRun): RunSummary => ({
	id: run.id,
	status: run.status,
	createdAt: run.createdAt,
	totalUnits: run.totalUnits,
	completedUnits: run.completedUnits,
	durationMs: run.durationMs,
	source: run.source ?? 'Local run',
});
