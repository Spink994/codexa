'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { CodeBlock } from '@/components/CodeBlock';
import { EmptyState } from '@/components/EmptyState';
import { Select } from '@/components/Select';
import { ApiError, createFromPreview, getPreviewSources } from '@/lib/api';
import { saveRunSource } from '@/lib/source-store';
import { entriesFromFiles, readZip, type ZipEntry } from '@/lib/browser-zip';
import type { PreviewModule } from '@/lib/types';
import { useUiStore } from '@/store/ui-store';

type Tri = 'all' | 'some' | 'none';

export function SelectConfigure() {
	const router = useRouter();
	const preview = useUiStore((state) => state.preview);
	const setPreview = useUiStore((state) => state.setPreview);
	const setSelection = useUiStore((state) => state.setSelection);
	const provider = useUiStore((state) => state.provider);
	const formatting = useUiStore((state) => state.formatting);
	const styleProfile = useUiStore((state) => state.styleProfile);
	const pushToast = useUiStore((state) => state.pushToast);
	const uploadSource = useUiStore((state) => state.uploadSource);
	const allPaths = useMemo(
		() => preview?.modules.flatMap((module) => module.files.map((file) => file.path)) ?? [],
		[preview],
	);
	const [selected, setSelected] = useState<Set<string>>(() => {
		/**
		|--------------------------------------------------
		| Restore a saved selection for this preview, else all
		|--------------------------------------------------
		*/
		const saved = useUiStore.getState().selection;
		return saved && saved.previewId === preview?.previewId ? new Set(saved.paths) : new Set(allPaths);
	});
	const [expanded, setExpanded] = useState(() => new Set(preview?.modules.map((module) => module.id)));
	const [search, setSearch] = useState('');
	const [language, setLanguage] = useState('all');
	const [workers, setWorkers] = useState(4);
	const [busy, setBusy] = useState(false);
	const [activePath, setActivePath] = useState<string | null>(allPaths[0] ?? null);
	const [sources, setSources] = useState<Map<string, string> | null>(null);
	const [sourceError, setSourceError] = useState<string | null>(null);
	const [expired, setExpired] = useState(false);

	useEffect(() => {
		/**
		|--------------------------------------------------
		| Reinitialize from a saved selection when the preview changes
		|--------------------------------------------------
		*/
		const saved = useUiStore.getState().selection;
		setSelected(saved && saved.previewId === preview?.previewId ? new Set(saved.paths) : new Set(allPaths));
		setExpanded(new Set(preview?.modules.map((module) => module.id)));
		setActivePath(allPaths[0] ?? null);
	}, [preview?.previewId, allPaths]);

	/**
	|--------------------------------------------------
	| Persist the selection so it survives navigation
	|--------------------------------------------------
	*/
	useEffect(() => {
		if (preview) setSelection(preview.previewId, [...selected]);
	}, [selected, preview?.previewId, setSelection]);

	useEffect(() => {
		if (!preview) return;
		let active = true;
		setSources(null);
		setSourceError(null);
		getPreviewSources(preview.previewId)
			.then(({ files }) => {
				if (active) setSources(new Map(files.map((file) => [file.path, file.source])));
			})
			.catch((error) => {
				if (!active) return;

				/**
				|--------------------------------------------------
				| A missing preview means it expired server-side
				|--------------------------------------------------
				*/
				if (error instanceof ApiError && error.status === 404) {
					setExpired(true);
					return;
				}

				setSourceError(error instanceof Error ? error.message : String(error));
			});
		return () => {
			active = false;
		};
	}, [preview?.previewId]);

	/**
	|--------------------------------------------------
	| Drop the stale preview and return to scanning
	|--------------------------------------------------
	*/
	const rescan = () => {
		setPreview(null);
		router.push('/');
	};

	/**
	|--------------------------------------------------
	| The preview expired on the server — offer a re-scan
	|--------------------------------------------------
	*/
	if (expired) {
		return (
			<EmptyState
				icon="warn"
				title="This preview expired"
				body="The scan behind this selection is no longer available — it expires after a period of inactivity or when the server restarts. Re-scan your source to pick up where you left off."
				action={
					<Button variant="primary" className="px-4 py-2 text-[13px] font-semibold" onClick={rescan}>
						<Icon name="scan" />
						Re-scan source
					</Button>
				}
			/>
		);
	}

	if (!preview) {
		return (
			<EmptyState
				icon="folder"
				title="Nothing to format yet"
				body="Scan a ZIP archive, project folder, file, or snippet — Codexa detects your backend modules and lists them here, ready to select and format."
				action={
					<Link href="/">
						<Button variant="primary" className="px-4 py-2 text-[13px] font-semibold">
							<Icon name="scan" />
							Start a scan
						</Button>
					</Link>
				}
			/>
		);
	}

	const languages = [...new Set(preview.modules.flatMap((module) => module.files.map((file) => file.language)))];
	const visibleModules = preview.modules
		.map((module) => ({
			...module,
			files: module.files.filter(
				(file) =>
					(language === 'all' || file.language === language) &&
					(!search.trim() ||
						module.id.toLowerCase().includes(search.toLowerCase()) ||
						file.path.toLowerCase().includes(search.toLowerCase())),
			),
		}))
		.filter((module) => module.files.length > 0);
	const selectedFiles = preview.modules.flatMap((module) => module.files).filter((file) => selected.has(file.path));
	const selectedModules = preview.modules.filter((module) => module.files.some((file) => selected.has(file.path)));
	const estTokens = selectedFiles.reduce((total, file) => total + file.estTokens, 0);
	const activeFile = preview.modules.flatMap((module) => module.files).find((file) => file.path === activePath);
	const activeModule = preview.modules.find((module) => module.files.some((file) => file.path === activePath));
	const activeSource = activePath ? sources?.get(activePath) : undefined;
	const selectedIndex = activePath ? selectedFiles.findIndex((file) => file.path === activePath) : -1;

	const triFor = (module: PreviewModule): Tri => {
		const count = module.files.filter((file) => selected.has(file.path)).length;
		return count === 0 ? 'none' : count === module.files.length ? 'all' : 'some';
	};

	const toggleFile = (path: string) => {
		setSelected((current) => {
			const next = new Set(current);
			if (next.has(path)) next.delete(path);
			else next.add(path);
			return next;
		});
	};

	const toggleModule = (module: PreviewModule) => {
		setSelected((current) => {
			const next = new Set(current);
			const allSelected = module.files.every((file) => next.has(file.path));
			for (const file of module.files) {
				if (allSelected) next.delete(file.path);
				else next.add(file.path);
			}
			return next;
		});
	};

	const removeModule = (module: PreviewModule) => {
		setSelected((current) => {
			const next = new Set(current);
			module.files.forEach((file) => next.delete(file.path));
			return next;
		});
	};

	/**
	|--------------------------------------------------
	| Resolve the original tree for folder reconstruction
	|--------------------------------------------------
	*/
	const buildSourceEntries = async (previewId: string): Promise<ZipEntry[]> => {
		/**
		|--------------------------------------------------
		| Folder and ZIP uploads come straight from the client
		|--------------------------------------------------
		*/
		if (uploadSource?.kind === 'folder') return entriesFromFiles(uploadSource.files);
		if (uploadSource?.kind === 'zip') return readZip(uploadSource.file);

		/**
		|--------------------------------------------------
		| Repo clones are fetched from the server preview
		|--------------------------------------------------
		*/
		const { files } = await getPreviewSources(previewId);
		const encoder = new TextEncoder();
		return files.map((file) => ({ path: file.path, data: encoder.encode(file.source) }));
	};

	const start = async () => {
		setBusy(true);
		try {
			const run = await createFromPreview(preview.previewId, [...selected], provider, formatting);

			/**
			|--------------------------------------------------
			| Persist the original tree so the review screen can
			| rebuild the folder later — even after a reload.
			|--------------------------------------------------
			*/
			void buildSourceEntries(preview.previewId)
				.then((entries) => saveRunSource(run.id, entries))
				.catch((error) =>
					pushToast(`Could not save source for folder export: ${error instanceof Error ? error.message : error}`, 'error'),
				);

			// Keep the scan in the store so returning here lets the user format the
			// remaining modules without re-scanning.
			router.push(`/runs/${run.id}`);
		} catch (error) {
			setBusy(false);

			/**
			|--------------------------------------------------
			| Surface an expired preview as a recoverable state
			|--------------------------------------------------
			*/
			if (error instanceof ApiError && error.status === 404) {
				setExpired(true);
				return;
			}

			pushToast(error instanceof Error ? error.message : String(error), 'error');
		}
	};

	return (
		<div className="grid min-h-[520px] overflow-hidden rounded-xl border border-line bg-bg-2 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.8)] lg:h-[calc(100vh-96px)] lg:grid-cols-[minmax(300px,0.72fr)_minmax(420px,1.28fr)_300px]">
			<section className="flex min-h-0 min-w-0 flex-col border-r border-line">
				<div className="flex flex-col gap-2.5 border-b border-line px-3.5 py-3">
					<div className="flex items-center gap-2 rounded-md border border-line-strong bg-bg-3 px-2.5 py-1.5 focus-within:border-primary">
						<span className="text-sm text-fg-muted">
							<Icon name="search" />
						</span>
						<input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Filter modules by name or path…"
							className="min-w-0 flex-1 border-0 bg-transparent text-[12.5px] text-fg outline-none placeholder:text-fg-muted"
						/>
						{search && (
							<button onClick={() => setSearch('')} className="text-fg-muted hover:text-fg" aria-label="Clear search">
								<Icon name="close" />
							</button>
						)}
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<span className="text-[13px] text-fg-muted">
							<Icon name="filter" />
						</span>
						<div className="w-[138px]">
							<Select
								compact
								value="all"
								onChange={() => undefined}
								options={[{ value: 'all', label: 'All frameworks' }]}
							/>
						</div>
						<div className="w-[138px]">
							<Select
								compact
								value={language}
								onChange={setLanguage}
								options={[
									{ value: 'all', label: 'All languages' },
									...languages.map((item) => ({ value: item, label: item })),
								]}
							/>
						</div>
						<button className="cx-filter-button">
							<Icon name="warn" />
							Warnings
						</button>
						<button className="cx-filter-button">
							<span className="text-[8px] text-info">●</span>
							Changed
						</button>
					</div>

					<div className="flex flex-wrap items-center gap-1 text-[11.5px]">
						<button onClick={() => setSelected(new Set(allPaths))} className="cx-link-button">
							Select all
						</button>
						<button onClick={() => setSelected(new Set())} className="cx-link-button">
							Clear
						</button>
						<span className="text-line-strong">·</span>
						<button onClick={() => setExpanded(new Set(preview.modules.map((module) => module.id)))} className="cx-link-button">
							Expand all
						</button>
						<button onClick={() => setExpanded(new Set())} className="cx-link-button">
							Collapse all
						</button>
						<span className="ml-auto text-fg-muted">
							{visibleModules.length} of {preview.modules.length} modules
						</span>
					</div>
				</div>

				<div className="cx-scroll min-h-[240px] flex-1 overflow-auto">
					{visibleModules.map((module) => {
						const open = expanded.has(module.id);
						const tri = triFor(module);
						const selectedCount = module.files.filter((file) => selected.has(file.path)).length;
						return (
							<div key={module.id}>
								<div className="sticky top-0 z-[1] flex items-center gap-2 border-b border-line bg-bg-2 px-3.5 py-2 hover:bg-[var(--list-hover)]">
									<button
										onClick={() =>
											setExpanded((current) => {
												const next = new Set(current);
												if (next.has(module.id)) next.delete(module.id);
												else next.add(module.id);
												return next;
											})
										}
										className={`text-[13px] text-fg-muted transition ${open ? 'rotate-90' : ''}`}
									>
										<Icon name="chevron" />
									</button>
									<Checkbox state={tri} onClick={() => toggleModule(module)} />
									<span className="font-mono text-[12px] font-semibold">{module.id}</span>
									<span className="text-[11px] text-fg-muted">Detected module</span>
									<span className="ml-auto font-mono text-[10.5px] text-fg-muted">
										{selectedCount}/{module.files.length}
									</span>
									{selectedCount > 0 && (
										<button
											onClick={() => removeModule(module)}
											className="rounded px-1.5 py-1 text-[10.5px] text-fg-muted hover:bg-error-bg hover:text-error"
											title="Remove module from selection"
										>
											Remove
										</button>
									)}
								</div>

								{open &&
									module.files.map((file) => {
										const isSelected = selected.has(file.path);
										const parts = file.path.split('/');
										return (
											<div
												key={file.path}
												onClick={() => setActivePath(file.path)}
												onKeyDown={(event) => {
													if (event.key === 'Enter' || event.key === ' ') {
														event.preventDefault();
														setActivePath(file.path);
													}
												}}
												role="button"
												tabIndex={0}
												className={`flex w-full items-center gap-2.5 border-b border-line-faint py-2 pl-9 pr-3.5 text-left hover:bg-[var(--list-hover)] ${
													activePath === file.path ? 'bg-[var(--list-active)]' : isSelected ? 'bg-info-bg/30' : ''
												}`}
											>
												<Checkbox state={isSelected ? 'all' : 'none'} onClick={() => toggleFile(file.path)} />
												<div className="min-w-0 flex-1">
													<div className="truncate text-[12.5px] font-medium">{parts.at(-1)}</div>
													<div className="mt-0.5 truncate font-mono text-[10.5px] text-fg-muted">{file.path}</div>
												</div>
												<span className="rounded border border-line-strong px-1.5 py-0.5 text-[9.5px] font-semibold text-fg-muted">
													{file.language}
												</span>
												<span className="w-[52px] text-right font-mono text-[10.5px] text-fg-muted">
													~{formatTokens(file.estTokens)}
												</span>
											</div>
										);
									})}
							</div>
						);
					})}
					{visibleModules.length === 0 && (
						<div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
							<span className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-bg-3 text-lg text-fg-muted">
								<Icon name="search" />
							</span>
							<div>
								<div className="text-[13px] font-medium text-fg">No modules match these filters</div>
								<p className="mt-1 text-[12px] text-fg-muted">Try clearing the search or switching the language filter.</p>
							</div>
							<button
								onClick={() => {
									setSearch('');
									setLanguage('all');
								}}
								className="cx-link-button text-[12px]"
							>
								Clear filters
							</button>
						</div>
					)}
				</div>
			</section>

			<section className="flex min-h-[420px] min-w-0 flex-col border-r border-line bg-bg">
				{activeFile ? (
					<>
						<div className="border-b border-line bg-bg-2 px-4 py-3">
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div className="min-w-0">
									<div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[1px] text-accent">
										<Icon name="eye" /> Source inspector
									</div>
									<div className="truncate font-mono text-[13px] font-semibold text-fg">{activeFile.path}</div>
									<div className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] text-fg-muted">
										<span>{activeModule?.id}</span>
										<span>·</span>
										<span>{activeFile.language}</span>
										<span>·</span>
										<span>~{formatTokens(activeFile.estTokens)} tokens</span>
									</div>
								</div>
								<Button
									variant={selected.has(activeFile.path) ? 'danger' : 'secondary'}
									className="px-2.5 py-1.5 text-[11.5px]"
									onClick={() => toggleFile(activeFile.path)}
								>
									<Icon name={selected.has(activeFile.path) ? 'close' : 'check'} />
									{selected.has(activeFile.path) ? 'Remove from run' : 'Add to run'}
								</Button>
							</div>
						</div>

						<div className="cx-scroll min-h-0 flex-1 overflow-auto p-3">
							{sourceError ? (
								<div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
									<Icon name="warn" className="mb-3 text-xl text-warning" />
									<div className="text-[13px] text-fg">Could not load this source</div>
									<div className="mt-1 max-w-sm text-[11.5px] text-fg-muted">{sourceError}</div>
								</div>
							) : activeSource === undefined ? (
								<div className="flex h-full min-h-64 items-center justify-center gap-2 text-[12px] text-fg-muted">
									<Icon name="sync" className="animate-cx-spin" /> Loading source…
								</div>
							) : (
								<CodeBlock source={activeSource} language={activeFile.language} />
							)}
						</div>

						<div className="flex items-center justify-between border-t border-line bg-bg-2 px-3 py-2">
							<span className="text-[10.5px] text-fg-muted">
								{selected.has(activeFile.path) ? 'Included in formatting run' : 'Excluded from formatting run'}
							</span>
							<div className="flex gap-1">
								<button
									disabled={selectedIndex <= 0}
									onClick={() => setActivePath(selectedFiles[selectedIndex - 1]?.path ?? activePath)}
									className="rounded px-2 py-1 text-[11px] text-fg-muted hover:bg-bg-3 hover:text-fg disabled:opacity-30"
								>
									Previous selected
								</button>
								<button
									disabled={selectedIndex < 0 || selectedIndex >= selectedFiles.length - 1}
									onClick={() => setActivePath(selectedFiles[selectedIndex + 1]?.path ?? activePath)}
									className="rounded px-2 py-1 text-[11px] text-fg-muted hover:bg-bg-3 hover:text-fg disabled:opacity-30"
								>
									Next selected
								</button>
							</div>
						</div>
					</>
				) : (
					<div className="flex h-full min-h-96 flex-col items-center justify-center px-8 text-center">
						<span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-bg-2 text-xl text-accent">
							<Icon name="eye" />
						</span>
						<div className="text-[13px] font-medium text-fg">Inspect before formatting</div>
						<p className="mt-1 max-w-xs text-[11.5px] leading-5 text-fg-muted">
							Choose a file from the module list to review its source and decide whether it belongs in this run.
						</p>
					</div>
				)}
			</section>

			<aside className="flex min-h-0 flex-col bg-bg-2">
				<div className="cx-scroll flex-1 overflow-auto p-4">
					<div className="mb-3 text-[10px] font-semibold uppercase tracking-[1px] text-fg-muted">Configuration</div>
					<ConfigSelect label="AI provider" value={provider.id} options={[provider.id]} />
					<ConfigSelect label="Model" value={provider.model || 'Provider default'} options={[provider.model || 'Provider default']} />
					<ConfigSelect label="Style profile" value={styleProfile} options={[styleProfile]} />
					<ConfigSelect label="Execution mode" value="Review and apply" options={['Review and apply', 'Preview only']} />
					<label className="mb-3 block">
						<span className="mb-1.5 block text-[11.5px] font-medium">Validation commands</span>
						<input defaultValue="npm test" className="cx-control w-full font-mono text-[11.5px]" />
					</label>
					<label className="block">
						<span className="mb-1.5 flex justify-between text-[11.5px] font-medium">
							Max parallel workers <span className="font-mono text-accent">{workers}</span>
						</span>
						<input
							type="range"
							min="1"
							max="8"
							value={workers}
							onChange={(event) => setWorkers(Number(event.target.value))}
							className="w-full accent-progress"
						/>
					</label>
				</div>

				<div className="border-t border-line bg-bg p-4">
					<div className="mb-3 flex items-center">
						<span className="text-[10px] font-semibold uppercase tracking-[1px] text-fg-muted">Estimate</span>
						<span className="ml-auto rounded-full border border-success bg-success-bg px-2 py-0.5 text-[10px] font-semibold text-success">
							Ready
						</span>
					</div>
					<div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
						<Estimate value={selectedModules.length} label="modules" />
						<Estimate value={selectedFiles.length} label="files" />
						<Estimate value={`~${formatTokens(estTokens)}`} label="est. tokens" accent />
						<Estimate value="—" label="provider estimate" />
					</div>
					<div className="mb-3 flex gap-2 border-t border-dashed border-line-strong pt-2.5 text-[11px] leading-[1.55] text-fg-muted">
						<span className="mt-0.5 text-success">
							<Icon name="shield" />
						</span>
						<span>
							<strong className="font-semibold text-fg">Sensitive files excluded</strong> from this run.
						</span>
					</div>
					<Button variant="primary" className="w-full py-[9px] text-[13px] font-semibold" disabled={!selectedFiles.length || busy} onClick={start}>
						{busy ? 'Starting…' : `Continue with ${selectedModules.length} modules`}
						<Icon name="arrow-right" />
					</Button>
				</div>
			</aside>
		</div>
	);
}

