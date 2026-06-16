/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { randomUUID } from 'node:crypto';
import { Observable, ReplaySubject } from 'rxjs';
import type { CodeFormatPreferences, SemanticFormatGuidance } from '@codexa/provider';
import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { buildJobPlan, runFormatting, createPauseGate, type PauseGate } from '@codexa/orchestrator';
import {
	compareTypeScriptStructure,
	formatTypeScriptDeterministically,
	validateTypeScriptStyle,
	normalizeTypeScriptStyle,
} from '@codexa/language-typescript';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { ANONYMOUS_USER } from '../auth/current-user.js';
import { PreviewStore } from '../intake/preview.store.js';
import { GithubService } from '../github/github.service.js';
import { IntakeService } from '../intake/intake.service.js';
import type { RunRecord } from '../persistence/entities.js';
import { JOB_RUNNER, type JobRunner } from './job-runner.js';
import { ProviderFactory } from '../providers/provider.factory.js';
import type { RunEvent, RunState, PlanModule, ProviderConfig, CreateRunRequest } from './run.types.js';
import {
	RUN_REPOSITORY,
	type RunRepository,
	type RunHistoryQuery,
	CONNECTION_REPOSITORY,
	type ConnectionRepository,
} from '../persistence/repositories.js';

/**
|--------------------------------------------------
| Default house-style comment guidance
|--------------------------------------------------
*/
const DEFAULT_GUIDANCE: SemanticFormatGuidance = {
	style: 'block',
	detail: 'concise',
	requireFunctionComments: true,
	requirePropertyComments: true,
	requireBlankLineBoundaryComments: true,
};

const DEFAULT_FORMATTING: CodeFormatPreferences = {
	semi: true,
	tabWidth: 4,
	useTabs: true,
	printWidth: 120,
	endOfLine: 'lf',
	singleQuote: true,
	trailingComma: 'all',
	bracketSpacing: true,
	arrowParens: 'always',
};

/**
|--------------------------------------------------
| Run summary returned in history listings
|--------------------------------------------------
*/
export interface RunSummary {
	id: string;
	source: string;
	status: RunState['status'];
	createdAt: number;
	totalUnits: number;
	completedUnits: number;
	durationMs?: number;
}

export interface RunHistoryResult {
	items: RunSummary[];
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
}

/**
|--------------------------------------------------
| Inputs for creating a run
|--------------------------------------------------
*/
interface CreateRunInput {
	userId: string;
	source: string;
	modules: PlanModule[];
	provider: ProviderConfig;
	guidance?: Partial<SemanticFormatGuidance>;
	formatting?: CodeFormatPreferences;
	repository?: RunRecord['repository'];
}

/**
|--------------------------------------------------
| Orchestrates run creation, execution, and streaming
|--------------------------------------------------
*/
@Injectable()
export class RunsService {
	/**
	|--------------------------------------------------
	| Live run records keyed by identifier
	|--------------------------------------------------
	*/
	private readonly active = new Map<string, RunRecord>();

	/**
	|--------------------------------------------------
	| Event streams keyed by run identifier
	|--------------------------------------------------
	*/
	private readonly streams = new Map<string, ReplaySubject<RunEvent>>();

	/**
	|--------------------------------------------------
	| Pause gates keyed by run identifier
	|--------------------------------------------------
	*/
	private readonly gates = new Map<string, PauseGate>();

	/**
	|--------------------------------------------------
	| Inject run collaborators
	|--------------------------------------------------
	*/
	constructor(
		private readonly intake: IntakeService,
		private readonly previews: PreviewStore,
		private readonly providers: ProviderFactory,
		private readonly github: GithubService,
		@Inject(JOB_RUNNER) private readonly runner: JobRunner,
		@Inject(RUN_REPOSITORY) private readonly repo: RunRepository,
		@Inject(CONNECTION_REPOSITORY) private readonly connections: ConnectionRepository,
	) {}

	/**
	|--------------------------------------------------
	| Create a run from a pasted snippet
	|--------------------------------------------------
	*/
	createSnippetRun(request: CreateRunRequest, userId: string): RunRecord {
		/**
		 |--------------------------------------------------
		 | Build plan modules and start the run
		 |--------------------------------------------------
		 */
		const modules = this.intake.fromSnippet(request.intake);
		return this.createRun({
			userId,
			modules,
			provider: request.provider,
			guidance: request.guidance,
			formatting: request.formatting,
			source: `snippet:${request.intake.filename}`,
		});
	}

