'use client';

/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { use, useEffect } from 'react';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { controlRun } from '@/lib/api';
import { saveRun } from '@/lib/run-cache';
import { useUiStore } from '@/store/ui-store';
import { useRunEvents } from '@/lib/useRunEvents';
import { ProgressBar } from '@/components/ProgressBar';
import { ReviewView } from '@/features/review/ReviewView';
import { ProgressView } from '@/features/progress/ProgressView';

/**
|--------------------------------------------------
| Run detail page
|--------------------------------------------------
*/
export default function RunPage({ params }: { params: Promise<{ id: string }> }) {
	/**
	|--------------------------------------------------
	| Resolve the run identifier and live state
	|--------------------------------------------------
	*/
	const { id } = use(params);
	const { run, setRun } = useRunEvents(id);
	const pushToast = useUiStore((state) => state.pushToast);
	const trackRun = useUiStore((state) => state.trackRun);

	/**
	|--------------------------------------------------
	| Remember this run so it stays reachable in the sidebar
	|--------------------------------------------------
	*/
	useEffect(() => {
		trackRun(id, run?.status);
	}, [id, run?.status, trackRun]);

	/**
	|--------------------------------------------------
	| Cache terminal runs locally so they survive reloads
	| and remain viewable for anonymous (non-persisted) runs
	|--------------------------------------------------
	*/
	useEffect(() => {
		if (run && (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled')) {
			void saveRun(run);
		}
	}, [id, run?.status]);

	/**
	|--------------------------------------------------
	| Apply a control action and update local state
	|--------------------------------------------------
	*/
	const control = async (action: 'pause' | 'resume' | 'cancel') => {
		/**
		|--------------------------------------------------
		| Send the action and reflect the new state
		|--------------------------------------------------
		*/
		try {
			const next = await controlRun(id, action);
			setRun(next);
		} catch (error) {
			pushToast(error instanceof Error ? error.message : String(error), 'error');
		}
	};

	/**
	|--------------------------------------------------
	| Show a loading state until the run resolves
	|--------------------------------------------------
	*/
	if (!run) {
		return (
			<div className="flex flex-col gap-3">
				<div className="text-[12.5px] text-fg-muted">Loading run…</div>
				<ProgressBar />
			</div>
		);
	}

	/**
	|--------------------------------------------------
	| Show the review once the run is terminal
	|--------------------------------------------------
	*/
	const terminal = run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled';
	if (terminal) return <ReviewView run={run} />;

	/**
	|--------------------------------------------------
	| Otherwise show live progress
	|--------------------------------------------------
	*/
	return (
		<ProgressView
			run={run}
			onPause={() => control('pause')}
			onResume={() => control('resume')}
			onCancel={() => control('cancel')}
		/>
	);
}
