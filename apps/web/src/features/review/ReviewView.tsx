'use client';

/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useUiStore } from '@/store/ui-store';
import { loadRunSource } from '@/lib/source-store';
import { createZip, type ZipEntry } from '@/lib/browser-zip';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/Button';
import { Callout } from '@/components/Callout';
import { StatCard } from '@/components/StatCard';
import { CodeDiff } from '@/components/CodeDiff';
import { CodeBlock } from '@/components/CodeBlock';
import { Badge, runStatusTone, unitStatusTone } from '@/components/Badge';
import type { RunState, UnitResult } from '@/lib/types';
import { RunReport } from './RunReport';

/**
|--------------------------------------------------
| Download the run results as a JSON report
|--------------------------------------------------
*/
const exportReport = (run: RunState): void => {
	/**
	|--------------------------------------------------
	| Build a blob from the run results
	|--------------------------------------------------
	*/
	const blob = new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);

	/**
	|--------------------------------------------------
	| Trigger a download and release the URL
	|--------------------------------------------------
	*/
	const link = document.createElement('a');
	link.href = url;
	link.download = `codexa-run-${run.id}.json`;
	link.click();
	URL.revokeObjectURL(url);
};

/**
|--------------------------------------------------
| Trigger a browser download for a generated file
|--------------------------------------------------
*/
const downloadFile = (file: File): void => {
	/**
	|--------------------------------------------------
	| Create an object URL, click it, then release it
	|--------------------------------------------------
	*/
	const url = URL.createObjectURL(file);
	const link = document.createElement('a');
	link.href = url;
	link.download = file.name;
	link.click();
	URL.revokeObjectURL(url);
};