	/**
	|--------------------------------------------------
	| Create a run from an uploaded zip archive
	|--------------------------------------------------
	*/
	createUploadRun(
		providerConfig: ProviderConfig,
		archive: Buffer,
		userId: string,
		formatting?: CodeFormatPreferences,
	): RunRecord {
		/**
		 |--------------------------------------------------
		 | Build plan modules and start the run
		 |--------------------------------------------------
		 */
		const modules = this.intake.fromZip(archive);
		return this.createRun({ userId, modules, provider: providerConfig, formatting, source: 'upload:zip' });
	}

	/**
	|--------------------------------------------------
	| Create a run by cloning a git repository
	|--------------------------------------------------
	*/
	async createRepoRun(
		providerConfig: ProviderConfig,
		url: string,
		userId: string,
		token?: string,
		formatting?: CodeFormatPreferences,
	): Promise<RunRecord> {
		/**
		 |--------------------------------------------------
		 | Clone the repository, then start the run
		 |--------------------------------------------------
		 */
		const modules = await this.intake.fromRepo(url, token);
		return this.createRun({ userId, modules, provider: providerConfig, formatting, source: `repo:${url}` });
	}

	/**
	|--------------------------------------------------
	| Create a run from selected files of a preview
	|--------------------------------------------------
	*/
	createFromPreview(
		previewId: string,
		selectedPaths: string[],
		providerConfig: ProviderConfig,
		userId: string,
		formatting?: CodeFormatPreferences,
	): RunRecord {
		/**
		 |--------------------------------------------------
		 | Load the stored preview owned by the user
		 |--------------------------------------------------
		 */
		const entry = this.previews.require(previewId, userId);
		const selected = new Set(selectedPaths);

		/**
		 |--------------------------------------------------
		 | Keep only the selected files, dropping empties
		 |--------------------------------------------------
		 */
		const modules = entry.modules
			.map((module) => ({ id: module.id, files: module.files.filter((file) => selected.has(file.path)) }))
			.filter((module) => module.files.length > 0);

		/**
		 |--------------------------------------------------
		 | Reject an empty selection, then start the run
		 |--------------------------------------------------
		 */
		if (modules.length === 0) throw new NotFoundException('No files selected from the preview.');
		return this.createRun({
			userId,
			modules,
			formatting,
			provider: providerConfig,
			repository: entry.repository,
			source: `selection:${modules.length} modules`,
		});
	}

	/**
	|--------------------------------------------------
	| Create a run from prepared plan modules
	|--------------------------------------------------
	*/
	createRun(input: CreateRunInput): RunRecord {
		/**
		 |--------------------------------------------------
		 | Build the provider before any async work
		 |--------------------------------------------------
		 */
		const provider = this.providers.build(input.provider);

		/**
		 |--------------------------------------------------
		 | Build the plan and seed the run record
		 |--------------------------------------------------
		 */
		const plan = buildJobPlan(input.modules);
		const record: RunRecord = {
			results: [],
			status: 'queued',
			id: randomUUID(),
			completedUnits: 0,
			userId: input.userId,
			source: input.source,
			createdAt: Date.now(),
			repository: input.repository,
			totalUnits: plan.jobs.length,
		};
		this.active.set(record.id, record);
		void this.persist(record);

		/**
		 |--------------------------------------------------
		 | Register the event stream and announce creation
		 |--------------------------------------------------
		 */
		const stream = new ReplaySubject<RunEvent>();
		this.streams.set(record.id, stream);
		stream.next({ type: 'run.created', runId: record.id, totalUnits: record.totalUnits });

		/**
		 |--------------------------------------------------
		 | Register a pause gate and enqueue execution
		 |--------------------------------------------------
		 */
		const gate = createPauseGate();
		this.gates.set(record.id, gate);
		this.runner.enqueue(record.id, (signal) =>
			this.execute(
				record,
				plan.jobs,
				provider,
				{
					...DEFAULT_GUIDANCE,
					...input.guidance,
					formatting: { ...DEFAULT_FORMATTING, ...input.formatting, ...input.guidance?.formatting },
				},
				gate,
				signal,
			),
		);

		/**
		 |--------------------------------------------------
		 | Return the queued run record
		 |--------------------------------------------------
		 */
		return record;
	}

