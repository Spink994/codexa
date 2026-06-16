'use client';

/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { motion } from 'framer-motion';

/**
|--------------------------------------------------
| Determinate or indeterminate progress bar
|--------------------------------------------------
*/
export function ProgressBar({ value }: { value?: number }) {
	/**
	|--------------------------------------------------
	| Render an indeterminate shimmer when no value
	|--------------------------------------------------
	*/
	if (value === undefined) {
		return (
			<div className="relative h-1.5 w-full overflow-hidden rounded-full bg-bg-3">
				<div className="absolute inset-y-0 w-1/3 rounded-full bg-progress animate-cx-shimmer" />
			</div>
		);
	}

	/**
	|--------------------------------------------------
	| Render a determinate animated fill
	|--------------------------------------------------
	*/
	return (
		<div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-3">
			<motion.div
				initial={{ width: 0 }}
				className="h-full rounded-full bg-progress"
				transition={{ duration: 0.35, ease: 'easeOut' }}
				animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
			/>
		</div>
	);
}
