/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { join, relative } from 'node:path';
import { readFile } from 'node:fs/promises';
import ignore, { type Ignore } from 'ignore';

/**
|--------------------------------------------------
| Default excluded directories
|--------------------------------------------------
*/
const DEFAULT_EXCLUDED_DIRECTORIES = new Set([
	'.git',
	'.next',
	'.turbo',
	'build',
	'coverage',
	'dist',
	'fixtures',
	'node_modules',
	'out',
	'tmp',
	'vendor',
	'__fixtures__',
]);

/**
|--------------------------------------------------
| Determine whether error represents missing file
|--------------------------------------------------
*/
const isMissingFileError = (error: unknown): error is NodeJS.ErrnoException => {
	/**
	|--------------------------------------------------
	| Return missing-file comparison result
	|--------------------------------------------------
	*/
	return error instanceof Error && 'code' in error && error.code === 'ENOENT';
};

/**
|--------------------------------------------------
| Read optional ignore file
|--------------------------------------------------
*/
const readIgnoreFile = async (path: string) => {
	try {
		/**
		|--------------------------------------------------
		| Return ignore file contents
		|--------------------------------------------------
		*/
		return await readFile(path, 'utf8');
	} catch (error: unknown) {
		/**
		|--------------------------------------------------
		| Ignore missing file and rethrow unexpected error
		|--------------------------------------------------
		*/
		if (isMissingFileError(error)) return '';
		throw error;
	}
};

/**
|--------------------------------------------------
| Create workspace ignore matcher
|--------------------------------------------------
*/
const createIgnoreMatcher = async (workspacePath: string) => {
	/**
	|--------------------------------------------------
	| Read version-control and Codexa ignore rules
	|--------------------------------------------------
	*/
	const [gitIgnore, codexaIgnore] = await Promise.all([
		readIgnoreFile(`${workspacePath}/.gitignore`),
		readIgnoreFile(`${workspacePath}/.codexaignore`),
	]);

	/**
	|--------------------------------------------------
	| Return combined ignore matcher
	|--------------------------------------------------
	*/
	return ignore().add(gitIgnore).add(codexaIgnore);
};

/**
|--------------------------------------------------
| Add directory-scoped ignore rules
|--------------------------------------------------
*/
const addScopedIgnoreRules = async (matcher: Ignore, workspacePath: string, directoryPath: string) => {
	/**
	|--------------------------------------------------
	| Read ignore files from current directory
	|--------------------------------------------------
	*/
	const [gitIgnore, codexaIgnore] = await Promise.all([
		readIgnoreFile(join(directoryPath, '.gitignore')),
		readIgnoreFile(join(directoryPath, '.codexaignore')),
	]);

	/**
	|--------------------------------------------------
	| Calculate directory prefix relative to workspace
	|--------------------------------------------------
	*/
	const prefix = relative(workspacePath, directoryPath).replaceAll('\\', '/');

	/**
	|--------------------------------------------------
	| Scope and register local ignore rules
	|--------------------------------------------------
	*/
	[gitIgnore, codexaIgnore].forEach((source) => {
		const rules = source
			.split(/\r?\n/)
			.map((rule) => scopeIgnoreRule(rule, prefix))
			.filter((rule): rule is string => Boolean(rule));

		matcher.add(rules);
	});
};

/**
|--------------------------------------------------
| Scope ignore rule to containing directory
|--------------------------------------------------
*/
const scopeIgnoreRule = (rule: string, prefix: string) => {
	/**
	|--------------------------------------------------
	| Ignore empty and comment rules
	|--------------------------------------------------
	*/
	const value = rule.trim();
	if (!value || value.startsWith('#')) return null;

	/**
	|--------------------------------------------------
	| Preserve negation while prefixing pattern
	|--------------------------------------------------
	*/
	const negated = value.startsWith('!');
	const pattern = negated ? value.slice(1) : value;
	const normalizedPattern = pattern.startsWith('/') ? pattern.slice(1) : pattern;
	const scopedPattern = prefix ? `${prefix}/${normalizedPattern}` : normalizedPattern;

	/**
	|--------------------------------------------------
	| Return scoped ignore rule
	|--------------------------------------------------
	*/
	return `${negated ? '!' : ''}${scopedPattern}`;
};

/**
|--------------------------------------------------
| Determine whether directory should be skipped
|--------------------------------------------------
*/
const shouldSkipDirectory = (matcher: Ignore, workspacePath: string, directoryPath: string) => {
	/**
	|--------------------------------------------------
	| Derive workspace-relative directory metadata
	|--------------------------------------------------
	*/
	const relativePath = relative(workspacePath, directoryPath).replaceAll('\\', '/');
	const directoryName = relativePath.split('/').at(-1) || '';

	/**
	|--------------------------------------------------
	| Skip protected dependency and output directories
	|--------------------------------------------------
	*/
	if (DEFAULT_EXCLUDED_DIRECTORIES.has(directoryName)) return true;

	/**
	|--------------------------------------------------
	| Keep workspace root available for traversal
	|--------------------------------------------------
	*/
	if (!relativePath) return false;

	/**
	|--------------------------------------------------
	| Return configured ignore result
	|--------------------------------------------------
	*/
	return matcher.ignores(`${relativePath}/`);
};

/**
|--------------------------------------------------
| Export ignore utilities
|--------------------------------------------------
*/
export { addScopedIgnoreRules, createIgnoreMatcher, shouldSkipDirectory };