	/**
	|--------------------------------------------------
	| Execute a planned run and stream its progress
	|--------------------------------------------------
	*/
	private async execute(
		record: RunRecord,
		jobs: Parameters<typeof runFormatting>[0]['plan'],
		provider: ReturnType<ProviderFactory['build']>,
		guidance: SemanticFormatGuidance,
		gate: PauseGate,
		signal: AbortSignal,
	): Promise<void> {
		/**
		 |--------------------------------------------------
		 | Mark the run as running and announce the start
		 |--------------------------------------------------
		 */
		const stream = this.streams.get(record.id);
		record.status = 'running';
		record.startedAt = Date.now();
		void this.persist(record);
		stream?.next({ type: 'run.started', runId: record.id });

		try {
			/**
			 |--------------------------------------------------
			 | Run the formatting plan with behavior verification
			 |--------------------------------------------------
			 */
			const result = await runFormatting({
				signal,
				guidance,
				provider,
				plan: jobs,
				pause: gate,
				verifyBehavior: compareTypeScriptStructure,
				deterministicFormatter: (unit) =>
					formatTypeScriptDeterministically(unit.path, unit.source, unit.language),
				styleNormalizer: (unit, formattedSource) =>
					normalizeTypeScriptStyle(unit.path, formattedSource, unit.language),
				verifyConformance: (unit, formattedSource) =>
					validateTypeScriptStyle(unit.path, unit.source, formattedSource, unit.language),
				/**
				 |--------------------------------------------------
				 | Record and stream each completed unit
				 |--------------------------------------------------
				*/
				onResult: (unit) => {
					/**
					 |--------------------------------------------------
					 | Update the run record with the new result
					 |--------------------------------------------------
					 */
					record.results.push(unit);
					record.completedUnits = record.results.length;
					void this.persist(record);
				
					/**
					 |--------------------------------------------------
					 | Stream the completed unit to subscribers
					 |--------------------------------------------------
					 */
					stream?.next({
						runId: record.id,
						type: 'unit.completed',
						result: unit,
						totalUnits: record.totalUnits,
						completedUnits: record.completedUnits,
					});
				},
			});

			/**
			 |--------------------------------------------------
			 | Finalize as cancelled or completed
			 |--------------------------------------------------
			 */
			await this.finalize(record, result.cancelled);
		} catch (error) {
			/**
			 |--------------------------------------------------
			 | Finalize as failed when execution throws
			 |--------------------------------------------------
			 */
			await this.fail(record, error instanceof Error ? error.message : String(error));
		} finally {
			/**
			 |--------------------------------------------------
			 | Release in-flight run resources
			 |--------------------------------------------------
			 */
			this.gates.delete(record.id);
			this.active.delete(record.id);
		}
	}

	/**
	|--------------------------------------------------
	| Finalize a completed or cancelled run
	|--------------------------------------------------
	*/
	private async finalize(record: RunRecord, cancelled: boolean): Promise<void> {
		/**
		 |--------------------------------------------------
		 | Update terminal status and persist
		 |--------------------------------------------------
		 */
		record.status = cancelled ? 'cancelled' : 'completed';
		record.completedAt = Date.now();
		record.durationMs = record.completedAt - (record.startedAt ?? record.createdAt);
		await this.persist(record);

		/**
		 |--------------------------------------------------
		 | Stream the terminal event and close the stream
		 |--------------------------------------------------
		 */
		const stream = this.streams.get(record.id);
		stream?.next(
			cancelled
				? { type: 'run.cancelled', runId: record.id }
				: { type: 'run.completed', runId: record.id, results: record.results },
		);
		stream?.complete();
	}

	/**
	|--------------------------------------------------
	| Finalize a failed run
	|--------------------------------------------------
	*/
	private async fail(record: RunRecord, message: string): Promise<void> {
		/**
		 |--------------------------------------------------
		 | Record the failure and persist
		 |--------------------------------------------------
		 */
		record.status = 'failed';
		record.error = message;
		record.completedAt = Date.now();
		record.durationMs = record.completedAt - (record.startedAt ?? record.createdAt);
		await this.persist(record);

		/**
		 |--------------------------------------------------
		 | Stream the failure event and close the stream
		 |--------------------------------------------------
		 */
		const stream = this.streams.get(record.id);
		stream?.next({ type: 'run.failed', runId: record.id, error: message });
		stream?.complete();
	}

