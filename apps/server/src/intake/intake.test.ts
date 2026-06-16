/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import test from 'node:test';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { IntakeService } from './intake.service.js';

/**
|--------------------------------------------------
| Snippet intake builds a single-file module
|--------------------------------------------------
*/
test('builds a single module from a snippet', () => {
	/**
	|--------------------------------------------------
	| Detect language from the file name
	|--------------------------------------------------
	*/
	const intake = new IntakeService();
	const modules = intake.fromSnippet({ kind: 'snippet', filename: 'a.js', content: 'const a = 1;' });
	assert.equal(modules.length, 1);
	assert.equal(modules[0]?.files[0]?.language, 'javascript');
});

/**
|--------------------------------------------------
| Directory intake groups eligible files by folder
|--------------------------------------------------
*/
test('builds plan modules from a directory tree', () => {
	/**
	|--------------------------------------------------
	| Lay out a temporary project tree
	|--------------------------------------------------
	*/
	const root = mkdtempSync(join(tmpdir(), 'codexa-dir-'));
	mkdirSync(join(root, 'src'));
	mkdirSync(join(root, 'node_modules'));
	writeFileSync(join(root, 'src', 'a.ts'), 'export const a = 1;');
	writeFileSync(join(root, 'src', 'b.tsx'), 'export const B = () => null;');
	writeFileSync(join(root, 'src', 'types.d.ts'), 'export type T = number;');
	writeFileSync(join(root, 'node_modules', 'dep.ts'), 'export const dep = 1;');

	/**
	|--------------------------------------------------
	| Build modules from the directory
	|--------------------------------------------------
	*/
	try {
		const modules = new IntakeService().fromDirectory(root);
		const files = modules.flatMap((module) => module.files.map((file) => file.path));

		/**
		|--------------------------------------------------
		| Confirm eligible files only
		|--------------------------------------------------
		*/
		assert.ok(files.includes('/src/a.ts'));
		assert.ok(files.includes('/src/b.tsx'));
		assert.ok(!files.some((path) => path.includes('node_modules')));
		assert.ok(!files.some((path) => path.endsWith('.d.ts')));
	} finally {
		/**
		|--------------------------------------------------
		| Clean up the temporary tree
		|--------------------------------------------------
		*/
		rmSync(root, { recursive: true, force: true });
	}
});
