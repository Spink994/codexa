/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import {
	EMPTY_CACHE,
	readAnalysisCache,
	resolveCachePath,
	writeAnalysisCache,
	type AnalysisCacheFile,
} from './analysis-cache.js';
import { readGitDirtyFiles } from './git-state.js';
import type { DiscoveryOptions, DiscoveryResult } from './types.js';
import { analyzeTypeScriptSource } from '@codexa/language-typescript';
import { addScopedIgnoreRules, createIgnoreMatcher, shouldSkipDirectory } from './ignore-rules.js';
import type { BackendFramework, BackendModule, BackendRoot, BackendSourceFile, SourceLanguage } from '@codexa/core';

/**
|--------------------------------------------------
| Supported source file extensions
|--------------------------------------------------
*/
const SOURCE_EXTENSIONS = new Set(['.cjs', '.cts', '.js', '.mjs', '.mts', '.ts']);

/**
|--------------------------------------------------
| Traversed workspace file
|--------------------------------------------------
*/
interface ScannedFile {
	/**
	|--------------------------------------------------
	| Absolute file path
	|--------------------------------------------------
	*/
	path: string;

	/**
	|--------------------------------------------------
	| Workspace-relative file path
	|--------------------------------------------------
	*/
	relativePath: string;
}

/**
|--------------------------------------------------
| Package manifest fields used during discovery
|--------------------------------------------------
*/
interface PackageManifest {
	/**
	|--------------------------------------------------
	| Optional package name
	|--------------------------------------------------
	*/
	name?: string;

	/**
	|--------------------------------------------------
	| Runtime dependencies
	|--------------------------------------------------
	*/
	dependencies?: Record<string, string>;

	/**
	|--------------------------------------------------
	| Development dependencies
	|--------------------------------------------------
	*/
	devDependencies?: Record<string, string>;
}

/**
|--------------------------------------------------
| Backend-root creation input
|--------------------------------------------------
*/
interface CreateRootInput {
	/**
	|--------------------------------------------------
	| Evidence supporting backend classification
	|--------------------------------------------------
	*/
	evidence: string[];

	/**
	|--------------------------------------------------
	| Detected backend framework
	|--------------------------------------------------
	*/
	framework: BackendFramework;

	/**
	|--------------------------------------------------
	| Display name for detected backend
	|--------------------------------------------------
	*/
	name: string;

	/**
	|--------------------------------------------------
	| Absolute backend source-root path
	|--------------------------------------------------
	*/
	rootPath: string;

	/**
	|--------------------------------------------------
	| Source files owned by detected backend
	|--------------------------------------------------
	*/
	sourceFiles: ScannedFile[];

	/**
	|--------------------------------------------------
	| Absolute scanned workspace path
	|--------------------------------------------------
	*/
	workspacePath: string;
}

/**
|--------------------------------------------------
| Source analysis run context
|--------------------------------------------------
*/
interface AnalysisContext {
	/**
	|--------------------------------------------------
	| Mutable content-hash analysis cache
	|--------------------------------------------------
	*/
	cache: AnalysisCacheFile;

	/**
	|--------------------------------------------------
	| Whether cache reads and writes are enabled
	|--------------------------------------------------
	*/
	cacheEnabled: boolean;

	/**
	|--------------------------------------------------
	| Workspace-relative dirty-file paths
	|--------------------------------------------------
	*/
	dirtyFiles: Set<string>;

	/**
	|--------------------------------------------------
	| Number of analyses restored from cache
	|--------------------------------------------------
	*/
	cacheHits: number;

	/**
	|--------------------------------------------------
	| Number of analyses created during run
	|--------------------------------------------------
	*/
	cacheMisses: number;
}

