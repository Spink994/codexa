/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { Body, Controller, Get, Inject, Put, UnauthorizedException, BadRequestException } from '@nestjs/common';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import type { CodeFormatPreferences } from '@codexa/provider';
import type { ProviderConfig } from '../runs/run.types.js';
import { CurrentUser, ANONYMOUS_USER } from '../auth/current-user.js';
import { SETTINGS_REPOSITORY, type SettingsRepository } from '../persistence/repositories.js';

interface UpdateSettingsBody {
	provider?: ProviderConfig;
	styleProfile?: string;
	formatting?: CodeFormatPreferences;
}

/**
|--------------------------------------------------
| Prepare config
|--------------------------------------------------
*/
const DEFAULT_SETTINGS = {
	styleProfile: 'team-default',
	provider: { id: 'reference' } as ProviderConfig,
	formatting: {
		semi: true,
		useTabs: true,
		tabWidth: 4,
		printWidth: 120,
		singleQuote: true,
		trailingComma: 'all',
		bracketSpacing: true,
		arrowParens: 'always',
		endOfLine: 'lf',
	} satisfies CodeFormatPreferences,
};
const PROVIDERS = new Set(['reference', 'anthropic', 'openai', 'openai-compatible', 'ollama']);

@Controller('settings')
export class SettingsController {
	/**
	|--------------------------------------------------
	| Constructor
	|--------------------------------------------------
	*/
	constructor(@Inject(SETTINGS_REPOSITORY) private readonly settings: SettingsRepository) {}

	/**
	|--------------------------------------------------
	| Get settings
	|--------------------------------------------------
	*/
	@Get()
	async get(@CurrentUser() userId: string) {
		/**
		 |--------------------------------------------------
		 | Guard clause
		 |--------------------------------------------------
		 */
		this.requireAccount(userId);

		/**
		 |--------------------------------------------------
		 | Return result
		 |--------------------------------------------------
		 */
		const saved = await this.settings.find(userId);
		return saved
			? { ...saved, formatting: { ...DEFAULT_SETTINGS.formatting, ...saved.formatting } }
			: { userId, ...DEFAULT_SETTINGS, updatedAt: 0 };
	}

	/**
	|--------------------------------------------------
	| Update settings
	|--------------------------------------------------
	*/
	@Put()
	async update(@Body() body: UpdateSettingsBody, @CurrentUser() userId: string) {
		/**
		 |--------------------------------------------------
		 | Guard clause
		 |--------------------------------------------------
		 */
		this.requireAccount(userId);
		if (!body.provider?.id) throw new BadRequestException('provider configuration is required.');
		if (!PROVIDERS.has(body.provider.id)) throw new BadRequestException(`Unknown provider "${body.provider.id}".`);
		if (!body.styleProfile?.trim()) throw new BadRequestException('styleProfile is required.');
		this.validateFormatting(body.formatting);

		/**
		 |--------------------------------------------------
		 | Make request
		 |--------------------------------------------------
		 */
		return this.settings.upsert({
			userId,
			updatedAt: Date.now(),
			provider: body.provider,
			styleProfile: body.styleProfile.trim(),
			formatting: body.formatting,
		});
	}

	private validateFormatting(formatting: CodeFormatPreferences | undefined): asserts formatting is CodeFormatPreferences {
		if (!formatting) throw new BadRequestException('formatting configuration is required.');
		if (!Number.isInteger(formatting.tabWidth) || formatting.tabWidth < 1 || formatting.tabWidth > 16) {
			throw new BadRequestException('tabWidth must be an integer between 1 and 16.');
		}
		if (!Number.isInteger(formatting.printWidth) || formatting.printWidth < 40 || formatting.printWidth > 400) {
			throw new BadRequestException('printWidth must be an integer between 40 and 400.');
		}
		if (!['all', 'es5', 'none'].includes(formatting.trailingComma)) {
			throw new BadRequestException('trailingComma is invalid.');
		}
		if (!['always', 'avoid'].includes(formatting.arrowParens)) {
			throw new BadRequestException('arrowParens is invalid.');
		}
		if (!['lf', 'crlf', 'auto'].includes(formatting.endOfLine)) {
			throw new BadRequestException('endOfLine is invalid.');
		}
	}

	/**
	|--------------------------------------------------
	| Require account
	|--------------------------------------------------
	*/
	private requireAccount(userId: string) {
		/**
		 |--------------------------------------------------
		 | Guard clause
		 |--------------------------------------------------
		 */
		if (userId === ANONYMOUS_USER) throw new UnauthorizedException('Sign in to sync account settings.');
	}
}
