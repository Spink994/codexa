/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import ts from 'typescript';
import test from 'node:test';
import assert from 'node:assert/strict';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { compareTypeScriptStructure } from './behavior-check.js';
import { formatTypeScriptDeterministically } from './deterministic-formatter.js';

test('fully formats a standalone Zod schema by complete property length', () => {
	const source = `const appConfigSchema = z.object({
	PORT: z.coerce.number().default(4000),
	AI_PROVIDER: z.enum(['openai', 'claude', 'anthropic']).default('openai'),
	OPENAI_MODEL: z.string().default('gpt-4.1-mini'),
	REDIS_PORT: z.coerce.number().default(6379),
	DATABASE_URL: z.string().min(1),
});`;

	const result = formatTypeScriptDeterministically('config.ts', source, 'typescript');

	assert.equal(result.complete, true);
	assert.equal(result.changed, true);
	assert.equal(
		result.formattedSource,
		`/**
|--------------------------------------------------
| Prepare config
|--------------------------------------------------
*/
const appConfigSchema = z.object({
	DATABASE_URL: z.string().min(1),
	PORT: z.coerce.number().default(4000),
	REDIS_PORT: z.coerce.number().default(6379),
	OPENAI_MODEL: z.string().default('gpt-4.1-mini'),
	AI_PROVIDER: z.enum(['openai', 'claude', 'anthropic']).default('openai'),
});`,
	);
});

test('keeps equal-length Zod properties stable and is idempotent', () => {
	const source = `const schema = z.object({
	BB: z.string(),
	AA: z.string(),
});`;
	const first = formatTypeScriptDeterministically('schema.ts', source, 'typescript');
	const second = formatTypeScriptDeterministically('schema.ts', first.formattedSource, 'typescript');

	assert.match(first.formattedSource, /BB: z\.string\(\),\n\tAA: z\.string\(\),/);
	assert.equal(second.changed, false);
	assert.equal(second.complete, true);
});

test('falls back for object shapes whose ordering may change behavior', () => {
	const unsafe = [
		`const schema = z.object({ ...base, A: z.string() });`,
		`const schema = z.object({ [key]: z.string(), A: z.string() });`,
		`const schema = z.object({ A: z.string(), A: z.number() });`,
		`const schema = z.object({ A: createSchema(), B: z.string() });`,
		`const schema = z.object({ A: z.string(), method() {} });`,
		`const schema = z.object({ A: z.string() /* keep */, B: z.string() });`,
	];

	for (const source of unsafe) {
		const result = formatTypeScriptDeterministically('schema.ts', source, 'typescript');
		assert.equal(result.complete, false, source);
		assert.equal(result.formattedSource, source, source);
	}
});

test('falls back when a file contains work beyond schema declarations', () => {
	const source = `const schema = z.object({
	A: z.string(),
});

export const parse = (value: unknown) => schema.parse(value);`;

	const result = formatTypeScriptDeterministically('schema.ts', source, 'typescript');

	assert.equal(result.complete, false);
	assert.equal(result.changed, false);
	assert.equal(result.formattedSource, source);
});

test('returns a warning and preserves invalid source', () => {
	const source = 'const schema = z.object({ A: z.string(),';
	const result = formatTypeScriptDeterministically('schema.ts', source, 'typescript');

	assert.equal(result.complete, false);
	assert.equal(result.changed, false);
	assert.equal(result.formattedSource, source);
	assert.equal(result.warnings.length, 1);
});