	/**
	|--------------------------------------------------
	| Persist a run unless it is anonymous
	|--------------------------------------------------
	| Local-first: anonymous runs are processed in memory
	| and streamed, but never written to durable storage —
	| the client keeps the only copy in IndexedDB.
	|--------------------------------------------------
	*/
	private persist(record: RunRecord): Promise<void> {
		/**
		 |--------------------------------------------------
		 | Skip durable writes for anonymous runs
		 |--------------------------------------------------
		 */
		if (record.userId === ANONYMOUS_USER) return Promise.resolve();
		return this.repo.save(record);
	}

	/**
	|--------------------------------------------------
	| Read a run owned by the user
	|--------------------------------------------------
	*/
	async getRun(id: string, userId: string): Promise<RunRecord> {
		/**
		 |--------------------------------------------------
		 | Resolve from live runs first, then durable storage
		 |--------------------------------------------------
		 */
		const record = this.active.get(id) ?? (await this.repo.find(id));
		if (!record || record.userId !== userId) throw new NotFoundException(`Run "${id}" was not found.`);
		return record;
	}

	/**
	|--------------------------------------------------
	| Open a pull request from a completed run's output
	|--------------------------------------------------
	*/
	async createPullRequest(
		id: string,
		userId: string,
		options: { title?: string; body?: string; branch?: string } = {},
	): Promise<{ url: string; number: number; viaFork: boolean }> {
		/**
		 |--------------------------------------------------
		 | Require an owned, completed run with a repository
		 |--------------------------------------------------
		 */
		const record = await this.getRun(id, userId);
		if (userId === ANONYMOUS_USER) throw new BadRequestException('Sign in to open a pull request.');
		if (record.status !== 'completed')
			throw new BadRequestException('The run must finish before opening a pull request.');
		if (!record.repository || record.repository.provider !== 'github') {
			throw new BadRequestException('This run was not created from a GitHub repository.');
		}

		/**
		 |--------------------------------------------------
		 | Collect the changed files produced by the run
		 |--------------------------------------------------
		 */
		const files = record.results
			.filter((result) => result.changed && result.status === 'formatted')
			.map((result) => ({ path: result.path.replace(/^\/+/, ''), content: result.formattedSource }));
		if (files.length === 0) throw new BadRequestException('No formatted changes to propose.');

		/**
		 |--------------------------------------------------
		 | Require a stored GitHub token to push the branch
		 |--------------------------------------------------
		 */
		const connection = await this.connections.find(userId, 'github');
		if (!connection) throw new BadRequestException('Connect a GitHub account before opening a pull request.');

		/**
		 |--------------------------------------------------
		 | Open the pull request on the run's repository
		 |--------------------------------------------------
		 */
		const { repository } = record;
		const branch = options.branch?.trim() || `codexa/format-${record.id.slice(0, 8)}`;
		const pull = await this.github.openPullRequest(
			connection.accessToken,
			{
				branch,
				repo: repository.repo,
				owner: repository.owner,
				baseBranch: repository.baseBranch,
				title: options.title?.trim() || `Codexa: format ${files.length} file${files.length === 1 ? '' : 's'}`,
				body:
					options.body?.trim() ||
					`Automated formatting from Codexa run \`${record.id}\`.\n\nReformatted ${files.length} file${files.length === 1 ? '' : 's'} to the house style.`,
			},
			files,
		);

		/**
		 |--------------------------------------------------
		 | Persist the pull request URL on the run
		 |--------------------------------------------------
		 */
		record.pullRequestUrl = pull.url;
		await this.persist(record);
		return { url: pull.url, number: pull.number, viaFork: pull.viaFork };
	}

	/**
	|--------------------------------------------------
	| List the user's runs as summaries
	|--------------------------------------------------
	*/
	async listRuns(userId: string, query: RunHistoryQuery): Promise<RunHistoryResult> {
		/**
		 |--------------------------------------------------
		 | Map persisted runs to lightweight summaries
		 |--------------------------------------------------
		 */
		const result = await this.repo.listByUser(userId, query);
		const items = result.items.map((record) => ({
			id: record.id,
			source: record.source,
			status: record.status,
			createdAt: record.createdAt,
			totalUnits: record.totalUnits,
			durationMs: record.durationMs,
			completedUnits: record.completedUnits,
		}));
		return {
			items,
			page: query.page,
			total: result.total,
			pageSize: query.pageSize,
			totalPages: Math.max(1, Math.ceil(result.total / query.pageSize)),
		};
	}

