/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import AdmZip from 'adm-zip';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { Injectable, BadRequestException } from '@nestjs/common';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import type { SourceLanguage } from '@codexa/core';
import type { PlanModule, SnippetIntake } from '../runs/run.types.js';

/**
|--------------------------------------------------
| Promisified git invocation
|--------------------------------------------------
*/
const execFileAsync = promisify(execFile);

/**
|--------------------------------------------------
| Source file extensions eligible for formatting
|--------------------------------------------------
*/
const TYPESCRIPT_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts'];
const JAVASCRIPT_EXTENSIONS = ['.js', '.jsx', '.mjs', '.cjs'];

/**
|--------------------------------------------------
| Path fragments excluded from zip intake
|--------------------------------------------------
*/
const EXCLUDED_FRAGMENTS = ['node_modules/', '/dist/', '/build/', '/.git/', '.d.ts'];

/**
|--------------------------------------------------
| Builds plan modules from uploaded or pasted source
|--------------------------------------------------
*/
@Injectable()
export class IntakeService {
	/**
	|--------------------------------------------------
	| Build a single-file plan module from a snippet
	|--------------------------------------------------
	*/
	fromSnippet(intake: SnippetIntake): PlanModule[] {
		/**
		|--------------------------------------------------
		| Reject empty snippet content
		|--------------------------------------------------
		*/
		if (!intake.content.trim()) throw new BadRequestException('Snippet content is empty.');

		/**
		|--------------------------------------------------
		| Return one module owning the pasted file
		|--------------------------------------------------
		*/
		return [
			{
				id: 'snippet',
				files: [
					{
						path: `/${intake.filename}`,
						source: intake.content,
						language: this.detectLanguage(intake.filename),
					},
				],
			},
		];
	}

	/**
	|--------------------------------------------------
	| Build plan modules from an uploaded zip archive
	|--------------------------------------------------
	*/
	fromZip(buffer: Buffer): PlanModule[] {
		/**
		|--------------------------------------------------
		| Read the archive entries
		|--------------------------------------------------
		*/
		const entries = this.readZipEntries(buffer);

		/**
		|--------------------------------------------------
		| Group eligible files by their parent directory
		|--------------------------------------------------
		*/
		const byDirectory = new Map<string, PlanModule['files']>();
		entries.forEach((entry) => {
			/**
			|--------------------------------------------------
			| Append the file to its directory module
			|--------------------------------------------------
			*/
			const directory = entry.path.slice(0, entry.path.lastIndexOf('/')) || '/';
			const files = byDirectory.get(directory) ?? [];
			files.push(entry);
			byDirectory.set(directory, files);
		});

		/**
		|--------------------------------------------------
		| Reject archives with no eligible source files
		|--------------------------------------------------
		*/
		if (byDirectory.size === 0) throw new BadRequestException('Archive contains no TypeScript or JavaScript files.');

		/**
		|--------------------------------------------------
		| Return one module per directory
		|--------------------------------------------------
		*/
		return Array.from(byDirectory.entries()).map(([directory, files]) => ({
			files,
			id: directory,
		}));
	}

