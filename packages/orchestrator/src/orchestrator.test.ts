/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import test from 'node:test';
import assert from 'node:assert/strict';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { setImmediate } from 'node:timers/promises';
import { buildJobPlan } from './plan.js';
import { createMemoryCache } from './cache.js';
import { runFormatting, createPauseGate } from './run.js';
import type { FormatProvider, SemanticFormatRequest, SemanticFormatResponse } from '@codexa/provider';
import type { RunSnapshot, UnitResult } from './types.js';

/**
|--------------------------------------------------
| Build a fake provider with a response handler
|--------------------------------------------------
*/
const fakeProvider = (
	formatSemantic: (request: SemanticFormatRequest) => Promise<SemanticFormatResponse>,
): FormatProvider => {
	/**
	|--------------------------------------------------
	| Return a minimal provider implementation
	|--------------------------------------------------
	*/
	return {
		id: 'reference',
		formatSemantic,
		testConnection: () => Promise.resolve({ ok: true, message: 'ok' }),
		estimateCost: () => ({ model: 'fake', currency: 'USD', inputCost: 0, outputCost: 0, totalCost: 0 }),
		capabilities: {
			streaming: false,
			models: ['fake'],
			contextWindow: 1_000,
			systemPrompt: true,
			maxOutputTokens: 1_000,
			structuredOutput: true,
		},
	};
};

/**
|--------------------------------------------------
| Build a changed semantic response
|--------------------------------------------------
*/
const commentResponse = (request: SemanticFormatRequest): SemanticFormatResponse => {
	/**
	|--------------------------------------------------
	| Prepend a comment heading to the source
	|--------------------------------------------------
	*/
	const formatted = `// formatted\n${request.source}`;
	return {
		model: 'fake',
		changed: true,
		warnings: [],
		formattedSource: formatted,
		usage: { inputTokens: 1, outputTokens: 1 },
		edits: [
			{
				start: 0,
				text: formatted,
				end: request.source.length,
			},
		],
	};
};

/**
|--------------------------------------------------
| Standard formatting guidance
|--------------------------------------------------
*/
const guidance = {
	style: 'jsdoc' as const,
	detail: 'concise' as const,
	requireFunctionComments: true,
	requirePropertyComments: false,
	requireBlankLineBoundaryComments: false,
};

/**
|--------------------------------------------------
| Assign each file to exactly one job
|--------------------------------------------------
*/
test('builds a job plan with exclusive file ownership', () => {
	/**
	|--------------------------------------------------
	| Plan two modules sharing one file path
	|--------------------------------------------------
	*/
	const plan = buildJobPlan([
		{
			id: 'm1',
			files: [{ path: '/a.ts', source: 'a', language: 'typescript' }],
		},
		{
			id: 'm2',
			files: [
				{ path: '/a.ts', source: 'a-again', language: 'typescript' },
				{ path: '/b.ts', source: 'b', language: 'typescript' },
			],
		},
	]);

	/**
	|--------------------------------------------------
	| Confirm the duplicate file is excluded
	|--------------------------------------------------
	*/
	assert.equal(plan.jobs.length, 2);
	assert.deepEqual(plan.duplicates, ['/a.ts']);
	assert.equal(plan.jobs.find((job) => job.path === '/a.ts')?.moduleId, 'm1');
});