test('formats the full application config schema by complete entry length', () => {
	const source = `const appConfigSchema = z.object({
	PORT: z.coerce.number().default(4000),
	AI_PROVIDER: z.enum(['openai', 'claude', 'anthropic']).default('openai'),
	OPENAI_MODEL: z.string().default('gpt-4.1-mini'),
	ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),
	REDIS_PORT: z.coerce.number().default(6379),
	REDIS_HOST: z.string().default('localhost'),
	JWT_SECRET: z.string().min(12).default('development-secret-change-me'),
	NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
	APP_BASE_URL: z.string().url().default('http://localhost:3000'),
	JWT_EXPIRES_IN: z.string().default('7d'),
	DATABASE_URL: z.string().min(1),
	GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
	GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
	GITHUB_OAUTH_CLIENT_ID: z.string().optional(),
	GITHUB_OAUTH_CLIENT_SECRET: z.string().optional(),
	OPENAI_API_KEY: z.string().optional(),
	ANTHROPIC_API_KEY: z.string().optional(),
	EMAIL_WEBHOOK_SECRET: z.string().optional(),
	EMAIL_PROVIDER: z.enum(['webhook', 'resend', 'postmark', 'sendgrid', 'mailgun']).default('webhook'),
	EMAIL_OUTBOUND_WEBHOOK_URL: z.string().url().optional(),
	EMAIL_OUTBOUND_WEBHOOK_SECRET: z.string().optional(),
	EMAIL_FROM: z.string().email().optional(),
	RESEND_API_KEY: z.string().optional(),
	POSTMARK_SERVER_TOKEN: z.string().optional(),
	SENDGRID_API_KEY: z.string().optional(),
	MAILGUN_API_KEY: z.string().optional(),
	MAILGUN_DOMAIN: z.string().optional(),
	MAILGUN_BASE_URL: z.string().url().default('https://api.mailgun.net'),
	S3_ENDPOINT: z.string().optional(),
	S3_PUBLIC_URL: z.string().url().optional(),
	S3_REGION: z.string().default('auto'),
	S3_BUCKET: z.string().default('pulsehq'),
	S3_PRESIGNED_URL_EXPIRES_IN: z.coerce.number().min(1).max(604800).default(3600),
	S3_ACCESS_KEY_ID: z.string().optional(),
	S3_SECRET_ACCESS_KEY: z.string().optional(),
});`;
	const result = formatTypeScriptDeterministically('config.ts', source, 'typescript');
	const lengths = propertyLengths(result.formattedSource);

	assert.equal(result.complete, true);
	assert.equal(
		lengths.every((length, index) => index === 0 || lengths[index - 1]! <= length),
		true,
	);
	assert.deepEqual(compareTypeScriptStructure(source, result.formattedSource), { equivalent: true });
});

test('preserves CRLF and supports exported and multiple schema declarations', () => {
	const source = [
		'export const firstSchema = z.object({',
		'\tLONG_NAME: z.string(),',
		'\tA: z.string(),',
		'});',
		'',
		'const secondSchema = z.object({',
		'\tCOUNT: z.number(),',
		'\tID: z.string(),',
		'});',
	].join('\r\n');
	const result = formatTypeScriptDeterministically('schemas.ts', source, 'typescript');

	assert.equal(result.complete, true);
	assert.equal(result.formattedSource.includes('\r\n'), true);
	assert.equal(result.formattedSource.replaceAll('\r\n', '').includes('\n'), false);
	assert.equal(result.formattedSource.match(/Prepare config/g)?.length, 2);
});

test('fully formats static imports followed by a Zod schema', () => {
	const source = `import { z } from 'zod';
import Button from '@/components/Button';
import fs from 'node:fs';
import express from 'express';

export const appConfigSchema = z.object({
	LONG_NAME: z.string(),
	ID: z.string(),
});`;
	const result = formatTypeScriptDeterministically('config.ts', source, 'typescript');

	assert.equal(result.complete, true);
	assert.equal(result.changed, true);
	assert.equal(
		result.formattedSource,
		`/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { z } from 'zod';
import fs from 'node:fs';
import express from 'express';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import Button from '@/components/Button';

/**
|--------------------------------------------------
| Prepare config
|--------------------------------------------------
*/
export const appConfigSchema = z.object({
	ID: z.string(),
	LONG_NAME: z.string(),
});`,
	);
	assert.deepEqual(compareTypeScriptStructure(source, result.formattedSource), { equivalent: true });
});

test('orders equal-length imports alphabetically and remains idempotent', () => {
	const source = `import bb from 'bb';
import aa from 'aa';

const schema = z.object({
	ID: z.string(),
});`;
	const first = formatTypeScriptDeterministically('schema.ts', source, 'typescript');
	const second = formatTypeScriptDeterministically('schema.ts', first.formattedSource, 'typescript');

	assert.match(first.formattedSource, /import aa from 'aa';\nimport bb from 'bb';/);
	assert.equal(second.complete, true);
	assert.equal(second.changed, false);
});

