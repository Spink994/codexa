#!/usr/bin/env node

/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import process from 'node:process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { discoverBackends } from '@codexa/discovery';
import { validateProfileFile } from './profile-validator.js';
import { formatDiscoveryResult } from './discovery-reporter.js';

/**
|--------------------------------------------------
| CLI output writer
|--------------------------------------------------
*/
interface CliWriter {
	/**
	|--------------------------------------------------
	| Write standard command output
	|--------------------------------------------------
	*/
	log(message: string): void;

	/**
	|--------------------------------------------------
	| Write command failure output
	|--------------------------------------------------
	*/
	error(message: string): void;
}

/**
|--------------------------------------------------
| Run Codexa command line interface
|--------------------------------------------------
*/
const runCli = async (args: string[], writer: CliWriter = console) => {
	/**
	|--------------------------------------------------
	| Read requested command
	|--------------------------------------------------
	*/
	const [command] = args;

	/**
	|--------------------------------------------------
	| Validate selected style profile
	|--------------------------------------------------
	*/
	if (command === 'validate-profile') {
		/**
		|--------------------------------------------------
		| Read profile path argument
		|--------------------------------------------------
		*/
		const profilePath = args[1];

		/**
		|--------------------------------------------------
		| Reject missing profile path
		|--------------------------------------------------
		*/
		if (!profilePath) {
			writer.error('Usage: codexa validate-profile <profile.json>');
			return 1;
		}

		/**
		|--------------------------------------------------
		| Validate selected profile file
		|--------------------------------------------------
		*/
		const result = await validateProfileFile(resolve(profilePath));

		/**
		|--------------------------------------------------
		| Print profile validation messages
		|--------------------------------------------------
		*/
		result.messages.forEach((message) => {
			/**
			|--------------------------------------------------
			| Route message according to validation outcome
			|--------------------------------------------------
			*/
			if (result.valid) writer.log(message);
			else writer.error(message);
		});

		/**
		|--------------------------------------------------
		| Return profile validation exit code
		|--------------------------------------------------
		*/
		return result.valid ? 0 : 1;
	}

	/**
	|--------------------------------------------------
	| Discover backend roots and modules
	|--------------------------------------------------
	*/
	if (command === 'discover') {
		/**
		|--------------------------------------------------
		| Resolve optional workspace and output mode
		|--------------------------------------------------
		*/
		const json = args.includes('--json');
		const cache = !args.includes('--no-cache');
		const gitState = !args.includes('--no-git');
		const workspaceArgument = args.slice(1).find((argument) => !argument.startsWith('--'));
		const workspacePath = resolve(workspaceArgument || '.');

		/**
		|--------------------------------------------------
		| Run local backend discovery
		|--------------------------------------------------
		*/
		const result = await discoverBackends(workspacePath, {
			cache,
			gitState,
		});

		/**
		|--------------------------------------------------
		| Print requested discovery representation
		|--------------------------------------------------
		*/
		writer.log(json ? JSON.stringify(result, null, 2) : formatDiscoveryResult(result));

		/**
		|--------------------------------------------------
		| Return successful discovery exit code
		|--------------------------------------------------
		*/
		return 0;
	}

	/**
	|--------------------------------------------------
	| Reject unsupported command
	|--------------------------------------------------
	*/
	writer.error(
		'Usage: codexa <discover [workspace] [--json] [--no-cache] [--no-git] | validate-profile <profile.json>>',
	);
	return 1;
};

/**
|--------------------------------------------------
| Determine whether module is the active CLI entry point
|--------------------------------------------------
*/
const isEntryPoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

/**
|--------------------------------------------------
| Execute command when loaded as the active entry point
|--------------------------------------------------
*/
if (isEntryPoint) {
	runCli(process.argv.slice(2))
		.then((exitCode) => {
			/**
			|--------------------------------------------------
			| Assign completed command exit code
			|--------------------------------------------------
			*/
			process.exitCode = exitCode;
		})
		.catch((error: unknown) => {
			/**
			|--------------------------------------------------
			| Print unexpected command failure
			|--------------------------------------------------
			*/
			console.error(error instanceof Error ? error.message : String(error));

			/**
			|--------------------------------------------------
			| Mark command as failed
			|--------------------------------------------------
			*/
			process.exitCode = 1;
		});
}

/**
|--------------------------------------------------
| Export command line runner
|--------------------------------------------------
*/
export { runCli, type CliWriter };
