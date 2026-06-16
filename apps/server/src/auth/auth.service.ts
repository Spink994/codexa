/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { randomUUID } from 'node:crypto';
import { Inject, Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { createToken, hashPassword, verifyPassword } from './token.js';
import type { GithubProfile } from '../github/github.service.js';
import { USER_REPOSITORY, type UserRepository } from '../persistence/repositories.js';

/**
|--------------------------------------------------
| Authentication result
|--------------------------------------------------
*/
export interface AuthResult {
	/**
	|--------------------------------------------------
	| Signed session token
	|--------------------------------------------------
	*/
	token: string;

	/**
	|--------------------------------------------------
	| Public user fields
	|--------------------------------------------------
	*/
	user: { id: string; email: string };
}

/**
|--------------------------------------------------
| Account registration and login service
|--------------------------------------------------
*/
@Injectable()
export class AuthService {
	/**
	|--------------------------------------------------
	| Inject the user repository
	|--------------------------------------------------
	*/
	constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

	/**
	|--------------------------------------------------
	| Register a new account
	|--------------------------------------------------
	*/
	async register(email: string, password: string): Promise<AuthResult> {
		/**
		|--------------------------------------------------
		| Reject duplicate email registration
		|--------------------------------------------------
		*/
		if (await this.users.findByEmail(email)) throw new ConflictException('Email is already registered.');

		/**
		|--------------------------------------------------
		| Persist the new user with a hashed password
		|--------------------------------------------------
		*/
		const user = await this.users.create({
			email,
			id: randomUUID(),
			createdAt: Date.now(),
			passwordHash: hashPassword(password),
		});

		/**
		|--------------------------------------------------
		| Return a signed token for the new user
		|--------------------------------------------------
		*/
		return { token: createToken(user.id), user: { id: user.id, email: user.email } };
	}

	/**
	|--------------------------------------------------
	| Authenticate an existing account
	|--------------------------------------------------
	*/
	async login(email: string, password: string): Promise<AuthResult> {
		/**
		|--------------------------------------------------
		| Reject unknown emails and bad passwords alike
		|--------------------------------------------------
		*/
		const user = await this.users.findByEmail(email);
		if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
			throw new UnauthorizedException('Invalid email or password.');
		}

		/**
		|--------------------------------------------------
		| Return a signed token for the user
		|--------------------------------------------------
		*/
		return { token: createToken(user.id), user: { id: user.id, email: user.email } };
	}

	/**
	|--------------------------------------------------
	| Sign in or provision an account from a GitHub profile
	|--------------------------------------------------
	*/
	async loginWithGithub(profile: GithubProfile): Promise<AuthResult> {
		/**
		|--------------------------------------------------
		| Resolve the email, synthesizing a noreply fallback
		|--------------------------------------------------
		*/
		const email = (profile.email ?? `${profile.login}@users.noreply.github.com`).toLowerCase().trim();

		/**
		|--------------------------------------------------
		| Return immediately for an already-linked account
		|--------------------------------------------------
		*/
		const linked = await this.users.findByOauth('github', profile.id);
		if (linked) return { token: createToken(linked.id), user: { id: linked.id, email: linked.email } };

		/**
		|--------------------------------------------------
		| Link GitHub onto an existing same-email account
		|--------------------------------------------------
		*/
		const existing = await this.users.findByEmail(email);
		if (existing) {
			const updated = await this.users.update({ ...existing, oauthProvider: 'github', oauthId: profile.id });
			return { token: createToken(updated.id), user: { id: updated.id, email: updated.email } };
		}

		/**
		|--------------------------------------------------
		| Otherwise provision a fresh OAuth-only account
		|--------------------------------------------------
		*/
		const user = await this.users.create({
			email,
			id: randomUUID(),
			createdAt: Date.now(),
			oauthProvider: 'github',
			oauthId: profile.id,
		});
		return { token: createToken(user.id), user: { id: user.id, email: user.email } };
	}
}
