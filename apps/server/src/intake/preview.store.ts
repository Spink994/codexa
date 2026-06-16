/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { Injectable, NotFoundException } from '@nestjs/common';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import type { PlanModule } from '../runs/run.types.js';

/**
|--------------------------------------------------
| Stored intake preview
|--------------------------------------------------
*/
interface PreviewEntry {
	id: string;
	userId: string;
	source: string;
	createdAt: number;
	modules: PlanModule[];
}

/**
|--------------------------------------------------
| In-memory store of intake previews
|--------------------------------------------------
| Holds the full planned source between preview and
| run so the client only round-trips file selections,
| not source. Entries expire after a short TTL.
|--------------------------------------------------
*/
@Injectable()
export class PreviewStore {
	/**
	|--------------------------------------------------
	| Previews keyed by identifier
	|--------------------------------------------------
	*/
	private readonly previews = new Map<string, PreviewEntry>();

	/**
	|--------------------------------------------------
	| Preview lifetime in milliseconds
	|--------------------------------------------------
	*/
	private readonly ttl = 30 * 60 * 1000;

	/**
	|--------------------------------------------------
	| Save a preview entry
	|--------------------------------------------------
	*/
	save(entry: PreviewEntry): void {
		/**
		|--------------------------------------------------
		| Drop expired entries, then store the new one
		|--------------------------------------------------
		*/
		this.evictExpired(entry.createdAt);
		this.previews.set(entry.id, entry);
	}

	/**
	|--------------------------------------------------
	| Read a preview owned by the user
	|--------------------------------------------------
	*/
	require(id: string, userId: string): PreviewEntry {
		/**
		|--------------------------------------------------
		| Resolve the preview and enforce ownership
		|--------------------------------------------------
		*/
		const entry = this.previews.get(id);
		if (!entry || entry.userId !== userId) throw new NotFoundException(`Preview "${id}" was not found.`);
		return entry;
	}

	/**
	|--------------------------------------------------
	| Evict previews older than the TTL
	|--------------------------------------------------
	*/
	private evictExpired(now: number): void {
		/**
		|--------------------------------------------------
		| Remove entries past their lifetime
		|--------------------------------------------------
		*/
		for (const [id, entry] of this.previews) {
			if (now - entry.createdAt > this.ttl) this.previews.delete(id);
		}
	}
}
