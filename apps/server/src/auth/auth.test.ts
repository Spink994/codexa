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
import { AuthService } from './auth.service.js';
import { createToken, verifyToken, hashPassword, verifyPassword } from './token.js';
import { InMemoryUserRepository } from '../persistence/in-memory.js';

/**
|--------------------------------------------------
| Tokens round-trip and reject tampering
|--------------------------------------------------
*/
test('signs and verifies session tokens', () => {
	/**
	|--------------------------------------------------
	| A valid token resolves to its user id
	|--------------------------------------------------
	*/
	const token = createToken('user-1');
	assert.equal(verifyToken(token), 'user-1');

	/**
	|--------------------------------------------------
	| A tampered token is rejected
	|--------------------------------------------------
	*/
	assert.equal(verifyToken(`${token}x`), undefined);
	assert.equal(verifyToken('garbage'), undefined);
});

/**
|--------------------------------------------------
| Passwords hash and verify
|--------------------------------------------------
*/
test('hashes and verifies passwords', () => {
	/**
	|--------------------------------------------------
	| The correct password verifies; a wrong one fails
	|--------------------------------------------------
	*/
	const hash = hashPassword('correct horse battery');
	assert.equal(verifyPassword('correct horse battery', hash), true);
	assert.equal(verifyPassword('wrong', hash), false);
});

/**
|--------------------------------------------------
| Registration and login issue valid tokens
|--------------------------------------------------
*/
test('registers and logs in a user', async () => {
	/**
	|--------------------------------------------------
	| Register a new account
	|--------------------------------------------------
	*/
	const service = new AuthService(new InMemoryUserRepository());
	const registered = await service.register('a@b.com', 'password123');
	assert.equal(verifyToken(registered.token), registered.user.id);

	/**
	|--------------------------------------------------
	| Duplicate registration is rejected
	|--------------------------------------------------
	*/
	await assert.rejects(() => service.register('a@b.com', 'password123'));

	/**
	|--------------------------------------------------
	| Login with the right password succeeds
	|--------------------------------------------------
	*/
	const loggedIn = await service.login('a@b.com', 'password123');
	assert.equal(loggedIn.user.id, registered.user.id);

	/**
	|--------------------------------------------------
	| Login with the wrong password fails
	|--------------------------------------------------
	*/
	await assert.rejects(() => service.login('a@b.com', 'nope'));
});
