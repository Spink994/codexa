'use client';

import { Card, SectionLabel } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Badge } from '@/components/Badge';
import type { RunState, UnitResult } from '@/lib/types';

const formatDuration = (ms: number): string => {
	if (ms < 1_000) return `${ms} ms`;
	const seconds = ms / 1_000;
	return seconds < 60 ? `${seconds.toFixed(1)} s` : `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
};

const engineLabel = (engine: UnitResult['engine']): string => {
	if (engine === 'deterministic') return 'Deterministic';
	if (engine === 'hybrid') return 'Hybrid';
	if (engine === 'ai') return 'AI';
	return 'Unknown';
};

export function RunReport({ run }: { run: RunState }) {
	const inputTokens = run.results.reduce((total, result) => total + (result.usage?.inputTokens ?? 0), 0);
	const outputTokens = run.results.reduce((total, result) => total + (result.usage?.outputTokens ?? 0), 0);
	const attempts = run.results.flatMap((result) => result.providerAttempts ?? []);
	const conformance = run.results.flatMap((result) => (result.conformance ? [result.conformance] : []));
	const score =
		conformance.length === 0
			? null
			: Math.round(conformance.reduce((total, report) => total + report.score, 0) / conformance.length);
	const passedChecks = conformance.flatMap((report) => report.checks).filter((check) => check.status === 'passed').length;
	const failedChecks = conformance.flatMap((report) => report.checks).filter((check) => check.status === 'failed').length;
	const engines = new Map<string, number>();
	run.results.forEach((result) => engines.set(engineLabel(result.engine), (engines.get(engineLabel(result.engine)) ?? 0) + 1));

	return (
		<div className="cx-fade flex flex-col gap-4">
			<div className="overflow-hidden rounded-xl border border-line bg-bg-2">
				<div className="border-b border-line bg-[linear-gradient(135deg,var(--info-bg),var(--bg-2)_55%,var(--success-bg))] px-5 py-5">
					<div className="flex flex-wrap items-end justify-between gap-4">
						<div>
							<div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[1.4px] text-accent">
								<Icon name="shield" /> Codexa quality report
							</div>
							<h2 className="text-xl font-semibold text-fg">Formatting evidence, not just a token count</h2>
							<p className="mt-1 max-w-2xl text-[12.5px] leading-5 text-fg-muted">
								Every available rule check, provider attempt, and execution path for this run.
							</p>
						</div>
						<div className="flex items-end gap-2">
							<span className="text-4xl font-semibold text-fg">{score ?? '—'}</span>
							<span className="pb-1 text-[12px] text-fg-muted">conformance score</span>
						</div>
					</div>
				</div>

				<div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 sm:divide-y-0">
					<ReportMetric label="Elapsed" value={formatDuration(run.durationMs ?? 0)} />
					<ReportMetric label="Input tokens" value={inputTokens.toLocaleString()} />
					<ReportMetric label="Output tokens" value={outputTokens.toLocaleString()} />
					<ReportMetric label="Provider calls" value={attempts.length.toLocaleString()} />
				</div>
			</div>

			<div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
				<Card className="p-4">
					<SectionLabel>Execution</SectionLabel>
					<div className="flex flex-col gap-3">
						{[...engines.entries()].map(([engine, count]) => (
							<div key={engine} className="flex items-center justify-between rounded-lg border border-line bg-bg px-3 py-2.5">
								<div className="flex items-center gap-2">
									<span className={`h-2 w-2 rounded-full ${engine === 'AI' ? 'bg-info' : engine === 'Hybrid' ? 'bg-warning' : 'bg-success'}`} />
									<span className="text-[12.5px] text-fg">{engine}</span>
								</div>
								<span className="font-mono text-[12px] text-fg-muted">{count} files</span>
							</div>
						))}
					</div>
				</Card>

				<Card className="p-4">
					<SectionLabel>Rule checks</SectionLabel>
					<div className="grid grid-cols-2 gap-3">
						<div className="rounded-lg border border-line bg-success-bg p-3">
							<div className="text-2xl font-semibold text-success">{passedChecks}</div>
							<div className="text-[11.5px] text-fg-muted">checks passed</div>
						</div>
						<div className="rounded-lg border border-line bg-error-bg p-3">
							<div className="text-2xl font-semibold text-error">{failedChecks}</div>
							<div className="text-[11.5px] text-fg-muted">checks need review</div>
						</div>
					</div>
				</Card>
			</div>

			<div className="flex flex-col gap-3">
				{run.results.map((result) => (
					<FileReport key={result.path} result={result} />
				))}
			</div>
		</div>
	);
}

function ReportMetric({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="px-4 py-3.5">
			<div className="text-[10px] uppercase tracking-[1px] text-fg-muted">{label}</div>
			<div className="mt-1 font-mono text-[15px] text-fg">{value}</div>
		</div>
	);
}

function FileReport({ result }: { result: UnitResult }) {
	const checks = result.conformance?.checks ?? [];
	return (
		<Card className="overflow-hidden">
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
				<div className="flex items-center gap-2">
					<Icon name="file" className="text-accent" />
					<span className="font-mono text-[12.5px] text-fg">{result.path}</span>
				</div>
				<div className="flex items-center gap-2">
					<Badge tone={result.conformance?.passed ? 'success' : result.conformance ? 'warning' : 'neutral'}>
						{result.conformance ? `${result.conformance.score}% conformant` : 'legacy report'}
					</Badge>
					<Badge tone={result.engine === 'ai' ? 'info' : result.engine === 'hybrid' ? 'warning' : 'success'}>
						{engineLabel(result.engine)}
					</Badge>
				</div>
			</div>

			<div className="grid gap-4 p-4 lg:grid-cols-2">
				<div>
					<SectionLabel>Conformance evidence</SectionLabel>
					<div className="flex flex-col gap-2">
						{checks.length === 0 && <div className="text-[12px] text-fg-muted">No executable checks were stored for this run.</div>}
						{checks.map((check) => (
							<div key={check.id} className="flex items-start gap-2 rounded-md border border-line bg-bg px-3 py-2">
								<Icon
									name={check.status === 'passed' ? 'check' : check.status === 'failed' ? 'warn' : 'info'}
									className={`mt-0.5 shrink-0 ${check.status === 'passed' ? 'text-success' : check.status === 'failed' ? 'text-error' : 'text-fg-muted'}`}
								/>
								<div>
									<div className="text-[12px] text-fg">{check.label}</div>
									<div className="mt-0.5 text-[11px] leading-4 text-fg-muted">{check.detail}</div>
								</div>
							</div>
						))}
					</div>
				</div>

				<div className="flex flex-col gap-4">
					<div>
						<SectionLabel>Provider attempts</SectionLabel>
						<div className="flex flex-col gap-2">
							{(result.providerAttempts ?? []).length === 0 && (
								<div className="text-[12px] text-fg-muted">No remote provider call was required.</div>
							)}
							{result.providerAttempts?.map((attempt) => (
								<div key={attempt.index} className="grid grid-cols-4 gap-2 rounded-md border border-line bg-bg px-3 py-2">
									<div>
										<div className="text-[10px] text-fg-muted">Attempt</div>
										<div className="font-mono text-[11.5px] text-fg">#{attempt.index}</div>
									</div>
									<div>
										<div className="text-[10px] text-fg-muted">Time</div>
										<div className="font-mono text-[11.5px] text-fg">{formatDuration(attempt.durationMs)}</div>
									</div>
									<div>
										<div className="text-[10px] text-fg-muted">Tokens</div>
										<div className="font-mono text-[11.5px] text-fg">{(attempt.inputTokens + attempt.outputTokens).toLocaleString()}</div>
									</div>
									<div>
										<div className="text-[10px] text-fg-muted">Finish</div>
										<div className="truncate font-mono text-[11.5px] text-fg">{attempt.finishReason ?? 'unknown'}</div>
									</div>
								</div>
							))}
						</div>
					</div>

					{result.warnings.length > 0 && (
						<div>
							<SectionLabel>Warnings</SectionLabel>
							<div className="flex flex-col gap-2">
								{result.warnings.map((warning, index) => (
									<div key={index} className="flex items-start gap-2 rounded-md border border-warning-bd bg-warning-bg px-3 py-2 text-[11.5px] leading-4 text-warning">
										<Icon name="warn" className="mt-0.5 shrink-0" />
										{warning}
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			</div>
		</Card>
	);
}
