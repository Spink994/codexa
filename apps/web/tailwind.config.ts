/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import type { Config } from 'tailwindcss';

/**
|--------------------------------------------------
| Tailwind configuration with Codexa design tokens
|--------------------------------------------------
*/
const config: Config = {
	content: ['./src/**/*.{ts,tsx}'],
	theme: {
		extend: {
			/**
			|--------------------------------------------------
			| Token-driven color palette
			|--------------------------------------------------
			*/
			colors: {
				bg: {
					DEFAULT: 'var(--bg)',
					2: 'var(--bg-2)',
					3: 'var(--bg-3)',
				},
				fg: {
					DEFAULT: 'var(--fg)',
					muted: 'var(--fg-muted)',
				},
				line: {
					DEFAULT: 'var(--border)',
					faint: 'var(--border-faint)',
					strong: 'var(--border-strong)',
				},
				primary: {
					DEFAULT: 'var(--primary)',
					fg: 'var(--primary-fg)',
				},
				accent: {
					DEFAULT: 'var(--accent)',
					deep: 'var(--accent-deep)',
				},
				link: 'var(--link)',
				progress: 'var(--progress)',
				error: { DEFAULT: 'var(--error)', bg: 'var(--error-bg)', bd: 'var(--error-bd)' },
				warning: { DEFAULT: 'var(--warning)', bg: 'var(--warning-bg)', bd: 'var(--warning-bd)' },
				success: { DEFAULT: 'var(--success)', bg: 'var(--success-bg)' },
				info: { DEFAULT: 'var(--info)', bg: 'var(--info-bg)' },
			},

			/**
			|--------------------------------------------------
			| Font families bound to design tokens
			|--------------------------------------------------
			*/
			fontFamily: {
				sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
				mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
			},

			/**
			|--------------------------------------------------
			| Motion keyframes for loaders and progress
			|--------------------------------------------------
			*/
			keyframes: {
				'cx-spin': { to: { transform: 'rotate(360deg)' } },
				'cx-shimmer': {
					'0%': { transform: 'translateX(-100%)' },
					'100%': { transform: 'translateX(220%)' },
				},
			},
			animation: {
				'cx-spin': 'cx-spin 0.9s linear infinite',
				'cx-shimmer': 'cx-shimmer 1.4s ease infinite',
			},
		},
	},
	plugins: [],
};

export default config;
