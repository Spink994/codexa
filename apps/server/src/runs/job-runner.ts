/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { Injectable } from '@nestjs/common';

/**
|--------------------------------------------------
| A unit of background work for a run
|--------------------------------------------------
*/
type JobTask = (signal: AbortSignal) => Promise<void>;

/**
|--------------------------------------------------
| Background job runner contract
|--------------------------------------------------
*/
interface JobRunner {
	/**
	|--------------------------------------------------
	| Enqueue a task for a run and begin executing it
	|--------------------------------------------------
	*/
	enqueue(jobId: string, task: JobTask): void;

	/**
	|--------------------------------------------------
	| Request cancellation of a running job
	|--------------------------------------------------
	*/
	cancel(jobId: string): void;
}

/**
|--------------------------------------------------
| In-process job runner
|--------------------------------------------------
| Executes each job in the current process. The same
| contract can be implemented by a BullMQ/Redis adapter
| for distributed, durable execution in production.
|--------------------------------------------------
*/
@Injectable()
export class InProcessJobRunner implements JobRunner {
	/**
	|--------------------------------------------------
	| Abort controllers keyed by job identifier
	|--------------------------------------------------
	*/
	private readonly controllers = new Map<string, AbortController>();

	/**
	|--------------------------------------------------
	| Enqueue and immediately start a job
	|--------------------------------------------------
	*/
	enqueue(jobId: string, task: JobTask): void {
		/**
		|--------------------------------------------------
		| Track an abort controller for the job
		|--------------------------------------------------
		*/
		const controller = new AbortController();
		this.controllers.set(jobId, controller);

		/**
		|--------------------------------------------------
		| Run the task and release the controller when done
		|--------------------------------------------------
		*/
		void task(controller.signal).finally(() => {
			this.controllers.delete(jobId);
		});
	}

	/**
	|--------------------------------------------------
	| Cancel a running job by aborting its signal
	|--------------------------------------------------
	*/
	cancel(jobId: string): void {
		/**
		|--------------------------------------------------
		| Abort the job when a controller is present
		|--------------------------------------------------
		*/
		this.controllers.get(jobId)?.abort();
	}
}

/**
|--------------------------------------------------
| Injection token for the job runner
|--------------------------------------------------
*/
const JOB_RUNNER = 'JOB_RUNNER';

/**
|--------------------------------------------------
| Export job runner contracts
|--------------------------------------------------
*/
export { JOB_RUNNER, type JobTask, type JobRunner };
