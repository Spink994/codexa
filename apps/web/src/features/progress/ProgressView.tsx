'use client';

/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import type { RunState } from '@/lib/types';
import { Button } from '@/components/Button';
import { StatCard } from '@/components/StatCard';
import { ProgressBar } from '@/components/ProgressBar';
import { Badge, unitStatusTone } from '@/components/Badge';
import { PhaseStepper, type Phase } from '@/components/PhaseStepper';

/**
|--------------------------------------------------
| Run pipeline phases
|--------------------------------------------------
*/
const PHASES: Phase[] = [
	{ key: 'queued', label: 'Queued' },
	{ key: 'formatting', label: 'Formatting' },
	{ key: 'review', label: 'Review' },
];

/**
|--------------------------------------------------
| Format an elapsed duration as mm:ss
|--------------------------------------------------
*/
const formatElapsed = (ms: number): string => {
	/**
	|--------------------------------------------------
	| Convert milliseconds to minutes and seconds
	|--------------------------------------------------
	*/
	const total = Math.max(0, Math.floor(ms / 1000));
	const minutes = Math.floor(total / 60);
	const seconds = total % 60;
	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
|--------------------------------------------------
| Live run progress view
|--------------------------------------------------
*/
export function ProgressView({
	run,
	onPause,
	onResume,
	onCancel,
}: {
	run: RunState;
	onPause: () => void;
	onResume: () => void;
	onCancel: () => void;
}) {
	/**
	 |--------------------------------------------------
	 | Tick the elapsed clock every second
	 |--------------------------------------------------
	 */
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, []);

	/**
	 |--------------------------------------------------
	 | Determine value
	 |--------------------------------------------------
	 */
	const percent = run.totalUnits ? Math.round((run.completedUnits / run.totalUnits) * 100) : 0;

	/**
	 |--------------------------------------------------
	 | Determine status
	 |--------------------------------------------------
	 */
	const paused = run.status === 'paused';

	/**
	 |--------------------------------------------------
	 | Resolve the active pipeline phase
	 |--------------------------------------------------
	 */
	const activeIndex = run.status === 'queued' ? 0 : 1;

	/**
	 |--------------------------------------------------
	 | Aggregate token usage across results
	 |--------------------------------------------------
	 */
	const tokens = run.results.reduce(
		(total, result) => total + (result.usage ? result.usage.inputTokens + result.usage.outputTokens : 0),
		0,
	);
	const model = run.results.find((result) => result.model)?.model ?? '—';

	/**
	 |--------------------------------------------------
	 | Render content
	 |--------------------------------------------------
	 */
	return (
		<div className="flex flex-col gap-6">
			{/**
			|--------------------------------------------------
			| Phase and controls
			|--------------------------------------------------
			*/}
			<div className="flex items-center justify-between">
				{/**
				|--------------------------------------------------
				| Phase label
				|--------------------------------------------------
				*/}
				<div className="flex items-center gap-2 text-[12.5px] text-fg-muted">
					<Icon name="sync" className={paused ? '' : 'animate-cx-spin'} />
					{paused ? 'Paused' : 'Formatting'} · {run.completedUnits}/{run.totalUnits} files
				</div>

				{/**
				|--------------------------------------------------
				| Controls
				|--------------------------------------------------
				*/}
				<div className="flex gap-2">
					{paused ? (
						/**
						|--------------------------------------------------
						| Resume button
						|--------------------------------------------------
						*/
						<Button onClick={onResume}>
							<Icon name="play" /> Resume
						</Button>
					) : (
						/**
						|--------------------------------------------------
						| Pause button
						|--------------------------------------------------
						*/
						<Button onClick={onPause}>
							<Icon name="pause" /> Pause
						</Button>
					)}

					{/**
					|--------------------------------------------------
					| Cancel button
					|--------------------------------------------------
					*/}
					<Button variant="danger" onClick={onCancel}>
						<Icon name="stop" /> Cancel
					</Button>
				</div>
			</div>

			{/**
			|--------------------------------------------------
			| Phase stepper
			|--------------------------------------------------
			*/}
			<PhaseStepper phases={PHASES} activeIndex={activeIndex} />

			{/**
			|--------------------------------------------------
			| Percentage and progress bar
			|--------------------------------------------------
			*/}
			<div className="flex flex-col gap-3">
				<div className="font-mono text-4xl text-fg">{percent}%</div>
				<ProgressBar value={percent} />
			</div>

			{/**
			|--------------------------------------------------
			| Run metrics
			|--------------------------------------------------
			*/}
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<StatCard label="Files" value={`${run.completedUnits}/${run.totalUnits}`} />
				<StatCard label="Elapsed" value={formatElapsed(now - run.createdAt)} />
				<StatCard label="Tokens" value={tokens.toLocaleString()} />
				<StatCard label="Model" value={<span className="text-[13px]">{model}</span>} />
			</div>

			{/**
			|--------------------------------------------------
			| Streaming per-file results
			|--------------------------------------------------
			*/}
			<Card className="divide-y divide-line">
				<AnimatePresence initial={false}>
					{run.results.map((result) => (
						<motion.div
							key={result.path}
							initial={{ opacity: 0, y: 4 }}
							animate={{ opacity: 1, y: 0 }}
							className="flex items-center justify-between px-4 py-2.5"
						>
							<span className="font-mono text-[12px] text-fg">{result.path}</span>
							<Badge tone={unitStatusTone(result.status)}>{result.status}</Badge>
						</motion.div>
					))}
				</AnimatePresence>

				{/**
				|--------------------------------------------------
				| Empty state
				|--------------------------------------------------
				*/}
				{run.results.length === 0 && (
					<div className="px-4 py-6 text-center text-[12px] text-fg-muted">Waiting for the first file…</div>
				)}
			</Card>
		</div>
	);
}
