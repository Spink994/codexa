/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { Icon } from './Icon';

/**
|--------------------------------------------------
| A single pipeline phase
|--------------------------------------------------
*/
export interface Phase {
	key: string;
	label: string;
}

/**
|--------------------------------------------------
| Phase visual state
|--------------------------------------------------
*/
type PhaseState = 'done' | 'active' | 'pending';

/**
|--------------------------------------------------
| Horizontal pipeline phase stepper
|--------------------------------------------------
*/
export function PhaseStepper({ phases, activeIndex }: { phases: Phase[]; activeIndex: number }) {
	/**
	|--------------------------------------------------
	| Resolve each phase's state from the active index
	|--------------------------------------------------
	*/
	const stateFor = (index: number): PhaseState =>
		index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending';

	/**
	|--------------------------------------------------
	| Render the connected steps
	|--------------------------------------------------
	*/
	return (
		<div className="flex items-center">
			{phases.map((phase, index) => {
				const state = stateFor(index);
				return (
					<div key={phase.key} className="flex flex-1 items-center last:flex-none">
						{/**
						|--------------------------------------------------
						| Step marker and label
						|--------------------------------------------------
						*/}
						<div className="flex items-center gap-2">
							<span
								className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
									state === 'done'
										? 'bg-success text-bg'
										: state === 'active'
											? 'bg-progress text-primary-fg'
											: 'bg-bg-3 text-fg-muted'
								}`}
							>
								{state === 'done' ? <Icon name="check" /> : index + 1}
							</span>
							<span className={`text-[11.5px] ${state === 'pending' ? 'text-fg-muted' : 'text-fg'}`}>
								{phase.label}
							</span>
						</div>

						{/**
						|--------------------------------------------------
						| Connector to the next step
						|--------------------------------------------------
						*/}
						{index < phases.length - 1 && (
							<div className={`mx-2 h-px flex-1 ${index < activeIndex ? 'bg-success' : 'bg-line'}`} />
						)}
					</div>
				);
			})}
		</div>
	);
}
