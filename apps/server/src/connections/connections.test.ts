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
import { GithubService } from '../github/github.service.js';
import { ConnectionsController } from './connections.controller.js';
import { InMemoryConnectionRepository } from '../persistence/in-memory.js';

/**
|--------------------------------------------------
| Connects, redacts, and disconnects a source provider
|--------------------------------------------------
*/
test('connects, redacts, and disconnects a source provider', async () => {
	/**
	 |--------------------------------------------------
	 | Prepare payload
	 |--------------------------------------------------
	 */
	const controller = new ConnectionsController(new GithubService(), new InMemoryConnectionRepository());
	await controller.connect({ provider: 'github', accessToken: 'secret-token' }, 'user-1');

	/**
	 |--------------------------------------------------
	 | Determine value
	 |--------------------------------------------------
	 */
	const listed = await controller.list('user-1');
	assert.equal(listed.length, 1);
	assert.equal(listed[0]?.provider, 'github');
	assert.equal('accessToken' in (listed[0] ?? {}), false);

	/**
	 |--------------------------------------------------
	 | Handle success response
	 |--------------------------------------------------
	 */
	assert.deepEqual(await controller.disconnect('github', 'user-1'), { removed: true });
	assert.deepEqual(await controller.list('user-1'), []);
});

/**
|--------------------------------------------------
| Rejects anonymous connection access
|--------------------------------------------------
*/
test('rejects anonymous connection access', async () => {
	/**
	 |--------------------------------------------------
	 | Prepare payload
	 |--------------------------------------------------
	 */
	const controller = new ConnectionsController(new GithubService(), new InMemoryConnectionRepository());

	/**
	 |--------------------------------------------------
	 | Handle failure response
	 |--------------------------------------------------
	 */
	await assert.rejects(() => controller.list('anonymous'));
	await assert.rejects(() => controller.connect({ provider: 'gitlab', accessToken: 'secret-token' }, 'anonymous'));
});
