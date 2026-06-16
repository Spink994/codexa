/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { hashSource } from './cache.js';
import type { FormattingUnit } from './types.js';
import type { SourceLanguage } from '@codexa/core';

/**
|--------------------------------------------------
| Planned source file
|--------------------------------------------------
*/
interface PlanFile {
	/**
	|--------------------------------------------------
	| Absolute file path
	|--------------------------------------------------
	*/
	path: string;

	/**
	|--------------------------------------------------
	| File source captured for the plan
	|--------------------------------------------------
	*/
	source: string;

	/**
	|--------------------------------------------------
	| Source language of the file
	|--------------------------------------------------
	*/
	language: SourceLanguage;

	/**
	|--------------------------------------------------
	| Exported symbols that must survive formatting
	|--------------------------------------------------
	*/
	symbols?: string[];

	/**
	|--------------------------------------------------
	| Precomputed content hash for the source
	|--------------------------------------------------
	*/
	contentHash?: string;
}

/**
|--------------------------------------------------
| Planned module
|--------------------------------------------------
*/
interface PlanModule {
	/**
	|--------------------------------------------------
	| Stable module identifier
	|--------------------------------------------------
	*/
	id: string;

	/**
	|--------------------------------------------------
	| Files owned by the module
	|--------------------------------------------------
	*/
	files: PlanFile[];
}

/**
|--------------------------------------------------
| Built job plan
|--------------------------------------------------
*/
interface JobPlan {
	/**
	|--------------------------------------------------
	| Formatting units with exclusive file ownership
	|--------------------------------------------------
	*/
	jobs: FormattingUnit[];

	/**
	|--------------------------------------------------
	| Duplicate file paths excluded from ownership
	|--------------------------------------------------
	*/
	duplicates: string[];
}

/**
|--------------------------------------------------
| Build a job plan with exclusive file ownership
|--------------------------------------------------
*/
const buildJobPlan = (modules: PlanModule[]): JobPlan => {
	/**
	|--------------------------------------------------
	| Track owned paths to prevent overlapping writes
	|--------------------------------------------------
	*/
	const owned = new Set<string>();
	const jobs: FormattingUnit[] = [];
	const duplicates: string[] = [];

	/**
	|--------------------------------------------------
	| Assign each unique file to exactly one job
	|--------------------------------------------------
	*/
	modules.forEach((module) => {
		module.files.forEach((file) => {
			/**
			|--------------------------------------------------
			| Skip files already owned by another job
			|--------------------------------------------------
			*/
			if (owned.has(file.path)) {
				duplicates.push(file.path);
				return;
			}

			/**
			|--------------------------------------------------
			| Record the owning formatting unit
			|--------------------------------------------------
			*/
			owned.add(file.path);
			jobs.push({
				path: file.path,
				moduleId: module.id,
				source: file.source,
				language: file.language,
				symbols: file.symbols || [],
				contentHash: file.contentHash || hashSource(file.source),
			});
		});
	});

	/**
	|--------------------------------------------------
	| Return the exclusive-ownership job plan
	|--------------------------------------------------
	*/
	return {
		jobs,
		duplicates,
	};
};

/**
|--------------------------------------------------
| Export job plan builder
|--------------------------------------------------
*/
export { buildJobPlan, type PlanFile, type PlanModule, type JobPlan };
