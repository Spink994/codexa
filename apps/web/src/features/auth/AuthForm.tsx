'use client';

/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { Icon } from '@/components/Icon';
import { Button } from '@/components/Button';
import { githubAuthUrl } from '@/lib/api';
import { useUiStore } from '@/store/ui-store';
import { useAuthStore } from '@/store/auth-store';

/**
|--------------------------------------------------
| Authentication mode
|--------------------------------------------------
*/
type Mode = 'login' | 'register';

/**
|--------------------------------------------------
| Login and registration form
|--------------------------------------------------
*/
export function AuthForm({ initialMode = 'login' }: { initialMode?: Mode }) {
	/**
	|--------------------------------------------------
	| Local form state
	|--------------------------------------------------
	*/
	const router = useRouter();
	const [mode, setMode] = useState<Mode>(initialMode);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [busy, setBusy] = useState(false);

	/**
	|--------------------------------------------------
	| Auth actions and notifications
	|--------------------------------------------------
	*/
	const login = useAuthStore((state) => state.login);
	const register = useAuthStore((state) => state.register);
	const pushToast = useUiStore((state) => state.pushToast);

	/**
	|--------------------------------------------------
	| Whether the credentials satisfy the minimum rules
	|--------------------------------------------------
	*/
	const valid = Boolean(email) && password.length >= 8;

	/**
	|--------------------------------------------------
	| Submit the credentials
	|--------------------------------------------------
	*/
	const submit = async (event: React.FormEvent) => {
		/**
		|--------------------------------------------------
		| Run the selected auth action
		|--------------------------------------------------
		*/
		event.preventDefault();
		setBusy(true);
		try {
			await (mode === 'login' ? login(email, password) : register(email, password));
			pushToast(mode === 'login' ? 'Signed in' : 'Account created', 'success');
			router.push('/');
		} catch (error) {
			pushToast(error instanceof Error ? error.message : String(error), 'error');
		} finally {
			setBusy(false);
		}
	};

	/**
	|--------------------------------------------------
	| Render the centered, branded auth card
	|--------------------------------------------------
	*/
	return (
		<div className="relative flex min-h-[calc(100vh-140px)] items-center justify-center">
			{/**
			|--------------------------------------------------
			| Soft brand glow behind the card
			|--------------------------------------------------
			*/}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-[90px]"
			/>

			{/**
			|--------------------------------------------------
			| Auth card
			|--------------------------------------------------
			*/}
			<div className="relative w-full max-w-[400px]">
				{/**
				|--------------------------------------------------
				| Gradient hairline crowning the card
				|--------------------------------------------------
				*/}
				<div className="cx-logo h-[3px] rounded-t-xl" />

				<div className="rounded-b-xl border border-t-0 border-line bg-bg-2 px-7 py-7 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.6)]">
					{/**
					|--------------------------------------------------
					| Brand mark and welcome copy
					|--------------------------------------------------
					*/}
					<div className="mb-6 flex flex-col items-center text-center">
						<span className="cx-logo mb-4 flex h-11 w-11 items-center justify-center rounded-xl shadow-[0_8px_24px_-8px_var(--accent)]">
							<span className="block h-4 w-4 rotate-45 rounded-[3px] border-[2.5px] border-bg-2" />
						</span>
						<h1 className="text-[19px] font-semibold tracking-tight text-fg">
							{mode === 'login' ? 'Welcome back' : 'Create your account'}
						</h1>
						<p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-muted">
							{mode === 'login'
								? 'Sign in to format backend modules to your house style.'
								: 'Start formatting backend modules to your house style.'}
						</p>
					</div>

					{/**
					|--------------------------------------------------
					| Segmented mode toggle
					|--------------------------------------------------
					*/}
					<div className="mb-5 grid grid-cols-2 gap-1 rounded-lg border border-line bg-bg-3 p-1">
						{(['login', 'register'] as Mode[]).map((option) => (
							<button
								key={option}
								type="button"
								onClick={() => setMode(option)}
								className={`rounded-md py-1.5 text-[12px] font-medium transition ${
									mode === option ? 'bg-bg-2 text-fg shadow-sm' : 'text-fg-muted hover:text-fg'
								}`}
							>
								<span className="mr-1 inline-flex text-[13px]">
									<Icon name={option === 'login' ? 'login' : 'user-plus'} />
								</span>
								{option === 'login' ? 'Sign in' : 'Create account'}
							</button>
						))}
					</div>

					{/**
					|--------------------------------------------------
					| GitHub sign-in
					|--------------------------------------------------
					*/}
					<button
						type="button"
						onClick={() => {
							window.location.href = githubAuthUrl();
						}}
						className="mb-4 flex w-full items-center justify-center gap-2 rounded-md border border-line-strong bg-bg px-3 py-2.5 text-[12.5px] font-medium text-fg transition hover:bg-[var(--list-hover)]"
					>
						<span className="text-[15px]">
							<Icon name="git" />
						</span>
						Continue with GitHub
					</button>

					{/**
					|--------------------------------------------------
					| Divider between OAuth and credentials
					|--------------------------------------------------
					*/}
					<div className="mb-4 flex items-center gap-3 text-[10.5px] uppercase tracking-[0.6px] text-fg-muted">
						<span className="h-px flex-1 bg-line" />
						or use email
						<span className="h-px flex-1 bg-line" />
					</div>

					{/**
					|--------------------------------------------------
					| Credentials
					|--------------------------------------------------
					*/}
					<form onSubmit={submit} className="flex flex-col gap-3.5">
						{/**
						|--------------------------------------------------
						| Email
						|--------------------------------------------------
						*/}
						<label className="block">
							<span className="mb-1.5 block text-[11.5px] font-medium text-fg">Email</span>
							<span className="flex items-center gap-2.5 rounded-md border border-line-strong bg-bg px-3 py-2.5 focus-within:border-primary">
								<span className="text-[15px] text-fg-muted">
									<Icon name="mail" />
								</span>
								<input
									type="email"
									value={email}
									autoComplete="email"
									placeholder="you@company.com"
									onChange={(event) => setEmail(event.target.value)}
									className="min-w-0 flex-1 border-0 bg-transparent text-[12.5px] text-fg outline-none placeholder:text-fg-muted"
								/>
							</span>
						</label>

						{/**
						|--------------------------------------------------
						| Password
						|--------------------------------------------------
						*/}
						<label className="block">
							<span className="mb-1.5 block text-[11.5px] font-medium text-fg">Password</span>
							<span className="flex items-center gap-2.5 rounded-md border border-line-strong bg-bg px-3 py-2.5 focus-within:border-primary">
								<span className="text-[15px] text-fg-muted">
									<Icon name="lock" />
								</span>
								<input
									type={showPassword ? 'text' : 'password'}
									value={password}
									autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
									placeholder="At least 8 characters"
									onChange={(event) => setPassword(event.target.value)}
									className="min-w-0 flex-1 border-0 bg-transparent text-[12.5px] text-fg outline-none placeholder:text-fg-muted"
								/>
								<button
									type="button"
									onClick={() => setShowPassword((current) => !current)}
									className="text-[15px] text-fg-muted transition hover:text-fg"
									aria-label={showPassword ? 'Hide password' : 'Show password'}
								>
									<Icon name={showPassword ? 'eye-off' : 'eye'} />
								</button>
							</span>
							{mode === 'register' && (
								<span className="mt-1.5 block text-[11px] text-fg-muted">Use at least 8 characters.</span>
							)}
						</label>

						{/**
						|--------------------------------------------------
						| Submit
						|--------------------------------------------------
						*/}
						<Button
							type="submit"
							variant="primary"
							disabled={busy || !valid}
							className="mt-1 w-full py-2.5 text-[13px] font-semibold"
						>
							{busy ? (
								<>
									<Icon name="sync" className="animate-cx-spin" />
									Working…
								</>
							) : (
								<>
									<Icon name={mode === 'login' ? 'login' : 'user-plus'} />
									{mode === 'login' ? 'Sign in' : 'Create account'}
									<Icon name="arrow-right" />
								</>
							)}
						</Button>
					</form>

					{/**
					|--------------------------------------------------
					| Security reassurance
					|--------------------------------------------------
					*/}
					<div className="mt-6 flex items-center justify-center gap-1.5 border-t border-line pt-4 text-[11px] text-fg-muted">
						<span className="text-success">
							<Icon name="shield" />
						</span>
						Encrypted connection · your source code is never stored.
					</div>
				</div>
			</div>
		</div>
	);
}
