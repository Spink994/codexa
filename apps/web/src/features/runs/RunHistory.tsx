'use client';

/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { listRuns } from '@/lib/api';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/Button';
import { useAuthStore } from '@/store/auth-store';
import { EmptyState } from '@/components/EmptyState';
import { listCachedRuns, toSummary } from '@/lib/run-cache';
import { Badge, runStatusTone } from '@/components/Badge';
import { DatePicker } from '@/components/DatePicker';
import type { CachedRun } from '@/lib/run-cache';
import type { RunHistoryResult, RunSummary } from '@/lib/types';

const PAGE_SIZE = 10;

/**
|--------------------------------------------------
| Run history list
|--------------------------------------------------
*/
export function RunHistory() {
	/**
	|--------------------------------------------------
	| Resolve auth state
	|--------------------------------------------------
	*/
	const user = useAuthStore((state) => state.user);
	const ready = useAuthStore((state) => state.ready);
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const [fromDate, setFromDate] = useState('');
	const [toDate, setToDate] = useState('');
	const deferredSearch = useDeferredValue(search.trim());
	const from = dateStart(fromDate);
	const to = dateEnd(toDate);

	useEffect(() => {
		setPage(1);
	}, [deferredSearch, fromDate, toDate]);

	/**
	|--------------------------------------------------
	| Signed-in: account runs; signed-out: local runs
	|--------------------------------------------------
	*/
	const server = useQuery({
		queryKey: ['runs', page, deferredSearch, from, to],
		queryFn: () =>
			listRuns({
				page,
				pageSize: PAGE_SIZE,
				search: deferredSearch || undefined,
				from,
				to,
			}),
		enabled: Boolean(user),
		placeholderData: (previous) => previous,
	});
	const local = useQuery({
		queryKey: ['cached-runs'],
		queryFn: listCachedRuns,
		enabled: ready && !user,
	});

	const localResult = useMemo(
		() => paginateLocalRuns(local.data ?? [], page, deferredSearch, from, to),
		[local.data, page, deferredSearch, from, to],
	);
	const result = user ? server.data : localResult;
	const runs = result?.items;
	const isLoading = user ? server.isLoading : !ready || local.isLoading;
	const hasFilters = Boolean(deferredSearch || fromDate || toDate);

	/**
	|--------------------------------------------------
	| Invite the first run when there is nothing yet
	|--------------------------------------------------
	*/
	if (!isLoading && result && result.total === 0 && !hasFilters) {
		return (
			<EmptyState
				icon="clipboard"
				title="No runs yet"
				body={
					user
						? 'Once you format a project, file, or snippet, every run shows up here with its status and results.'
						: 'Runs you make are saved on this device. Format a project, file, or snippet to see it here.'
				}
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

	/**
	|--------------------------------------------------
	| Render the history list
	|--------------------------------------------------
	*/
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-end gap-3">
				<div className="mr-auto">
					<h1 className="text-[17px] font-semibold text-fg">Run history</h1>
					<p className="mt-1 text-[11px] text-fg-muted">
						{result ? `${result.total} matching ${result.total === 1 ? 'run' : 'runs'}` : 'Search past formatting runs'}
					</p>
				</div>
				<label className="min-w-[220px] flex-1 sm:max-w-sm">
					<span className="mb-1 block text-[11px] font-medium text-fg-muted">Search</span>
					<input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Source, status, run ID, or file path"
						className="cx-control h-[42px] w-full rounded-lg px-3"
					/>
				</label>
				<div>
					<span className="mb-1 block text-[11px] font-medium text-fg-muted">From</span>
					<DatePicker
						value={fromDate}
						max={toDate || undefined}
						onChange={setFromDate}
						placeholder="Start date"
					/>
				</div>
				<div>
					<span className="mb-1 block text-[11px] font-medium text-fg-muted">To</span>
					<DatePicker
						value={toDate}
						min={fromDate || undefined}
						onChange={setToDate}
						placeholder="End date"
					/>
				</div>
				{hasFilters && (
					<Button
						variant="secondary"
						onClick={() => {
							setSearch('');
							setFromDate('');
							setToDate('');
						}}
					>
						Clear
					</Button>
				)}
			</div>

			{/**
			|--------------------------------------------------
			| Local-only notice for signed-out users
			|--------------------------------------------------
			*/}
			{ready && !user && runs && runs.length > 0 && (
				<div className="flex items-center gap-2.5 rounded-lg border border-line bg-bg-2 px-3.5 py-2.5 text-[12px] text-fg-muted">
					<span className="text-accent">
						<Icon name="shield" />
					</span>
					<span>These runs are saved on this device only.</span>
					<Link href="/login" className="ml-auto text-link hover:underline">
						Sign in to save to your account
					</Link>
				</div>
			)}

			{/**
			|--------------------------------------------------
			| Loading state
			|--------------------------------------------------
			*/}
			{isLoading && <Card className="px-4 py-6 text-center text-[12.5px] text-fg-muted">Loading…</Card>}

			{!isLoading && runs?.length === 0 && hasFilters && (
				<Card className="px-4 py-8 text-center">
					<div className="text-[13px] font-medium text-fg">No matching runs</div>
					<div className="mt-1 text-[11.5px] text-fg-muted">Try a broader search or date range.</div>
				</Card>
			)}

			{/**
			|--------------------------------------------------
			| Run rows
			|--------------------------------------------------
			*/}
			{runs?.map((run) => (
				<Link key={run.id} href={`/runs/${run.id}`}>
					<Card className="flex items-center justify-between px-4 py-3 transition hover:border-line-strong">
						<div className="flex flex-col gap-0.5">
							<span className="font-mono text-[12.5px] text-fg">{run.source}</span>
							<span className="text-[11px] text-fg-muted">
								{new Date(run.createdAt).toLocaleString()} · {run.completedUnits}/{run.totalUnits} files
							</span>
						</div>
						<Badge tone={runStatusTone(run.status)}>{run.status}</Badge>
					</Card>
				</Link>
			))}

			{result && result.total > 0 && (
				<div className="flex items-center justify-between gap-3 pt-1 text-[11.5px] text-fg-muted">
					<span>
						Page {result.page} of {result.totalPages}
					</span>
					<div className="flex gap-2">
						<Button
							variant="secondary"
							disabled={page <= 1 || isLoading}
							onClick={() => setPage((current) => Math.max(1, current - 1))}
						>
							Previous
						</Button>
						<Button
							variant="secondary"
							disabled={page >= result.totalPages || isLoading}
							onClick={() => setPage((current) => current + 1)}
						>
							Next
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}

const dateStart = (value: string): number | undefined =>
	value ? new Date(`${value}T00:00:00`).getTime() : undefined;

const dateEnd = (value: string): number | undefined =>
	value ? new Date(`${value}T23:59:59.999`).getTime() : undefined;

const paginateLocalRuns = (
	runs: CachedRun[],
	page: number,
	search: string,
	from?: number,
	to?: number,
): RunHistoryResult => {
	const needle = search.toLowerCase();
	const filtered = runs
		.filter((run) => from === undefined || run.createdAt >= from)
		.filter((run) => to === undefined || run.createdAt <= to)
		.filter((run) => {
			if (!needle) return true;
			return [
				run.id,
				run.source ?? 'Local run',
				run.status,
				run.error ?? '',
				...run.results.map((result) => result.path),
			].some((value) => value.toLowerCase().includes(needle));
		});
	const start = (page - 1) * PAGE_SIZE;
	const items: RunSummary[] = filtered.slice(start, start + PAGE_SIZE).map(toSummary);
	return {
		items,
		page,
		pageSize: PAGE_SIZE,
		total: filtered.length,
		totalPages: Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
	};
};