/**
|--------------------------------------------------
| Preview multiple modules without overlap
|--------------------------------------------------
*/
test('formats every owned file in the plan', async () => {
	/**
	|--------------------------------------------------
	| Plan two files across two modules
	|--------------------------------------------------
	*/
	const plan = buildJobPlan([
		{ id: 'm1', files: [{ path: '/a.ts', source: 'export const a = 1;\n', language: 'typescript' }] },
		{ id: 'm2', files: [{ path: '/b.ts', source: 'export const b = 2;\n', language: 'typescript' }] },
	]);

	/**
	|--------------------------------------------------
	| Run the formatting plan
	|--------------------------------------------------
	*/
	const run = await runFormatting({
		guidance,
		plan: plan.jobs,
		concurrency: 4,
		provider: fakeProvider((request) => Promise.resolve(commentResponse(request))),
	});

	/**
	|--------------------------------------------------
	| Confirm both files were formatted
	|--------------------------------------------------
	*/
	assert.equal(run.cancelled, false);
	assert.equal(run.results.length, 2);
	assert.equal(run.results.every((result) => result.status === 'formatted'), true);
	assert.equal(run.results.every((result) => result.formattedSource.startsWith('// formatted')), true);
});

/**
|--------------------------------------------------
| Reuse cached responses for identical sources
|--------------------------------------------------
*/
test('reuses cached semantic responses across units', async () => {
	/**
	|--------------------------------------------------
	| Plan two files with identical sources
	|--------------------------------------------------
	*/
	const plan = buildJobPlan([
		{
			id: 'm1',
			files: [
				{ path: '/a.ts', source: 'export const value = 1;\n', language: 'typescript' },
				{ path: '/b.ts', source: 'export const value = 1;\n', language: 'typescript' },
			],
		},
	]);

	/**
	|--------------------------------------------------
	| Count provider invocations
	|--------------------------------------------------
	*/
	let calls = 0;
	const run = await runFormatting({
		guidance,
		plan: plan.jobs,
		cache: createMemoryCache(),
		provider: fakeProvider((request) => {
			calls += 1;
			return Promise.resolve(commentResponse(request));
		}),
	});

	/**
	|--------------------------------------------------
	| Confirm the provider ran once for two units
	|--------------------------------------------------
	*/
	assert.equal(calls, 1);
	assert.equal(run.results.length, 2);
});

/**
|--------------------------------------------------
| Skip AI for complete deterministic formatting
|--------------------------------------------------
*/
test('skips the provider when deterministic formatting is complete', async () => {
	const plan = buildJobPlan([
		{ id: 'm1', files: [{ path: '/schema.ts', source: 'const schema = {};\n', language: 'typescript' }] },
	]);
	let providerCalls = 0;

	const run = await runFormatting({
		guidance,
		plan: plan.jobs,
		deterministicFormatter: (unit) => ({
			complete: true,
			changed: true,
			warnings: [],
			transforms: ['object-order'],
			formattedSource: `/** Config */\n${unit.source}`,
			edits: [{ start: 0, end: unit.source.length, text: `/** Config */\n${unit.source}` }],
		}),
		provider: fakeProvider((request) => {
			providerCalls += 1;
			return Promise.resolve(commentResponse(request));
		}),
	});

	assert.equal(providerCalls, 0);
	assert.equal(run.results[0]?.formattedSource, '/** Config */\nconst schema = {};\n');
	assert.equal(run.results[0]?.usage, undefined);
});

/**
|--------------------------------------------------
| Fall back to AI for incomplete deterministic work
|--------------------------------------------------
*/
test('uses deterministic output as AI input only when accepted', async () => {
	const plan = buildJobPlan([
		{ id: 'm1', files: [{ path: '/mixed.ts', source: 'const value = 1;\n', language: 'typescript' }] },
	]);
	let providerSource = '';

	await runFormatting({
		guidance,
		plan: plan.jobs,
		verifyBehavior: () => ({ equivalent: true }),
		deterministicFormatter: (unit) => ({
			complete: false,
			changed: true,
			warnings: [],
			transforms: ['imports'],
			formattedSource: `/** Imports */\n${unit.source}`,
			edits: [{ start: 0, end: unit.source.length, text: `/** Imports */\n${unit.source}` }],
		}),
		provider: fakeProvider((request) => {
			providerSource = request.source;
			return Promise.resolve({
				...commentResponse(request),
				changed: false,
				edits: [],
				formattedSource: request.source,
			});
		}),
	});

	assert.equal(providerSource, '/** Imports */\nconst value = 1;\n');
});

