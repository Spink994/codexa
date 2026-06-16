/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { Global, Module } from '@nestjs/common';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import {
	RUN_REPOSITORY,
	USER_REPOSITORY,
	PROFILE_REPOSITORY,
	CONNECTION_REPOSITORY,
	SETTINGS_REPOSITORY,
} from './repositories.js';
import {
	FileRunRepository,
	FileUserRepository,
	FileProfileRepository,
	FileConnectionRepository,
	FileSettingsRepository,
} from './file-backed.js';

/**
|--------------------------------------------------
| Global persistence module
|--------------------------------------------------
| Binds repository tokens to durable file-backed
| implementations (JSON under CODEXA_DATA_DIR). Swap
| these `useClass` bindings for a real database to
| scale beyond a single node (see README).
|--------------------------------------------------
*/
@Global()
@Module({
	providers: [
		{ provide: USER_REPOSITORY, useClass: FileUserRepository },
		{ provide: CONNECTION_REPOSITORY, useClass: FileConnectionRepository },
		{ provide: SETTINGS_REPOSITORY, useClass: FileSettingsRepository },
		{ provide: PROFILE_REPOSITORY, useClass: FileProfileRepository },
		{ provide: RUN_REPOSITORY, useClass: FileRunRepository },
	],
	exports: [USER_REPOSITORY, CONNECTION_REPOSITORY, SETTINGS_REPOSITORY, PROFILE_REPOSITORY, RUN_REPOSITORY],
})
export class PersistenceModule {}
