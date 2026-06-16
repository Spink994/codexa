/**
|--------------------------------------------------
| Icon name union
|--------------------------------------------------
*/
export type IconName =
	| 'gear'
	| 'check'
	| 'close'
	| 'play'
	| 'pause'
	| 'stop'
	| 'refresh'
	| 'upload'
	| 'clipboard'
	| 'sync'
	| 'warn'
	| 'git'
	| 'contrast'
	| 'download'
	| 'cloud'
	| 'diff'
	| 'archive'
	| 'folder'
	| 'file'
	| 'scan'
	| 'shield'
	| 'search'
	| 'filter'
	| 'chevron'
	| 'arrow-right'
	| 'mail'
	| 'lock'
	| 'eye'
	| 'eye-off'
	| 'info'
	| 'logout'
	| 'login'
	| 'user-plus'
	| 'save'
	| 'trash'
	| 'plug'
	| 'calendar';

/**
|--------------------------------------------------
| Inline SVG path data per icon
|--------------------------------------------------
*/
const PATHS: Record<IconName, React.ReactNode> = {
	gear: (
		<path d="M8 5.5A2.5 2.5 0 1 0 8 10.5 2.5 2.5 0 0 0 8 5.5Zm5.4 2.5a5.4 5.4 0 0 0-.1-1l1.3-1-1.5-2.6-1.6.6a5.4 5.4 0 0 0-1.7-1L9.3 1H6.7l-.2 1.5a5.4 5.4 0 0 0-1.7 1l-1.6-.6L1.7 5.5l1.3 1a5.4 5.4 0 0 0 0 2l-1.3 1 1.5 2.6 1.6-.6a5.4 5.4 0 0 0 1.7 1l.2 1.5h2.6l.2-1.5a5.4 5.4 0 0 0 1.7-1l1.6.6 1.5-2.6-1.3-1c.06-.33.1-.66.1-1Z" />
	),
	play: <path d="M5 3.5v9l7-4.5z" />,
	check: <path d="M3 8.5 6.5 12 13 4" />,
	close: <path d="M4 4l8 8M12 4l-8 8" />,
	upload: <path d="M8 11V3M5 6l3-3 3 3M3.5 13h9" />,
	diff: <path d="M8 2v12M3 6h4M9 10h4M5 4v4M11 8v4" />,
	pause: <path d="M5 3.5h2.2v9H5zM8.8 3.5H11v9H8.8z" />,
	stop: <rect x="4" y="4" width="8" height="8" rx="1" />,
	sync: <path d="M13 8a5 5 0 1 1-1.5-3.5M13 2.5V5h-2.5" />,
	refresh: <path d="M13 8a5 5 0 1 1-1.5-3.5M13 2.5V5h-2.5" />,
	warn: <path d="M8 2.5 14.5 13.5h-13zM8 6.5v3.5M8 11.8v.2" />,
	clipboard: <path d="M6 3.5h4M5 4.5h6v9H5zM6.5 2.5h3v2h-3z" />,
	git: <path d="M4 4.5v7M4 4.5a1.2 1.2 0 1 0 0-.01M4 11.5a1.2 1.2 0 1 0 0-.01M11 5.5a1.2 1.2 0 1 0 0-.01M11 5.5v1a3 3 0 0 1-3 3H4" />,
	contrast: <path d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM8 2v12a6 6 0 0 0 0-12z" />,
	download: <path d="M8 2v8M5 7l3 3 3-3M3.5 13h9" />,
	cloud: <path d="M4.5 12a2.5 2.5 0 0 1 0-5 3.5 3.5 0 0 1 6.8-1A2.5 2.5 0 0 1 11.5 12z" />,
	archive: <path d="M2.5 4.5h11v9h-11zM2 2.5h12v2H2zM6 7h4" />,
	folder: <path d="M1.8 4.2H6l1.5 1.6h6.7v7.4H1.8z" />,
	file: <path d="M4 2h5l3 3v9H4zM9 2v3h3" />,
	scan: <path d="M5 2H2v3M11 2h3v3M5 14H2v-3M11 14h3v-3M5 8h6" />,
	shield: <path d="M8 1.8 13.2 4v3.6C13.2 11 8 14 8 14S2.8 11 2.8 7.6V4zM5.6 8l1.7 1.7 3.3-3.4" />,
	search: <path d="M7 2.6a4.4 4.4 0 1 0 0 8.8 4.4 4.4 0 0 0 0-8.8zM10.4 10.4 14 14" />,
	filter: <path d="M2 3.5h12L9.4 9v3.5l-2.8 1.6V9z" />,
	chevron: <path d="m6 4 4 4-4 4" />,
	'arrow-right': <path d="M3 8h10M9 4l4 4-4 4" />,
	mail: <path d="M2.5 4h11v8h-11zM2.5 4.5 8 8.5l5.5-4" />,
	lock: <path d="M4.5 7V5.3a3.5 3.5 0 0 1 7 0V7M3.6 7h8.8v6.3H3.6zM8 9.6v2" />,
	eye: <path d="M1.6 8S4 3.7 8 3.7 14.4 8 14.4 8 12 12.3 8 12.3 1.6 8 1.6 8ZM8 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />,
	'eye-off': <path d="M6.3 6.4A2 2 0 0 0 9.6 9.7M3 4.6C1.9 5.6 1.6 8 1.6 8s2.4 4.3 6.4 4.3c1 0 1.9-.3 2.7-.7M12.7 11C14 10 14.4 8 14.4 8S12 3.7 8 3.7M2.5 2.5l11 11" />,
	info: <path d="M8 7.2v4M8 4.7v.1M8 1.6a6.4 6.4 0 1 0 0 12.8A6.4 6.4 0 0 0 8 1.6z" />,
	logout: <path d="M7 3H3v10h4M9 5l3 3-3 3M6 8h6" />,
	login: <path d="M9 3h4v10H9M7 5l3 3-3 3M3 8h7" />,
	'user-plus': <path d="M6 7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.8 14v-1.5A3.5 3.5 0 0 1 5.3 9h1.4a3.5 3.5 0 0 1 2.8 1.4M12.5 8.5v5M10 11h5" />,
	save: <path d="M2.5 2.5h9l2 2v9h-11zM5 2.5v4h5v-4M5 13.5v-4h6v4" />,
	trash: <path d="M3.5 4.5h9M6 4.5V2.8h4v1.7M5 6.5v6M8 6.5v6M11 6.5v6M4.5 4.5l.5 9h6l.5-9" />,
	plug: <path d="M6 2v3M10 2v3M4 5h8v2a4 4 0 0 1-8 0zM8 11v3" />,
	calendar: <path d="M3 3.5h10v10H3zM5.5 2v3M10.5 2v3M3 6.5h10M5.5 9h.01M8 9h.01M10.5 9h.01M5.5 11.5h.01M8 11.5h.01" />,
};

/**
|--------------------------------------------------
| Inline icon component
|--------------------------------------------------
*/
export function Icon({ name, className }: { name: IconName; className?: string }) {
	/**
	|--------------------------------------------------
	| Render the named SVG glyph at 1em
	|--------------------------------------------------
	*/
	return (
		<svg
			width="1em"
			fill="none"
			height="1em"
			strokeWidth={1.4}
			aria-hidden="true"
			viewBox="0 0 16 16"
			stroke="currentColor"
			className={className}
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			{PATHS[name]}
		</svg>
	);
}
