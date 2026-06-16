/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { Module } from '@nestjs/common';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { RunsModule } from './runs/runs.module.js';
import { AuthModule } from './auth/auth.module.js';
import { IntakeModule } from './intake/intake.module.js';
import { ProfilesModule } from './profiles/profiles.module.js';
import { ProvidersModule } from './providers/providers.module.js';
import { ConnectionsModule } from './connections/connections.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { PersistenceModule } from './persistence/persistence.module.js';

/**
|--------------------------------------------------
| Root application module
|--------------------------------------------------
*/
@Module({
	imports: [
		PersistenceModule,
		AuthModule,
		ProvidersModule,
		IntakeModule,
		ProfilesModule,
		ConnectionsModule,
		SettingsModule,
		RunsModule,
	],
})
export class AppModule {}
