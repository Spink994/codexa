/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import type { BackendRoot } from '@codexa/core';

/**
|--------------------------------------------------
| Backend discovery options
|--------------------------------------------------
*/
interface DiscoveryOptions {
	/**
	|--------------------------------------------------
	| Maximum directory depth scanned below workspace
	|--------------------------------------------------
	*/
	maxDepth?: number;

	/**
	|--------------------------------------------------
	| Whether content-hash analysis caching is enabled
	|--------------------------------------------------
	*/
	cache?: boolean;

	/**
	|--------------------------------------------------
	| Optional cache path relative to workspace
	|--------------------------------------------------
	*/
	cachePath?: string;

	/**
	|--------------------------------------------------
	| Whether Git dirty-file state should be collected
	|--------------------------------------------------
	*/
	gitState?: boolean;
}

/**
|--------------------------------------------------
| Backend discovery result
|--------------------------------------------------
*/
interface DiscoveryResult {
	/**
	|--------------------------------------------------
	| Absolute workspace path used for discovery
	|--------------------------------------------------
	*/
	workspacePath: string;

	/**
	|--------------------------------------------------
	| Backend roots ordered by portable relative path
	|--------------------------------------------------
	*/
	roots: BackendRoot[];

	/**
	|--------------------------------------------------
	| Number of source files inspected
	|--------------------------------------------------
	*/
	filesInspected: number;

	/**
	|--------------------------------------------------
	| Number of directories excluded during traversal
	|--------------------------------------------------
	*/
	directoriesSkipped: number;

	/**
	|--------------------------------------------------
	| Number of source analyses restored from cache
	|--------------------------------------------------
	*/
	cacheHits: number;

	/**
	|--------------------------------------------------
	| Number of source analyses created during this run
	|--------------------------------------------------
	*/
	cacheMisses: number;
}

/**
|--------------------------------------------------
| Export discovery contracts
|--------------------------------------------------
*/
export type { DiscoveryOptions, DiscoveryResult };
