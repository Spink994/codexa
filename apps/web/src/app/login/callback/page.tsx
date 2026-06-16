'use client';

/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { Icon } from '@/components/Icon';
import { useUiStore } from '@/store/ui-store';
import { useAuthStore } from '@/store/auth-store';

/**
|--------------------------------------------------
| Completes GitHub OAuth from the redirect fragment
|--------------------------------------------------
*/
export default function GithubCallbackPage() {
	/**
	|--------------------------------------------------
	| Page state and collaborators
	|--------------------------------------------------
	*/
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const completeOauth = useAuthStore((state) => state.completeOauth);
	const pushToast = useUiStore((state) => state.pushToast);

	/**
	|--------------------------------------------------
	| Read the token from the URL fragment once
	|--------------------------------------------------
	*/
	useEffect(() => {
		/**
		|--------------------------------------------------
		| Parse the token or error out of the hash
		|--------------------------------------------------
		*/
		const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
		const token = params.get('token');
		const failure = params.get('error');

		/**
		|--------------------------------------------------
		| Surface a returned error and stop
		|--------------------------------------------------
		*/
		if (failure || !token) {
			setError(failure || 'GitHub did not return a session.');
			return;
		}

		/**
		|--------------------------------------------------
		| Establish the session, then land on the home page
		|--------------------------------------------------
		*/
		completeOauth(token)
			.then(() => {
				pushToast('Signed in with GitHub', 'success');
				router.replace('/');
			})
			.catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'GitHub sign-in failed.'));
	}, [completeOauth, pushToast, router]);

	/**
	|--------------------------------------------------
	| Render a spinner, or the failure with a retry link
	|--------------------------------------------------
	*/
	return (
		<div className="flex min-h-[calc(100vh-140px)] flex-col items-center justify-center gap-4 text-center">
			{error ? (
				<>
					<span className="text-2xl text-error">
						<Icon name="warn" />
					</span>
					<p className="max-w-sm text-[13px] text-fg">{error}</p>
					<a href="/login" className="text-[12.5px] text-link underline">
						Back to sign in
					</a>
				</>
			) : (
				<>
					<span className="animate-cx-spin text-2xl text-accent">
						<Icon name="sync" />
					</span>
					<p className="text-[13px] text-fg-muted">Completing GitHub sign-in…</p>
				</>
			)}
		</div>
	);
}
