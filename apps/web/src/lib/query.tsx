'use client';

/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
|--------------------------------------------------
| TanStack Query provider
|--------------------------------------------------
*/
export function QueryProvider({ children }: { children: React.ReactNode }) {
	/**
	|--------------------------------------------------
	| Create one query client per browser session
	|--------------------------------------------------
	*/
	const [client] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: { refetchOnWindowFocus: false, retry: 1 },
				},
			}),
	);

	/**
	|--------------------------------------------------
	| Provide the client to the tree
	|--------------------------------------------------
	*/
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
