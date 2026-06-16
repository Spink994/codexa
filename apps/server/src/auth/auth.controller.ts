/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { Get, Post, Body, Inject, Controller, BadRequestException } from '@nestjs/common';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { AuthService } from './auth.service.js';
import { CurrentUser, ANONYMOUS_USER } from './current-user.js';
import { USER_REPOSITORY, type UserRepository } from '../persistence/repositories.js';

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
		@Inject(USER_REPOSITORY) private readonly users: UserRepository,
	) {}

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
