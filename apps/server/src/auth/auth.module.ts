/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { AuthService } from './auth.service.js';
import { AuthContextGuard } from './current-user.js';
import { AuthController } from './auth.controller.js';
import { GithubModule } from '../github/github.module.js';

/**
|--------------------------------------------------
| Authentication module
|--------------------------------------------------
*/
@Module({
	imports: [GithubModule],
	controllers: [AuthController],
	providers: [
		AuthService,

		/**
		|--------------------------------------------------
		| Resolve the user id on every request
		|--------------------------------------------------
		*/
		{ provide: APP_GUARD, useClass: AuthContextGuard },
	],
})
export class AuthModule {}