/**
|--------------------------------------------------
| Normalize a path for matching across sources
|--------------------------------------------------
*/
const normalizePath = (path: string): string => path.replaceAll('\\', '/').replace(/^\.?\//, '');

/**
|--------------------------------------------------
| Files that were formatted into new content
|--------------------------------------------------
*/
const changedResults = (run: RunState): UnitResult[] =>
	run.results.filter((result) => result.changed && result.status === 'formatted');

/**
|--------------------------------------------------
| Completed run review view
|--------------------------------------------------
*/
export function ReviewView({ run }: { run: RunState }) {
	/**
	|--------------------------------------------------
	| Track the expanded file preview
	|--------------------------------------------------
	*/
	const [openPath, setOpenPath] = useState<string | null>(run.results[0]?.path ?? null);
	const [viewMode, setViewMode] = useState<'changes' | 'report'>('changes');

	/**
	|--------------------------------------------------
	| Persisted original tree and download state
	|--------------------------------------------------
	*/
	const pushToast = useUiStore((state) => state.pushToast);
	const [sourceEntries, setSourceEntries] = useState<ZipEntry[] | null>(null);
	const [loadingSource, setLoadingSource] = useState(true);
	const changedFiles = changedResults(run);
	const formattedByPath = new Map(changedFiles.map((result) => [normalizePath(result.path), result]));

	/**
	|--------------------------------------------------
	| Encode the formatted source for an archive entry
	|--------------------------------------------------
	*/
	const encoder = new TextEncoder();

	/**
	|--------------------------------------------------
	| Load the run's persisted source tree once
	|--------------------------------------------------
	*/
	useEffect(() => {
		let active = true;
		loadRunSource(run.id)
			.then((entries) => {
				if (active) setSourceEntries(entries);
			})
			.catch(() => undefined)
			.finally(() => {
				if (active) setLoadingSource(false);
			});
		return () => {
			active = false;
		};
	}, [run.id]);

	/**
	|--------------------------------------------------
	| Download only the formatted files, by path
	|--------------------------------------------------
	*/
	const downloadChanged = (): void => {
		/**
		|--------------------------------------------------
		| Build a zip from each formatted result
		|--------------------------------------------------
		*/
		const entries: ZipEntry[] = changedFiles.map((result) => ({
			path: normalizePath(result.path),
			data: encoder.encode(result.formattedSource),
		}));
		downloadFile(createZip(entries, `codexa-changed-${run.id}.zip`));
	};

	/**
	|--------------------------------------------------
	| Rebuild the original folder with formatted files
	|--------------------------------------------------
	*/
	const downloadFolder = (): void => {
		/**
		|--------------------------------------------------
		| Guard when the original tree is unavailable
		|--------------------------------------------------
		*/
		if (!sourceEntries) return;
		try {
			/**
			|--------------------------------------------------
			| Overlay each formatted file onto its original
			|--------------------------------------------------
			*/
			const merged = new Map<string, ZipEntry>();
			for (const entry of sourceEntries) merged.set(normalizePath(entry.path), entry);
			for (const [key, result] of formattedByPath) {
				const existing = merged.get(key);
				merged.set(key, { path: existing?.path ?? key, data: encoder.encode(result.formattedSource) });
			}

			/**
			|--------------------------------------------------
			| Zip the merged tree and download it
			|--------------------------------------------------
			*/
			downloadFile(createZip([...merged.values()], `codexa-folder-${run.id}.zip`));
		} catch (error) {
			pushToast(error instanceof Error ? error.message : String(error), 'error');
		}
	};

	/**
	|--------------------------------------------------
	| Derive summary counts
	|--------------------------------------------------
	*/
	const changed = run.results.filter((result) => result.changed).length;
	const unchanged = run.results.filter((result) => !result.changed && result.status !== 'failed').length;
	const failed = run.results.filter((result) => result.status === 'failed').length;
	const warnings = run.results.reduce((total, result) => total + result.warnings.length, 0);
	const tokens = run.results.reduce(
		(total, result) => total + (result.usage ? result.usage.inputTokens + result.usage.outputTokens : 0),
		0,
	);

	/**
	|--------------------------------------------------
	| Render the review summary and previews
	|--------------------------------------------------
	*/
	return (
		<div className="flex flex-col gap-6">
			{/**
			|--------------------------------------------------
			| Header
			|--------------------------------------------------
			*/}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h1 className="text-[17px] font-semibold text-fg">Review changes</h1>
					<Badge tone={runStatusTone(run.status)}>{run.status}</Badge>
				</div>
				<div className="flex flex-wrap gap-2">
					{/**
					|--------------------------------------------------
					| Download the rebuilt folder with replacements
					|--------------------------------------------------
					*/}
					{(loadingSource || sourceEntries) && (
						<Button
							variant="primary"
							onClick={downloadFolder}
							disabled={loadingSource || changedFiles.length === 0}
						>
							<Icon name={loadingSource ? 'sync' : 'archive'} className={loadingSource ? 'animate-cx-spin' : ''} />
							{loadingSource ? 'Preparing…' : 'Download folder (.zip)'}
						</Button>
					)}

					{/**
					|--------------------------------------------------
					| Download only the formatted files
					|--------------------------------------------------
					*/}
					<Button onClick={downloadChanged} disabled={changedFiles.length === 0}>
						<Icon name="download" /> Changed files (.zip)
					</Button>

					{/**
					|--------------------------------------------------
					| Export the JSON report
					|--------------------------------------------------
					*/}
					<Button variant={viewMode === 'report' ? 'primary' : 'ghost'} onClick={() => setViewMode(viewMode === 'report' ? 'changes' : 'report')}>
						<Icon name="shield" /> {viewMode === 'report' ? 'View changes' : 'View report'}
					</Button>

					{/**
					|--------------------------------------------------
					| New run
					|--------------------------------------------------
					*/}
					<Link href="/">
						<Button variant="ghost">
							<Icon name="refresh" /> New run
						</Button>
					</Link>
				</div>
			</div>

			{/**
			|--------------------------------------------------
			| Cancelled recovery banner
			|--------------------------------------------------
			*/}
			{run.status === 'cancelled' && (
				<Callout tone="warning" title="Run cancelled">
					{run.results.length} preview{run.results.length === 1 ? '' : 's'} recovered before cancellation.
				</Callout>
			)}

			{/**
			|--------------------------------------------------
			| Failure banner
			|--------------------------------------------------
			*/}
			{run.error && (
				<Callout tone="error" title="Run failed">
					{run.error}
				</Callout>
			)}

			{/**
			|--------------------------------------------------
			| Summary stats
			|--------------------------------------------------
			*/}
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
				<StatCard label="Files changed" value={changed} />
				<StatCard label="Unchanged" value={unchanged} />
				<StatCard label="Failed" value={failed} />
				<StatCard label="Warnings" value={warnings} />
				<StatCard label="Tokens" value={tokens.toLocaleString()} />
			</div>

			{viewMode === 'report' && (
				<>
					<div className="flex justify-end">
						<Button variant="ghost" onClick={() => exportReport(run)}>
							<Icon name="download" /> Export JSON
						</Button>
					</div>
					<RunReport run={run} />
				</>
			)}

			{/**
			|--------------------------------------------------
			| Per-file results
			|--------------------------------------------------
			*/}
			{viewMode === 'changes' && <div className="flex flex-col gap-2">
				{run.results.map((result) => (
					<FileRow
						key={result.path}
						result={result}
						open={openPath === result.path}
						onToggle={() => setOpenPath(openPath === result.path ? null : result.path)}
					/>
				))}
			</div>}
		</div>
	);
}

/**
|--------------------------------------------------
| Expandable per-file result row
|--------------------------------------------------
*/
function FileRow({ result, open, onToggle }: { result: UnitResult; open: boolean; onToggle: () => void }) {
	/**
	|--------------------------------------------------
	| Track diff vs output view for changed files
	|--------------------------------------------------
	*/
	const [view, setView] = useState<'diff' | 'output'>('diff');

	/**
	|--------------------------------------------------
	| Render the row header and expandable preview
	|--------------------------------------------------
	*/
	return (
		<Card>
			{/**
			|--------------------------------------------------
			| Row header
			|--------------------------------------------------
			*/}
			<button onClick={onToggle} className="flex w-full items-center justify-between px-4 py-3 text-left">
				<span className="font-mono text-[12.5px] text-fg">{result.path}</span>
				<span className="flex items-center gap-2">
					{result.warnings.length > 0 && <Badge tone="warning">{result.warnings.length} warning</Badge>}
					<Badge tone={unitStatusTone(result.status)}>{result.status}</Badge>
				</span>
			</button>

			{/**
			|--------------------------------------------------
			| Expanded preview and warnings
			|--------------------------------------------------
			*/}
			{open && (
				<div className="border-t border-line p-4">
					{result.warnings.length > 0 && (
						<ul className="mb-3 flex flex-col gap-1.5">
							{result.warnings.map((warning, index) => (
								<li key={index} className="flex items-start gap-2 text-[12px] text-warning">
									<Icon name="warn" className="mt-0.5 shrink-0" />
									{warning}
								</li>
							))}
						</ul>
					)}

					{/**
					|--------------------------------------------------
					| Diff / output toggle for changed files
					|--------------------------------------------------
					*/}
					{result.changed && (
						<div className="mb-3 inline-flex gap-1 rounded-md border border-line bg-bg-2 p-1">
							<ViewTab active={view === 'diff'} onClick={() => setView('diff')} label="Diff" />
							<ViewTab active={view === 'output'} onClick={() => setView('output')} label="Output" />
						</div>
					)}

					{/**
					|--------------------------------------------------
					| Diff for changes, otherwise the formatted output
					|--------------------------------------------------
					*/}
					{result.changed && view === 'diff' ? (
						<CodeDiff before={result.originalSource} after={result.formattedSource} />
					) : (
						<CodeBlock source={result.formattedSource} />
					)}
				</div>
			)}
		</Card>
	);
}

/**
|--------------------------------------------------
| Diff / output view tab
|--------------------------------------------------
*/
function ViewTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
	/**
	|--------------------------------------------------
	| Render a selectable view tab
	|--------------------------------------------------
	*/
	return (
		<button
			onClick={onClick}
			className={`rounded px-3 py-1 text-[11.5px] transition ${
				active ? 'bg-bg-3 text-fg' : 'text-fg-muted hover:text-fg'
			}`}
		>
			{label}
		</button>
	);
}
