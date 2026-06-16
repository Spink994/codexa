'use client';

/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { loadRun } from './run-cache';
import { API_BASE, getRun } from './api';
import type { RunEvent, RunState } from './types';

/**
|--------------------------------------------------
| Subscribe to a run's server-sent events
|--------------------------------------------------
*/
export function useRunEvents(runId: string | undefined) {
	/**
	|--------------------------------------------------
	| Track the live run state and connection status
	|--------------------------------------------------
	*/
	const [run, setRun] = useState<RunState | undefined>();
	const [connected, setConnected] = useState(false);
	const queryClient = useQueryClient();
	const sourceRef = useRef<EventSource | null>(null);

	/**
	|--------------------------------------------------
	| Open the event stream for the run
	|--------------------------------------------------
	*/
	useEffect(() => {
		/**
		|--------------------------------------------------
		| Skip when no run is selected
		|--------------------------------------------------
		*/
		if (!runId) return;

		/**
		|--------------------------------------------------
		| Seed state from the current run snapshot
		|--------------------------------------------------
		*/
		let active = true;
		void getRun(runId)
			.then((state) => {
				if (active) setRun(state);
			})
			.catch(async () => {
				/**
				|--------------------------------------------------
				| Fall back to the locally cached run when the
				| server has none (e.g. an anonymous, evicted run)
				|--------------------------------------------------
				*/
				const cached = await loadRun(runId);
				if (active && cached) setRun(cached);
			});

		/**
		|--------------------------------------------------
		| Connect to the run event stream
		|--------------------------------------------------
		*/
		const source = new EventSource(`${API_BASE}/runs/${runId}/events`);
		sourceRef.current = source;
		source.onopen = () => setConnected(true);

		/**
		|--------------------------------------------------
		| Apply each event to the live run state
		|--------------------------------------------------
		*/
		source.onmessage = (message) => {
			/**
			|--------------------------------------------------
			| Reduce the event into the run state
			|--------------------------------------------------
			*/
			const event = JSON.parse(message.data) as RunEvent;
			setRun((previous) => reduceRunEvent(previous, event));

			/**
			|--------------------------------------------------
			| Close the stream once the run is terminal
			|--------------------------------------------------
			*/
			if (event.type === 'run.completed' || event.type === 'run.cancelled' || event.type === 'run.failed') {
				source.close();
				setConnected(false);
				void queryClient.invalidateQueries({ queryKey: ['run', runId] });
			}
		};

		/**
		|--------------------------------------------------
		| Treat transport errors as a closed connection
		|--------------------------------------------------
		*/
		source.onerror = () => setConnected(false);

		/**
		|--------------------------------------------------
		| Tear down the stream on unmount
		|--------------------------------------------------
		*/
		return () => {
			active = false;
			source.close();
		};
	}, [runId, queryClient]);

	/**
	|--------------------------------------------------
	| Return the live run state and connection status
	|--------------------------------------------------
	*/
	return { run, connected, setRun };
}

/**
|--------------------------------------------------
| Reduce a run event into the run state
|--------------------------------------------------
*/
function reduceRunEvent(previous: RunState | undefined, event: RunEvent): RunState | undefined {
	/**
	|--------------------------------------------------
	| Require a base state before applying updates
	|--------------------------------------------------
	*/
	if (!previous) {
		if (event.type === 'run.created') {
			return {
				results: [],
				status: 'queued',
				completedUnits: 0,
				id: event.runId,
				createdAt: Date.now(),
				totalUnits: event.totalUnits,
			};
		}
		return previous;
	}

	/**
	|--------------------------------------------------
	| Apply the event to the existing state
	|--------------------------------------------------
	*/
	switch (event.type) {
		/**
		|--------------------------------------------------
		| Run started
		|--------------------------------------------------
		*/
		case 'run.started':
			return {
				...previous,
				status: 'running',
			};

		/**
		|--------------------------------------------------
		| Individual unit completed
		|--------------------------------------------------
		*/
		case 'unit.completed':
			return {
				...previous,
				status: 'running',
				completedUnits: event.completedUnits,
				results: [...previous.results.filter((r) => r.path !== event.result.path), event.result],
			};

		/**
		|--------------------------------------------------
		| Run completed
		|--------------------------------------------------
		*/
		case 'run.completed':
			return {
				...previous,
				status: 'completed',
				results: event.results,
				completedUnits: event.results.length,
			};

		/**
		|--------------------------------------------------
		| Run cancelled
		|--------------------------------------------------
		*/
		case 'run.cancelled':
			return {
				...previous,
				status: 'cancelled',
			};

		/**
		|--------------------------------------------------
		| Run failed
		|--------------------------------------------------
		*/
		case 'run.failed':
			return {
				...previous,
				status: 'failed',
				error: event.error,
			};

		/**
		|--------------------------------------------------
		| Fallback
		|--------------------------------------------------
		*/
		default:
			return previous;
	}
}
