/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import process from 'node:process';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
|--------------------------------------------------
| Resolve the signing secret at call time
|--------------------------------------------------
| Read lazily so a secret supplied through a .env file
| loaded during bootstrap is honored, not just one
| exported before this module was imported.
|--------------------------------------------------
*/
const secret = (): string => process.env.CODEXA_AUTH_SECRET || 'codexa-dev-secret-change-me';

/**
|--------------------------------------------------
| Base64url-encode a buffer or string
|--------------------------------------------------
*/
const encode = (value: Buffer | string): string => Buffer.from(value).toString('base64url');

/**
|--------------------------------------------------
| Hash a password with a random salt
|--------------------------------------------------
*/
export const hashPassword = (password: string): string => {
	/**
	|--------------------------------------------------
	| Derive a salted scrypt hash
	|--------------------------------------------------
	*/
	const salt = randomBytes(16);
	const derived = scryptSync(password, salt, 32);
	return `${salt.toString('hex')}:${derived.toString('hex')}`;
};

/**
|--------------------------------------------------
| Verify a password against a stored hash
|--------------------------------------------------
*/
export const verifyPassword = (password: string, stored: string): boolean => {
	/**
	|--------------------------------------------------
	| Recompute the hash with the stored salt
	|--------------------------------------------------
	*/
	const [saltHex, hashHex] = stored.split(':');
	if (!saltHex || !hashHex) return false;
	const derived = scryptSync(password, Buffer.from(saltHex, 'hex'), 32);
	const expected = Buffer.from(hashHex, 'hex');

	/**
	|--------------------------------------------------
	| Compare in constant time
	|--------------------------------------------------
	*/
	return derived.length === expected.length && timingSafeEqual(derived, expected);
};

/**
|--------------------------------------------------
| Sign a session token for a user
|--------------------------------------------------
*/
export const createToken = (userId: string): string => {
	/**
	|--------------------------------------------------
	| Encode the payload and append an HMAC signature
	|--------------------------------------------------
	*/
	const payload = encode(JSON.stringify({ userId }));
	const signature = createHmac('sha256', secret()).update(payload).digest('base64url');
	return `${payload}.${signature}`;
};

/**
|--------------------------------------------------
| Sign a short-lived OAuth state nonce
|--------------------------------------------------
| Guards the GitHub redirect against CSRF by binding
| the callback to a value this server issued and can
| verify, with an embedded expiry.
|--------------------------------------------------
*/
export const createState = (ttlMs: number = 10 * 60 * 1000): string => {
	/**
	|--------------------------------------------------
	| Encode an expiring nonce and sign it
	|--------------------------------------------------
	*/
	const payload = encode(JSON.stringify({ nonce: randomBytes(12).toString('hex'), expiresAt: Date.now() + ttlMs }));
	const signature = createHmac('sha256', secret()).update(payload).digest('base64url');
	return `${payload}.${signature}`;
};

/**
|--------------------------------------------------
| Verify an OAuth state nonce has not expired
|--------------------------------------------------
*/
export const verifyState = (state: string): boolean => {
	/**
	|--------------------------------------------------
	| Split the state into payload and signature
	|--------------------------------------------------
	*/
	const [payload, signature] = state.split('.');
	if (!payload || !signature) return false;

	/**
	|--------------------------------------------------
	| Recompute and compare the signature
	|--------------------------------------------------
	*/
	const expected = createHmac('sha256', secret()).update(payload).digest('base64url');
	if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
		return false;
	}

	/**
	|--------------------------------------------------
	| Decode the payload and enforce its expiry
	|--------------------------------------------------
	*/
	try {
		const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { expiresAt?: number };
		return typeof decoded.expiresAt === 'number' && decoded.expiresAt > Date.now();
	} catch {
		return false;
	}
};

/**
|--------------------------------------------------
| Verify a session token and return its user id
|--------------------------------------------------
*/
export const verifyToken = (token: string): string | undefined => {
	/**
	|--------------------------------------------------
	| Split the token into payload and signature
	|--------------------------------------------------
	*/
	const [payload, signature] = token.split('.');
	if (!payload || !signature) return undefined;

	/**
	|--------------------------------------------------
	| Recompute and compare the signature
	|--------------------------------------------------
	*/
	const expected = createHmac('sha256', secret()).update(payload).digest('base64url');
	if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
		return undefined;
	}

	/**
	|--------------------------------------------------
	| Decode the payload and return the user id
	|--------------------------------------------------
	*/
	try {
		const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { userId?: string };
		return decoded.userId;
	} catch {
		return undefined;
	}
};
