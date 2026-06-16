/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { AuthForm } from '@/features/auth/AuthForm';

/**
|--------------------------------------------------
| Login / registration page
|--------------------------------------------------
*/
export default async function LoginPage({
	searchParams,
}: {
	searchParams: Promise<{ mode?: string }>;
}) {
	/**
	|--------------------------------------------------
	| Render the authentication form
	|--------------------------------------------------
	*/
	const { mode } = await searchParams;
	return <AuthForm initialMode={mode === 'register' ? 'register' : 'login'} />;
}
