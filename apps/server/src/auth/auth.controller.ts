/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { randomUUID } from 'node:crypto';
import { Get, Res, Post, Body, Query, Inject, Controller, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { AuthService } from './auth.service.js';
import { createState, verifyState } from './token.js';
import { GithubService } from '../github/github.service.js';
import { CurrentUser, ANONYMOUS_USER } from './current-user.js';
import {
	USER_REPOSITORY,
	type UserRepository,
	CONNECTION_REPOSITORY,
	type ConnectionRepository,
} from '../persistence/repositories.js';

/**
|--------------------------------------------------
| Credentials request body
|--------------------------------------------------
*/
interface Credentials {
	email?: string;
	password?: string;
}

/**
|--------------------------------------------------
| Authentication endpoints
|--------------------------------------------------
*/
@Controller('auth')
export class AuthController {
	/**
	|--------------------------------------------------
	| Inject auth collaborators
	|--------------------------------------------------
	*/
	constructor(
		private readonly auth: AuthService,
		private readonly github: GithubService,
		@Inject(USER_REPOSITORY) private readonly users: UserRepository,
		@Inject(CONNECTION_REPOSITORY) private readonly connections: ConnectionRepository,
	) {}

	/**
	|--------------------------------------------------
	| Begin GitHub OAuth by redirecting to authorize
	|--------------------------------------------------
	*/
	@Get('github')
	startGithub(@Res() res: Response) {
		/**
		|--------------------------------------------------
		| Redirect to GitHub with a signed CSRF state
		|--------------------------------------------------
		*/
		res.redirect(this.github.buildAuthorizeUrl(createState()));
	}

	/**
	|--------------------------------------------------
	| Complete GitHub OAuth and hand a token to the web app
	|--------------------------------------------------
	*/
	@Get('github/callback')
	async githubCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
		/**
		|--------------------------------------------------
		| Land back on the web login route on any failure
		|--------------------------------------------------
		*/
		const redirect = `${this.github.webOrigin()}/login/callback`;
		try {
			/**
			|--------------------------------------------------
			| Reject a missing code or a forged state
			|--------------------------------------------------
			*/
			if (!code) throw new BadRequestException('Missing authorization code.');
			if (!verifyState(state)) throw new BadRequestException('Invalid or expired login state.');

			/**
			|--------------------------------------------------
			| Exchange the code and resolve the GitHub profile
			|--------------------------------------------------
			*/
			const token = await this.github.exchangeCode(code);
			const profile = await this.github.getProfile(token);

			/**
			|--------------------------------------------------
			| Sign in the account and store the clone token
			|--------------------------------------------------
			*/
			const result = await this.auth.loginWithGithub(profile);
			await this.connections.upsert({
				id: randomUUID(),
				userId: result.user.id,
				provider: 'github',
				accessToken: token,
				createdAt: Date.now(),
			});

			/**
			|--------------------------------------------------
			| Return the session token in the URL fragment
			|--------------------------------------------------
			*/
			res.redirect(`${redirect}#token=${encodeURIComponent(result.token)}`);
		} catch (error) {
			/**
			|--------------------------------------------------
			| Redirect with a readable error message
			|--------------------------------------------------
			*/
			const message = error instanceof Error ? error.message : 'GitHub sign-in failed.';
			res.redirect(`${redirect}#error=${encodeURIComponent(message)}`);
		}
	}

	/**
	|--------------------------------------------------
	| Register a new account
	|--------------------------------------------------
	*/
	@Post('register')
	register(@Body() body: Credentials) {
		/**
		|--------------------------------------------------
		| Register with validated credentials
		|--------------------------------------------------
		*/
		const { email, password } = this.requireCredentials(body);
		return this.auth.register(email, password);
	}

	/**
	|--------------------------------------------------
	| Log in to an existing account
	|--------------------------------------------------
	*/
	@Post('login')
	login(@Body() body: Credentials) {
		/**
		|--------------------------------------------------
		| Authenticate with validated credentials
		|--------------------------------------------------
		*/
		const { email, password } = this.requireCredentials(body);
		return this.auth.login(email, password);
	}

	/**
	|--------------------------------------------------
	| Return the current authenticated user
	|--------------------------------------------------
	*/
	@Get('me')
	async me(@CurrentUser() userId: string) {
		/**
		|--------------------------------------------------
		| Report anonymous sessions distinctly
		|--------------------------------------------------
		*/
		if (userId === ANONYMOUS_USER) return { authenticated: false };

		/**
		|--------------------------------------------------
		| Return the resolved account
		|--------------------------------------------------
		*/
		const user = await this.users.findById(userId);
		return user ? { authenticated: true, user: { id: user.id, email: user.email } } : { authenticated: false };
	}

	/**
	|--------------------------------------------------
	| Validate credential presence
	|--------------------------------------------------
	*/
	private requireCredentials(body: Credentials): { email: string; password: string } {
		/**
		|--------------------------------------------------
		| Reject missing or short credentials
		|--------------------------------------------------
		*/
		if (!body.email || !body.password) throw new BadRequestException('email and password are required.');
		if (body.password.length < 8) throw new BadRequestException('password must be at least 8 characters.');

		/**
		|--------------------------------------------------
		| Return the normalized credentials
		|--------------------------------------------------
		*/
		return { email: body.email.toLowerCase().trim(), password: body.password };
	}
}