/**
|--------------------------------------------------
| Discover TypeScript and JavaScript backends
|--------------------------------------------------
*/
const discoverBackends = async (workspacePath: string, options: DiscoveryOptions = {}): Promise<DiscoveryResult> => {
	/**
	|--------------------------------------------------
	| Resolve workspace path and scan depth
	|--------------------------------------------------
	*/
	const maxDepth = options.maxDepth ?? 12;
	const cacheEnabled = options.cache !== false;
	const absoluteWorkspacePath = resolve(workspacePath);
	const cachePath = resolveCachePath(absoluteWorkspacePath, options.cachePath);

	/**
	|--------------------------------------------------
	| Confirm workspace exists as directory
	|--------------------------------------------------
	*/
	const workspaceStats = await stat(absoluteWorkspacePath);
	if (!workspaceStats.isDirectory()) throw new Error(`Workspace is not a directory: ${absoluteWorkspacePath}`);

	/**
	|--------------------------------------------------
	| Prepare traversal state and ignore rules
	|--------------------------------------------------
	*/
	const matcher = await createIgnoreMatcher(absoluteWorkspacePath);
	const files: ScannedFile[] = [];
	let directoriesSkipped = 0;

	/**
	|--------------------------------------------------
	| Prepare cache and Git source-state context
	|--------------------------------------------------
	*/
	const [cache, dirtyFiles] = await Promise.all([
		cacheEnabled ? readAnalysisCache(cachePath) : Promise.resolve(structuredClone(EMPTY_CACHE)),
		options.gitState === false ? Promise.resolve(new Set<string>()) : readGitDirtyFiles(absoluteWorkspacePath),
	]);
	const context: AnalysisContext = {
		cache,
		dirtyFiles,
		cacheEnabled,
		cacheHits: 0,
		cacheMisses: 0,
	};

	/**
	|--------------------------------------------------
	| Traverse eligible workspace directories
	|--------------------------------------------------
	*/
	const visit = async (directoryPath: string, depth: number): Promise<void> => {
		/**
		|--------------------------------------------------
		| Stop traversal beyond configured maximum depth
		|--------------------------------------------------
		*/
		if (depth > maxDepth) return;

		/**
		|--------------------------------------------------
		| Register ignore rules scoped to current directory
		|--------------------------------------------------
		*/
		await addScopedIgnoreRules(matcher, absoluteWorkspacePath, directoryPath);

		/**
		|--------------------------------------------------
		| Read directory entries in deterministic order
		|--------------------------------------------------
		*/
		const entries = await readdir(directoryPath, { withFileTypes: true });
		entries.sort((left, right) => left.name.localeCompare(right.name));

		/**
		|--------------------------------------------------
		| Process directory entries
		|--------------------------------------------------
		*/
		for (const entry of entries) {
			/**
			|--------------------------------------------------
			| Build portable entry paths
			|--------------------------------------------------
			*/
			const entryPath = join(directoryPath, entry.name);
			const relativePath = toRelativePath(absoluteWorkspacePath, entryPath);

			/**
			|--------------------------------------------------
			| Skip symbolic links to avoid external traversal
			|--------------------------------------------------
			*/
			if (entry.isSymbolicLink()) continue;

			/**
			|--------------------------------------------------
			| Recurse into eligible directories
			|--------------------------------------------------
			*/
			if (entry.isDirectory()) {
				if (shouldSkipDirectory(matcher, absoluteWorkspacePath, entryPath)) {
					directoriesSkipped += 1;
					continue;
				}

				await visit(entryPath, depth + 1);
				continue;
			}

			/**
			|--------------------------------------------------
			| Skip ignored files
			|--------------------------------------------------
			*/
			if (matcher.ignores(relativePath)) continue;

			/**
			|--------------------------------------------------
			| Retain files that contribute discovery evidence
			|--------------------------------------------------
			*/
			if (isDiscoveryFile(entry.name)) {
				files.push({
					relativePath,
					path: entryPath,
				});
			}
		}
	};

	/**
	|--------------------------------------------------
	| Scan workspace file tree
	|--------------------------------------------------
	*/
	await visit(absoluteWorkspacePath, 0);

	/**
	|--------------------------------------------------
	| Detect backend roots from collected evidence
	|--------------------------------------------------
	*/
	const roots = await detectRoots(absoluteWorkspacePath, files, context);

	/**
	|--------------------------------------------------
	| Remove cache entries no longer present in result
	|--------------------------------------------------
	*/
	const activeSourcePaths = new Set(
		roots.flatMap((root) => root.modules.flatMap((module) => module.files.map((file) => file.path))),
	);
	Object.keys(context.cache.files).forEach((path) => {
		if (!activeSourcePaths.has(path)) delete context.cache.files[path];
	});

	/**
	|--------------------------------------------------
	| Persist updated source analysis cache
	|--------------------------------------------------
	*/
	if (cacheEnabled) await writeAnalysisCache(cachePath, context.cache);

	/**
	|--------------------------------------------------
	| Return discovery result
	|--------------------------------------------------
	*/
	return {
		roots,
		directoriesSkipped,
		cacheHits: context.cacheHits,
		cacheMisses: context.cacheMisses,
		workspacePath: absoluteWorkspacePath,
		filesInspected: files.filter((file) => isSourceFile(file.path)).length,
	};
};