/**
|--------------------------------------------------
| Normalize objective rules after semantic formatting
|--------------------------------------------------
*/
test('applies a style normalizer after AI and reports the hybrid engine', async () => {
	const source = 'const payload = { longName: 1, id: 2 };\n';
	const plan = buildJobPlan([
		{ id: 'm1', files: [{ path: '/payload.ts', source, language: 'typescript' }] },
	]);
	const formatted = '/** Payload */\nconst payload = {\n\tlongName: 1,\n\tid: 2,\n};\n';

	const run = await runFormatting({
		guidance,
		plan: plan.jobs,
		verifyBehavior: () => ({ equivalent: true }),
		styleNormalizer: (_unit, candidate) => ({
			changed: true,
			transforms: ['object-order'],
			formattedSource: candidate.replace('\tlongName: 1,\n\tid: 2,', '\tid: 2,\n\tlongName: 1,'),
		}),
		provider: fakeProvider(() =>
			Promise.resolve({
				model: 'fake',
				changed: true,
				warnings: [],
				formattedSource: formatted,
				usage: { inputTokens: 2, outputTokens: 3 },
				edits: [{ start: 0, end: source.length, text: formatted }],
			}),
		),
	});

	assert.equal(run.results[0]?.engine, 'hybrid');
	assert.match(run.results[0]?.formattedSource ?? '', /\tid: 2,\n\tlongName: 1,/);
});

/**
|--------------------------------------------------
| Skip files that changed after planning
|--------------------------------------------------
*/
test('skips stale files detected before formatting', async () => {
	/**
	|--------------------------------------------------
	| Plan one file then change it on disk
	|--------------------------------------------------
	*/
	const plan = buildJobPlan([
		{ id: 'm1', files: [{ path: '/a.ts', source: 'export const value = 1;\n', language: 'typescript' }] },
	]);

	/**
	|--------------------------------------------------
	| Run with a reader returning changed content
	|--------------------------------------------------
	*/
	const run = await runFormatting({
		guidance,
		plan: plan.jobs,
		readSource: () => 'export const value = 999;\n',
		provider: fakeProvider((request) => Promise.resolve(commentResponse(request))),
	});

	/**
	|--------------------------------------------------
	| Confirm the file was marked stale
	|--------------------------------------------------
	*/
	assert.equal(run.results[0]?.status, 'stale');
	assert.equal(run.results[0]?.changed, false);
});

/**
|--------------------------------------------------
| Cancel remaining units when aborted
|--------------------------------------------------
*/
test('cancels remaining units on abort', async () => {
	/**
	|--------------------------------------------------
	| Plan two files and abort before running
	|--------------------------------------------------
	*/
	const plan = buildJobPlan([
		{ id: 'm1', files: [{ path: '/a.ts', source: 'a', language: 'typescript' }] },
		{ id: 'm2', files: [{ path: '/b.ts', source: 'b', language: 'typescript' }] },
	]);
	const controller = new AbortController();
	controller.abort();

	/**
	|--------------------------------------------------
	| Run with an already-aborted signal
	|--------------------------------------------------
	*/
	const run = await runFormatting({
		guidance,
		plan: plan.jobs,
		signal: controller.signal,
		provider: fakeProvider((request) => Promise.resolve(commentResponse(request))),
	});

	/**
	|--------------------------------------------------
	| Confirm every unit was cancelled
	|--------------------------------------------------
	*/
	assert.equal(run.cancelled, true);
	assert.equal(run.results.every((result) => result.status === 'cancelled'), true);
});

