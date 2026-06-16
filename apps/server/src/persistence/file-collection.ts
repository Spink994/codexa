/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { dirname } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

/**
|--------------------------------------------------
| A JSON-file-backed keyed collection
|--------------------------------------------------
| Hydrates a Map from disk on construction and writes
| the whole collection back on every mutation. Simple
| and durable enough for a single-node deployment.
|--------------------------------------------------
*/
export class FileCollection<T> {
	/**
	|--------------------------------------------------
	| In-memory mirror of the persisted records
	|--------------------------------------------------
	*/
	private readonly items = new Map<string, T>();

	/**
	|--------------------------------------------------
	| Load any existing records from the backing file
	|--------------------------------------------------
	*/
	constructor(
		private readonly file: string,
		private readonly keyOf: (item: T) => string,
	) {
		/**
		|--------------------------------------------------
		| Hydrate from disk, starting empty on any failure
		|--------------------------------------------------
		*/
		try {
			if (existsSync(this.file)) {
				const records = JSON.parse(readFileSync(this.file, 'utf8')) as T[];
				for (const record of records) this.items.set(this.keyOf(record), record);
			}
		} catch {
			/* corrupt or unreadable file — start empty */
		}
	}

	/**
	|--------------------------------------------------
	| Write the current records back to disk
	|--------------------------------------------------
	*/
	private flush(): void {
		/**
		|--------------------------------------------------
		| Ensure the directory exists, then persist
		|--------------------------------------------------
		*/
		mkdirSync(dirname(this.file), { recursive: true });
		writeFileSync(this.file, JSON.stringify([...this.items.values()]));
	}

	/**
	|--------------------------------------------------
	| Insert or replace a record, then persist
	|--------------------------------------------------
	*/
	set(item: T): void {
		this.items.set(this.keyOf(item), item);
		this.flush();
	}

	/**
	|--------------------------------------------------
	| Remove a record by key, then persist
	|--------------------------------------------------
	*/
	delete(key: string): boolean {
		const removed = this.items.delete(key);
		if (removed) this.flush();
		return removed;
	}

	/**
	|--------------------------------------------------
	| Read a record by key
	|--------------------------------------------------
	*/
	get(key: string): T | undefined {
		return this.items.get(key);
	}

	/**
	|--------------------------------------------------
	| Snapshot all records
	|--------------------------------------------------
	*/
	values(): T[] {
		return [...this.items.values()];
	}
}

/**
|--------------------------------------------------
| Resolve the on-disk data directory
|--------------------------------------------------
*/
export const dataDir = (): string => process.env.CODEXA_DATA_DIR || `${process.cwd()}/.codexa-data`;
