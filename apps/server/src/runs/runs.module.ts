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
import { RunsService } from './runs.service.js';
import { RunsController } from './runs.controller.js';
import { IntakeModule } from '../intake/intake.module.js';
import { GithubModule } from '../github/github.module.js';
import { ProvidersModule } from '../providers/providers.module.js';
import { JOB_RUNNER, InProcessJobRunner } from './job-runner.js';

/**
|--------------------------------------------------
| Run orchestration module
|--------------------------------------------------
*/
@Module({
	imports: [IntakeModule, ProvidersModule, GithubModule],
	controllers: [RunsController],
	providers: [
		RunsService,

		/**
		|--------------------------------------------------
		| Bind the in-process job runner to its token
		|--------------------------------------------------
		*/
		{ provide: JOB_RUNNER, useClass: InProcessJobRunner },
	],
})
export class RunsModule {}