/**
|--------------------------------------------------
| Detect backend roots from collected files
|--------------------------------------------------
*/
const detectRoots = async (workspacePath: string, files: ScannedFile[], context: AnalysisContext) => {
	/**
	|--------------------------------------------------
	| Separate manifests, Nest configuration, and source files
	|--------------------------------------------------
	*/
	const manifests = files.filter((file) => basename(file.path) === 'package.json');
	const nestConfigs = files.filter((file) => basename(file.path) === 'nest-cli.json');
	const sourceFiles = files.filter((file) => isSourceFile(file.path));
	const roots = new Map<string, BackendRoot>();
	const manifestDirectories = manifests.map((manifest) => dirname(manifest.path));

	/**
	|--------------------------------------------------
	| Detect backends represented by package manifests
	|--------------------------------------------------
	*/
	for (const manifestFile of manifests) {
		/**
		|--------------------------------------------------
		| Parse manifest and framework dependencies
		|--------------------------------------------------
		*/
		const manifest = await readJsonFile<PackageManifest>(manifestFile.path);
		const packagePath = dirname(manifestFile.path);
		const framework = detectManifestFramework(manifest);
		const packageSources = sourceFiles.filter(
			(file) => findOwningManifestDirectory(file.path, manifestDirectories) === packagePath,
		);

		/**
		|--------------------------------------------------
		| Skip package without backend evidence
		|--------------------------------------------------
		*/
		if (framework === 'unknown' && !containsBackendSource(packageSources)) continue;

		/**
		|--------------------------------------------------
		| Resolve configured source root where available
		|--------------------------------------------------
		*/
		const configuredRoots = await resolveConfiguredSourceRoots(packagePath, nestConfigs);
		const sourceRoots =
			configuredRoots.length > 0 ? configuredRoots : [resolveConventionalSourceRoot(packagePath, packageSources)];

		/**
		|--------------------------------------------------
		| Create every manifest-backed backend source root
		|--------------------------------------------------
		*/
		for (const rootPath of sourceRoots) {
			/**
			|--------------------------------------------------
			| Collect sources owned by source root
			|--------------------------------------------------
			*/
			const rootSources = packageSources.filter((file) => isInsidePath(rootPath, file.path));
			if (rootSources.length === 0) continue;

			/**
			|--------------------------------------------------
			| Create manifest-backed backend root
			|--------------------------------------------------
			*/
			const root = await createBackendRoot({
				context,
				rootPath,
				framework,
				workspacePath,
				sourceFiles: rootSources,
				name: manifest.name || basename(rootPath),
				evidence: buildManifestEvidence(framework, rootPath, manifestFile.relativePath),
			});

			/**
			|--------------------------------------------------
			| Store backend root by relative path
			|--------------------------------------------------
			*/
			roots.set(root.path, root);
		}
	}

	/**
	|--------------------------------------------------
	| Detect configured Nest roots missed by manifest ownership
	|--------------------------------------------------
	*/
	for (const configFile of nestConfigs) {
		/**
		|--------------------------------------------------
		| Resolve configured Nest source path
		|--------------------------------------------------
		*/
		const sourceRoots = await readNestSourceRoots(configFile.path);
		const configPath = dirname(configFile.path);

		/**
		|--------------------------------------------------
		| Create every backend declared by Nest configuration
		|--------------------------------------------------
		*/
		for (const sourceRoot of sourceRoots.length > 0 ? sourceRoots : ['src']) {
			/**
			|--------------------------------------------------
			| Resolve configured source root and owned files
			|--------------------------------------------------
			*/
			const rootPath = resolve(configPath, sourceRoot);
			const rootSources = sourceFiles.filter((file) => isInsidePath(rootPath, file.path));
			const relativeRootPath = toRelativePath(workspacePath, rootPath) || '.';
			if (rootSources.length === 0 || roots.has(relativeRootPath)) continue;

			/**
			|--------------------------------------------------
			| Create configured Nest backend root
			|--------------------------------------------------
			*/
			const root = await createBackendRoot({
				context,
				rootPath,
				workspacePath,
				framework: 'nestjs',
				sourceFiles: rootSources,
				name: basename(rootPath),
				evidence: [`Nest configuration: ${configFile.relativePath}`],
			});

			/**
			|--------------------------------------------------
			| Store configured Nest backend root
			|--------------------------------------------------
			*/
			roots.set(root.path, root);
		}
	}

	/**
	|--------------------------------------------------
	| Return roots ordered by portable relative path
	|--------------------------------------------------
	*/
	return [...roots.values()].sort((left, right) => left.path.localeCompare(right.path));
};

