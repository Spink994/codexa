'use client';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { useEffect, useState } from 'react';

import { Icon } from './Icon';
import { highlightSource } from '@/lib/highlighter';
import { useUiStore } from '@/store/ui-store';

/**
|--------------------------------------------------
| Read-only source viewer with syntax highlighting
|--------------------------------------------------
*/
export function CodeBlock({ source, language = 'typescript' }: { source: string; language?: string }) {
	/**
	|--------------------------------------------------
	| Toast access for copy feedback and active theme
	|--------------------------------------------------
	*/
	const pushToast = useUiStore((state) => state.pushToast);
	const theme = useUiStore((state) => state.theme);
	const lines = source.replace(/\n$/, '').split('\n');

	/**
	|--------------------------------------------------
	| Highlighted markup, empty until Shiki resolves
	|--------------------------------------------------
	*/
	const [highlighted, setHighlighted] = useState('');

	/**
	|--------------------------------------------------
	| Highlight whenever the source, language or theme change
	|--------------------------------------------------
	*/
	useEffect(() => {
		/**
		|--------------------------------------------------
		| Guard against stale updates after unmount or change
		|--------------------------------------------------
		*/
		let active = true;

		/**
		|--------------------------------------------------
		| Render the source, falling back to plain text on error
		|--------------------------------------------------
		*/
		highlightSource(source, language, theme)
			.then((html) => {
				if (active) setHighlighted(html);
			})
			.catch(() => {
				if (active) setHighlighted('');
			});

		return () => {
			active = false;
		};
	}, [source, language, theme]);

	/**
	|--------------------------------------------------
	| Copy the source to the clipboard
	|--------------------------------------------------
	*/
	const copy = async () => {
		/**
		|--------------------------------------------------
		| Write to the clipboard and confirm
		|--------------------------------------------------
		*/
		await navigator.clipboard.writeText(source);
		pushToast('Copied to clipboard', 'success');
	};

	/**
	|--------------------------------------------------
	| Render the highlighted source with a copy control
	|--------------------------------------------------
	*/
	return (
		<div className="cx-code relative overflow-hidden rounded-md border border-line bg-bg">
			<button
				onClick={copy}
				className="absolute right-2 top-2 z-10 flex items-center gap-1.5 rounded bg-bg-3 px-2 py-1 text-[11px] text-fg-muted hover:text-fg"
			>
				<Icon name="clipboard" />
				Copy
			</button>

			{/**
			|--------------------------------------------------
			| Highlighted markup once Shiki has rendered
			|--------------------------------------------------
			*/}
			{highlighted ? (
				<div
					className="cx-code-body cx-scroll overflow-auto text-[12px] leading-relaxed"
					dangerouslySetInnerHTML={{ __html: highlighted }}
				/>
			) : (
				/**
				|--------------------------------------------------
				| Plain numbered fallback while highlighting
				|--------------------------------------------------
				*/
				<pre className="cx-scroll overflow-auto p-3 font-mono text-[12px] leading-relaxed">
					<code>
						{lines.map((line, index) => (
							<div key={index} className="flex">
								{/**
								|--------------------------------------------------
								| Line number gutter
								|--------------------------------------------------
								*/}
								<span className="mr-4 inline-block w-8 shrink-0 select-none text-right text-fg-muted/60">
									{index + 1}
								</span>

								{/**
								|--------------------------------------------------
								| Source line content
								|--------------------------------------------------
								*/}
								<span className="whitespace-pre text-fg">{line || ' '}</span>
							</div>
						))}
					</code>
				</pre>
			)}
		</div>
	);
}