	/**
	|--------------------------------------------------
	| Clone a git repository and build plan modules
	|--------------------------------------------------
	*/
	async fromRepo(url: string, token?: string): Promise<PlanModule[]> {
		/**
		|--------------------------------------------------
		| Reject obviously invalid repository URLs
		|--------------------------------------------------
		*/
		if (!/^https?:\/\//.test(url)) throw new BadRequestException('Repository URL must be http(s).');

		/**
		|--------------------------------------------------
		| Create a temporary clone directory
		|--------------------------------------------------
		*/
		const directory = mkdtempSync(join(tmpdir(), 'codexa-repo-'));

		/**
		|--------------------------------------------------
		| Shallow-clone the repository, then build modules
		|--------------------------------------------------
		*/
		try {
			await execFileAsync('git', ['clone', '--depth', '1', this.authenticatedUrl(url, token), directory]);
			return this.fromDirectory(directory);
		} catch (error) {
			throw new BadRequestException(`Could not clone repository: ${error instanceof Error ? error.message : error}`);
		} finally {
			/**
			|--------------------------------------------------
			| Always remove the temporary clone
			|--------------------------------------------------
			*/
			rmSync(directory, { recursive: true, force: true });
		}
	}

	/**
	|--------------------------------------------------
	| Build plan modules from a directory tree
	|--------------------------------------------------
	*/
	fromDirectory(rootDir: string): PlanModule[] {
		/**
		|--------------------------------------------------
		| Group eligible files by their parent directory
		|--------------------------------------------------
		*/
		const byDirectory = new Map<string, PlanModule['files']>();
		this.walkFiles(rootDir).forEach((absolutePath) => {
			/**
			|--------------------------------------------------
			| Skip files that are not eligible to format
			|--------------------------------------------------
			*/
			const relativePath = `/${relative(rootDir, absolutePath).split('\\').join('/')}`;
			if (!this.isEligible(relativePath)) return;

			/**
			|--------------------------------------------------
			| Append the file to its directory module
			|--------------------------------------------------
			*/
			const directory = relativePath.slice(0, relativePath.lastIndexOf('/')) || '/';
			const files = byDirectory.get(directory) ?? [];
			files.push({
				path: relativePath,
				language: this.detectLanguage(relativePath),
				source: readFileSync(absolutePath, 'utf8'),
			});
			byDirectory.set(directory, files);
		});

		/**
		|--------------------------------------------------
		| Reject trees with no eligible source files
		|--------------------------------------------------
		*/
		if (byDirectory.size === 0) throw new BadRequestException('Repository contains no TypeScript or JavaScript files.');

		/**
		|--------------------------------------------------
		| Return one module per directory
		|--------------------------------------------------
		*/
		return Array.from(byDirectory.entries()).map(([id, files]) => ({ id, files }));
	}

	/**
	|--------------------------------------------------
	| Recursively list files under a directory
	|--------------------------------------------------
	*/
	private walkFiles(root: string): string[] {
		/**
		|--------------------------------------------------
		| Collect files, skipping vendored and VCS folders
		|--------------------------------------------------
		*/
		const found: string[] = [];
		const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next']);
		const visit = (dir: string) => {
			for (const entry of readdirSync(dir, { withFileTypes: true })) {
				if (entry.isDirectory()) {
					if (!skipDirs.has(entry.name)) visit(join(dir, entry.name));
				} else if (entry.isFile()) {
					found.push(join(dir, entry.name));
				}
			}
		};
		visit(root);
		return found;
	}

	/**
	|--------------------------------------------------
	| Inject a token into an https clone URL
	|--------------------------------------------------
	*/
	private authenticatedUrl(url: string, token?: string): string {
		/**
		|--------------------------------------------------
		| Return the URL unchanged when no token is given
		|--------------------------------------------------
		*/
		if (!token) return url;

		/**
		|--------------------------------------------------
		| Embed the token as basic credentials
		|--------------------------------------------------
		*/
		return url.replace(/^https:\/\//, `https://x-access-token:${token}@`);
	}

	/**
	|--------------------------------------------------
	| Read eligible source entries from a zip buffer
	|--------------------------------------------------
	*/
	private readZipEntries(buffer: Buffer): PlanModule['files'] {
		/**
		|--------------------------------------------------
		| Parse the archive, rejecting malformed input
		|--------------------------------------------------
		*/
		let zip: AdmZip;
		try {
			zip = new AdmZip(buffer);
		} catch {
			throw new BadRequestException('Uploaded file is not a valid zip archive.');
		}

		/**
		|--------------------------------------------------
		| Map eligible non-directory entries to plan files
		|--------------------------------------------------
		*/
		return zip
			.getEntries()
			.filter((entry) => !entry.isDirectory)
			.filter((entry) => this.isEligible(entry.entryName))
			.map((entry) => ({
				path: `/${entry.entryName}`,
				language: this.detectLanguage(entry.entryName),
				source: entry.getData().toString('utf8'),
			}));
	}

	/**
	|--------------------------------------------------
	| Determine whether an archived path is eligible
	|--------------------------------------------------
	*/
	private isEligible(entryName: string): boolean {
		/**
		|--------------------------------------------------
		| Exclude vendored, built, and declaration files
		|--------------------------------------------------
		*/
		const normalized = `/${entryName}`;
		if (EXCLUDED_FRAGMENTS.some((fragment) => normalized.includes(fragment))) return false;

		/**
		|--------------------------------------------------
		| Include only TypeScript and JavaScript sources
		|--------------------------------------------------
		*/
		return [...TYPESCRIPT_EXTENSIONS, ...JAVASCRIPT_EXTENSIONS].some((extension) => entryName.endsWith(extension));
	}

	/**
	|--------------------------------------------------
	| Detect the source language from a file name
	|--------------------------------------------------
	*/
	private detectLanguage(filename: string): SourceLanguage {
		/**
		|--------------------------------------------------
		| Treat JavaScript extensions as javascript
		|--------------------------------------------------
		*/
		if (JAVASCRIPT_EXTENSIONS.some((extension) => filename.endsWith(extension))) return 'javascript';

		/**
		|--------------------------------------------------
		| Default everything else to typescript
		|--------------------------------------------------
		*/
		return 'typescript';
	}
}