/**
|--------------------------------------------------
| Create detected backend root
|--------------------------------------------------
*/
const createBackendRoot = async (input: CreateRootInput & { context: AnalysisContext }) => {
	/**
	|--------------------------------------------------
	| Normalize unknown framework into generic Node backend
	|--------------------------------------------------
	*/
	const framework = input.framework === 'unknown' ? 'generic-node' : input.framework;

	/**
	|--------------------------------------------------
	| Detect language and backend modules
	|--------------------------------------------------
	*/
	const language = detectPrimaryLanguage(input.sourceFiles);
	const modules = await detectModules(
		input.workspacePath,
		input.rootPath,
		framework,
		input.sourceFiles,
		input.context,
	);

	/**
	|--------------------------------------------------
	| Build detected backend root
	|--------------------------------------------------
	*/
	const root: BackendRoot = {
		modules,
		language,
		framework,
		name: input.name,
		evidence: input.evidence,
		path: toRelativePath(input.workspacePath, input.rootPath) || '.',
		confidence: calculateRootConfidence(framework, modules.length, input.evidence.length),
		id: createStableId(toRelativePath(input.workspacePath, input.rootPath) || input.name),
	};

	/**
	|--------------------------------------------------
	| Return detected backend root
	|--------------------------------------------------
	*/
	return root;
};

