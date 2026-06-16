'use client';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import type { ZipEntry } from './browser-zip';

/**
|--------------------------------------------------
| IndexedDB configuration for persisted run sources
|--------------------------------------------------
*/
const DB_NAME = 'codexa';
const STORE = 'run-sources';
const VERSION = 1;
const MAX_RUNS = 12;

/**
|--------------------------------------------------
| A persisted original source tree for one run
|--------------------------------------------------
*/
interface SourceRecord {
	runId: string;
	at: number;
	entries: ZipEntry[];
}

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
| Open (and upgrade) the Codexa database
|--------------------------------------------------
*/
const openDb = (): Promise<IDBDatabase> => {
	/**
	|--------------------------------------------------
	| Create the object store on first use
	|--------------------------------------------------
	*/
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE)) {
				const store = db.createObjectStore(STORE, { keyPath: 'runId' });
				store.createIndex('at', 'at');
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
};

/**
|--------------------------------------------------
| Drop the oldest records beyond the retention cap
|--------------------------------------------------
*/
const prune = async (db: IDBDatabase): Promise<void> => {
	/**
	|--------------------------------------------------
	| Read every stored record, newest first
	|--------------------------------------------------
	*/
	const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
	const records = (await promisify(store.getAll())) as SourceRecord[];
	const stale = records.sort((a, b) => b.at - a.at).slice(MAX_RUNS);

	/**
	|--------------------------------------------------
	| Delete the records past the cap
	|--------------------------------------------------
	*/
	for (const record of stale) store.delete(record.runId);
};

/**
|--------------------------------------------------
| Persist a run's original source tree
|--------------------------------------------------
*/
export async function saveRunSource(runId: string, entries: ZipEntry[]): Promise<void> {
	/**
	|--------------------------------------------------
	| Skip when storage is unavailable
	|--------------------------------------------------
	*/
	if (typeof indexedDB === 'undefined') return;

	/**
	|--------------------------------------------------
	| Write the record, then prune old ones
	|--------------------------------------------------
	*/
	const db = await openDb();
	try {
		const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
		await promisify(store.put({ runId, at: Date.now(), entries } satisfies SourceRecord));
		await prune(db);
	} finally {
		db.close();
	}
}

/**
|--------------------------------------------------
| Load a run's original source tree, if persisted
|--------------------------------------------------
*/
export async function loadRunSource(runId: string): Promise<ZipEntry[] | null> {
	/**
	|--------------------------------------------------
	| Skip when storage is unavailable
	|--------------------------------------------------
	*/
	if (typeof indexedDB === 'undefined') return null;

	/**
	|--------------------------------------------------
	| Read the record for the run
	|--------------------------------------------------
	*/
	const db = await openDb();
	try {
		const store = db.transaction(STORE, 'readonly').objectStore(STORE);
		const record = (await promisify(store.get(runId))) as SourceRecord | undefined;
		return record?.entries ?? null;
	} finally {
		db.close();
	}
}
