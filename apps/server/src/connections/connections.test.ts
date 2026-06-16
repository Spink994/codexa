import test from 'node:test';
import assert from 'node:assert/strict';
import { ConnectionsController } from './connections.controller.js';
import { InMemoryConnectionRepository } from '../persistence/in-memory.js';

test('connects, redacts, and disconnects a source provider', async () => {
	const controller = new ConnectionsController(new InMemoryConnectionRepository());
	await controller.connect({ provider: 'github', accessToken: 'secret-token' }, 'user-1');

	const listed = await controller.list('user-1');
	assert.equal(listed.length, 1);
	assert.equal(listed[0]?.provider, 'github');
	assert.equal('accessToken' in (listed[0] ?? {}), false);

	assert.deepEqual(await controller.disconnect('github', 'user-1'), { removed: true });
	assert.deepEqual(await controller.list('user-1'), []);
});

test('rejects anonymous connection access', async () => {
	const controller = new ConnectionsController(new InMemoryConnectionRepository());
	await assert.rejects(() => controller.list('anonymous'));
	await assert.rejects(() =>
		controller.connect({ provider: 'gitlab', accessToken: 'secret-token' }, 'anonymous'),
	);
});