/**
|--------------------------------------------------
| Detect backend modules
|--------------------------------------------------
*/
const detectModules = async (
	workspacePath: string,
	rootPath: string,
	framework: BackendFramework,
	sourceFiles: ScannedFile[],
	context: AnalysisContext,
) => {
	/**
	|--------------------------------------------------
	| Locate explicit Nest module declarations
	|--------------------------------------------------
	*/
	const nestModules = sourceFiles.filter((file) => /\.module\.[cm]?[jt]s$/.test(file.path));

	/**
	|--------------------------------------------------
	| Build Nest modules around declaration directories
	|--------------------------------------------------
	*/
	if (framework === 'nestjs' && nestModules.length > 0) {
		/**
		|--------------------------------------------------
		| Collect directories declaring explicit Nest modules
		|--------------------------------------------------
		*/
		const moduleDirectories = nestModules.map((moduleFile) => dirname(moduleFile.path));

		/**
		|--------------------------------------------------
		| Assign each source file to nearest module directory
		|--------------------------------------------------
		*/
		const moduleFiles = new Map<string, ScannedFile[]>();
		sourceFiles.forEach((file) => {
			/**
			|--------------------------------------------------
			| Find deepest module directory containing file
			|--------------------------------------------------
			*/
			const owner = findNearestContainingPath(file.path, moduleDirectories);
			if (!owner) return;

			/**
			|--------------------------------------------------
			| Append file to exclusive module owner
			|--------------------------------------------------
			*/
			const ownedFiles = moduleFiles.get(owner) || [];
			ownedFiles.push(file);
			moduleFiles.set(owner, ownedFiles);
		});

		const modules = await Promise.all(
			nestModules.map((moduleFile) => {
				/**
			 |--------------------------------------------------
			 | Read source files exclusively owned by module
			 |--------------------------------------------------
			 */
				const modulePath = dirname(moduleFile.path);
				const ownedFiles = moduleFiles.get(modulePath) || [];

				/**
			 |--------------------------------------------------
			 | Return explicit Nest module
			 |--------------------------------------------------
			 */
				return createModule(workspacePath, rootPath, framework, modulePath, ownedFiles, 0.98, context);
			}),
		);

		/**
		|--------------------------------------------------
		| Remove duplicate nested module paths and sort
		| result
		|--------------------------------------------------
		*/
		return deduplicateModules(modules);
	}

	/**
	|--------------------------------------------------
	| Group generic Node files by nearest source
	| directory
	|--------------------------------------------------
	*/
	const groups = new Map<string, ScannedFile[]>();
	sourceFiles.forEach((file) => {
		/**
		|--------------------------------------------------
		| Determine module directory below backend root
		|--------------------------------------------------
		*/
		const relativeFilePath = toRelativePath(rootPath, file.path);
		const firstSegment = relativeFilePath.split('/')[0] || relativeFilePath;
		const modulePath = relativeFilePath.includes('/') ? join(rootPath, firstSegment) : rootPath;
		const moduleFiles = groups.get(modulePath) || [];

		/**
		|--------------------------------------------------
		| Add file to module group
		|--------------------------------------------------
		*/
		moduleFiles.push(file);
		groups.set(modulePath, moduleFiles);
	});

	/**
	|--------------------------------------------------
	| Create inferred generic modules
	|--------------------------------------------------
	*/
	const modules = await Promise.all(
		[...groups.entries()].map(([modulePath, moduleFiles]) =>
			createModule(workspacePath, rootPath, framework, modulePath, moduleFiles, 0.72, context),
		),
	);

	/**
	|--------------------------------------------------
	| Return inferred modules in portable path order
	|--------------------------------------------------
	*/
	return modules.sort((left, right) => left.path.localeCompare(right.path));
};

/**
|--------------------------------------------------
| Create discovered backend module
|--------------------------------------------------
*/
const createModule = async (
	workspacePath: string,
	rootPath: string,
	framework: BackendFramework,
	modulePath: string,
	files: ScannedFile[],
	confidence: number,
	context: AnalysisContext,
) => {
	/**
	|--------------------------------------------------
	| Convert scanned files into source metadata
	|--------------------------------------------------
	*/
	const sourceFiles = await Promise.all(files.map((file) => createBackendSourceFile(file, context)));
	const relativeModulePath = toRelativePath(rootPath, modulePath) || '.';

	/**
	|--------------------------------------------------
	| Build discovered backend module
	|--------------------------------------------------
	*/
	const module: BackendModule = {
		framework,
		confidence,
		files: sourceFiles,
		path: relativeModulePath,
		name: relativeModulePath === '.' ? basename(rootPath) : basename(modulePath),
		id: createStableId(`${toRelativePath(workspacePath, rootPath)}:${relativeModulePath}`),
	};

	/**
	|--------------------------------------------------
	| Return discovered backend module
	|--------------------------------------------------
	*/
	return module;
};

