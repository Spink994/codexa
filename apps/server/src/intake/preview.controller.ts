/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { randomUUID } from 'node:crypto';
import { Get, Post, Body, Param, Inject, Controller, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { PreviewStore } from './preview.store.js';
import { IntakeService } from './intake.service.js';
import { CurrentUser } from '../auth/current-user.js';
import type { PlanModule } from '../runs/run.types.js';
import type { ConnectionProvider, RepositorySource } from '../persistence/entities.js';
import { CONNECTION_REPOSITORY, type ConnectionRepository } from '../persistence/repositories.js';

/**
|--------------------------------------------------
| Preview file metadata
|--------------------------------------------------
*/
interface PreviewFile {
	path: string;
	language: string;
	estTokens: number;
}

/**
|--------------------------------------------------
| Preview response
|--------------------------------------------------
*/
interface PreviewResponse {
	previewId: string;
	modules: { id: string; files: PreviewFile[] }[];
	totals: { files: number; estTokens: number };
}

/**
|--------------------------------------------------
| Estimate tokens from source length
|--------------------------------------------------
*/
const estimateTokens = (source: string): number => Math.max(1, Math.ceil(source.length / 4));

/**
|--------------------------------------------------
| Intake preview endpoints
|--------------------------------------------------
*/
@Controller('intake/preview')
export class PreviewController {
	/**
	|--------------------------------------------------
	| Inject preview collaborators
	|--------------------------------------------------
	*/
	constructor(
		private readonly intake: IntakeService,
		private readonly store: PreviewStore,
		@Inject(CONNECTION_REPOSITORY) private readonly connections: ConnectionRepository,
	) {}

	/**
	|--------------------------------------------------
	| Preview an uploaded zip archive
	|--------------------------------------------------
	*/
	@Post('upload')
	@UseInterceptors(FileInterceptor('file'))
	previewUpload(@UploadedFile() file: { buffer: Buffer } | undefined, @CurrentUser() userId: string): PreviewResponse {
		/**
		|--------------------------------------------------
		| Build modules from the archive and store them
		|--------------------------------------------------
		*/
		if (!file) throw new BadRequestException('Missing "file" upload.');
		return this.store_(this.intake.fromZip(file.buffer), userId);
	}

	/**
	|--------------------------------------------------
	| Preview a git repository
	|--------------------------------------------------
	*/
	@Post('repo')
	async previewRepo(
		@Body() body: { repoUrl?: string; token?: string; owner?: string; repo?: string; baseBranch?: string },
		@CurrentUser() userId: string,
	): Promise<PreviewResponse> {
		/**
		|--------------------------------------------------
		| Resolve the clone token and build modules
		|--------------------------------------------------
		*/
		if (!body.repoUrl) throw new BadRequestException('Missing "repoUrl".');
		const token = body.token ?? (await this.resolveToken(userId, body.repoUrl));
		const modules = await this.intake.fromRepo(body.repoUrl, token);

		/**
		|--------------------------------------------------
		| Capture the repository origin for later PRs
		|--------------------------------------------------
		*/
		const repository = this.toRepositorySource(body.repoUrl, body.owner, body.repo, body.baseBranch);
		return this.store_(modules, userId, repository);
	}

	/**
	|--------------------------------------------------
	| Return the original source files for a preview
	|--------------------------------------------------
	*/
	@Get(':id/sources')
	previewSources(@Param('id') id: string, @CurrentUser() userId: string): { files: { path: string; source: string }[] } {
		/**
		|--------------------------------------------------
		| Resolve the owned preview and flatten its files
		|--------------------------------------------------
		*/
		const entry = this.store.require(id, userId);
		const files = entry.modules.flatMap((module) =>
			module.files.map((file) => ({ path: file.path, source: file.source })),
		);
		return { files };
	}

	/**
	|--------------------------------------------------
	| Store modules and build the preview response
	|--------------------------------------------------
	*/
	private store_(modules: PlanModule[], userId: string, repository?: RepositorySource): PreviewResponse {
		/**
		|--------------------------------------------------
		| Persist the planned modules for later selection
		|--------------------------------------------------
		*/
		const previewId = randomUUID();
		this.store.save({ id: previewId, userId, modules, repository, source: '', createdAt: Date.now() });

		/**
		|--------------------------------------------------
		| Build per-file metadata and totals
		|--------------------------------------------------
		*/
		let files = 0;
		let estTokens = 0;
		const summarized = modules.map((module) => ({
			id: module.id,
			files: module.files.map((file) => {
				const tokens = estimateTokens(file.source);
				files += 1;
				estTokens += tokens;
				return { path: file.path, language: file.language, estTokens: tokens };
			}),
		}));

		/**
		|--------------------------------------------------
		| Return the preview summary
		|--------------------------------------------------
		*/
		return { previewId, modules: summarized, totals: { files, estTokens } };
	}

	/**
	|--------------------------------------------------
	| Build a repository origin from a URL and hints
	|--------------------------------------------------
	*/
	private toRepositorySource(
		repoUrl: string,
		owner?: string,
		repo?: string,
		baseBranch?: string,
	): RepositorySource | undefined {
		/**
		|--------------------------------------------------
		| Only GitHub repositories support pull requests
		|--------------------------------------------------
		*/
		const provider: ConnectionProvider | undefined = repoUrl.includes('github')
			? 'github'
			: repoUrl.includes('gitlab')
				? 'gitlab'
				: undefined;
		if (!provider) return undefined;

		/**
		|--------------------------------------------------
		| Fall back to parsing owner and repo from the URL
		|--------------------------------------------------
		*/
		const match = repoUrl.replace(/\.git$/, '').match(/[/:]([^/]+)\/([^/]+?)$/);
		const resolvedOwner = owner ?? match?.[1];
		const resolvedRepo = repo ?? match?.[2];
		if (!resolvedOwner || !resolvedRepo) return undefined;

		/**
		|--------------------------------------------------
		| Return the assembled repository origin
		|--------------------------------------------------
		*/
		return {
			provider,
			url: repoUrl,
			owner: resolvedOwner,
			repo: resolvedRepo,
			baseBranch: baseBranch || 'main',
		};
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
}
