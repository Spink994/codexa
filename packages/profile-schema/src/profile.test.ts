/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import assert from 'node:assert/strict';
import test from 'node:test';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { PROFILE_SCHEMA_VERSION, safeParseStyleProfile } from './profile.js';

/**
|--------------------------------------------------
| Create valid test profile
|--------------------------------------------------
*/
const createValidProfile = () => {
	/**
	|--------------------------------------------------
	| Return complete neutral profile fixture
	|--------------------------------------------------
	*/
	return {
		version: '0.1.0',
		id: 'starter-backend',
		name: 'Starter Backend',
		frameworks: ['generic-node'],
		schemaVersion: PROFILE_SCHEMA_VERSION,
		languages: ['javascript', 'typescript'],
		description: 'Neutral backend formatting defaults.',
		/**
		|--------------------------------------------------
		| Rules
		|--------------------------------------------------
		*/
		rules: {
			/**
			|--------------------------------------------------
			| Imports
			|--------------------------------------------------
			*/
			imports: {
				enabled: true,
				sort: 'preserve',
				sortNamedImports: false,
				groups: ['built-in', 'external', 'custom', 'side-effect'],
				/**
				|--------------------------------------------------
				| Sections
				|--------------------------------------------------
				*/
				sections: [
					{
						label: 'Dependencies',
						groups: ['built-in', 'external'],
					},
					{
						groups: ['custom'],
						label: 'Project imports',
					},
				],
			},

			/**
			|--------------------------------------------------
			| Objects
			|--------------------------------------------------
			*/
			objects: {
				safeOnly: true,
				order: 'preserve',
			},

			/**
			|--------------------------------------------------
			| Comments
			|--------------------------------------------------
			*/
			comments: {
				enabled: true,
				style: 'jsdoc',
				detail: 'concise',
				requireFunctionComments: false,
				requirePropertyComments: false,
				requireBlankLineBoundaryComments: false,
			},

			/**
			|--------------------------------------------------
			| Conditions
			|--------------------------------------------------
			*/
			conditions: {
				preferGuardClauses: false,
				allowSingleLineGuards: true,
			},

			/**
			|--------------------------------------------------
			| Validation
			|--------------------------------------------------
			*/
			validation: {
				requireSyntaxValidation: true,
				requireSymbolPreservation: true,
			},
		},
	};
};

/**
|--------------------------------------------------
| Validate complete profile
|--------------------------------------------------
*/
test('accepts a complete supported profile', () => {
	/**
	|--------------------------------------------------
	| Validate profile fixture
	|--------------------------------------------------
	*/
	const result = safeParseStyleProfile(createValidProfile());

	/**
	|--------------------------------------------------
	| Confirm successful validation
	|--------------------------------------------------
	*/
	assert.equal(result.success, true);
});

/**
|--------------------------------------------------
| Reject unsupported schema version
|--------------------------------------------------
*/
test('rejects an unsupported schema version', () => {
	/**
	|--------------------------------------------------
	| Prepare profile with incompatible schema version
	|--------------------------------------------------
	*/
	const profile = {
		...createValidProfile(),
		schemaVersion: PROFILE_SCHEMA_VERSION + 1,
	};

	/**
	|--------------------------------------------------
	| Validate incompatible profile
	|--------------------------------------------------
	*/
	const result = safeParseStyleProfile(profile);

	/**
	|--------------------------------------------------
	| Confirm failed validation
	|--------------------------------------------------
	*/
	assert.equal(result.success, false);
});