/**
|--------------------------------------------------
| Retry transient provider failures
|--------------------------------------------------
*/
test('retries a transient provider failure', async () => {
	/**
	|--------------------------------------------------
	| Plan one file and fail the first attempt
	|--------------------------------------------------
	*/
	const plan = buildJobPlan([
		{ id: 'm1', files: [{ path: '/a.ts', source: 'export const value = 1;\n', language: 'typescript' }] },
	]);
	let attempt = 0;

	/**
	|--------------------------------------------------
	| Run with a provider that throws once
	|--------------------------------------------------
	*/
	const run = await runFormatting({
		guidance,
		retries: 2,
		plan: plan.jobs,
		provider: fakeProvider((request) => {
			attempt += 1;
			if (attempt === 1) return Promise.reject(new Error('transient'));
			return Promise.resolve(commentResponse(request));
		}),
	});

	/**
	|--------------------------------------------------
	| Confirm the retry succeeded
	|--------------------------------------------------
	*/
	assert.equal(run.results[0]?.status, 'formatted');
	assert.equal(run.results[0]?.attempts, 2);
});

/**
|--------------------------------------------------
| Resume completed units from a snapshot
|--------------------------------------------------
*/
test('resumes completed units from a snapshot', async () => {
	/**
	|--------------------------------------------------
	| Plan two files with one already completed
	|--------------------------------------------------
	*/
	const plan = buildJobPlan([
		{
			id: 'm1',
			files: [
				{ path: '/a.ts', source: 'export const a = 1;\n', language: 'typescript' },
				{ path: '/b.ts', source: 'export const b = 2;\n', language: 'typescript' },
			],
		},
	]);
	const completed: UnitResult = {
		edits: [],
		attempts: 1,
		path: '/a.ts',
		moduleId: 'm1',
		changed: true,
		warnings: [],
		status: 'formatted',
		originalSource: 'export const a = 1;\n',
		formattedSource: '// cached\nexport const a = 1;\n',
	};
	const snapshot: RunSnapshot = {
		version: 1,
		results: {
			'/a.ts': completed,
		},
	};

	/**
	|--------------------------------------------------
	| Resume the run from the snapshot
	|--------------------------------------------------
	*/
	let calls = 0;
	const run = await runFormatting({
		snapshot,
		guidance,
		plan: plan.jobs,
		provider: fakeProvider((request) => {
			calls += 1;
			return Promise.resolve(commentResponse(request));
		}),
	});

	/**
	|--------------------------------------------------
	| Confirm only the pending unit was formatted
	|--------------------------------------------------
	*/
	assert.equal(calls, 1);
	assert.equal(run.results.find((result) => result.path === '/a.ts')?.formattedSource, '// cached\nexport const a = 1;\n');
	assert.equal(run.results.find((result) => result.path === '/b.ts')?.status, 'formatted');
});

/**
|--------------------------------------------------
| Hold workers while paused and release on resume
|--------------------------------------------------
*/
test('pauses workers and resumes them', async () => {
	/**
	|--------------------------------------------------
	| Plan one file behind a paused gate
	|--------------------------------------------------
	*/
	const plan = buildJobPlan([
		{ id: 'm1', files: [{ path: '/a.ts', source: 'export const a = 1;\n', language: 'typescript' }] },
	]);
	const gate = createPauseGate();
	gate.pause();

	/**
	|--------------------------------------------------
	| Start the run without awaiting it
	|--------------------------------------------------
	*/
	let settled = false;
	const runPromise = runFormatting({
		guidance,
		pause: gate,
		plan: plan.jobs,
		provider: fakeProvider((request) => Promise.resolve(commentResponse(request))),
	}).then((result) => {
		settled = true;
		return result;
	});

	/**
	|--------------------------------------------------
	| Confirm the run is blocked while paused
	|--------------------------------------------------
	*/
	await setImmediate();
	assert.equal(settled, false);

	/**
	|--------------------------------------------------
	| Resume and confirm the run completes
	|--------------------------------------------------
	*/
	gate.resume();
	const run = await runPromise;
	assert.equal(settled, true);
	assert.equal(run.results[0]?.status, 'formatted');
});
