/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { Icon, type IconName } from './Icon';

/**
|--------------------------------------------------
| Callout tone
|--------------------------------------------------
*/
type Tone = 'info' | 'warning' | 'error' | 'success';

/**
|--------------------------------------------------
| Tone styling and icon
|--------------------------------------------------
*/
const TONES: Record<Tone, { box: string; icon: IconName }> = {
	info: { box: 'border-line bg-info-bg/40 text-info', icon: 'sync' },
	warning: { box: 'border-warning-bd bg-warning-bg text-warning', icon: 'warn' },
	error: { box: 'border-error-bd bg-error-bg text-error', icon: 'warn' },
	success: { box: 'border-success bg-success-bg text-success', icon: 'check' },
};

/**
|--------------------------------------------------
| Inline callout banner
|--------------------------------------------------
*/
export function Callout({ tone = 'info', title, children }: { tone?: Tone; title?: string; children?: React.ReactNode }) {
	/**
	|--------------------------------------------------
	| Resolve the tone styling
	|--------------------------------------------------
	*/
	const style = TONES[tone];

	/**
	|--------------------------------------------------
	| Render the callout
	|--------------------------------------------------
	*/
	return (
		<div className={`flex items-start gap-2.5 rounded-md border px-3.5 py-2.5 text-[12.5px] ${style.box}`}>
			<Icon name={style.icon} className="mt-0.5 shrink-0" />
			<div className="flex flex-col gap-0.5">
				{title && <span className="font-medium">{title}</span>}
				{children && <span className="opacity-90">{children}</span>}
			</div>
		</div>
	);
}
