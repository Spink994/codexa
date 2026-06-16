/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import type { DiscoveryResult } from '@codexa/discovery';

/**
|--------------------------------------------------
| Format discovery result for terminal output
|--------------------------------------------------
*/
const formatDiscoveryResult = (result: DiscoveryResult) => {
	/**
	|--------------------------------------------------
	| Prepare discovery summary lines
	|--------------------------------------------------
	*/
	const lines = [
		`Workspace: ${result.workspacePath}`,
		`Backend roots: ${result.roots.length}`,
		`Source files inspected: ${result.filesInspected}`,
		`Directories skipped: ${result.directoriesSkipped}`,
		`Analysis cache: ${result.cacheHits} hits · ${result.cacheMisses} misses`,
	];

	/**
	|--------------------------------------------------
	| Append backend root and module details
	|--------------------------------------------------
	*/
	result.roots.forEach((root) => {
		/**
		|--------------------------------------------------
		| Append backend root summary
		|--------------------------------------------------
		*/
		lines.push('');
		lines.push(
			`${root.name} [${root.framework} · ${root.language}] ${Math.round(root.confidence * 100)}%`,
		);
		lines.push(`  Path: ${root.path}`);
		lines.push(`  Modules: ${root.modules.length}`);

		/**
		|--------------------------------------------------
		| Append discovered module summaries
		|--------------------------------------------------
		*/
		root.modules.forEach((module) => {
			/**
			|--------------------------------------------------
			| Count invalid and dirty source files
			|--------------------------------------------------
			*/
			const dirtyFiles = module.files.filter((file) => file.dirty).length;
			const invalidFiles = module.files.filter((file) => !file.syntaxValid).length;
			const warnings = [
				dirtyFiles > 0 ? `${dirtyFiles} dirty` : '',
				invalidFiles > 0 ? `${invalidFiles} invalid` : '',
			].filter(Boolean);

			/**
			|--------------------------------------------------
			| Append module summary with source warnings
			|--------------------------------------------------
			*/
			lines.push(
				`  - ${module.path} (${module.files.length} files${warnings.length > 0 ? ` · ${warnings.join(' · ')}` : ''})`,
			);
		});
	});

	/**
	|--------------------------------------------------
	| Return complete terminal output
	|--------------------------------------------------
	*/
	return lines.join('\n');
};

/**
|--------------------------------------------------
| Export discovery reporter
|--------------------------------------------------
*/
export { formatDiscoveryResult };
