/**
|--------------------------------------------------
| Bordered surface container
|--------------------------------------------------
*/
export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
	/**
	|--------------------------------------------------
	| Render a token-styled card surface
	|--------------------------------------------------
	*/
	return <div className={`rounded-lg border border-line bg-bg-2 ${className}`}>{children}</div>;
}

/**
|--------------------------------------------------
| Uppercase section label
|--------------------------------------------------
*/
export function SectionLabel({ children }: { children: React.ReactNode }) {
	/**
	|--------------------------------------------------
	| Render a spaced uppercase label
	|--------------------------------------------------
	*/
	return <div className="mb-2 text-[10px] font-medium uppercase tracking-[1px] text-fg-muted">{children}</div>;
}
