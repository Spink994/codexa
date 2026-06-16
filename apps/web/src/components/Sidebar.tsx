'use client';

/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { Icon, type IconName } from './Icon';
import { useUiStore } from '@/store/ui-store';
import { useAuthStore } from '@/store/auth-store';
import type { RunStatus } from '@/lib/types';

/**
|--------------------------------------------------
| Single navigation entry
|--------------------------------------------------
*/
interface NavItem {
	href: string;
	label: string;
	icon: IconName;
}

/**
|--------------------------------------------------
| Grouped navigation entry
|--------------------------------------------------
*/
interface NavGroup {
	label: string;
	items: NavItem[];
}

/**
|--------------------------------------------------
| Static navigation groups around the run list
|--------------------------------------------------
*/
const CORE_GROUP: NavGroup = {
	label: 'Core flow',
	items: [
		{ href: '/', label: 'Backend scan', icon: 'scan' },
		{ href: '/select', label: 'Select & configure', icon: 'folder' },
	],
};

const SETTINGS_GROUP: NavGroup = {
	label: 'Settings & edge',
	items: [{ href: '/providers', label: 'Provider settings', icon: 'cloud' }],
};

/**
|--------------------------------------------------
| Status dot colour per run status
|--------------------------------------------------
*/
const RUN_DOT: Record<RunStatus, string> = {
	queued: 'bg-info',
	running: 'bg-info',
	paused: 'bg-warning',
	completed: 'bg-success',
	cancelled: 'bg-warning',
	failed: 'bg-error',
};

/**
|--------------------------------------------------
| Decide whether a nav entry matches the route
|--------------------------------------------------
*/
const isActive = (href: string, pathname: string): boolean => {
	/**
	|--------------------------------------------------
	| Match the home route exactly
	|--------------------------------------------------
	*/
	if (href === '/') return pathname === '/';

	/**
	|--------------------------------------------------
	| Otherwise match the route prefix
	|--------------------------------------------------
	*/
	return pathname === href || pathname.startsWith(`${href}/`);
};

