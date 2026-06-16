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
import { ProviderFactory } from './provider.factory.js';
import { ProvidersController } from './providers.controller.js';

/**
|--------------------------------------------------
| Provider configuration and instantiation module
|--------------------------------------------------
*/
@Module({
	providers: [ProviderFactory],
	controllers: [ProvidersController],
	exports: [ProviderFactory],
})
export class ProvidersModule {}
