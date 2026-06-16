/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { Card } from './Card';

/**
|--------------------------------------------------
| Single metric stat card
|--------------------------------------------------
*/
export function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
	/**
	|--------------------------------------------------
	| Render a labelled numeric metric
	|--------------------------------------------------
	*/
	return (
		<Card className="px-4 py-3">
			<div className="font-mono text-xl text-fg">{value}</div>
			<div className="mt-1 text-[10.5px] uppercase tracking-[1px] text-fg-muted">{label}</div>
		</Card>
	);
}
