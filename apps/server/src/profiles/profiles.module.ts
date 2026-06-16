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
import { ProfilesController } from './profiles.controller.js';

/**
|--------------------------------------------------
| Saved profiles module
|--------------------------------------------------
*/
@Module({
	controllers: [ProfilesController],
})
export class ProfilesModule {}
