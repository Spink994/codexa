'use client';

/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { useUiStore } from '@/store/ui-store';

/**
|--------------------------------------------------
| Tone class map for toasts
|--------------------------------------------------
*/
const TONES: Record<string, string> = {
	info: 'border-line text-fg',
	error: 'border-error-bd text-error',
	success: 'border-success text-success',
};

/**
|--------------------------------------------------
| Bottom-center toast viewport
|--------------------------------------------------
*/
export function ToastViewport() {
	/**
	|--------------------------------------------------
	| Read toasts from the UI store
	|--------------------------------------------------
	*/
	const toasts = useUiStore((state) => state.toasts);
	const dismissToast = useUiStore((state) => state.dismissToast);

	/**
	|--------------------------------------------------
	| Auto-dismiss the oldest toast on a timer
	|--------------------------------------------------
	*/
	useEffect(() => {
		/**
		|--------------------------------------------------
		| Schedule dismissal for the oldest toast
		|--------------------------------------------------
		*/
		if (toasts.length === 0) return;
		const timer = setTimeout(() => dismissToast(toasts[0].id), 2800);
		return () => clearTimeout(timer);
	}, [toasts, dismissToast]);

	/**
	|--------------------------------------------------
	| Render the stacked toast notifications
	|--------------------------------------------------
	*/
	return (
		<div className="pointer-events-none fixed inset-x-0 bottom-6 flex flex-col items-center gap-2">
			<AnimatePresence>
				{toasts.map((toast) => (
					<motion.div
						key={toast.id}
						exit={{ opacity: 0, y: 8 }}
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.2 }}
						className={`pointer-events-auto rounded-md border bg-bg-2 px-4 py-2 text-[12px] shadow-lg ${TONES[toast.tone]}`}
					>
						{toast.message}
					</motion.div>
				))}
			</AnimatePresence>
		</div>
	);
}
