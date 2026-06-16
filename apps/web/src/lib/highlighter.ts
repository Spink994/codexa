/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { createHighlighter, type Highlighter } from 'shiki';

import type { Theme } from '@/store/ui-store';

/**
|--------------------------------------------------
| Grammars and themes loaded into the highlighter
|--------------------------------------------------
*/
const SHIKI_LANGS = ['tsx', 'jsx'] as const;
const SHIKI_THEMES = ['dark-plus', 'light-plus', 'github-dark-high-contrast'] as const;

/**
|--------------------------------------------------
| Map a UI theme onto its closest VS Code theme
|--------------------------------------------------
*/
const THEME_MAP: Record<Theme, (typeof SHIKI_THEMES)[number]> = {
	dark: 'dark-plus',
	light: 'light-plus',
	'high-contrast': 'github-dark-high-contrast',
};

/**
|--------------------------------------------------
| Cached highlighter instance, created once
|--------------------------------------------------
*/
let highlighterPromise: Promise<Highlighter> | null = null;

/**
|--------------------------------------------------
| Resolve the shared highlighter, loading on demand
|--------------------------------------------------
*/
function getHighlighter(): Promise<Highlighter> {
	/**
	|--------------------------------------------------
	| Reuse the in-flight or resolved instance
	|--------------------------------------------------
	*/
	if (highlighterPromise) return highlighterPromise;

	/**
	|--------------------------------------------------
	| Create it with only the grammars and themes we need
	|--------------------------------------------------
	*/
	highlighterPromise = createHighlighter({
		langs: [...SHIKI_LANGS],
		themes: [...SHIKI_THEMES],
	});

	return highlighterPromise;
}

/**
|--------------------------------------------------
| Highlight source into themed HTML for the preview
|--------------------------------------------------
*/
export async function highlightSource(source: string, language: string, theme: Theme): Promise<string> {
	/**
	|--------------------------------------------------
	| Pick a loaded grammar, treating JavaScript as JSX
	|--------------------------------------------------
	*/
	const lang = language === 'javascript' ? 'jsx' : 'tsx';

	/**
	|--------------------------------------------------
	| Render the source with the active theme
	|--------------------------------------------------
	*/
	const highlighter = await getHighlighter();

	return highlighter.codeToHtml(source, { lang, theme: THEME_MAP[theme] });
}
