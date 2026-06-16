'use client';

/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { Icon } from '@/components/Icon';
import { Button } from '@/components/Button';
import { Callout } from '@/components/Callout';
import { Select } from '@/components/Select';
import { useUiStore } from '@/store/ui-store';
import { useAuthStore } from '@/store/auth-store';
import {
	connectSource,
	updateSettings,
	listConnections,
	listProviders,
	testProvider,
	disconnectSource,
} from '@/lib/api';
import type {
	ProviderConfig,
	ProviderId,
	SourceConnection,
	ProviderDescriptor,
	ConnectionTestResult,
	CodeFormatPreferences,
} from '@/lib/types';

/**
|--------------------------------------------------
| Connection status shown beside each provider
|--------------------------------------------------
*/
type Status = 'connected' | 'unconfigured' | 'offline';

/**
|--------------------------------------------------
| Static display metadata per provider
|--------------------------------------------------
*/
const META: Record<ProviderId, { label: string; host: string; remote: boolean }> = {
	openai: { label: 'OpenAI', host: 'api.openai.com', remote: true },
	anthropic: { label: 'Anthropic', host: 'api.anthropic.com', remote: true },
	'openai-compatible': { label: 'OpenAI-compatible', host: 'custom endpoint', remote: true },
	ollama: { label: 'Ollama (local)', host: 'localhost:11434', remote: false },
	reference: { label: 'Reference (offline)', host: 'built-in', remote: false },
};

/**
|--------------------------------------------------
| Suggested default models per provider
|--------------------------------------------------
*/
const MODELS: Record<ProviderId, string[]> = {
	openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1'],
	anthropic: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
	'openai-compatible': [],
	ollama: ['llama3.1', 'qwen2.5-coder', 'deepseek-coder'],
	reference: [],
};

/**
|--------------------------------------------------
| Default provider catalogue used before the API responds
|--------------------------------------------------
*/
const FALLBACK_CATALOGUE: ProviderDescriptor[] = [
	{ id: 'openai', remote: true, requiresApiKey: true },
	{ id: 'anthropic', remote: true, requiresApiKey: true },
	{ id: 'openai-compatible', remote: true, requiresApiKey: true },
	{ id: 'ollama', remote: false, requiresApiKey: false },
];

/**
|--------------------------------------------------
| Visual treatment per connection status
|--------------------------------------------------
*/
const STATUS_STYLE: Record<Status, { label: string; dot: string; text: string }> = {
	connected: { label: 'Connected', dot: 'bg-success', text: 'text-success' },
	unconfigured: { label: 'Not configured', dot: 'bg-fg-muted/50', text: 'text-fg-muted' },
	offline: { label: 'Offline', dot: 'bg-error', text: 'text-error' },
};

const STYLE_PROFILES = [
	{ id: 'team-default', label: 'Team default · .codexa/style.json' },
	{ id: 'google', label: 'Google style' },
	{ id: 'airbnb-pep8', label: 'Airbnb / PEP 8' },
	{ id: 'minimal', label: 'Minimal · comments only' },
];

