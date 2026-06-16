'use client';

/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { Icon } from './Icon';
import { ThemeSwitcher } from './ThemeSwitcher';

/**
|--------------------------------------------------
| Breadcrumb label per top-level route
|--------------------------------------------------
*/
const CRUMBS: Record<string, string> = {
	'/': 'Scanning workspace',
	'/select': 'Format backend modules',
	'/providers': 'Provider settings',
	'/history': 'Run history',
	'/login': 'Sign in',
};

/**
|--------------------------------------------------
| Top bar with breadcrumb and global actions
|--------------------------------------------------
*/
export function AppHeader() {
	/**
	|--------------------------------------------------
	| Resolve the breadcrumb for the active route
	|--------------------------------------------------
	*/
	const pathname = usePathname();
	const crumb = pathname.startsWith('/runs/') ? 'Run in progress' : CRUMBS[pathname] || 'Codexa';

	/**
	|--------------------------------------------------
	| Render the breadcrumb, theme switcher, and actions
	|--------------------------------------------------
	*/
	return (
		<header className="flex h-11 shrink-0 items-center gap-2.5 border-b border-line bg-bg-2 px-4">
			<span className="text-[12.5px] font-semibold text-fg">Codexa</span>
			<span className="text-fg-muted">/</span>
			<span className="text-[12.5px] text-fg-muted">{crumb}</span>
			<span className="flex-1" />
			<ThemeSwitcher />
			<Link
				href="/providers"
				className="flex h-7 w-7 items-center justify-center rounded-md text-[15px] text-fg-muted hover:bg-[var(--list-hover)] hover:text-fg"
				aria-label="Provider settings"
			>
				<Icon name="gear" />
			</Link>
			<button
				className="flex h-7 w-7 items-center justify-center rounded-md text-[15px] text-fg-muted hover:bg-[var(--list-hover)] hover:text-fg"
				aria-label="Help"
			>
				<Icon name="info" />
			</button>
		</header>
	);
}
