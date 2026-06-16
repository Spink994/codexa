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
import { PreviewStore } from './preview.store.js';
import { IntakeService } from './intake.service.js';
import { PreviewController } from './preview.controller.js';

/**
|--------------------------------------------------
| Source intake module
|--------------------------------------------------
*/
@Module({
	controllers: [PreviewController],
	providers: [IntakeService, PreviewStore],
	exports: [IntakeService, PreviewStore],
})
export class IntakeModule {}