/**
|--------------------------------------------------
| Application navigation sidebar
|--------------------------------------------------
*/
export function Sidebar() {
	/**
	|--------------------------------------------------
	| Resolve the active route and recent runs
	|--------------------------------------------------
	*/
	const pathname = usePathname();
	const router = useRouter();
	const recentRuns = useUiStore((state) => state.recentRuns);
	const hydrateRuns = useUiStore((state) => state.hydrateRuns);
	const user = useAuthStore((state) => state.user);
	const ready = useAuthStore((state) => state.ready);
	const logout = useAuthStore((state) => state.logout);

	/**
	|--------------------------------------------------
	| Load persisted runs once on the client
	|--------------------------------------------------
	*/
	useEffect(() => {
		hydrateRuns();
	}, [hydrateRuns]);

	/**
	|--------------------------------------------------
	| Render the brand, grouped navigation, and footer
	|--------------------------------------------------
	*/
	return (
		<aside className="flex w-[224px] shrink-0 flex-col border-r border-line bg-bg-2">
			{/**
			|--------------------------------------------------
			| Brand header
			|--------------------------------------------------
			*/}
			<Link href="/" className="flex items-center gap-2.5 border-b border-line px-4 py-3.5">
				<span className="cx-logo flex h-[26px] w-[26px] items-center justify-center rounded-md">
					<span className="block h-[10px] w-[10px] rotate-45 rounded-sm border-2 border-bg-2" />
				</span>
				<span className="flex flex-col leading-none">
					<span className="text-[13.5px] font-semibold text-fg">Codexa</span>
					<span className="mt-1 text-[10px] text-fg-muted">webview · v0.4</span>
				</span>
			</Link>

			{/**
			|--------------------------------------------------
			| Grouped navigation
			|--------------------------------------------------
			*/}
			<nav className="cx-scroll flex-1 overflow-auto px-2.5 py-3.5">
				{/**
				|--------------------------------------------------
				| Core flow
				|--------------------------------------------------
				*/}
				<NavSection label={CORE_GROUP.label}>
					{CORE_GROUP.items.map((item) => (
						<NavLink key={item.href} href={item.href} icon={item.icon} active={isActive(item.href, pathname)}>
							{item.label}
						</NavLink>
					))}
				</NavSection>

				{/**
				|--------------------------------------------------
				| Runs — history plus recently visited runs
				|--------------------------------------------------
				*/}
				<NavSection label="Runs">
					<NavLink href="/history" icon="clipboard" active={isActive('/history', pathname)}>
						Run history
					</NavLink>
					{recentRuns.map((run) => {
						const href = `/runs/${run.id}`;
						return (
							<NavLink key={run.id} href={href} icon="diff" active={isActive(href, pathname)}>
								<span className="flex flex-1 items-center gap-2 truncate">
									<span
										className={`h-1.5 w-1.5 shrink-0 rounded-full ${run.status ? RUN_DOT[run.status] : 'bg-fg-muted/50'}`}
									/>
									<span className="truncate font-mono text-[11.5px]">Run {run.id.slice(0, 8)}</span>
								</span>
							</NavLink>
						);
					})}
				</NavSection>

				{/**
				|--------------------------------------------------
				| Settings & edge
				|--------------------------------------------------
				*/}
				<NavSection label={SETTINGS_GROUP.label}>
					{SETTINGS_GROUP.items.map((item) => (
						<NavLink key={item.href} href={item.href} icon={item.icon} active={isActive(item.href, pathname)}>
							{item.label}
						</NavLink>
					))}
				</NavSection>
			</nav>

			<div className="border-t border-line p-3">
				{!ready ? (
					<div className="h-[74px] animate-pulse rounded-lg bg-bg-3" />
				) : user ? (
					<div className="rounded-lg border border-line bg-bg p-3">
						<div className="flex items-center gap-2.5">
							<span className="cx-logo flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-[#06231f]">
								{user.email.slice(0, 1).toUpperCase()}
							</span>
							<div className="min-w-0 flex-1">
								<div className="text-[10px] font-semibold uppercase tracking-[1px] text-fg-muted">Account</div>
								<div className="mt-0.5 truncate text-[11.5px] text-fg" title={user.email}>
									{user.email}
								</div>
							</div>
						</div>
						<button
							onClick={() => {
								logout();
								router.push('/');
							}}
							className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-line px-2 py-1.5 text-[11.5px] text-fg-muted transition hover:bg-bg-3 hover:text-fg"
						>
							<Icon name="logout" />
							Sign out
						</button>
					</div>
				) : (
					<div className="rounded-lg border border-line bg-bg p-3">
						<div className="mb-2.5">
							<div className="text-[11.5px] font-medium text-fg">Save and sync your work</div>
							<div className="mt-1 text-[10.5px] leading-[1.45] text-fg-muted">
								Sync settings, run history, and Git connections.
							</div>
						</div>
						<div className="flex flex-col gap-2">
							<Link
								href="/login"
								className="flex w-full items-center gap-2.5 rounded-md border border-line px-3 py-2 text-[11.5px] text-fg transition hover:bg-bg-3"
							>
								<span className="text-[14px] text-fg-muted">
									<Icon name="login" />
								</span>
								<span className="flex-1 text-left">Sign in</span>
								<span className="text-fg-muted">
									<Icon name="arrow-right" />
								</span>
							</Link>
							<Link
								href="/login?mode=register"
								className="flex w-full items-center gap-2.5 rounded-md bg-primary px-3 py-2 text-[11.5px] font-medium text-primary-fg transition hover:brightness-110"
							>
								<span className="text-[14px]">
									<Icon name="user-plus" />
								</span>
								<span className="flex-1 text-left">Create account</span>
								<Icon name="arrow-right" />
							</Link>
						</div>
					</div>
				)}
			</div>
		</aside>
	);
}

/**
|--------------------------------------------------
| Labeled navigation group
|--------------------------------------------------
*/
function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
	/**
	|--------------------------------------------------
	| Render the heading above its entries
	|--------------------------------------------------
	*/
	return (
		<div className="mb-4 last:mb-0">
			<div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[1.2px] text-fg-muted">{label}</div>
			{children}
		</div>
	);
}

/**
|--------------------------------------------------
| Single navigation link with active state
|--------------------------------------------------
*/
function NavLink({
	href,
	icon,
	active,
	children,
}: {
	href: string;
	icon: IconName;
	active: boolean;
	children: React.ReactNode;
}) {
	/**
	|--------------------------------------------------
	| Render the icon, label, and active indicator
	|--------------------------------------------------
	*/
	return (
		<Link
			href={href}
			className={`mb-0.5 flex items-center gap-2.5 rounded-md px-2 py-[7px] text-[12.5px] transition ${
				active ? 'bg-[var(--list-active)] font-medium text-fg' : 'text-fg-muted hover:bg-[var(--list-hover)] hover:text-fg'
			}`}
		>
			<span className={`text-[14px] ${active ? 'text-accent' : ''}`}>
				<Icon name={icon} />
			</span>
			<span className="flex-1 truncate">{children}</span>
			{active && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
		</Link>
	);
}
