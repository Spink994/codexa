/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import {
	Sse,
	Get,
	Post,
	Body,
	Param,
	Query,
	Inject,
	Controller,
	UploadedFile,
	UseInterceptors,
	BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { RunsService } from './runs.service.js';
import { CurrentUser, ANONYMOUS_USER } from '../auth/current-user.js';
import type { ConnectionProvider } from '../persistence/entities.js';
import type { CodeFormatPreferences } from '@codexa/provider';
import type { RunState, ProviderConfig, CreateRunRequest } from './run.types.js';
import { CONNECTION_REPOSITORY, type ConnectionRepository } from '../persistence/repositories.js';

/**
|--------------------------------------------------
| Uploaded multipart file shape
|--------------------------------------------------
*/
interface UploadedZip {
	/**
	|--------------------------------------------------
	| Raw archive contents
	|--------------------------------------------------
	*/
	buffer: Buffer;
}

/**
|--------------------------------------------------
| Run creation, control, and streaming endpoints
|--------------------------------------------------
*/
@Controller('runs')
export class RunsController {
	/**
	|--------------------------------------------------
	| Inject run collaborators
	|--------------------------------------------------
	*/
	constructor(
		private readonly runs: RunsService,
		@Inject(CONNECTION_REPOSITORY) private readonly connections: ConnectionRepository,
	) {}

	/**
	|--------------------------------------------------
	| Create a run from a pasted snippet
	|--------------------------------------------------
	*/
	@Post()
	createSnippet(@Body() request: CreateRunRequest, @CurrentUser() userId: string) {
		/**
		|--------------------------------------------------
		| Start a snippet run and return its state
		|--------------------------------------------------
		*/
		return this.runs.createSnippetRun(request, userId);
	}

	/**
	|--------------------------------------------------
	| Create a run by cloning a git repository
	|--------------------------------------------------
	*/
	@Post('repo')
	async createRepo(
		@Body() body: { provider?: ProviderConfig; repoUrl?: string; token?: string; formatting?: CodeFormatPreferences },
		@CurrentUser() userId: string,
	) {
		/**
		|--------------------------------------------------
		| Validate the repository request
		|--------------------------------------------------
		*/
		if (!body.provider) throw new BadRequestException('Missing "provider" configuration.');
		if (!body.repoUrl) throw new BadRequestException('Missing "repoUrl".');

		/**
		|--------------------------------------------------
		| Resolve a clone token from the body or a connection
		|--------------------------------------------------
		*/
		const token = body.token ?? (await this.resolveToken(userId, body.repoUrl));

		/**
		|--------------------------------------------------
		| Clone and start the run
		|--------------------------------------------------
		*/
		return this.runs.createRepoRun(body.provider, body.repoUrl, userId, token, body.formatting);
	}

	/**
	|--------------------------------------------------
	| Create a run from a selected preview
	|--------------------------------------------------
	*/
	@Post('from-preview')
	createFromPreview(
		@Body() body: {
			previewId?: string;
			selectedPaths?: string[];
			provider?: ProviderConfig;
			formatting?: CodeFormatPreferences;
		},
		@CurrentUser() userId: string,
	) {
		/**
		|--------------------------------------------------
		| Validate the selection request
		|--------------------------------------------------
		*/
		if (!body.provider) throw new BadRequestException('Missing "provider" configuration.');
		if (!body.previewId) throw new BadRequestException('Missing "previewId".');
		if (!body.selectedPaths?.length) throw new BadRequestException('Select at least one file.');

		/**
		|--------------------------------------------------
		| Start a run from the selected files
		|--------------------------------------------------
		*/
		return this.runs.createFromPreview(body.previewId, body.selectedPaths, body.provider, userId, body.formatting);
	}

	/**
	|--------------------------------------------------
	| List the user's run history
	|--------------------------------------------------
	*/
	@Get()
	list(
		@CurrentUser() userId: string,
		@Query('page') page?: string,
		@Query('pageSize') pageSize?: string,
		@Query('search') search?: string,
		@Query('from') from?: string,
		@Query('to') to?: string,
	) {
		/**
		|--------------------------------------------------
		| Return run summaries newest first
		|--------------------------------------------------
		*/
		const parsedPage = this.parsePositiveInteger(page, 1, 'page');
		const parsedPageSize = Math.min(this.parsePositiveInteger(pageSize, 20, 'pageSize'), 100);
		const parsedFrom = this.parseTimestamp(from, 'from');
		const parsedTo = this.parseTimestamp(to, 'to');
		if (parsedFrom !== undefined && parsedTo !== undefined && parsedFrom > parsedTo) {
			throw new BadRequestException('"from" must be earlier than or equal to "to".');
		}
		return this.runs.listRuns(userId, {
			page: parsedPage,
			pageSize: parsedPageSize,
			search: search?.trim() || undefined,
			from: parsedFrom,
			to: parsedTo,
		});
	}

	/**
	|--------------------------------------------------
	| Import locally-held runs into the signed-in account
	|--------------------------------------------------
	*/
	@Post('import')
	import(@Body() body: { runs?: (RunState & { source?: string })[] }, @CurrentUser() userId: string) {
		/**
		|--------------------------------------------------
		| Require a signed-in user to claim runs
		|--------------------------------------------------
		*/
		if (userId === ANONYMOUS_USER) throw new BadRequestException('Sign in to import runs.');
		return this.runs.importRuns(body.runs ?? [], userId);
	}

	/**
	|--------------------------------------------------
	| Create a run from an uploaded zip archive
	|--------------------------------------------------
	*/
	@Post('upload')
	@UseInterceptors(FileInterceptor('file'))
	createUpload(
		@UploadedFile() file: UploadedZip | undefined,
		@Body('provider') providerJson: string,
		@Body('formatting') formattingJson: string | undefined,
		@CurrentUser() userId: string,
	) {
		/**
		|--------------------------------------------------
		| Reject uploads missing the archive
		|--------------------------------------------------
		*/
		if (!file) throw new BadRequestException('Missing "file" upload.');

		/**
		|--------------------------------------------------
		| Parse the provider configuration field
		|--------------------------------------------------
		*/
		const provider = this.parseProvider(providerJson);

		/**
		|--------------------------------------------------
		| Build plan modules from the archive and start
		|--------------------------------------------------
		*/
		return this.runs.createUploadRun(
			provider,
			file.buffer,
			userId,
			this.parseFormatting(formattingJson),
		);
	}

	/**
	|--------------------------------------------------
	| Read the current state of a run
	|--------------------------------------------------
	*/
	@Get(':id')
	get(@Param('id') id: string, @CurrentUser() userId: string) {
		/**
		|--------------------------------------------------
		| Return the stored run state
		|--------------------------------------------------
		*/
		return this.runs.getRun(id, userId);
	}

	/**
	|--------------------------------------------------
	| Stream run lifecycle events over SSE
	|--------------------------------------------------
	*/
	@Sse(':id/events')
	events(@Param('id') id: string) {
		/**
		|--------------------------------------------------
		| Return the mapped server-sent event stream
		|--------------------------------------------------
		*/
		return this.runs.streamEvents(id);
	}

	/**
	|--------------------------------------------------
	| Pause a running run
	|--------------------------------------------------
	*/
	@Post(':id/pause')
	pause(@Param('id') id: string, @CurrentUser() userId: string) {
		/**
		|--------------------------------------------------
		| Pause the run and return its state
		|--------------------------------------------------
		*/
		return this.runs.pause(id, userId);
	}

	/**
	|--------------------------------------------------
	| Resume a paused run
	|--------------------------------------------------
	*/
	@Post(':id/resume')
	resume(@Param('id') id: string, @CurrentUser() userId: string) {
		/**
		|--------------------------------------------------
		| Resume the run and return its state
		|--------------------------------------------------
		*/
		return this.runs.resume(id, userId);
	}

	/**
	|--------------------------------------------------
	| Cancel a run
	|--------------------------------------------------
	*/
	@Post(':id/cancel')
	cancel(@Param('id') id: string, @CurrentUser() userId: string) {
		/**
		|--------------------------------------------------
		| Cancel the run and return its state
		|--------------------------------------------------
		*/
		return this.runs.cancel(id, userId);
	}

	/**
	|--------------------------------------------------
	| Resolve a stored clone token for a repo URL
	|--------------------------------------------------
	*/
	private async resolveToken(userId: string, repoUrl: string): Promise<string | undefined> {
		/**
		|--------------------------------------------------
		| Derive the provider from the repository host
		|--------------------------------------------------
		*/
		const provider: ConnectionProvider | undefined = repoUrl.includes('gitlab')
			? 'gitlab'
			: repoUrl.includes('github')
				? 'github'
				: undefined;
		if (!provider) return undefined;

		/**
		|--------------------------------------------------
		| Return the stored access token when present
		|--------------------------------------------------
		*/
		const connection = await this.connections.find(userId, provider);
		return connection?.accessToken;
	}

	/**
	|--------------------------------------------------
	| Parse a provider configuration JSON field
	|--------------------------------------------------
	*/
	private parseProvider(providerJson: string): ProviderConfig {
		/**
		|--------------------------------------------------
		| Reject a missing provider field
		|--------------------------------------------------
		*/
		if (!providerJson) throw new BadRequestException('Missing "provider" field.');

		/**
		|--------------------------------------------------
		| Parse the provider JSON, rejecting malformed input
		|--------------------------------------------------
		*/
		try {
			return JSON.parse(providerJson) as ProviderConfig;
		} catch {
			throw new BadRequestException('Field "provider" must be valid JSON.');
		}
	}

	/**
	|--------------------------------------------------
	| Parse an optional formatting configuration field
	|--------------------------------------------------
	*/
	private parseFormatting(formattingJson: string | undefined): CodeFormatPreferences | undefined {
		if (!formattingJson) return undefined;
		try {
			return JSON.parse(formattingJson) as CodeFormatPreferences;
		} catch {
			throw new BadRequestException('Field "formatting" must be valid JSON.');
		}
	}

	private parsePositiveInteger(value: string | undefined, fallback: number, field: string): number {
		if (value === undefined) return fallback;
		const parsed = Number(value);
		if (!Number.isInteger(parsed) || parsed < 1) {
			throw new BadRequestException(`"${field}" must be a positive integer.`);
		}
		return parsed;
	}

	private parseTimestamp(value: string | undefined, field: string): number | undefined {
		if (value === undefined) return undefined;
		const parsed = Number(value);
		if (!Number.isFinite(parsed) || parsed < 0) {
			throw new BadRequestException(`"${field}" must be a valid timestamp.`);
		}
		return parsed;
	}
}
