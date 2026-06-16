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
import { useAuthStore } from '@/store/auth-store';

/**
|--------------------------------------------------
| Resolve the session once on app load
|--------------------------------------------------
*/
export function SessionBootstrap() {
	/**
	|--------------------------------------------------
	| Read the session resolver from the auth store
	|--------------------------------------------------
	*/
	const bootstrap = useAuthStore((state) => state.bootstrap);

	/**
	|--------------------------------------------------
	| Kick off the session check after mount
	|--------------------------------------------------
	*/
	useEffect(() => {
		void bootstrap();
	}, [bootstrap]);

	/**
	|--------------------------------------------------
	| Render nothing; this component only runs an effect
	|--------------------------------------------------
	*/
	return null;
}
