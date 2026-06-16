/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import test from 'node:test';
import assert from 'node:assert/strict';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { SettingsController } from './settings.controller.js';
import { InMemorySettingsRepository } from '../persistence/in-memory.js';

/**
|--------------------------------------------------
| Prepare config
|--------------------------------------------------
*/
const formatting = {
	semi: true,
	tabWidth: 2,
	useTabs: false,
	printWidth: 100,
	singleQuote: true,
	bracketSpacing: true,
	endOfLine: 'lf' as const,
	trailingComma: 'all' as const,
	arrowParens: 'always' as const,
};

/**
|--------------------------------------------------
| Returns defaults then persists account settings
|--------------------------------------------------
*/
test('returns defaults then persists account settings', async () => {
	/**
	 |--------------------------------------------------
	 | Set loading state
	 |--------------------------------------------------
	 */
	const controller = new SettingsController(new InMemorySettingsRepository());

	/**
	 |--------------------------------------------------
	 | Determine value
	 |--------------------------------------------------
	 */
	const defaults = await controller.get('user-1');
	assert.equal(defaults.provider.id, 'reference');
	assert.equal(defaults.styleProfile, 'team-default');
	assert.equal(defaults.formatting.tabWidth, 4);

	/**
	 |--------------------------------------------------
	 | Update local state
	 |--------------------------------------------------
	 */
	const saved = await controller.update(
		{ provider: { id: 'openai', model: 'gpt-4o' }, styleProfile: 'google', formatting },
		'user-1',
	);
	assert.equal(saved.provider.id, 'openai');
	assert.equal(saved.formatting.useTabs, false);
	assert.equal((await controller.get('user-1')).styleProfile, 'google');
	assert.equal((await controller.get('user-2')).provider.id, 'reference');
});

/**
|--------------------------------------------------
| Rejects anonymous settings access
|--------------------------------------------------
*/
test('rejects anonymous settings access', async () => {
	/**
	 |--------------------------------------------------
	 | Set loading state
	 |--------------------------------------------------
	 */
	const controller = new SettingsController(new InMemorySettingsRepository());

	/**
	 |--------------------------------------------------
	 | Handle failure response
	 |--------------------------------------------------
	 */
	await assert.rejects(() => controller.get('anonymous'));
	await assert.rejects(() =>
		controller.update({ provider: { id: 'reference' }, styleProfile: 'team-default', formatting }, 'anonymous'),
	);
});

/**
|--------------------------------------------------
| Rejects invalid formatting settings
|--------------------------------------------------
*/
test('rejects invalid formatting settings', async () => {
	/**
	 |--------------------------------------------------
	 | Set loading state
	 |--------------------------------------------------
	 */
	const controller = new SettingsController(new InMemorySettingsRepository());

	/**
	 |--------------------------------------------------
	 | Handle failure response
	 |--------------------------------------------------
	 */
	await assert.rejects(() =>
		controller.update(
			{
				styleProfile: 'team-default',
				provider: { id: 'reference' },
				formatting: { ...formatting, tabWidth: 0 },
			},
			'user-1',
		),
	);
});