/**
|--------------------------------------------------
| Create backend source metadata
|--------------------------------------------------
*/
const createBackendSourceFile = async (file: ScannedFile, context: AnalysisContext) => {
	/**
	|--------------------------------------------------
	| Read source and create stable content hash
	|--------------------------------------------------
	*/
	const source = await readFile(file.path, 'utf8');
	const contentHash = createHash('sha256').update(source).digest('hex');
	const language = detectSourceLanguage(file.path);

	/**
	|--------------------------------------------------
	| Restore matching analysis or parse source
	|--------------------------------------------------
	*/
	const cachedEntry = context.cache.files[file.relativePath];
	const cacheHit = context.cacheEnabled && cachedEntry?.contentHash === contentHash;
	const analysis = cacheHit ? cachedEntry.analysis : analyzeTypeScriptSource(file.path, source, language);

	/**
	|--------------------------------------------------
	| Update cache metrics and source analysis entry
	|--------------------------------------------------
	*/
	if (cacheHit) {
		context.cacheHits += 1;
	} else {
		context.cacheMisses += 1;
		context.cache.files[file.relativePath] = {
			analysis,
			contentHash,
		};
	}

	/**
	|--------------------------------------------------
	| Build backend source file
	|--------------------------------------------------
	*/
	const backendFile: BackendSourceFile = {
		language,
		contentHash,
		path: file.relativePath,
		exports: analysis.exports,
		imports: analysis.imports,
		symbols: analysis.symbols,
		diagnostics: analysis.diagnostics,
		syntaxValid: analysis.syntaxValid,
		generated: isGeneratedPath(file.relativePath),
		dirty: context.dirtyFiles.has(file.relativePath),
	};

	/**
	|--------------------------------------------------
	| Return backend source file
	|--------------------------------------------------
	*/
	return backendFile;
};

/**
|--------------------------------------------------
| Detect framework from package dependencies
|--------------------------------------------------
*/
const detectManifestFramework = (manifest: PackageManifest): BackendFramework => {
	/**
	|--------------------------------------------------
	| Combine runtime and development dependency names
	|--------------------------------------------------
	*/
	const dependencies = new Set([
		...Object.keys(manifest.dependencies || {}),
		...Object.keys(manifest.devDependencies || {}),
	]);

	/**
	|--------------------------------------------------
	| Return matching supported framework
	|--------------------------------------------------
	*/
	if (dependencies.has('@nestjs/core')) return 'nestjs';
	if (dependencies.has('fastify')) return 'fastify';
	if (dependencies.has('express')) return 'express';

	/**
	|--------------------------------------------------
	| Return unknown framework without dependency match
	|--------------------------------------------------
	*/
	return 'unknown';
};

/**
|--------------------------------------------------
| Resolve configured source roots
|--------------------------------------------------
*/
const resolveConfiguredSourceRoots = async (packagePath: string, configs: ScannedFile[]) => {
	/**
	|--------------------------------------------------
	| Locate package-level Nest configuration
	|--------------------------------------------------
	*/
	const config = configs.find((file) => dirname(file.path) === packagePath);
	if (!config) return [];

	/**
	|--------------------------------------------------
	| Read configured source roots
	|--------------------------------------------------
	*/
	const sourceRoots = await readNestSourceRoots(config.path);

	/**
	|--------------------------------------------------
	| Return absolute configured source roots
	|--------------------------------------------------
	*/
	return sourceRoots.map((sourceRoot) => resolve(packagePath, sourceRoot));
};

/**
|--------------------------------------------------
| Resolve conventional package source root
|--------------------------------------------------
*/
const resolveConventionalSourceRoot = (packagePath: string, files: ScannedFile[]) => {
	/**
	|--------------------------------------------------
	| Prefer package src directory when source exists
	|--------------------------------------------------
	*/
	const sourcePath = join(packagePath, 'src');
	if (files.some((file) => isInsidePath(sourcePath, file.path))) return sourcePath;

	/**
	|--------------------------------------------------
	| Return package directory as fallback
	|--------------------------------------------------
	*/
	return packagePath;
};

