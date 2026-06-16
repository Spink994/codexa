/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
//@ts-ignore
import './globals.css';
import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { QueryProvider } from '@/lib/query';
import { Sidebar } from '@/components/Sidebar';
import { AppHeader } from '@/components/AppHeader';
import { ToastViewport } from '@/components/Toast';
import { SessionBootstrap } from '@/components/SessionBootstrap';

/**
|--------------------------------------------------
| Monospace brand font
|--------------------------------------------------
*/
const mono = JetBrains_Mono({
	subsets: ['latin'],
	weight: ['400', '500', '600'],
	variable: '--font-mono',
});

/**
|--------------------------------------------------
| Document metadata
|--------------------------------------------------
*/
export const metadata: Metadata = {
	title: 'Codexa',
	description: 'AI code formatter that conforms to your house style.',
};

/**
|--------------------------------------------------
| Root application layout
|--------------------------------------------------
*/
export default function RootLayout({ children }: { children: React.ReactNode }) {
	/**
	|--------------------------------------------------
	| Render the themed application shell
	|--------------------------------------------------
	*/
	return (
		<html lang="en" className={mono.variable}>
			<head>
				{/**
				|--------------------------------------------------
				| Apply the persisted theme before paint
				|--------------------------------------------------
				*/}
				<script
					dangerouslySetInnerHTML={{
						__html: `try{var t=localStorage.getItem('codexa.theme');if(t)document.documentElement.dataset.theme=t;}catch(e){}`,
					}}
				/>
			</head>
			<body>
				<QueryProvider>
					<SessionBootstrap />
					{/**
					|--------------------------------------------------
					| Sidebar + content shell
					|--------------------------------------------------
					*/}
					<div className="flex h-screen w-full overflow-hidden">
						<Sidebar />
						<div className="flex min-w-0 flex-1 flex-col">
							{/**
							|--------------------------------------------------
							| App header
							|--------------------------------------------------
							*/}
							<AppHeader />

							{/**
							|--------------------------------------------------
							| Header
							|--------------------------------------------------
							*/}
							<main className="cx-scroll flex-1 overflow-auto">
								<div className="w-full px-8 py-6">{children}</div>
							</main>
						</div>
					</div>
					<ToastViewport />
				</QueryProvider>
			</body>
		</html>
	);
}
