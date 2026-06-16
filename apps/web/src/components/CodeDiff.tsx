'use client';

/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { useMemo } from 'react';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { diffLines } from '@/lib/diff';

/**
|--------------------------------------------------
| Per-type row styling
|--------------------------------------------------
*/
const ROW_STYLES = {
	add: 'bg-success-bg/60 text-success',
	del: 'bg-error-bg/60 text-error',
	context: 'text-fg',
};

/**
|--------------------------------------------------
| Per-type gutter marker
|--------------------------------------------------
*/
const MARKERS = { add: '+', del: '-', context: ' ' };

/**
|--------------------------------------------------
| Unified line-level diff viewer
|--------------------------------------------------
*/
export function CodeDiff({ before, after }: { before: string; after: string }) {
	/**
	|--------------------------------------------------
	| Compute the unified diff once per input pair
	|--------------------------------------------------
	*/
	const lines = useMemo(() => diffLines(before, after), [before, after]);

	/**
	|--------------------------------------------------
	| Render the diff rows with gutter markers
	|--------------------------------------------------
	*/
	return (
		<div className="overflow-hidden rounded-md border border-line bg-bg">
			<pre className="cx-scroll overflow-auto p-3 font-mono text-[12px] leading-relaxed">
				<code>
					{lines.map((line, index) => (
						<div key={index} className={`flex ${ROW_STYLES[line.type]}`}>
							{/**
							|--------------------------------------------------
							| Gutter marker
							|--------------------------------------------------
							*/}
							<span className="mr-3 inline-block w-3 shrink-0 select-none text-right opacity-70">
								{MARKERS[line.type]}
							</span>

							{/**
							|--------------------------------------------------
							| Line content
							|--------------------------------------------------
							*/}
							<span className="whitespace-pre">{line.text || ' '}</span>
						</div>
					))}
				</code>
			</pre>
		</div>
	);
}
