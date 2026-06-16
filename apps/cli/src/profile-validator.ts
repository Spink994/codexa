/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { readFile } from 'node:fs/promises';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { safeParseStyleProfile } from '@codexa/profile-schema';

/**
|--------------------------------------------------
| Profile validation response
|--------------------------------------------------
*/
interface ProfileValidationResponse {
	/**
	|--------------------------------------------------
	| Whether the profile passed every schema requirement
	|--------------------------------------------------
	*/
	valid: boolean;

	/**
	|--------------------------------------------------
	| Human-readable validation messages
	|--------------------------------------------------
	*/
	messages: string[];
}

/**
|--------------------------------------------------
| Validate profile file
|--------------------------------------------------
*/
const validateProfileFile = async (profilePath: string): Promise<ProfileValidationResponse> => {
	/**
	|--------------------------------------------------
	| Read profile source from disk
	|--------------------------------------------------
	*/
	const source = await readFile(profilePath, 'utf8');

	/**
	|--------------------------------------------------
	| Parse profile JSON source
	|--------------------------------------------------
	*/
	const input: unknown = JSON.parse(source);

	/**
	|--------------------------------------------------
	| Validate parsed profile against current schema
	|--------------------------------------------------
	*/
	const result = safeParseStyleProfile(input);

	/**
	|--------------------------------------------------
	| Return successful validation response
	|--------------------------------------------------
	*/
	if (result.success) {
		return {
			valid: true,
			messages: [`Profile "${result.data.name}" is valid.`],
		};
	}

	/**
	|--------------------------------------------------
	| Convert schema issues into readable path messages
	|--------------------------------------------------
	*/
	const messages = result.error.issues.map((issue) => {
		/**
		|--------------------------------------------------
		| Build issue path with root fallback
		|--------------------------------------------------
		*/
		const path = issue.path.length > 0 ? issue.path.join('.') : 'profile';

		/**
		|--------------------------------------------------
		| Return formatted validation issue
		|--------------------------------------------------
		*/
		return `${path}: ${issue.message}`;
	});

	/**
	|--------------------------------------------------
	| Return failed validation response
	|--------------------------------------------------
	*/
	return {
		messages,
		valid: false,
	};
};

/**
|--------------------------------------------------
| Export profile validator
|--------------------------------------------------
*/
export { validateProfileFile, type ProfileValidationResponse };
