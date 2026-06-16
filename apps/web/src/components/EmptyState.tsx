/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { Icon, type IconName } from './Icon';

/**
|--------------------------------------------------
| Premium, fully centered empty / error state
|--------------------------------------------------
*/
export function EmptyState({
	icon,
	title,
	body,
	tips,
	action,
}: {
	icon: IconName;
	title: string;
	body?: string;
	tips?: string[];
	action?: React.ReactNode;
}) {
	/**
	|--------------------------------------------------
	| Render a centered icon, message, tips, and action
	|--------------------------------------------------
	*/
	return (
		<div className="relative flex min-h-[calc(100vh-150px)] w-full flex-col items-center justify-center px-6 py-10 text-center">
			{/**
			|--------------------------------------------------
			| Soft brand glow behind the content
			|--------------------------------------------------
			*/}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-[100px]"
			/>

			{/**
			|--------------------------------------------------
			| Foreground content
			|--------------------------------------------------
			*/}
			<div className="relative flex flex-col items-center">
				{/**
				|--------------------------------------------------
				| Icon tile
				|--------------------------------------------------
				*/}
				<span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-gradient-to-b from-bg-3 to-bg-2 text-[26px] text-accent shadow-[0_18px_50px_-24px_var(--accent)]">
					<Icon name={icon} />
				</span>

				{/**
				|--------------------------------------------------
				| Title and body
				|--------------------------------------------------
				*/}
				<h2 className="text-[18px] font-semibold tracking-tight text-fg">{title}</h2>
				{body && <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-fg-muted">{body}</p>}

				{/**
				|--------------------------------------------------
				| Troubleshooting tips
				|--------------------------------------------------
				*/}
				{tips && tips.length > 0 && (
					<ol className="mt-5 flex max-w-sm flex-col gap-2 rounded-xl border border-line bg-bg-2 p-4 text-left text-[12px] text-fg-muted">
						{tips.map((tip, index) => (
							<li key={index} className="flex gap-2.5">
								<span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-bg-3 text-[10px] font-semibold text-accent">
									{index + 1}
								</span>
								<span>{tip}</span>
							</li>
						))}
					</ol>
				)}

				{/**
				|--------------------------------------------------
				| Action
				|--------------------------------------------------
				*/}
				{action && <div className="mt-6 flex items-center gap-2">{action}</div>}
			</div>
		</div>
	);
}
