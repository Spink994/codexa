/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { Module } from '@nestjs/common';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { GithubService } from './github.service.js';

/**
|--------------------------------------------------
| Shared GitHub integration module
|--------------------------------------------------
| Provides a single GitHub client used by auth for
| OAuth login, by connections for repo listing, and
| by runs for opening pull requests.
|--------------------------------------------------
*/
@Module({
	providers: [GithubService],
	exports: [GithubService],
})
export class GithubModule {}