/**
|--------------------------------------------------
| Read Nest source-root configurations
|--------------------------------------------------
*/
const readNestSourceRoots = async (configPath: string) => {
	/**
	|--------------------------------------------------
	| Parse Nest configuration
	|--------------------------------------------------
	*/
	const config = await readJsonFile<{
		sourceRoot?: string;
		projects?: Record<string, { sourceRoot?: string }>;
	}>(configPath);

	/**
	|--------------------------------------------------
	| Collect top-level and monorepo source roots
	|--------------------------------------------------
	*/
	const sourceRoots = [
		config.sourceRoot,
		...Object.values(config.projects || {}).map((project) => project.sourceRoot),
	].filter((sourceRoot): sourceRoot is string => Boolean(sourceRoot));

	/**
	|--------------------------------------------------
	| Return unique configured source roots
	|--------------------------------------------------
	*/
	return [...new Set(sourceRoots)];
};

/**
|--------------------------------------------------
| Read JSON file
|--------------------------------------------------
*/
const readJsonFile = async <Value>(path: string): Promise<Value> => {
	/**
	|--------------------------------------------------
	| Return parsed JSON value
	|--------------------------------------------------
	*/
	return JSON.parse(await readFile(path, 'utf8')) as Value;
};

/**
|--------------------------------------------------
| Build manifest evidence
|--------------------------------------------------
*/
const buildManifestEvidence = (framework: BackendFramework, sourceRoot: string, manifestPath: string) => {
	/**
	|--------------------------------------------------
	| Prepare package manifest evidence
	|--------------------------------------------------
	*/
	const evidence = [`Package manifest: ${manifestPath}`];

	/**
	|--------------------------------------------------
	| Add framework and source-root evidence
	|--------------------------------------------------
	*/
	if (framework !== 'unknown') evidence.push(`Framework dependency: ${framework}`);
	evidence.push(`Source root: ${sourceRoot}`);

	/**
	|--------------------------------------------------
	| Return collected evidence
	|--------------------------------------------------
	*/
	return evidence;
};

/**
|--------------------------------------------------
| Detect primary source language
|--------------------------------------------------
*/
const detectPrimaryLanguage = (files: ScannedFile[]): SourceLanguage => {
	/**
	|--------------------------------------------------
	| Count TypeScript source files
	|--------------------------------------------------
	*/
	const typeScriptFiles = files.filter((file) => detectSourceLanguage(file.path) === 'typescript').length;

	/**
	|--------------------------------------------------
	| Return language represented by most source files
	|--------------------------------------------------
	*/
	return typeScriptFiles >= files.length / 2 ? 'typescript' : 'javascript';
};

/**
|--------------------------------------------------
| Detect source language
|--------------------------------------------------
*/
const detectSourceLanguage = (path: string): SourceLanguage => {
	/**
	|--------------------------------------------------
	| Return language from source extension
	|--------------------------------------------------
	*/
	return /\.[cm]?ts$/.test(path) ? 'typescript' : 'javascript';
};

/**
|--------------------------------------------------
| Calculate backend confidence
|--------------------------------------------------
*/
const calculateRootConfidence = (framework: BackendFramework, moduleCount: number, evidenceCount: number) => {
	/**
	|--------------------------------------------------
	| Combine framework, module, and evidence scores
	|--------------------------------------------------
	*/
	const frameworkScore = framework === 'generic-node' ? 0.35 : 0.65;
	const moduleScore = moduleCount > 0 ? 0.2 : 0;
	const evidenceScore = Math.min(0.15, evidenceCount * 0.05);

	/**
	|--------------------------------------------------
	| Return confidence capped at one
	|--------------------------------------------------
	*/
	return Math.min(1, Number((frameworkScore + moduleScore + evidenceScore).toFixed(2)));
};

/**
|--------------------------------------------------
| Remove duplicate module paths
|--------------------------------------------------
*/
const deduplicateModules = (modules: BackendModule[]) => {
	/**
	|--------------------------------------------------
	| Index modules by relative path
	|--------------------------------------------------
	*/
	const unique = new Map(modules.map((module) => [module.path, module]));

	/**
	|--------------------------------------------------
	| Return unique modules in portable path order
	|--------------------------------------------------
	*/
	return [...unique.values()].sort((left, right) => left.path.localeCompare(right.path));
};

