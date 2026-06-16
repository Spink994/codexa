#!/usr/bin/env node

/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import process from 'node:process';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { STYLE_EXAMPLES, createAnthropicProviderFromApiKey } from '../packages/provider/dist/index.js';

/**
|--------------------------------------------------
| Resolve run configuration from the environment
|--------------------------------------------------
*/
const apiKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.GOLDEN_MODEL || undefined;
const effort = process.env.GOLDEN_EFFORT || 'high';
const category = process.env.GOLDEN_CATEGORY || '';
const titles = (process.env.GOLDEN_TITLES || '').split(',').map((t) => t.trim()).filter(Boolean);
const concurrency = Number(process.env.GOLDEN_CONCURRENCY || 1);
const throttleMs = Number(process.env.GOLDEN_THROTTLE_MS || 26000);
const maxRetries = Number(process.env.GOLDEN_RETRIES || 6);
const showDiff = process.env.GOLDEN_DIFF !== '0';

/**
|--------------------------------------------------
| Sleep helper
|--------------------------------------------------
*/
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
|--------------------------------------------------
| Global throttle gate honoring requests-per-minute
|--------------------------------------------------
*/
let nextSlot = 0;
const throttle = async () => {
	const now = Date.now();
	const wait = Math.max(0, nextSlot - now);
	nextSlot = Math.max(now, nextSlot) + throttleMs;
	if (wait > 0) await sleep(wait);
};

/**
|--------------------------------------------------
| Default house-style guidance
|--------------------------------------------------
*/
const guidance = {
	style: 'block',
	detail: 'concise',
	requireFunctionComments: true,
	requirePropertyComments: true,
	requireBlankLineBoundaryComments: true,
};

/**
|--------------------------------------------------
| Print the first differing lines of two strings
|--------------------------------------------------
*/
const printDiff = (expected, actual) => {
	const e = expected.split('\n');
	const a = actual.split('\n');
	const max = Math.max(e.length, a.length);
	let shown = 0;
	for (let i = 0; i < max && shown < 8; i += 1) {
		if (e[i] !== a[i]) {
			console.log(`    line ${i + 1}:`);
			console.log(`      expected: ${JSON.stringify(e[i] ?? '<none>')}`);
			console.log(`      actual:   ${JSON.stringify(a[i] ?? '<none>')}`);
			shown += 1;
		}
	}
};

/**
|--------------------------------------------------
| Run a single golden example
|--------------------------------------------------
*/
const runExample = async (provider, example) => {
	/**
	|--------------------------------------------------
	| Retry through rate limits with backoff
	|--------------------------------------------------
	*/
	for (let attempt = 0; ; attempt += 1) {
		await throttle();
		try {
			const response = await provider.formatSemantic({
				guidance,
				symbols: [],
				path: 'sample.ts',
				source: example.input,
				language: 'typescript',
			});
			const actual = response.formattedSource.trim();
			const expected = example.output.trim();
			return { example, actual, expected, pass: actual === expected, warnings: response.warnings };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const transient = message.includes('429') || message.includes('rate_limit') || message.includes('timed out');
			if (!transient || attempt >= maxRetries) throw error;
			await sleep(30000);
		}
	}
};

/**
|--------------------------------------------------
| Run examples with bounded concurrency
|--------------------------------------------------
*/
const runAll = async (provider, examples) => {
	const results = [];
	let cursor = 0;
	const worker = async () => {
		for (;;) {
			const index = cursor;
			cursor += 1;
			const example = examples[index];
			if (!example) return;
			try {
				const result = await runExample(provider, example);
				results.push(result);
				console.log(`${result.pass ? '✓' : '✗'} [${example.category}] ${example.title}`);
			} catch (error) {
				results.push({ example, pass: false, error: error instanceof Error ? error.message : String(error) });
				console.log(`✗ [${example.category}] ${example.title} (error)`);
			}
		}
	};
	await Promise.all(Array.from({ length: concurrency }, () => worker()));
	return results;
};

/**
|--------------------------------------------------
| Entry point
|--------------------------------------------------
*/
const main = async () => {
	if (!apiKey) {
		console.error('Set ANTHROPIC_API_KEY to run the golden harness.');
		process.exit(1);
	}

	const provider = createAnthropicProviderFromApiKey({ apiKey, model, effort });
	const examples = STYLE_EXAMPLES.filter((e) => !category || e.category === category).filter(
		(e) => titles.length === 0 || titles.some((t) => e.title.startsWith(t)),
	);
	console.log(
		`Running ${examples.length} goldens (effort=${effort}, concurrency=${concurrency}, throttle=${throttleMs}ms)…\n`,
	);

	const results = await runAll(provider, examples);

	/**
	|--------------------------------------------------
	| Per-category tallies
	|--------------------------------------------------
	*/
	const byCat = {};
	for (const r of results) {
		const c = r.example.category;
		byCat[c] = byCat[c] || { pass: 0, total: 0 };
		byCat[c].total += 1;
		if (r.pass) byCat[c].pass += 1;
	}

	/**
	|--------------------------------------------------
	| Print failures
	|--------------------------------------------------
	*/
	const failures = results.filter((r) => !r.pass);
	for (const r of failures) {
		console.log(`✗ [${r.example.category}] ${r.example.title}`);
		if (r.error) console.log(`    error: ${r.error}`);
		else if (showDiff) printDiff(r.expected, r.actual);
	}

	/**
	|--------------------------------------------------
	| Print summary
	|--------------------------------------------------
	*/
	console.log('\n=== Summary ===');
	for (const [c, t] of Object.entries(byCat)) console.log(`${c}: ${t.pass}/${t.total}`);
	console.log(`TOTAL: ${results.length - failures.length}/${results.length}`);
};

void main();
