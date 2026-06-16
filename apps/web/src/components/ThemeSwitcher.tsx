'use client';

/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { useEffect } from 'react';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { Icon } from './Icon';
import { useUiStore, type Theme } from '@/store/ui-store';

/**
|--------------------------------------------------
| Theme cycle order and labels
|--------------------------------------------------
*/
const ORDER: Theme[] = ['dark', 'light', 'high-contrast'];
const LABELS: Record<Theme, string> = { dark: 'Dark', light: 'Light', 'high-contrast': 'HC' };

/**
|--------------------------------------------------
| Theme cycle switcher
|--------------------------------------------------
*/
export function ThemeSwitcher() {
	/**
	|--------------------------------------------------
	| Resolve theme state and setter
	|--------------------------------------------------
	*/
	const theme = useUiStore((state) => state.theme);
	const setTheme = useUiStore((state) => state.setTheme);

	/**
	|--------------------------------------------------
	| Sync the store with the persisted theme on mount
	|--------------------------------------------------
	*/
	useEffect(() => {
		/**
		|--------------------------------------------------
		| Read the persisted theme and apply it
		|--------------------------------------------------
		*/
		const stored = (window.localStorage.getItem('codexa.theme') as Theme | null) ?? 'dark';
		setTheme(stored);
	}, [setTheme]);

	/**
	|--------------------------------------------------
	| Advance to the next theme in the cycle
	|--------------------------------------------------
	*/
	const cycle = () => {
		/**
		|--------------------------------------------------
		| Pick the next theme and apply it
		|--------------------------------------------------
		*/
		const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
		setTheme(next ?? 'dark');
	};

	/**
	|--------------------------------------------------
	| Render the switcher button
	|--------------------------------------------------
	*/
	return (
		<button
			onClick={cycle}
			title={`Theme: ${LABELS[theme]}`}
			className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] text-fg-muted transition hover:bg-bg-3 hover:text-fg"
		>
			<Icon name="contrast" />
			{LABELS[theme]}
		</button>
	);
}
