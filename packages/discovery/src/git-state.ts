/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

/**
|--------------------------------------------------
| Promise-based process execution
|--------------------------------------------------
*/
const execFileAsync = promisify(execFile);

/**
|--------------------------------------------------
| Read Git dirty-file paths
|--------------------------------------------------
*/
const readGitDirtyFiles = async (workspacePath: string) => {
	try {
		/**
		|--------------------------------------------------
		| Request tracked and untracked working-tree changes
		|--------------------------------------------------
		*/
		const { stdout } = await execFileAsync(
			'git',
			['status', '--porcelain=v1', '-z', '--untracked-files=all'],
			{
				cwd: workspacePath,
				encoding: 'utf8',
				maxBuffer: 10 * 1024 * 1024,
			},
		);

		/**
		|--------------------------------------------------
		| Convert porcelain records into portable file paths
		|--------------------------------------------------
		*/
		const dirtyFiles = new Set<string>();
		const records = stdout.split('\0').filter(Boolean);

		for (let index = 0; index < records.length; index += 1) {
			/**
			|--------------------------------------------------
			| Read status record and primary path
			|--------------------------------------------------
			*/
			const record = records[index] || '';
			const status = record.slice(0, 2);
			const path = record.slice(3).replaceAll('\\', '/');
			if (path) dirtyFiles.add(path);

			/**
			|--------------------------------------------------
			| Read second path emitted for rename records
			|--------------------------------------------------
			*/
			if (status.includes('R') || status.includes('C')) {
				const renamedPath = records[index + 1];
				if (renamedPath) dirtyFiles.add(renamedPath.replaceAll('\\', '/'));
				index += 1;
			}
		}

		/**
		|--------------------------------------------------
		| Return collected dirty-file paths
		|--------------------------------------------------
		*/
		return dirtyFiles;
	} catch {
		/**
		|--------------------------------------------------
		| Return empty state outside Git repositories
		|--------------------------------------------------
		*/
		return new Set<string>();
	}
};

/**
|--------------------------------------------------
| Export Git state reader
|--------------------------------------------------
*/
export { readGitDirtyFiles };