test('falls back for imports that are unsafe or outside the deterministic contract', () => {
	const unsafe = [
		`import './instrumentation.js';`,
		`import data from './data.json' with { type: 'json' };`,
		`const ready = true;\nimport z from 'zod';`,
		`/** Copyright Example */\nimport z from 'zod';`,
		`import { z /* keep */ } from 'zod';`,
	];

	for (const importSource of unsafe) {
		const source = `${importSource}

const schema = z.object({
	ID: z.string(),
});`;
		const result = formatTypeScriptDeterministically('schema.ts', source, 'typescript');

		assert.equal(result.complete, false, source);
		assert.equal(result.changed, false, source);
		assert.equal(result.formattedSource, source, source);
	}
});

test('preserves CRLF while formatting imports and schemas together', () => {
	const source = [
		"import Button from '@/Button';",
		"import { z } from 'zod';",
		'',
		'const schema = z.object({',
		'\tLONG_NAME: z.string(),',
		'\tID: z.string(),',
		'});',
	].join('\r\n');
	const result = formatTypeScriptDeterministically('schema.ts', source, 'typescript');

	assert.equal(result.complete, true);
	assert.equal(result.formattedSource.includes('\r\n'), true);
	assert.equal(result.formattedSource.replaceAll('\r\n', '').includes('\n'), false);
});

test('deterministically orders imports in ordinary source files before AI', () => {
	const source = `import { writeFile, readFile } from 'node:fs/promises';
import type { TypeScriptSourceAnalysis } from '@codexa/language-typescript';
import { resolve, dirname } from 'node:path';
import helper from '#/helper';
import local from './local';

export const load = async () => readFile('input.txt', 'utf8');`;
	const result = formatTypeScriptDeterministically('service.ts', source, 'typescript');

	assert.equal(result.complete, false);
	assert.equal(result.changed, true);
	assert.deepEqual(result.transforms, ['import-order', 'import-headings']);
	assert.equal(
		result.formattedSource,
		`/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { resolve, dirname } from 'node:path';
import { writeFile, readFile } from 'node:fs/promises';
import type { TypeScriptSourceAnalysis } from '@codexa/language-typescript';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import local from './local';
import helper from '#/helper';

export const load = async () => readFile('input.txt', 'utf8');`,
	);
});

test('breaks equal-length import ties alphabetically', () => {
	const source = `import bb from 'bb';
import aa from 'aa';

export const value = aa + bb;`;
	const result = formatTypeScriptDeterministically('value.ts', source, 'typescript');

	assert.match(result.formattedSource, /import aa from 'aa';\nimport bb from 'bb';/);
});

test('leaves side-effect import regions untouched for AI safety', () => {
	const source = `import './instrumentation.js';
import express from 'express';

export const app = express();`;
	const result = formatTypeScriptDeterministically('app.ts', source, 'typescript');

	assert.equal(result.changed, false);
	assert.equal(result.formattedSource, source);
});

/**
|--------------------------------------------------
| Property lengths
|--------------------------------------------------
*/
function propertyLengths(source: string): number[] {
	/**
	 |--------------------------------------------------
	 | Prepare config
	 |--------------------------------------------------
	 */
	const file = ts.createSourceFile('config.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	let object: ts.ObjectLiteralExpression | undefined;

	/**
	 |--------------------------------------------------
	 | Process items
	 |--------------------------------------------------
	 */
	const visit = (node: ts.Node) => {
		if (
			!object &&
			ts.isCallExpression(node) &&
			ts.isPropertyAccessExpression(node.expression) &&
			node.expression.name.text === 'object' &&
			node.arguments[0] &&
			ts.isObjectLiteralExpression(node.arguments[0])
		) {
			object = node.arguments[0];
		}
		ts.forEachChild(node, visit);
	};
	visit(file);

	/**
	 |--------------------------------------------------
	 | Return result
	 |--------------------------------------------------
	 */
	return (object?.properties ?? []).map((property) => property.getText(file).trim().length + 1);
}