/**
|--------------------------------------------------
| Determine whether file contributes discovery evidence
|--------------------------------------------------
*/
const isDiscoveryFile = (name: string) => {
	/**
	|--------------------------------------------------
	| Return manifest, configuration, or source match
	|--------------------------------------------------
	*/
	return name === 'nest-cli.json' || name === 'package.json' || isSourceFile(name);
};

/**
|--------------------------------------------------
| Determine whether path is supported source file
|--------------------------------------------------
*/
const isSourceFile = (path: string) => {
	/**
	|--------------------------------------------------
	| Return supported extension result
	|--------------------------------------------------
	*/
	return SOURCE_EXTENSIONS.has(extname(path));
};

/**
|--------------------------------------------------
| Determine whether package contains backend source
|--------------------------------------------------
*/
const containsBackendSource = (files: ScannedFile[]) => {
	/**
	|--------------------------------------------------
	| Match common backend source-file conventions
	|--------------------------------------------------
	*/
	return files.some((file) =>
		/\.(controller|gateway|module|resolver|route|router|server|service)\.[cm]?[jt]s$/.test(basename(file.path)),
	);
};

/**
|--------------------------------------------------
| Determine whether child belongs to parent path
|--------------------------------------------------
*/
const isInsidePath = (parentPath: string, childPath: string) => {
	/**
	|--------------------------------------------------
	| Calculate normalized relative path
	|--------------------------------------------------
	*/
	const value = relative(parentPath, childPath);

	/**
	|--------------------------------------------------
	| Return path containment result
	|--------------------------------------------------
	*/
	return value === '' || (!value.startsWith('..') && !value.startsWith('/'));
};

/**
|--------------------------------------------------
| Find nearest package manifest owning source file
|--------------------------------------------------
*/
const findOwningManifestDirectory = (filePath: string, manifestDirectories: string[]) => {
	/**
	|--------------------------------------------------
	| Collect package directories containing source file
	|--------------------------------------------------
	*/
	const owners = manifestDirectories.filter((directoryPath) => isInsidePath(directoryPath, filePath));

	/**
	|--------------------------------------------------
	| Return deepest containing package directory
	|--------------------------------------------------
	*/
	return owners.sort((left, right) => right.length - left.length)[0];
};

/**
|--------------------------------------------------
| Find nearest containing path
|--------------------------------------------------
*/
const findNearestContainingPath = (filePath: string, parentPaths: string[]) => {
	/**
	|--------------------------------------------------
	| Collect parent paths containing file
	|--------------------------------------------------
	*/
	const owners = parentPaths.filter((parentPath) => isInsidePath(parentPath, filePath));

	/**
	|--------------------------------------------------
	| Return deepest containing path
	|--------------------------------------------------
	*/
	return owners.sort((left, right) => right.length - left.length)[0];
};

/**
|--------------------------------------------------
| Convert path into portable relative path
|--------------------------------------------------
*/
const toRelativePath = (parentPath: string, childPath: string) => {
	/**
	|--------------------------------------------------
	| Return slash-normalized relative path
	|--------------------------------------------------
	*/
	return relative(parentPath, childPath).replaceAll('\\', '/');
};

/**
|--------------------------------------------------
| Create stable discovery identifier
|--------------------------------------------------
*/
const createStableId = (value: string) => {
	/**
	|--------------------------------------------------
	| Return short content-derived identifier
	|--------------------------------------------------
	*/
	return createHash('sha256').update(value).digest('hex').slice(0, 16);
};

/**
|--------------------------------------------------
| Determine whether source path appears generated
|--------------------------------------------------
*/
const isGeneratedPath = (path: string) => {
	/**
	|--------------------------------------------------
	| Return generated-directory match
	|--------------------------------------------------
	*/
	return /(^|\/)(__generated__|codegen|generated)(\/|$)/i.test(path);
};

/**
|--------------------------------------------------
| Export backend discovery
|--------------------------------------------------
*/
export { discoverBackends };
