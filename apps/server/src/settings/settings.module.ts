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
import { SettingsController } from './settings.controller.js';

@Module({
	controllers: [SettingsController],
})
export class SettingsModule {}