	/**
	|--------------------------------------------------
	| Claim locally-held runs into the user's account
	|--------------------------------------------------
	*/
	async importRuns(runs: (RunState & { source?: string })[], userId: string): Promise<{ imported: number }> {
		/**
		 |--------------------------------------------------
		 | Upsert each run under the user, idempotent by id
		 |--------------------------------------------------
		 */
		let imported = 0;
		for (const run of runs) {
			/**
			 |--------------------------------------------------
			 | Skip malformed runs and runs owned by others
			 |--------------------------------------------------
			 */
			if (!run || typeof run.id !== 'string') continue;
			const existing = await this.repo.find(run.id);
			if (existing && existing.userId !== userId) continue;

			/**
			 |--------------------------------------------------
			 | Persist the run under the signed-in user
			 |--------------------------------------------------
			 */
			await this.repo.save({ ...run, userId, source: run.source ?? 'imported' });
			imported += 1;
		}
		return { imported };
	}

	/**
	|--------------------------------------------------
	| Pause a running run owned by the user
	|--------------------------------------------------
	*/
	async pause(id: string, userId: string): Promise<RunRecord> {
		/**
		 |--------------------------------------------------
		 | Pause the gate and persist the paused status
		 |--------------------------------------------------
		 */
		const record = await this.requireActive(id, userId);
		this.gates.get(id)?.pause();
		if (record.status === 'running') record.status = 'paused';
		await this.persist(record);
		return record;
	}

	/**
	|--------------------------------------------------
	| Resume a paused run owned by the user
	|--------------------------------------------------
	*/
	async resume(id: string, userId: string): Promise<RunRecord> {
		/**
		 |--------------------------------------------------
		 | Resume the gate and persist the running status
		 |--------------------------------------------------
		 */
		const record = await this.requireActive(id, userId);
		this.gates.get(id)?.resume();
		if (record.status === 'paused') record.status = 'running';
		await this.persist(record);
		return record;
	}

	/**
	|--------------------------------------------------
	| Cancel a run owned by the user
	|--------------------------------------------------
	*/
	async cancel(id: string, userId: string): Promise<RunRecord> {
		/**
		 |--------------------------------------------------
		 | Resume any pause and abort the job
		 |--------------------------------------------------
		 */
		const record = await this.requireActive(id, userId);
		this.gates.get(id)?.resume();
		this.runner.cancel(id);
		return record;
	}

	/**
	|--------------------------------------------------
	| Stream run events as server-sent messages
	|--------------------------------------------------
	*/
	streamEvents(id: string): Observable<{ data: string }> {
		/**
		 |--------------------------------------------------
		 | Resolve the run stream or an empty replay
		 |--------------------------------------------------
		 */
		const stream = this.streams.get(id) ?? new ReplaySubject<RunEvent>();

		/**
		 |--------------------------------------------------
		 | Map run events into server-sent message frames
		 |--------------------------------------------------
		 */
		return new Observable((subscriber) => {
			/**
			 |--------------------------------------------------
			 | Forward each event as an SSE frame
			 |--------------------------------------------------
			 */
			const subscription = stream.subscribe({
				complete: () => subscriber.complete(),
				error: (error) => subscriber.error(error),
				next: (event) => subscriber.next({ data: JSON.stringify(event) }),
			});

			/**
			 |--------------------------------------------------
			 | Tear down the subscription on unsubscribe
			 |--------------------------------------------------
			 */
			return () => subscription.unsubscribe();
		});
	}

	/**
	|--------------------------------------------------
	| Require an active run owned by the user
	|--------------------------------------------------
	*/
	private async requireActive(id: string, userId: string): Promise<RunRecord> {
		/**
		 |--------------------------------------------------
		 | Enforce ownership before returning the live record
		 |--------------------------------------------------
		 */
		await this.getRun(id, userId);
		const record = this.active.get(id);
		if (!record) throw new NotFoundException(`Run "${id}" is not active.`);
		return record;
	}
}
