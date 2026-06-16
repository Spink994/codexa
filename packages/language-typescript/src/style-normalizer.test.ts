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
import { compareTypeScriptStructure } from './behavior-check.js';
import { normalizeTypeScriptStyle } from './style-normalizer.js';

test('orders nested objects exactly while moving comments with their properties', () => {
	const source = `const payload = {
	longCall: Number(value || fallback),
	/**
	 |--------------------------------------------------
	 | Keep identifier meaning
	 |--------------------------------------------------
	 */
	id: value.id,
	meta: {
		longProperty: value.longProperty,
		id: value.id,
	},
	sku: \`item-\${value.id}\`,
};`;
	const result = normalizeTypeScriptStyle('sample.ts', source, 'typescript');

	assert.equal(result.changed, true);
	assert.match(result.formattedSource, /Keep identifier meaning[\s\S]*id: value\.id/);
	assert.match(
		result.formattedSource,
		/\t\/\*\*\n\t \|--------------------------------------------------\n\t \| Keep identifier meaning\n\t \|--------------------------------------------------\n\t\*\/\n\tid: value\.id/,
	);
	assert.doesNotMatch(result.formattedSource, /\t{3,} \|/);
	assert.match(result.formattedSource, /id: value\.id,[\s\S]*sku: `item-\$\{value\.id\}`,[\s\S]*longCall/);
	assert.match(result.formattedSource, /meta: \{\n\t\tid: value\.id,\n\t\tlongProperty/);
	assert.deepEqual(compareTypeScriptStructure(source, result.formattedSource), { equivalent: true });
});

test('is idempotent after objective style normalization', () => {
	const source = `const payload = {
	longName: value.longName,
	id: value.id,
};`;
	const first = normalizeTypeScriptStyle('sample.ts', source, 'typescript');
	const second = normalizeTypeScriptStyle('sample.ts', first.formattedSource, 'typescript');

	assert.equal(first.changed, true);
	assert.equal(second.changed, false);
});

test('reasserts deterministic import order after semantic formatting', () => {
	const source = `import LongName from '@/components/LongName';
import z from 'zod';
import fs from 'node:fs';
import A from '@/A';

export const value = z.string();`;
	const result = normalizeTypeScriptStyle('value.ts', source, 'typescript');

	assert.equal(result.changed, true);
	assert.deepEqual(result.transforms, ['import-order', 'import-headings']);
	assert.ok(
		result.formattedSource.indexOf("import z from 'zod';") <
			result.formattedSource.indexOf("import fs from 'node:fs';"),
	);
	assert.ok(result.formattedSource.indexOf("import A from '@/A';") < result.formattedSource.indexOf('import LongName'));
});
