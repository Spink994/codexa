/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { firstValueFrom, toArray } from 'rxjs';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { RunsService } from './runs.service.js';
import { InProcessJobRunner } from './job-runner.js';
import { IntakeService } from '../intake/intake.service.js';
import { PreviewStore } from '../intake/preview.store.js';
import { GithubService } from '../github/github.service.js';
import { ProviderFactory } from '../providers/provider.factory.js';
import { InMemoryRunRepository, InMemoryConnectionRepository } from '../persistence/in-memory.js';
import type { CreateRunRequest, RunEvent } from './run.types.js';

/**
|--------------------------------------------------
| Build a runs service over real collaborators
|--------------------------------------------------
*/
const buildService = (): RunsService => {
	/**
	|--------------------------------------------------
	| Wire the service with in-memory persistence
	|--------------------------------------------------
	*/
	return new RunsService(
		new IntakeService(),
		new PreviewStore(),
		new ProviderFactory(),
		new GithubService(),
		new InProcessJobRunner(),
		new InMemoryRunRepository(),
		new InMemoryConnectionRepository(),
	);
};

/**
|--------------------------------------------------
| A snippet run request using the reference provider
|--------------------------------------------------
*/
const snippetRequest: CreateRunRequest = {
	provider: { id: 'reference' },
	intake: {
		kind: 'snippet',
		filename: 'sample.ts',
		content: 'export const getUser = (u) => u.name;\n',
	},
};

/**
|--------------------------------------------------
| Wait until a run reaches a terminal status
|--------------------------------------------------
*/
const waitForTerminal = (service: RunsService, id: string, userId: string): Promise<void> => {
	/**
	|--------------------------------------------------
	| Poll the run state until it stops running
	|--------------------------------------------------
	*/
	return new Promise((resolve) => {
		const timer = setInterval(async () => {
			const status = (await service.getRun(id, userId)).status;
			if (status !== 'queued' && status !== 'running' && status !== 'paused') {
				clearInterval(timer);
				resolve();
			}
		}, 5);
	});
};

/**
|--------------------------------------------------
| Runs a snippet to completion through the engine
|--------------------------------------------------
*/
test('runs a snippet to completion and persists it', async () => {
	/**
	|--------------------------------------------------
	| Start the run and wait for it to finish
	|--------------------------------------------------
	*/
	const service = buildService();
	const created = service.createSnippetRun(snippetRequest, 'user-1');
	await waitForTerminal(service, created.id, 'user-1');

	/**
	|--------------------------------------------------
	| Confirm the run completed with one unit result
	|--------------------------------------------------
	*/
	const state = await service.getRun(created.id, 'user-1');
	assert.equal(state.status, 'completed');
	assert.equal(state.results.length, 1);
	assert.equal(typeof state.durationMs, 'number');
	assert.equal(typeof state.completedAt, 'number');
	assert.equal(state.results[0]?.conformance?.checks.length, 6);
});

/**
|--------------------------------------------------
| Complete Zod schemas without model token usage
|--------------------------------------------------
*/
test('uses the deterministic fast path for standalone Zod schemas', async () => {
	const service = buildService();
	const created = service.createSnippetRun(
		{
			provider: { id: 'reference' },
			intake: {
				kind: 'snippet',
				filename: 'config.ts',
				content: `import { z } from 'zod';

const schema = z.object({
	LONG_NAME: z.string(),
	A: z.string(),
});`,
			},
		},
		'user-1',
	);
	await waitForTerminal(service, created.id, 'user-1');

	const result = (await service.getRun(created.id, 'user-1')).results[0];
	assert.equal(result?.engine, 'deterministic');
	assert.equal(result?.usage, undefined);
	assert.equal(result?.conformance?.passed, true);
	assert.equal(typeof result?.durationMs, 'number');
	assert.match(result?.formattedSource ?? '', /Npm imports/);
	assert.match(result?.formattedSource ?? '', /A: z\.string\(\),\n\tLONG_NAME: z\.string\(\),/);
});

