'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import { createSnippetRun, previewUpload } from '@/lib/api';
import {
	folderFilesFromDrop,
	zipFiles,
	type FolderFile,
} from '@/lib/browser-zip';
import { useUiStore } from '@/store/ui-store';

type Mode = 'zip' | 'folder' | 'file' | 'snippet';
type Phase = 'input' | 'scanning' | 'complete';

const MODES: { id: Mode; label: string; detail: string; icon: IconName }[] = [
	{ id: 'zip', label: 'Upload a ZIP', detail: 'Scan a complete backend project archive', icon: 'archive' },
	{ id: 'folder', label: 'Choose a folder', detail: 'Select a project directory from this device', icon: 'folder' },
	{ id: 'file', label: 'Add a file', detail: 'Format one TypeScript or JavaScript file', icon: 'file' },
	{ id: 'snippet', label: 'Paste a snippet', detail: 'Paste source code directly into Codexa', icon: 'clipboard' },
];

export function IntakeForm() {
	const router = useRouter();
	const fileInput = useRef<HTMLInputElement>(null);
	const dragDepth = useRef(0);
	const [mode, setMode] = useState<Mode>('zip');
	const [phase, setPhase] = useState<Phase>('input');
	const [file, setFile] = useState<File | null>(null);
	const [folderFiles, setFolderFiles] = useState<FolderFile[]>([]);
	const [dragging, setDragging] = useState(false);
	const [readingDrop, setReadingDrop] = useState(false);
	const [showFolderGuide, setShowFolderGuide] = useState(false);
	const [filename, setFilename] = useState('snippet.ts');
	const [content, setContent] = useState('');
	const [visibleRows, setVisibleRows] = useState(0);
	const preview = useUiStore((state) => state.preview);
	const provider = useUiStore((state) => state.provider);
	const formatting = useUiStore((state) => state.formatting);
	const setPreview = useUiStore((state) => state.setPreview);
	const pushToast = useUiStore((state) => state.pushToast);
	const setUploadSource = useUiStore((state) => state.setUploadSource);

	useEffect(() => {
		if (phase !== 'scanning' || !preview) return;
		if (visibleRows >= preview.modules.length) {
			const done = window.setTimeout(() => setPhase('complete'), 280);
			return () => window.clearTimeout(done);
		}
		const timer = window.setTimeout(() => setVisibleRows((count) => count + 1), 260);
		return () => window.clearTimeout(timer);
	}, [phase, preview, visibleRows]);

	const mutation = useMutation({
		mutationFn: async () => {
			if (mode === 'zip') {
				if (!file) throw new Error('Choose a ZIP archive first.');
				return { kind: 'preview' as const, preview: await previewUpload(file) };
			}
			if (mode === 'folder') {
				if (folderFiles.length === 0) throw new Error('Choose a project folder first.');
				return { kind: 'preview' as const, preview: await previewUpload(await zipFiles(folderFiles)) };
			}
			if (mode === 'file') {
				if (!file) throw new Error('Choose a source file first.');
				return {
					kind: 'run' as const,
					run: await createSnippetRun({
						provider,
						formatting,
						intake: { kind: 'snippet', filename: file.name, content: await file.text() },
					}),
				};
			}
			if (!content.trim()) throw new Error('Paste a source snippet first.');
			return {
				kind: 'run' as const,
				run: await createSnippetRun({ provider, formatting, intake: { kind: 'snippet', filename, content } }),
			};
		},
		onSuccess: (result) => {
			if (result.kind === 'run') {
				router.push(`/runs/${result.run.id}`);
				return;
			}
			setPreview(result.preview);
			setVisibleRows(0);
		},
		onError: (error: Error) => {
			setPhase('input');
			pushToast(error.message, 'error');
		},
	});

	const start = () => {
		setPreview(null);
		// Keep the original upload so the review screen can rebuild the folder
		// with formatted files swapped in; clear it for non-folder intakes.
		if (mode === 'folder') setUploadSource({ kind: 'folder', files: folderFiles });
		else if (mode === 'zip' && file) setUploadSource({ kind: 'zip', file });
		else setUploadSource(null);
		setVisibleRows(0);
		setPhase(mode === 'zip' || mode === 'folder' ? 'scanning' : 'input');
		mutation.mutate();
	};

	const reset = () => {
		mutation.reset();
		setPreview(null);
		setVisibleRows(0);
		setPhase('input');
	};

	const handleDrop = async (event: React.DragEvent) => {
		event.preventDefault();
		dragDepth.current = 0;
		setDragging(false);
		setReadingDrop(true);

		try {
			const droppedFiles = Array.from(event.dataTransfer.files);
			const zip = droppedFiles.find((entry) => isZip(entry));
			const entries = Array.from(event.dataTransfer.items)
				.map((item) => item.webkitGetAsEntry?.())
				.filter((entry): entry is FileSystemEntry => Boolean(entry));
			const hasDirectory = entries.some((entry) => entry.isDirectory);

			if (zip && !hasDirectory) {
				setMode('zip');
				setFile(zip);
				setFolderFiles([]);
				pushToast(`Ready to scan ${zip.name}`, 'success');
				return;
			}

			const files = await folderFilesFromDrop(event.dataTransfer.items);
			if (files.length === 0) throw new Error('That drop did not contain a readable folder or ZIP archive.');
			setMode('folder');
			setFile(null);
			setFolderFiles(files);
			setShowFolderGuide(false);
			pushToast(`Ready to scan ${folderName(files)} with ${files.length} files`, 'success');
		} catch (error) {
			pushToast(error instanceof Error ? error.message : 'Could not read dropped files.', 'error');
		} finally {
			setReadingDrop(false);
		}
	};

	const selectedLabel =
		mode === 'folder'
			? folderFiles.length
				? `${folderName(folderFiles)} · ${folderFiles.length} files`
				: 'No folder selected'
			: file?.name || (mode === 'snippet' ? filename : 'No file selected');
	const hasSelectedSource = Boolean(file || folderFiles.length);
	const selectedSize = file?.size ?? folderFiles.reduce((total, entry) => total + entry.file.size, 0);
	const selectedKind = folderFiles.length ? 'Project folder' : mode === 'zip' ? 'ZIP archive' : 'Source file';

	if (phase !== 'input') {
		const rows = preview?.modules.slice(0, visibleRows) ?? [];
		return (
			<div className="mx-auto flex max-w-[560px] flex-col items-center px-7 py-16">
				<div className="relative mb-[22px] h-[54px] w-[54px]">
					<div className="absolute inset-0 rounded-full border-[3px] border-line" />
					<div
						className={`absolute inset-0 rounded-full border-[3px] border-transparent border-r-accent border-t-accent ${
							phase === 'scanning' ? 'animate-cx-spin' : ''
						}`}
					/>
					{phase === 'complete' && (
						<div className="absolute inset-[7px] flex items-center justify-center rounded-full bg-success-bg text-xl text-success">
							<Icon name="check" />
						</div>
					)}
				</div>
				<h1 className="mb-1.5 text-[16px] font-semibold">
					{phase === 'complete' ? 'Scan complete' : 'Scanning workspace for backend modules…'}
				</h1>
				<p className="mb-[22px] text-center text-[12.5px] text-fg-muted">
					{phase === 'complete' && preview
						? `${preview.modules.length} backend roots · ${preview.totals.files} files detected`
						: 'Reading project structure, manifests, and source files.'}
				</p>
				<div className="relative mb-6 h-1 w-full overflow-hidden rounded bg-bg-3">
					<div
						className={
							phase === 'complete'
								? 'h-full w-full rounded bg-progress'
								: 'absolute inset-y-0 w-2/5 animate-cx-shimmer rounded bg-progress'
						}
					/>
				</div>
				<div className="cx-scroll max-h-[clamp(160px,38vh,360px)] min-h-[48px] w-full overflow-auto rounded-lg border border-line bg-bg-2">
					{rows.map((module) => (
						<div
							key={module.id}
							className="cx-fade flex items-center gap-2.5 border-b border-line px-3.5 py-2.5 text-[12.5px] last:border-b-0"
						>
							<span className="flex w-4 justify-center text-success">
								<Icon name="check" />
							</span>
							<span className="font-mono">{module.id}/</span>
							<span className="flex-1" />
							<span className="text-[11px] text-fg-muted">{module.files.length} files</span>
						</div>
					))}
					{phase === 'scanning' && !preview && (
						<div className="flex items-center gap-2.5 px-3.5 py-2.5 text-[12.5px]">
							<span className="animate-cx-spin text-fg-muted">
								<Icon name="sync" />
							</span>
							<span className="font-mono">{selectedLabel}</span>
							<span className="ml-auto text-[11px] text-fg-muted">reading…</span>
						</div>
					)}
				</div>
				<div className="mt-6 flex w-full justify-end gap-2.5">
					<Button variant="secondary" onClick={reset}>
						Restart scan
					</Button>
					<Button
						variant="primary"
						disabled={phase !== 'complete'}
						onClick={() => router.push('/select')}
					>
						Continue to selection
						<Icon name="arrow-right" />
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className={`mx-auto w-full px-7 py-12 transition-[max-width] duration-200 ${mode === 'snippet' ? 'max-w-[868px]' : 'max-w-[620px]'}`}>
			<div className="mb-7 text-center">
				<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-bg-2 text-[22px] text-accent">
					<Icon name="scan" />
				</div>
				<h1 className="text-[17px] font-semibold">Scan backend source</h1>
				<p className="mt-1.5 text-[12.5px] text-fg-muted">
					Add a project, file, or snippet. Codexa will detect the backend structure before formatting.
				</p>
			</div>

			<div className="mb-5 grid grid-cols-2 gap-2.5">
				{MODES.map((item) => (
					<button
						key={item.id}
						onClick={() => {
							setMode(item.id);
							setFile(null);
							setFolderFiles([]);
							setDragging(false);
							setShowFolderGuide(false);
						}}
						className={`flex items-start gap-3 rounded-lg border p-3.5 text-left transition ${
							mode === item.id
								? 'border-primary bg-info-bg'
								: 'border-line bg-bg-2 hover:bg-[var(--list-hover)]'
						}`}
					>
						<span className={mode === item.id ? 'mt-0.5 text-link' : 'mt-0.5 text-fg-muted'}>
							<Icon name={item.icon} />
						</span>
						<span>
							<span className="block text-[12.5px] font-medium">{item.label}</span>
							<span className="mt-0.5 block text-[10.5px] leading-4 text-fg-muted">{item.detail}</span>
						</span>
					</button>
				))}
			</div>

			<div className="rounded-lg border border-line bg-bg-2 p-4">
				{mode === 'snippet' ? (
					<div className="space-y-3">
						<label className="block">
							<span className="mb-1.5 block text-[11.5px] font-medium">File name</span>
							<input
								value={filename}
								onChange={(event) => setFilename(event.target.value)}
								className="cx-control w-full font-mono"
							/>
						</label>
						<label className="block">
							<span className="mb-1.5 block text-[11.5px] font-medium">Source</span>
							<textarea
								value={content}
								spellCheck={false}
								onChange={(event) => setContent(event.target.value)}
								placeholder="export const getUser = (user) => user.name;"
								className="cx-control cx-scroll h-48 w-full resize-none font-mono leading-relaxed"
							/>
						</label>
					</div>
				) : (
					<div
						onDragEnter={(event) => {
							event.preventDefault();
							dragDepth.current += 1;
							setDragging(true);
						}}
						onDragOver={(event) => {
							event.preventDefault();
							event.dataTransfer.dropEffect = 'copy';
						}}
						onDragLeave={(event) => {
							event.preventDefault();
							dragDepth.current = Math.max(0, dragDepth.current - 1);
							if (dragDepth.current === 0) setDragging(false);
						}}
						onDrop={(event) => void handleDrop(event)}
						className={`relative min-h-[210px] overflow-hidden rounded-2xl border bg-bg transition-all ${
							dragging
								? 'scale-[1.01] border-accent shadow-[0_0_0_4px_rgba(45,212,191,0.1),0_24px_70px_rgba(0,0,0,0.25)]'
								: hasSelectedSource
									? 'border-success bg-success-bg/35 shadow-[0_16px_50px_rgba(0,0,0,0.16)]'
									: 'border-line-strong'
						}`}
					>
						<div
							className={`absolute inset-0 ${
								hasSelectedSource
									? 'bg-[radial-gradient(circle_at_top_left,rgba(115,201,145,0.16),transparent_52%)]'
									: 'bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.09),transparent_52%)]'
							}`}
						/>
						{hasSelectedSource && !dragging && !readingDrop && (
							<div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-success via-accent to-success" />
						)}
						<div className="relative flex min-h-[210px] flex-col items-center justify-center px-6 py-7 text-center">
							{hasSelectedSource && !dragging && !readingDrop && (
								<div className="mb-4 flex items-center gap-1.5 rounded-full border border-success/40 bg-success-bg px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.8px] text-success">
									<Icon name="check" />
									Ready to scan
								</div>
							)}
							<div
								className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border text-[24px] transition ${
									dragging
										? 'border-accent bg-info-bg text-accent'
										: hasSelectedSource
											? 'border-success/50 bg-success-bg text-success shadow-[0_8px_24px_rgba(115,201,145,0.18)]'
											: 'border-line-strong bg-bg-2 text-accent'
								}`}
							>
								<Icon
									name={
										readingDrop
											? 'sync'
											: folderFiles.length
												? 'folder'
												: file
													? mode === 'zip'
														? 'archive'
														: 'file'
													: 'upload'
									}
									className={readingDrop ? 'animate-cx-spin' : ''}
								/>
							</div>
							<div className="text-[14px] font-semibold text-fg">
								{readingDrop
									? 'Reading dropped workspace…'
									: dragging
										? 'Release to add this workspace'
										: hasSelectedSource
											? folderFiles.length
												? folderName(folderFiles)
												: file?.name
											: 'Drop a project folder or ZIP here'}
							</div>
							<p className="mt-1.5 max-w-sm text-[11.5px] leading-5 text-fg-muted">
								{hasSelectedSource
									? 'Source staged locally. Drop another item here to replace it instantly.'
									: 'Codexa reads folders recursively in the browser. Nothing opens and nothing uploads until you start the scan.'}
							</p>
							{hasSelectedSource && !dragging && !readingDrop && (
								<div className="mt-4 grid w-full max-w-sm grid-cols-3 divide-x divide-line overflow-hidden rounded-xl border border-success/25 bg-bg-2/70 py-2.5 text-left">
									<SourceStat label="Type" value={selectedKind} />
									<SourceStat
										label="Contents"
										value={folderFiles.length ? `${folderFiles.length} files` : '1 file'}
									/>
									<SourceStat label="Size" value={formatBytes(selectedSize)} />
								</div>
							)}
							<div className="mt-5 flex items-center gap-3">
								<Button
									type="button"
									variant={hasSelectedSource ? 'primary' : 'secondary'}
									onClick={() => {
										if (mode === 'folder') {
											setShowFolderGuide(true);
											return;
										}
										fileInput.current?.click();
									}}
									disabled={readingDrop}
								>
									<Icon name={mode === 'folder' ? 'folder' : mode === 'zip' ? 'archive' : 'file'} />
									{hasSelectedSource ? 'Replace source' : 'Browse instead'}
								</Button>
								{hasSelectedSource && (
									<button
										type="button"
										onClick={() => {
											setFile(null);
											setFolderFiles([]);
										}}
										className="rounded-md border border-error-bd px-3 py-2 text-[11.5px] text-error transition hover:bg-error-bg"
									>
										Remove
									</button>
								)}
							</div>
							{!hasSelectedSource && (
								<div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[10px] text-fg-muted">
									<span className="rounded-full border border-line bg-bg-2 px-2.5 py-1">Recursive folders</span>
									<span className="rounded-full border border-line bg-bg-2 px-2.5 py-1">ZIP archives</span>
									<span className="rounded-full border border-line bg-bg-2 px-2.5 py-1">Local-first</span>
								</div>
							)}
							{showFolderGuide && mode === 'folder' && !hasSelectedSource && (
								<div className="mt-5 w-full max-w-md rounded-2xl border border-accent/30 bg-bg-2/95 p-4 text-left shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
									<div className="mb-3 flex items-start gap-3">
										<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/40 bg-info-bg text-accent">
											<Icon name="folder" />
										</span>
										<div>
											<div className="text-[13px] font-semibold text-fg">Use the custom folder drop zone</div>
											<p className="mt-1 text-[11.5px] leading-5 text-fg-muted">
												Drag your project folder onto this card. Codexa reads it recursively here without opening
												the browser folder window.
											</p>
										</div>
									</div>
									<div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
										<button
											type="button"
											onClick={() => setShowFolderGuide(false)}
											className="rounded-md px-2.5 py-2 text-[11.5px] text-fg-muted transition hover:bg-bg-3 hover:text-fg"
										>
											Got it
										</button>
										<Button
											type="button"
											variant="secondary"
											className="text-[11.5px]"
											onClick={() => {
												setShowFolderGuide(false);
												fileInput.current?.click();
											}}
										>
											Open system picker
										</Button>
									</div>
								</div>
							)}
						</div>
						<input
							ref={fileInput}
							type="file"
							accept={mode === 'zip' ? '.zip,application/zip' : mode === 'file' ? '.ts,.tsx,.js,.jsx,.mjs,.cjs' : undefined}
							multiple={mode === 'folder'}
							{...(mode === 'folder' ? ({ webkitdirectory: '' } as React.InputHTMLAttributes<HTMLInputElement>) : {})}
							onChange={(event) => {
								const files = Array.from(event.target.files ?? []);
								if (mode === 'folder') {
									setFolderFiles(
										files.map((entry) => ({
											file: entry,
											path: entry.webkitRelativePath || entry.name,
										})),
									);
								}
								else setFile(files[0] ?? null);
								event.target.value = '';
							}}
							className="sr-only"
						/>
					</div>
				)}
			</div>

			<div className="mt-5 flex items-center justify-between">
				<div className="flex items-center gap-2 text-[11.5px] text-fg-muted">
					<span className="text-success">
						<Icon name="shield" />
					</span>
					Sensitive files and ignored paths are excluded.
				</div>
				<Button
					variant="primary"
					disabled={
						mutation.isPending ||
						(mode === 'zip' && !file) ||
						(mode === 'folder' && folderFiles.length === 0) ||
						(mode === 'file' && !file) ||
						(mode === 'snippet' && !content.trim())
					}
					onClick={start}
				>
					{mode === 'zip' || mode === 'folder' ? 'Scan source' : 'Format source'}
					<Icon name="arrow-right" />
				</Button>
			</div>
		</div>
	);
}

const isZip = (file: File): boolean =>
	file.type === 'application/zip' || file.name.toLowerCase().endsWith('.zip');

const folderName = (files: FolderFile[]): string =>
	files[0]?.path.split('/')[0] || 'Dropped folder';

function SourceStat({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0 px-3">
			<div className="text-[9px] font-semibold uppercase tracking-[0.7px] text-fg-muted">{label}</div>
			<div className="mt-1 truncate text-[11px] font-medium text-fg">{value}</div>
		</div>
	);
}

const formatBytes = (bytes: number): string => {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes >= 10240 ? 0 : 1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
};
