/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { Get, Post, Body, Controller } from '@nestjs/common';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { ProviderFactory } from './provider.factory.js';
import type { ProviderConfig } from '../runs/run.types.js';

/**
|--------------------------------------------------
| Available provider descriptor
|--------------------------------------------------
*/
interface ProviderDescriptor {
	/**
	|--------------------------------------------------
	| Provider identifier
	|--------------------------------------------------
	*/
	id: ProviderConfig['id'];

	/**
	|--------------------------------------------------
	| Whether the provider runs remotely
	|--------------------------------------------------
	*/
	remote: boolean;

	/**
	|--------------------------------------------------
	| Whether the provider needs an API key
	|--------------------------------------------------
	*/
	requiresApiKey: boolean;
}

/**
|--------------------------------------------------
| Exposes provider listing and connection testing
|--------------------------------------------------
*/
@Controller('providers')
export class ProvidersController {
	/**
	|--------------------------------------------------
	| Inject the provider factory
	|--------------------------------------------------
	*/
	constructor(private readonly factory: ProviderFactory) {}

	/**
	|--------------------------------------------------
	| List the providers the server can instantiate
	|--------------------------------------------------
	*/
	@Get()
	list(): ProviderDescriptor[] {
		/**
		|--------------------------------------------------
		| Return the static provider catalogue
		|--------------------------------------------------
		*/
		return [
			{ id: 'reference', remote: false, requiresApiKey: false },
			{ id: 'ollama', remote: false, requiresApiKey: false },
			{ id: 'openai', remote: true, requiresApiKey: true },
			{ id: 'anthropic', remote: true, requiresApiKey: true },
			{ id: 'openai-compatible', remote: true, requiresApiKey: false },
		];
	}

	/**
	|--------------------------------------------------
	| Test connectivity for a provider configuration
	|--------------------------------------------------
	*/
	@Post('test')
	async test(@Body() config: ProviderConfig) {
		/**
		|--------------------------------------------------
		| Build the provider and run its connection test
		|--------------------------------------------------
		*/
		const provider = this.factory.build(config);
		return provider.testConnection();
	}
}