/**
|--------------------------------------------------
| Lists a user's run history
|--------------------------------------------------
*/
test('lists run history scoped to the user', async () => {
	/**
	|--------------------------------------------------
	| Create runs for two different users
	|--------------------------------------------------
	*/
	const service = buildService();
	const mine = service.createSnippetRun(snippetRequest, 'user-1');
	service.createSnippetRun(snippetRequest, 'user-2');
	await waitForTerminal(service, mine.id, 'user-1');

	/**
	|--------------------------------------------------
	| Confirm history only includes the user's runs
	|--------------------------------------------------
	*/
	const history = await service.listRuns('user-1', { page: 1, pageSize: 20 });
	assert.equal(history.total, 1);
	assert.equal(history.items[0]?.id, mine.id);
	assert.equal(history.items[0]?.source, 'snippet:sample.ts');
});

test('paginates, searches, and date-filters run history', async () => {
	const service = buildService();
	const alpha = service.createSnippetRun(
		{
			...snippetRequest,
			intake: { ...snippetRequest.intake, filename: 'alpha-service.ts' },
		},
		'user-1',
	);
	const beta = service.createSnippetRun(
		{
			...snippetRequest,
			intake: { ...snippetRequest.intake, filename: 'beta-controller.ts' },
		},
		'user-1',
	);
	const gamma = service.createSnippetRun(
		{
			...snippetRequest,
			intake: { ...snippetRequest.intake, filename: 'gamma-repository.ts' },
		},
		'user-1',
	);
	await Promise.all([
		waitForTerminal(service, alpha.id, 'user-1'),
		waitForTerminal(service, beta.id, 'user-1'),
		waitForTerminal(service, gamma.id, 'user-1'),
	]);

	alpha.createdAt = 1_000;
	beta.createdAt = 2_000;
	gamma.createdAt = 3_000;

	const page = await service.listRuns('user-1', { page: 2, pageSize: 1 });
	assert.equal(page.total, 3);
	assert.equal(page.totalPages, 3);
	assert.equal(page.items[0]?.id, beta.id);

	const searched = await service.listRuns('user-1', {
		page: 1,
		pageSize: 20,
		search: 'GAMMA-REPOSITORY.TS',
	});
	assert.equal(searched.total, 1);
	assert.equal(searched.items[0]?.id, gamma.id);

	const dated = await service.listRuns('user-1', {
		page: 1,
		pageSize: 20,
		from: 1_000,
		to: 2_000,
	});
	assert.deepEqual(dated.items.map((run) => run.id), [beta.id, alpha.id]);
});

/**
|--------------------------------------------------
| Enforces ownership on run access
|--------------------------------------------------
*/
test('rejects access to another user run', async () => {
	/**
	|--------------------------------------------------
	| Create a run owned by user-1
	|--------------------------------------------------
	*/
	const service = buildService();
	const created = service.createSnippetRun(snippetRequest, 'user-1');

	/**
	|--------------------------------------------------
	| Expect a different user to be denied
	|--------------------------------------------------
	*/
	await assert.rejects(() => service.getRun(created.id, 'user-2'));
});

/**
|--------------------------------------------------
| Streams the run lifecycle over SSE
|--------------------------------------------------
*/
test('streams run lifecycle events', async () => {
	/**
	|--------------------------------------------------
	| Subscribe to the event stream before completion
	|--------------------------------------------------
	*/
	const service = buildService();
	const created = service.createSnippetRun(snippetRequest, 'user-1');
	const frames = await firstValueFrom(service.streamEvents(created.id).pipe(toArray()));

	/**
	|--------------------------------------------------
	| Confirm the full lifecycle was streamed
	|--------------------------------------------------
	*/
	const types = frames.map((frame) => (JSON.parse(frame.data) as RunEvent).type);
	assert.ok(types.includes('run.created'));
	assert.ok(types.includes('run.started'));
	assert.ok(types.includes('unit.completed'));
	assert.ok(types.includes('run.completed'));
});

/**
|--------------------------------------------------
| Rejects an unknown provider configuration
|--------------------------------------------------
*/
test('rejects a run with a missing API key', () => {
	/**
	|--------------------------------------------------
	| Expect provider construction to reject anthropic
	|--------------------------------------------------
	*/
	const service = buildService();
	assert.throws(() => service.createSnippetRun({ ...snippetRequest, provider: { id: 'anthropic' } }, 'user-1'));
});
