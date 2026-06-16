/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import type { RunStatus, UnitResult } from '@/lib/types';

/**
|--------------------------------------------------
| Tone-driven badge styling
|--------------------------------------------------
*/
type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'accent';

/**
|--------------------------------------------------
| Tone class map
|--------------------------------------------------
*/
const TONES: Record<Tone, string> = {
	info: 'bg-info-bg text-info',
	accent: 'bg-bg-3 text-accent',
	error: 'bg-error-bg text-error',
	neutral: 'bg-bg-3 text-fg-muted',
	success: 'bg-success-bg text-success',
	warning: 'bg-warning-bg text-warning',
};

/**
|--------------------------------------------------
| Small status pill
|--------------------------------------------------
*/
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
	/**
	|--------------------------------------------------
	| Render the toned pill
	|--------------------------------------------------
	*/
	return (
		<span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10.5px] font-medium ${TONES[tone]}`}>
			{children}
		</span>
	);
}

/**
|--------------------------------------------------
| Map a run status to a badge tone
|--------------------------------------------------
*/
export function runStatusTone(status: RunStatus): Tone {
	/**
	|--------------------------------------------------
	| Resolve the tone for the run status
	|--------------------------------------------------
	*/
	if (status === 'failed') return 'error';
	if (status === 'completed') return 'success';
	if (status === 'cancelled') return 'warning';
	if (status === 'running' || status === 'paused') return 'info';

	/**
	|--------------------------------------------------
	| ...
	|--------------------------------------------------
	*/
	return 'neutral';
}

/**
|--------------------------------------------------
| Map a unit status to a badge tone
|--------------------------------------------------
*/
export function unitStatusTone(status: UnitResult['status']): Tone {
	/**
	|--------------------------------------------------
	| Resolve the tone for the unit status
	|--------------------------------------------------
	*/
	if (status === 'failed') return 'error';
	if (status === 'formatted') return 'success';
	if (status === 'unchanged') return 'neutral';
	if (status === 'stale' || status === 'cancelled') return 'warning';

	/**
	|--------------------------------------------------
	| ...
	|--------------------------------------------------
	*/
	return 'info';
}
