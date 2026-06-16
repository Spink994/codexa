/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { randomUUID } from 'node:crypto';
import {
	Get,
	Post,
	Body,
	Param,
	Inject,
	Delete,
	Controller,
	UnauthorizedException,
	BadRequestException,
} from '@nestjs/common';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { GithubService } from '../github/github.service.js';
import type { ConnectionProvider } from '../persistence/entities.js';
import { CurrentUser, ANONYMOUS_USER } from '../auth/current-user.js';
import { CONNECTION_REPOSITORY, type ConnectionRepository } from '../persistence/repositories.js';

/**
|--------------------------------------------------
| Connection creation body
|--------------------------------------------------
*/
interface CreateConnectionBody {
	provider?: ConnectionProvider;
	accessToken?: string;
}

/**
|--------------------------------------------------
| Source-control connection endpoints
|--------------------------------------------------
| Stores a personal access token per provider. Full
| OAuth redirect login is a documented follow-up; this
| token-based connect powers private-repo cloning today.
|--------------------------------------------------
*/
@Controller('connections')
export class ConnectionsController {
	/**
	|--------------------------------------------------
	| Inject the connection repository
	|--------------------------------------------------
	*/
	constructor(
		private readonly github: GithubService,
		@Inject(CONNECTION_REPOSITORY) private readonly connections: ConnectionRepository,
	) {}

	/**
	|--------------------------------------------------
	| List repositories the connected GitHub user can push to
	|--------------------------------------------------
	*/
	@Get('github/repos')
	async githubRepos(@CurrentUser() userId: string) {
		/**
		 |--------------------------------------------------
		 | Require a signed-in user with a GitHub connection
		 |--------------------------------------------------
		 */
		this.requireAccount(userId);
		const connection = await this.connections.find(userId, 'github');
		if (!connection) throw new BadRequestException('Connect a GitHub account first.');

		/**
		 |--------------------------------------------------
		 | List the repositories behind the stored token
		 |--------------------------------------------------
		 */
		return this.github.listRepos(connection.accessToken);
	}

	/**
	|--------------------------------------------------
	| List the user's connections, token redacted
	|--------------------------------------------------
	*/
	@Get()
	async list(@CurrentUser() userId: string) {
		/**
		 |--------------------------------------------------
		 | Guard clause
		 |--------------------------------------------------
		 */
		this.requireAccount(userId);

		/**
		 |--------------------------------------------------
		 | Return connections without exposing tokens
		 |--------------------------------------------------
		 */
		const connections = await this.connections.list(userId);
		return connections.map((connection) => ({
			connected: true,
			id: connection.id,
			provider: connection.provider,
			createdAt: connection.createdAt,
		}));
	}

	/**
	|--------------------------------------------------
	| Store or replace a provider connection
	|--------------------------------------------------
	*/
	@Post()
	async connect(@Body() body: CreateConnectionBody, @CurrentUser() userId: string) {
		/**
		 |--------------------------------------------------
		 | Guard clause
		 |--------------------------------------------------
		 */
		this.requireAccount(userId);

		/**
		 |--------------------------------------------------
		 | Validate the connection input
		 |--------------------------------------------------
		 */
		if (body.provider !== 'github' && body.provider !== 'gitlab') {
			throw new BadRequestException('provider must be "github" or "gitlab".');
		}
		if (!body.accessToken) throw new BadRequestException('accessToken is required.');

		/**
		 |--------------------------------------------------
		 | Persist the connection
		 |--------------------------------------------------
		 */
		const connection = await this.connections.upsert({
			userId,
			id: randomUUID(),
			createdAt: Date.now(),
			provider: body.provider,
			accessToken: body.accessToken,
		});
		return { id: connection.id, provider: connection.provider, connected: true };
	}

	/**
	|--------------------------------------------------
	| Disconnect a provider connection
	|--------------------------------------------------
	*/
	@Delete(':provider')
	async disconnect(@Param('provider') provider: ConnectionProvider, @CurrentUser() userId: string) {
		/**
		 |--------------------------------------------------
		 | Guard clause
		 |--------------------------------------------------
		 */
		this.requireAccount(userId);
		if (provider !== 'github' && provider !== 'gitlab') {
			throw new BadRequestException('provider must be "github" or "gitlab".');
		}

		/**
		 |--------------------------------------------------
		 | Return result
		 |--------------------------------------------------
		 */
		return { removed: await this.connections.remove(userId, provider) };
	}

	/**
	|--------------------------------------------------
	| Require an authenticated account
	|--------------------------------------------------
	*/
	private requireAccount(userId: string) {
		/**
		 |--------------------------------------------------
		 | Guard clause
		 |--------------------------------------------------
		 */
		if (userId === ANONYMOUS_USER) throw new UnauthorizedException('Sign in to manage Git connections.');
	}
}
