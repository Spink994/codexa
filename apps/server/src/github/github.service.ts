/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { Logger, Injectable, BadRequestException, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { readGithubConfig, isGithubConfigured, type GithubConfig } from './github.config.js';

/**
|--------------------------------------------------
| GitHub API base URLs
|--------------------------------------------------
*/
const API_BASE = 'https://api.github.com';
const OAUTH_AUTHORIZE = 'https://github.com/login/oauth/authorize';
const OAUTH_TOKEN = 'https://github.com/login/oauth/access_token';

/**
|--------------------------------------------------
| Authenticated GitHub account profile
|--------------------------------------------------
*/
export interface GithubProfile {
	id: string;
	login: string;
	name?: string;
	email?: string;
	avatarUrl?: string;
}

/**
|--------------------------------------------------
| Summary of a repository the user can access
|--------------------------------------------------
*/
export interface GithubRepoSummary {
	owner: string;
	name: string;
	fullName: string;
	cloneUrl: string;
	defaultBranch: string;
	private: boolean;
	canPush: boolean;
	updatedAt: string;
}

/**
|--------------------------------------------------
| Target describing where to open a pull request
|--------------------------------------------------
*/
export interface PullRequestTarget {
	owner: string;
	repo: string;
	baseBranch: string;
	branch: string;
	title: string;
	body: string;
}

/**
|--------------------------------------------------
| Result of opening a pull request
|--------------------------------------------------
*/
export interface PullRequestOutcome {
	url: string;
	number: number;
	viaFork: boolean;
	headRepo: string;
}

/**
|--------------------------------------------------
| A single file change committed in a pull request
|--------------------------------------------------
*/
export interface CommitFile {
	path: string;
	content: string;
}

/**
|--------------------------------------------------
| Wraps GitHub OAuth and REST for Codexa
|--------------------------------------------------
*/
@Injectable()
export class GithubService {
	/**
	|--------------------------------------------------
	| Diagnostic logger for OAuth and API issues
	|--------------------------------------------------
	*/
	private readonly logger = new Logger(GithubService.name);

	/**
	|--------------------------------------------------
	| Resolved configuration for the process lifetime
	|--------------------------------------------------
	*/
	private readonly config: GithubConfig = readGithubConfig();

	/**
	|--------------------------------------------------
	| Whether OAuth credentials are configured
	|--------------------------------------------------
	*/
	isConfigured(): boolean {
		return isGithubConfigured(this.config);
	}

	/**
	|--------------------------------------------------
	| Expose the configured web origin for redirects
	|--------------------------------------------------
	*/
	webOrigin(): string {
		return this.config.webOrigin;
	}

	/**
	|--------------------------------------------------
	| Build the GitHub authorize URL for a login state
	|--------------------------------------------------
	*/
	buildAuthorizeUrl(state: string): string {
		/**
		|--------------------------------------------------
		| Reject when OAuth credentials are not configured
		|--------------------------------------------------
		*/
		if (!this.isConfigured()) {
			throw new ServiceUnavailableException('GitHub login is not configured on this server.');
		}

		/**
		|--------------------------------------------------
		| Assemble the authorize query parameters
		|--------------------------------------------------
		*/
		const params = new URLSearchParams({
			state,
			scope: this.config.scopes,
			client_id: this.config.clientId,
			redirect_uri: this.config.callbackUrl,
			allow_signup: 'true',
		});
		return `${OAUTH_AUTHORIZE}?${params.toString()}`;
	}

	/**
	|--------------------------------------------------
	| Exchange an OAuth code for an access token
	|--------------------------------------------------
	*/
	async exchangeCode(code: string): Promise<string> {
		/**
		|--------------------------------------------------
		| Post the code to the token endpoint
		|--------------------------------------------------
		*/
		const response = await fetch(OAUTH_TOKEN, {
			method: 'POST',
			headers: { accept: 'application/json', 'content-type': 'application/json' },
			body: JSON.stringify({
				code,
				client_id: this.config.clientId,
				client_secret: this.config.clientSecret,
				redirect_uri: this.config.callbackUrl,
			}),
		});

		/**
		|--------------------------------------------------
		| Reject when the exchange request fails
		|--------------------------------------------------
		*/
		if (!response.ok) throw new UnauthorizedException('GitHub rejected the authorization code.');

		/**
		|--------------------------------------------------
		| Read the access token from the response body
		|--------------------------------------------------
		*/
		const body = (await response.json()) as { access_token?: string; scope?: string; error_description?: string };
		if (!body.access_token) throw new UnauthorizedException(body.error_description || 'GitHub did not return a token.');

		/**
		|--------------------------------------------------
		| Warn when the grant cannot reach private repos
		|--------------------------------------------------
		*/
		const scopes = body.scope ?? '';
		if (!scopes.split(/[\s,]+/).includes('repo')) {
			this.logger.warn(`GitHub granted scopes "${scopes}" — without "repo", private repositories will not be listed.`);
		}
		return body.access_token;
	}

	/**
	|--------------------------------------------------
	| Resolve the authenticated account profile
	|--------------------------------------------------
	*/
	async getProfile(token: string): Promise<GithubProfile> {
		/**
		|--------------------------------------------------
		| Read the core account record
		|--------------------------------------------------
		*/
		const user = await this.request<{
			id: number;
			login: string;
			name?: string;
			email?: string;
			avatar_url?: string;
		}>(token, 'GET', '/user');

		/**
		|--------------------------------------------------
		| Fall back to the verified primary email
		|--------------------------------------------------
		*/
		const email = user.email ?? (await this.getPrimaryEmail(token));
		return {
			id: String(user.id),
			login: user.login,
			name: user.name,
			email,
			avatarUrl: user.avatar_url,
		};
	}

	/**
	|--------------------------------------------------
	| Resolve the verified primary email if exposed
	|--------------------------------------------------
	*/
	async getPrimaryEmail(token: string): Promise<string | undefined> {
		/**
		|--------------------------------------------------
		| Read the account emails, tolerating denial
		|--------------------------------------------------
		*/
		try {
			const emails = await this.request<{ email: string; primary: boolean; verified: boolean }[]>(
				token,
				'GET',
				'/user/emails',
			);
			return emails.find((entry) => entry.primary && entry.verified)?.email ?? emails[0]?.email;
		} catch {
			return undefined;
		}
	}

	/**
	|--------------------------------------------------
	| List repositories the user can push to
	|--------------------------------------------------
	*/
	async listRepos(token: string): Promise<GithubRepoSummary[]> {
		/**
		|--------------------------------------------------
		| Page through the user's repositories
		|--------------------------------------------------
		*/
		const perPage = 100;
		const collected: GithubRepoSummary[] = [];

		/**
		|--------------------------------------------------
		| Page until a short page, capped for safety
		|--------------------------------------------------
		*/
		for (let page = 1; page <= 50; page += 1) {
			const repos = await this.request<RawRepo[]>(
				token,
				'GET',
				`/user/repos?per_page=${perPage}&page=${page}&sort=updated&visibility=all&affiliation=owner,collaborator,organization_member`,
			);
			collected.push(...repos.map((repo) => this.toSummary(repo)));
			if (repos.length < perPage) break;
		}
		return collected;
	}

	/**
	|--------------------------------------------------
	| Open a pull request, forking first when needed
	|--------------------------------------------------
	| Commits the changes to a branch on the repository
	| when the user can push, otherwise on a fork, then
	| opens the pull request against the base repository.
	|--------------------------------------------------
	*/
	async openPullRequest(token: string, target: PullRequestTarget, files: CommitFile[]): Promise<PullRequestOutcome> {
		/**
		|--------------------------------------------------
		| Reject when there is nothing to commit
		|--------------------------------------------------
		*/
		if (files.length === 0) throw new BadRequestException('No changed files to open a pull request for.');

		/**
		|--------------------------------------------------
		| Resolve where the branch can be pushed
		|--------------------------------------------------
		*/
		const base = await this.request<{ permissions?: { push?: boolean } }>(token, 'GET', `/repos/${target.owner}/${target.repo}`);
		const head = base.permissions?.push === true ? { owner: target.owner, repo: target.repo } : await this.forkRepo(token, target.owner, target.repo);
		const viaFork = head.owner !== target.owner || head.repo !== target.repo;

		/**
		|--------------------------------------------------
		| Commit the files to a new branch on the head repo
		|--------------------------------------------------
		*/
		await this.commitFiles(token, head.owner, head.repo, target.baseBranch, target.branch, target.title, files);

		/**
		|--------------------------------------------------
		| Open the pull request against the base repository
		|--------------------------------------------------
		*/
		const headRef = viaFork ? `${head.owner}:${target.branch}` : target.branch;
		const pull = await this.request<{ html_url: string; number: number }>(token, 'POST', `/repos/${target.owner}/${target.repo}/pulls`, {
			title: target.title,
			body: target.body,
			head: headRef,
			base: target.baseBranch,
			maintainer_can_modify: true,
		});
		return { url: pull.html_url, number: pull.number, viaFork, headRepo: `${head.owner}/${head.repo}` };
	}

	/**
	|--------------------------------------------------
	| Commit changed files onto a new branch
	|--------------------------------------------------
	*/
	private async commitFiles(
		token: string,
		owner: string,
		repo: string,
		baseBranch: string,
		branch: string,
		message: string,
		files: CommitFile[],
	): Promise<string> {
		/**
		|--------------------------------------------------
		| Resolve the base branch tip and its tree
		|--------------------------------------------------
		*/
		const baseRef = await this.request<{ object: { sha: string } }>(token, 'GET', `/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`);
		const baseCommitSha = baseRef.object.sha;
		const baseCommit = await this.request<{ tree: { sha: string } }>(token, 'GET', `/repos/${owner}/${repo}/git/commits/${baseCommitSha}`);

		/**
		|--------------------------------------------------
		| Create a blob for each changed file
		|--------------------------------------------------
		*/
		const tree = await Promise.all(
			files.map(async (file) => {
				const blob = await this.request<{ sha: string }>(token, 'POST', `/repos/${owner}/${repo}/git/blobs`, {
					content: file.content,
					encoding: 'utf-8',
				});
				return { path: file.path, mode: '100644', type: 'blob', sha: blob.sha };
			}),
		);

		/**
		|--------------------------------------------------
		| Build a tree, commit it, and point a new branch
		|--------------------------------------------------
		*/
		const newTree = await this.request<{ sha: string }>(token, 'POST', `/repos/${owner}/${repo}/git/trees`, {
			base_tree: baseCommit.tree.sha,
			tree,
		});
		const commit = await this.request<{ sha: string }>(token, 'POST', `/repos/${owner}/${repo}/git/commits`, {
			message,
			tree: newTree.sha,
			parents: [baseCommitSha],
		});
		await this.request(token, 'POST', `/repos/${owner}/${repo}/git/refs`, {
			ref: `refs/heads/${branch}`,
			sha: commit.sha,
		});
		return commit.sha;
	}

	/**
	|--------------------------------------------------
	| Fork a repository and wait until it is usable
	|--------------------------------------------------
	*/
	private async forkRepo(token: string, owner: string, repo: string): Promise<{ owner: string; repo: string }> {
		/**
		|--------------------------------------------------
		| Request the fork under the authenticated account
		|--------------------------------------------------
		*/
		const fork = await this.request<{ name: string; owner: { login: string } }>(token, 'POST', `/repos/${owner}/${repo}/forks`, {});
		const head = { owner: fork.owner.login, repo: fork.name };

		/**
		|--------------------------------------------------
		| Poll until the fork has populated its branches
		|--------------------------------------------------
		*/
		for (let attempt = 0; attempt < 12; attempt += 1) {
			try {
				const branches = await this.request<unknown[]>(token, 'GET', `/repos/${head.owner}/${head.repo}/branches?per_page=1`);
				if (Array.isArray(branches) && branches.length > 0) return head;
			} catch {
				/* fork not ready yet — keep waiting */
			}
			await new Promise((resolve) => setTimeout(resolve, 1500));
		}

		/**
		|--------------------------------------------------
		| Give up once the fork stays empty for too long
		|--------------------------------------------------
		*/
		throw new ServiceUnavailableException('Timed out waiting for the fork to become available.');
	}

	/**
	|--------------------------------------------------
	| Map a raw repository payload to a summary
	|--------------------------------------------------
	*/
	private toSummary(repo: RawRepo): GithubRepoSummary {
		/**
		|--------------------------------------------------
		| Keep only the fields the client needs
		|--------------------------------------------------
		*/
		return {
			owner: repo.owner.login,
			name: repo.name,
			fullName: repo.full_name,
			cloneUrl: repo.clone_url,
			defaultBranch: repo.default_branch,
			private: repo.private,
			canPush: repo.permissions?.push === true,
			updatedAt: repo.updated_at,
		};
	}

	/**
	|--------------------------------------------------
	| Perform an authenticated GitHub API request
	|--------------------------------------------------
	*/
	private async request<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
		/**
		|--------------------------------------------------
		| Send the request with the standard API headers
		|--------------------------------------------------
		*/
		const response = await fetch(`${API_BASE}${path}`, {
			method,
			headers: {
				accept: 'application/vnd.github+json',
				authorization: `Bearer ${token}`,
				'x-github-api-version': '2022-11-28',
				'user-agent': 'codexa',
				...(body ? { 'content-type': 'application/json' } : {}),
			},
			body: body ? JSON.stringify(body) : undefined,
		});

		/**
		|--------------------------------------------------
		| Surface a readable error on failure
		|--------------------------------------------------
		*/
		if (!response.ok) {
			const detail = await response.json().catch(() => ({}) as { message?: string });
			const message = (detail as { message?: string }).message || `GitHub request failed with ${response.status}.`;
			if (response.status === 401) throw new UnauthorizedException(message);
			throw new BadRequestException(message);
		}

		/**
		|--------------------------------------------------
		| Return the parsed body, tolerating empty content
		|--------------------------------------------------
		*/
		const text = await response.text();
		return (text ? JSON.parse(text) : {}) as T;
	}
}

/**
|--------------------------------------------------
| Raw repository payload from the GitHub API
|--------------------------------------------------
*/
interface RawRepo {
	name: string;
	full_name: string;
	clone_url: string;
	default_branch: string;
	private: boolean;
	updated_at: string;
	owner: { login: string };
	permissions?: { push?: boolean };
}