function Checkbox({ state, onClick }: { state: Tri; onClick: () => void }) {
	return (
		<button
			onClick={(event) => {
				event.stopPropagation();
				onClick();
			}}
			className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-[1.5px] text-[11px] ${
				state === 'none' ? 'border-line-strong bg-transparent text-transparent' : 'border-primary bg-primary text-primary-fg'
			}`}
		>
			{state === 'all' ? <Icon name="check" /> : state === 'some' ? <span className="h-0.5 w-2 rounded bg-current" /> : null}
		</button>
	);
}

function ConfigSelect({ label, value, options }: { label: string; value: string; options: string[] }) {
	return (
		<div className="mb-3">
			<span className="mb-1.5 block text-[11.5px] font-medium">{label}</span>
			<Select
				compact
				value={value}
				onChange={() => undefined}
				options={options.map((option) => ({ value: option, label: option }))}
			/>
		</div>
	);
}

function Estimate({ value, label, accent = false }: { value: string | number; label: string; accent?: boolean }) {
	return (
		<div>
			<div className={`font-mono text-[17px] font-semibold leading-none ${accent ? 'text-accent' : 'text-fg'}`}>{value}</div>
			<div className="mt-1 text-[10.5px] text-fg-muted">{label}</div>
		</div>
	);
}

function formatTokens(value: number) {
	if (value < 1000) return String(value);
	return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
}