/**
|--------------------------------------------------
| Provider configuration screen
|--------------------------------------------------
*/
export function ProviderSettings() {
	/**
	|--------------------------------------------------
	| Provider catalogue and saved configuration
	|--------------------------------------------------
	*/
	const { data: catalogue } = useQuery({ queryKey: ['providers'], queryFn: listProviders });
	const saved = useUiStore((state) => state.provider);
	const savedStyleProfile = useUiStore((state) => state.styleProfile);
	const savedFormatting = useUiStore((state) => state.formatting);
	const setProvider = useUiStore((state) => state.setProvider);
	const setStyleProfile = useUiStore((state) => state.setStyleProfile);
	const setFormatting = useUiStore((state) => state.setFormatting);
	const pushToast = useUiStore((state) => state.pushToast);
	const user = useAuthStore((state) => state.user);

	/**
	|--------------------------------------------------
	| Draft configuration edited in the form
	|--------------------------------------------------
	*/
	const [draft, setDraft] = useState<ProviderConfig>(saved);
	const [draftStyleProfile, setDraftStyleProfile] = useState(savedStyleProfile);
	const [draftFormatting, setDraftFormatting] = useState<CodeFormatPreferences>(savedFormatting);
	const [editingKey, setEditingKey] = useState(false);
	const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

	useEffect(() => {
		setDraft(saved);
		setDraftStyleProfile(savedStyleProfile);
		setDraftFormatting(savedFormatting);
	}, [saved, savedStyleProfile, savedFormatting]);

	/**
	|--------------------------------------------------
	| Provider catalogue with a safe fallback
	|--------------------------------------------------
	*/
	const providers = catalogue ?? FALLBACK_CATALOGUE;
	const descriptor = providers.find((entry) => entry.id === draft.id) ?? FALLBACK_CATALOGUE[0]!;
	const meta = META[draft.id];

	/**
	|--------------------------------------------------
	| Connection test mutation
	|--------------------------------------------------
	*/
	const test = useMutation({
		mutationFn: () => testProvider(draft),
		onSuccess: (result) => {
			setTestResult(result);
			pushToast(result.message, result.ok ? 'success' : 'error');
		},
		onError: (error: Error) => {
			setTestResult({ ok: false, message: error.message });
			pushToast(error.message, 'error');
		},
	});

	/**
	|--------------------------------------------------
	| Derive a connection status for a provider entry
	|--------------------------------------------------
	*/
	const statusFor = (entry: ProviderDescriptor): Status => {
		/**
		|--------------------------------------------------
		| Treat local providers as offline until reached
		|--------------------------------------------------
		*/
		if (entry.id === 'ollama') return entry.id === saved.id && testResult?.ok ? 'connected' : 'offline';

		/**
		|--------------------------------------------------
		| Remote providers need their key to be configured
		|--------------------------------------------------
		*/
		if (entry.requiresApiKey) {
			const hasKey = entry.id === saved.id && Boolean(saved.apiKey);
			return hasKey ? 'connected' : 'unconfigured';
		}

		/**
		|--------------------------------------------------
		| Everything else is ready to use
		|--------------------------------------------------
		*/
		return 'connected';
	};

	/**
	|--------------------------------------------------
	| Patch a field on the draft configuration
	|--------------------------------------------------
	*/
	const patch = (next: Partial<ProviderConfig>) => setDraft((current) => ({ ...current, ...next }));
	const patchFormatting = (next: Partial<CodeFormatPreferences>) =>
		setDraftFormatting((current) => ({ ...current, ...next }));

	/**
	|--------------------------------------------------
	| Switch the selected provider in the form
	|--------------------------------------------------
	*/
	const select = (id: ProviderId) => {
		/**
		|--------------------------------------------------
		| Load the saved config when reselecting it
		|--------------------------------------------------
		*/
		setDraft(id === saved.id ? saved : { id });
		setEditingKey(false);
		setTestResult(null);
	};

	/**
	|--------------------------------------------------
	| Persist the draft into the UI store
	|--------------------------------------------------
	*/
	const save = async () => {
		setProvider(draft);
		setStyleProfile(draftStyleProfile);
		setFormatting(draftFormatting);
		setEditingKey(false);
		if (user) {
			try {
				await updateSettings(draft, draftStyleProfile, draftFormatting);
				pushToast('Provider and formatting settings synced to your account', 'success');
			} catch (error) {
				pushToast(error instanceof Error ? error.message : 'Settings sync failed', 'error');
			}
		} else {
			pushToast('Provider and formatting settings saved on this device', 'success');
		}
	};

	/**
	|--------------------------------------------------
	| Clear the credentials for the selected provider
	|--------------------------------------------------
	*/
	const remove = async () => {
		const cleared: ProviderConfig = { id: draft.id };
		setDraft(cleared);
		setProvider(cleared);
		setEditingKey(false);
		setTestResult(null);
		if (user) {
			try {
				await updateSettings(cleared, draftStyleProfile, draftFormatting);
			} catch (error) {
				pushToast(error instanceof Error ? error.message : 'Settings sync failed', 'error');
				return;
			}
		}
		pushToast('Provider configuration removed', 'info');
	};

	/**
	|--------------------------------------------------
	| Whether the API key field is in masked mode
	|--------------------------------------------------
	*/
	const keyIsMasked = descriptor.requiresApiKey && Boolean(draft.apiKey) && !editingKey;

	/**
	|--------------------------------------------------
	| Model options including any saved custom value
	|--------------------------------------------------
	*/
	const modelOptions = [...new Set([...(draft.model ? [draft.model] : []), ...MODELS[draft.id]])];

	/**
	|--------------------------------------------------
	| Render the provider list and configuration panel
	|--------------------------------------------------
	*/
	return (
		<div className="space-y-6">
		<div className="grid gap-5 lg:grid-cols-[260px_1fr]">
			{/**
			|--------------------------------------------------
			| Provider list
			|--------------------------------------------------
			*/}
			<div>
				<div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[1.2px] text-fg-muted">Providers</div>
				<div className="flex flex-col gap-2">
					{providers.map((entry) => {
						const active = draft.id === entry.id;
						const status = STATUS_STYLE[statusFor(entry)];
						return (
							<button
								key={entry.id}
								onClick={() => select(entry.id)}
								className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition ${
									active
										? 'border-primary bg-info-bg'
										: 'border-line bg-bg-2 hover:bg-[var(--list-hover)]'
								}`}
							>
								<span className={active ? 'mt-0.5 text-[15px] text-link' : 'mt-0.5 text-[15px] text-fg-muted'}>
									<Icon name={META[entry.id].remote ? 'cloud' : 'archive'} />
								</span>
								<span className="min-w-0 flex-1">
									<span className="block truncate text-[12.5px] font-medium text-fg">{META[entry.id].label}</span>
									<span className="mt-0.5 block truncate font-mono text-[10.5px] text-fg-muted">{META[entry.id].host}</span>
								</span>
								<span className={`mt-0.5 flex shrink-0 items-center gap-1.5 text-[10px] ${status.text}`}>
									<span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
									{status.label}
								</span>
							</button>
						);
					})}
				</div>
			</div>

			{/**
			|--------------------------------------------------
			| Configuration panel
			|--------------------------------------------------
			*/}
			<div className="rounded-lg border border-line bg-bg-2 p-5">
				{/**
				|--------------------------------------------------
				| Provider heading
				|--------------------------------------------------
				*/}
				<div className="mb-1 flex items-center gap-2">
					<h2 className="text-[18px] font-semibold text-fg">{meta.label}</h2>
					{meta.remote && (
						<span className="flex items-center gap-1 rounded-full bg-info-bg px-2 py-0.5 text-[10px] font-medium text-info">
							<Icon name="cloud" />
						</span>
					)}
				</div>
				<div className="mb-5 flex items-center gap-1.5 text-[12px] text-fg-muted">
					<Icon name={meta.remote ? 'cloud' : 'archive'} />
					{meta.remote ? 'Remote API · requests sent over the internet' : 'Runs locally · your source never leaves your machine'}
				</div>

				<div className="mb-5 max-w-md">
					<Field label="Style profile">
						<Select
							value={draftStyleProfile}
							onChange={setDraftStyleProfile}
							options={STYLE_PROFILES.map((profile) => ({ value: profile.id, label: profile.label }))}
						/>
					</Field>
					<p className="mt-1.5 text-[11px] text-fg-muted">
						{user ? 'Synced with your account when you save.' : 'Sign in to use this profile on every device.'}
					</p>
				</div>

				<div className="mb-5 rounded-lg border border-line bg-bg p-4">
					<div className="mb-1 text-[13px] font-semibold text-fg">Code formatting</div>
					<p className="mb-4 text-[11px] text-fg-muted">
						Prettier-compatible preferences the AI follows for indentation, wrapping, and punctuation.
					</p>

					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<Field label="Indentation">
							<Select
								value={draftFormatting.useTabs ? 'tabs' : 'spaces'}
								onChange={(value) => patchFormatting({ useTabs: value === 'tabs' })}
								options={[
									{ value: 'tabs', label: 'Tabs' },
									{ value: 'spaces', label: 'Spaces' },
								]}
							/>
						</Field>
						<Field label="Tab width">
							<input
								type="number"
								min={1}
								max={16}
								value={draftFormatting.tabWidth}
								onChange={(event) => patchFormatting({ tabWidth: Number(event.target.value) })}
								className="cx-control w-full font-mono"
							/>
						</Field>
						<Field label="Print width">
							<input
								type="number"
								min={40}
								max={400}
								value={draftFormatting.printWidth}
								onChange={(event) => patchFormatting({ printWidth: Number(event.target.value) })}
								className="cx-control w-full font-mono"
							/>
						</Field>
						<Field label="Trailing commas">
							<Select
								value={draftFormatting.trailingComma}
								onChange={(value) =>
									patchFormatting({
										trailingComma: value as CodeFormatPreferences['trailingComma'],
									})
								}
								options={[
									{ value: 'all', label: 'All' },
									{ value: 'es5', label: 'ES5' },
									{ value: 'none', label: 'None' },
								]}
							/>
						</Field>
						<Field label="Arrow parentheses">
							<Select
								value={draftFormatting.arrowParens}
								onChange={(value) =>
									patchFormatting({
										arrowParens: value as CodeFormatPreferences['arrowParens'],
									})
								}
								options={[
									{ value: 'always', label: 'Always' },
									{ value: 'avoid', label: 'Avoid when possible' },
								]}
							/>
						</Field>
						<Field label="Line endings">
							<Select
								value={draftFormatting.endOfLine}
								onChange={(value) =>
									patchFormatting({
										endOfLine: value as CodeFormatPreferences['endOfLine'],
									})
								}
								options={[
									{ value: 'lf', label: 'LF' },
									{ value: 'crlf', label: 'CRLF' },
									{ value: 'auto', label: 'Preserve existing' },
								]}
							/>
						</Field>
					</div>

					<div className="mt-4 flex flex-wrap gap-x-5 gap-y-3">
						<FormatToggle
							label="Semicolons"
							checked={draftFormatting.semi}
							onChange={(semi) => patchFormatting({ semi })}
						/>
						<FormatToggle
							label="Single quotes"
							checked={draftFormatting.singleQuote}
							onChange={(singleQuote) => patchFormatting({ singleQuote })}
						/>
						<FormatToggle
							label="Bracket spacing"
							checked={draftFormatting.bracketSpacing}
							onChange={(bracketSpacing) => patchFormatting({ bracketSpacing })}
						/>
					</div>
				</div>

				{/**
				|--------------------------------------------------
				| Credentials and model
				|--------------------------------------------------
				*/}
				<div className="grid gap-4 md:grid-cols-3">
					{descriptor.requiresApiKey && (
						<Field label="API key">
							<div className="flex gap-2">
								<input
									type={keyIsMasked ? 'text' : 'password'}
									value={keyIsMasked ? '••••••••••••••••••••' : draft.apiKey ?? ''}
									readOnly={keyIsMasked}
									placeholder="sk-…"
									onChange={(event) => patch({ apiKey: event.target.value || undefined })}
									className="min-w-0 flex-1 rounded-md border border-line-strong bg-bg px-3 py-2 font-mono text-[12.5px] text-fg outline-none focus:border-primary"
								/>
								{keyIsMasked && (
									<Button variant="secondary" onClick={() => setEditingKey(true)}>
										<Icon name="refresh" />
										Replace
									</Button>
								)}
							</div>
							<p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-fg-muted">
								<span className="text-success">
									<Icon name="shield" />
								</span>
								Stored in the OS secret store, never in settings.json
							</p>
						</Field>
					)}

					<Field label="Default model">
						{modelOptions.length > 0 ? (
							<Select
								value={draft.model ?? ''}
								onChange={(value) => patch({ model: value || undefined })}
								options={[
									{ value: '', label: 'Provider default' },
									...modelOptions.map((model) => ({ value: model, label: model })),
								]}
							/>
						) : (
							<input
								value={draft.model ?? ''}
								placeholder="provider default"
								onChange={(event) => patch({ model: event.target.value || undefined })}
								className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 font-mono text-[12.5px] text-fg outline-none focus:border-primary"
							/>
						)}
					</Field>

					{meta.remote && (
						<Field label="Organization (optional)">
							<input
								value={draft.organization ?? ''}
								placeholder="org-…"
								onChange={(event) => patch({ organization: event.target.value || undefined })}
								className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 font-mono text-[12.5px] text-fg outline-none focus:border-primary"
							/>
						</Field>
					)}
				</div>

				{/**
				|--------------------------------------------------
				| Base URL for compatible or local providers
				|--------------------------------------------------
				*/}
				{(draft.id === 'openai-compatible' || draft.id === 'ollama') && (
					<div className="mt-4">
						<Field label="Base URL">
							<input
								value={draft.baseURL ?? ''}
								placeholder="https://…"
								onChange={(event) => patch({ baseURL: event.target.value || undefined })}
								className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 font-mono text-[12.5px] text-fg outline-none focus:border-primary"
							/>
						</Field>
					</div>
				)}

				{/**
				|--------------------------------------------------
				| Request tuning
				|--------------------------------------------------
				*/}
				<div className="mt-4 grid gap-4 md:grid-cols-2">
					<Field label="Request timeout (s)">
						<input
							type="number"
							min={1}
							value={draft.timeoutSeconds ?? 120}
							onChange={(event) => patch({ timeoutSeconds: Number(event.target.value) || undefined })}
							className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 font-mono text-[12.5px] text-fg outline-none focus:border-primary"
						/>
					</Field>
					<Field label="Max concurrent requests">
						<input
							type="number"
							min={1}
							value={draft.maxConcurrency ?? 4}
							onChange={(event) => patch({ maxConcurrency: Number(event.target.value) || undefined })}
							className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 font-mono text-[12.5px] text-fg outline-none focus:border-primary"
						/>
					</Field>
				</div>

				{/**
				|--------------------------------------------------
				| Connection test
				|--------------------------------------------------
				*/}
				<div className="mt-5 rounded-lg border border-line p-4">
					<Button variant="secondary" onClick={() => test.mutate()} disabled={test.isPending}>
						<Icon name="sync" className={test.isPending ? 'animate-cx-spin' : ''} />
						Test connection
					</Button>
					<div className="mt-3 flex items-center gap-1.5 border-t border-dashed border-line-strong pt-3 text-[11.5px] text-fg-muted">
						<span className="text-success">
							<Icon name="shield" />
						</span>
						Connection testing authenticates only — <strong className="font-semibold text-fg">no repository source code is ever sent.</strong>
					</div>
				</div>

				{/**
				|--------------------------------------------------
				| Troubleshooting on failure
				|--------------------------------------------------
				*/}
				{testResult && !testResult.ok && (
					<div className="mt-4">
						<Callout tone="error" title="Connection failed">
							{testResult.message}
						</Callout>
					</div>
				)}

				{/**
				|--------------------------------------------------
				| Actions
				|--------------------------------------------------
				*/}
				<div className="mt-5 flex items-center justify-between">
					<Button variant="primary" onClick={() => void save()}>
						<Icon name="save" />
						Save configuration
					</Button>
					<Button variant="danger" onClick={() => void remove()}>
						<Icon name="trash" />
						Remove provider
					</Button>
				</div>
			</div>
		</div>
			<GitConnections user={user} />
		</div>
	);
}

function GitConnections({ user }: { user: { id: string; email: string } | null }) {
	const queryClient = useQueryClient();
	const pushToast = useUiStore((state) => state.pushToast);
	const [tokens, setTokens] = useState<Record<SourceConnection['provider'], string>>({ github: '', gitlab: '' });
	const { data: connections = [], isLoading } = useQuery({
		queryKey: ['connections', user?.id],
		queryFn: listConnections,
		enabled: Boolean(user),
	});
	const connect = useMutation({
		mutationFn: ({ provider, token }: { provider: SourceConnection['provider']; token: string }) =>
			connectSource(provider, token),
		onSuccess: (_, variables) => {
			setTokens((current) => ({ ...current, [variables.provider]: '' }));
			void queryClient.invalidateQueries({ queryKey: ['connections', user?.id] });
			pushToast(`${providerLabel(variables.provider)} connected`, 'success');
		},
		onError: (error: Error) => pushToast(error.message, 'error'),
	});
	const disconnect = useMutation({
		mutationFn: disconnectSource,
		onSuccess: (_, provider) => {
			void queryClient.invalidateQueries({ queryKey: ['connections', user?.id] });
			pushToast(`${providerLabel(provider)} disconnected`, 'info');
		},
		onError: (error: Error) => pushToast(error.message, 'error'),
	});

	return (
		<section className="rounded-lg border border-line bg-bg-2 p-5">
			<div className="mb-4 flex items-start gap-3">
				<div className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-bg text-[17px] text-fg-muted">
					<Icon name="git" />
				</div>
				<div>
					<h2 className="text-[15px] font-semibold text-fg">Git connections</h2>
					<p className="mt-0.5 text-[11.5px] text-fg-muted">
						Connect GitHub or GitLab once to scan private repositories without pasting a token each time.
					</p>
				</div>
			</div>

			{!user ? (
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-info/30 bg-info-bg p-4">
					<div>
						<div className="text-[12.5px] font-medium text-fg">Git connections are a sign-in perk</div>
						<div className="mt-1 text-[11px] text-fg-muted">Your connection is scoped to your account and available across devices.</div>
					</div>
					<Link href="/login">
						<Button variant="primary">
							<Icon name="login" />
							Sign in to connect
						</Button>
					</Link>
				</div>
			) : (
				<div className="grid gap-3 md:grid-cols-2">
					{(['github', 'gitlab'] as const).map((provider) => {
						const connection = connections.find((entry) => entry.provider === provider);
						const pending = connect.isPending || disconnect.isPending;
						return (
							<div key={provider} className="rounded-lg border border-line bg-bg p-4">
								<div className="mb-3 flex items-center">
									<div>
										<div className="text-[12.5px] font-semibold text-fg">{providerLabel(provider)}</div>
										<div className="mt-0.5 text-[10.5px] text-fg-muted">
											{isLoading ? 'Checking connection…' : connection ? 'Connected to your account' : 'Personal access token'}
										</div>
									</div>
									<span className={`ml-auto h-2 w-2 rounded-full ${connection ? 'bg-success' : 'bg-fg-muted/40'}`} />
								</div>
								{connection ? (
									<div className="flex items-center justify-between gap-3">
										<span className="text-[11px] text-success">Ready for private repository scans</span>
										<Button variant="danger" disabled={pending} onClick={() => disconnect.mutate(provider)}>
											<Icon name="logout" />
											Disconnect
										</Button>
									</div>
								) : (
									<div className="flex gap-2">
										<input
											type="password"
											value={tokens[provider]}
											onChange={(event) =>
												setTokens((current) => ({ ...current, [provider]: event.target.value }))
											}
											placeholder={provider === 'github' ? 'github_pat_…' : 'glpat-…'}
											className="min-w-0 flex-1 rounded-md border border-line-strong bg-bg-3 px-3 py-2 font-mono text-[12px] text-fg outline-none focus:border-primary"
										/>
										<Button
											variant="secondary"
											disabled={pending || !tokens[provider].trim()}
											onClick={() => connect.mutate({ provider, token: tokens[provider].trim() })}
										>
											<Icon name="plug" />
											Connect
										</Button>
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}
		</section>
	);
}

function providerLabel(provider: SourceConnection['provider']) {
	return provider === 'github' ? 'GitHub' : 'GitLab';
}

/**
|--------------------------------------------------
| Labeled form field wrapper
|--------------------------------------------------
*/
function Field({ label, children }: { label: string; children: React.ReactNode }) {
	/**
	|--------------------------------------------------
	| Render the label above its control
	|--------------------------------------------------
	*/
	return (
		<label className="block">
			<span className="mb-1.5 block text-[12px] font-medium text-fg">{label}</span>
			{children}
		</label>
	);
}

function FormatToggle({
	label,
	checked,
	onChange,
}: {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}) {
	return (
		<label className="flex cursor-pointer items-center gap-2 text-[12px] text-fg">
			<input
				type="checkbox"
				checked={checked}
				onChange={(event) => onChange(event.target.checked)}
				className="h-4 w-4 accent-[var(--primary)]"
			/>
			{label}
		</label>
	);
}
