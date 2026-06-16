/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { dirname, resolve } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import type { TypeScriptSourceAnalysis } from '@codexa/language-typescript';

/**
|--------------------------------------------------
| Discovery analysis cache entry
|--------------------------------------------------
*/
interface AnalysisCacheEntry {
	/**
	|--------------------------------------------------
	| Stable source-content hash
	|--------------------------------------------------
	*/
	contentHash: string;

	/**
	|--------------------------------------------------
	| Parser analysis associated with source hash
	|--------------------------------------------------
	*/
	analysis: TypeScriptSourceAnalysis;
}

/**
|--------------------------------------------------
| Discovery analysis cache file
|--------------------------------------------------
*/
interface AnalysisCacheFile {
	/**
	|--------------------------------------------------
	| Cache schema version
	|--------------------------------------------------
	*/
	version: 1;

	/**
	|--------------------------------------------------
	| Source analysis indexed by workspace-relative path
	|--------------------------------------------------
	*/
	files: Record<string, AnalysisCacheEntry>;
}

/**
|--------------------------------------------------
| Empty discovery cache
|--------------------------------------------------
*/
const EMPTY_CACHE: AnalysisCacheFile = {
	version: 1,
	files: {},
};

/**
|--------------------------------------------------
| Resolve discovery cache path
|--------------------------------------------------
*/
const resolveCachePath = (workspacePath: string, cachePath?: string) => {
	/**
	|--------------------------------------------------
	| Return configured or default cache path
	|--------------------------------------------------
	*/
	return resolve(workspacePath, cachePath || '.codexa/cache/discovery-v1.json');
};

/**
|--------------------------------------------------
| Read discovery analysis cache
|--------------------------------------------------
*/
const readAnalysisCache = async (path: string) => {
	try {
		/**
		|--------------------------------------------------
		| Parse existing cache source
		|--------------------------------------------------
		*/
		const cache = JSON.parse(await readFile(path, 'utf8')) as AnalysisCacheFile;

		/**
		|--------------------------------------------------
		| Return supported cache version
		|--------------------------------------------------
		*/
		return cache.version === 1 ? cache : structuredClone(EMPTY_CACHE);
	} catch (error: unknown) {
		/**
		|--------------------------------------------------
		| Return empty cache for missing or malformed data
		|--------------------------------------------------
		*/
		if (error instanceof Error) return structuredClone(EMPTY_CACHE);
		throw error;
	}
};

/**
|--------------------------------------------------
| Write discovery analysis cache
|--------------------------------------------------
*/
const writeAnalysisCache = async (path: string, cache: AnalysisCacheFile) => {
	/**
	|--------------------------------------------------
	| Create cache directory
	|--------------------------------------------------
	*/
	await mkdir(dirname(path), { recursive: true });

	/**
	|--------------------------------------------------
	| Persist deterministic cache JSON
	|--------------------------------------------------
	*/
	await writeFile(path, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
};

/**
|--------------------------------------------------
| Export discovery cache utilities
|--------------------------------------------------
*/
export {
	EMPTY_CACHE,
	readAnalysisCache,
	resolveCachePath,
	writeAnalysisCache,
	type AnalysisCacheEntry,
	type AnalysisCacheFile,
};
