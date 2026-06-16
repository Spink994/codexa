/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { Injectable, BadRequestException } from '@nestjs/common';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import {
	createOllamaProvider,
	createReferenceProvider,
	createOpenAiProviderFromApiKey,
	createAnthropicProviderFromApiKey,
	createOpenAiCompatibleProvider,
	type FormatProvider,
} from '@codexa/provider';
import type { ProviderConfig } from '../runs/run.types.js';

/**
|--------------------------------------------------
| Builds format providers from per-run configuration
|--------------------------------------------------
*/
@Injectable()
export class ProviderFactory {
	/**
	|--------------------------------------------------
	| Build a format provider for the given config
	|--------------------------------------------------
	*/
	build(config: ProviderConfig): FormatProvider {
		/**
		|--------------------------------------------------
		| Select the provider implementation by identifier
		|--------------------------------------------------
		*/
		switch (config.id) {
			/**
			|--------------------------------------------------
			| Reference provider for offline testing
			|--------------------------------------------------
			*/
			case 'reference':
				return createReferenceProvider();

			/**
			|--------------------------------------------------
			| Anthropic provider requires an API key
			|--------------------------------------------------
			*/
			case 'anthropic':
				return createAnthropicProviderFromApiKey({
					model: config.model,
					effort: config.effort,
					apiKey: this.requireApiKey(config),
				});

			/**
			|--------------------------------------------------
			| OpenAI provider requires an API key
			|--------------------------------------------------
			*/
			case 'openai':
				return createOpenAiProviderFromApiKey({
					model: config.model,
					baseURL: config.baseURL,
					apiKey: this.requireApiKey(config),
				});

			/**
			|--------------------------------------------------
			| OpenAI-compatible provider requires a base URL
			|--------------------------------------------------
			*/
			case 'openai-compatible':
				return createOpenAiCompatibleProvider({
					apiKey: config.apiKey,
					model: this.requireModel(config),
					baseURL: this.requireBaseUrl(config),
				});

			/**
			|--------------------------------------------------
			| Ollama provider runs locally by default
			|--------------------------------------------------
			*/
			case 'ollama':
				return createOllamaProvider({
					baseURL: config.baseURL,
					model: this.requireModel(config),
				});

			/**
			|--------------------------------------------------
			| Reject unknown provider identifiers
			|--------------------------------------------------
			*/
			default:
				throw new BadRequestException(`Unknown provider "${config.id}".`);
		}
	}

	/**
	|--------------------------------------------------
	| Require an API key on the config
	|--------------------------------------------------
	*/
	private requireApiKey(config: ProviderConfig): string {
		/**
		|--------------------------------------------------
		| Reject a missing secret for remote providers
		|--------------------------------------------------
		*/
		if (!config.apiKey) throw new BadRequestException(`Provider "${config.id}" requires an apiKey.`);

		/**
		|--------------------------------------------------
		| Return the validated API key
		|--------------------------------------------------
		*/
		return config.apiKey;
	}

	/**
	|--------------------------------------------------
	| Require a model on the config
	|--------------------------------------------------
	*/
	private requireModel(config: ProviderConfig): string {
		/**
		|--------------------------------------------------
		| Reject a missing model for these providers
		|--------------------------------------------------
		*/
		if (!config.model) throw new BadRequestException(`Provider "${config.id}" requires a model.`);

		/**
		|--------------------------------------------------
		| Return the validated model
		|--------------------------------------------------
		*/
		return config.model;
	}

	/**
	|--------------------------------------------------
	| Require a base URL on the config
	|--------------------------------------------------
	*/
	private requireBaseUrl(config: ProviderConfig): string {
		/**
		|--------------------------------------------------
		| Reject a missing base URL for compatible providers
		|--------------------------------------------------
		*/
		if (!config.baseURL) throw new BadRequestException(`Provider "${config.id}" requires a baseURL.`);

		/**
		|--------------------------------------------------
		| Return the validated base URL
		|--------------------------------------------------
		*/
		return config.baseURL;
	}
}
