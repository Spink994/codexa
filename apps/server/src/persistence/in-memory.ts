/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { Injectable } from '@nestjs/common';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import type { User, Profile, Connection, RunRecord, AccountSettings, ConnectionProvider } from './entities.js';
import type {
	UserRepository,
	ProfileRepository,
	RunRepository,
	RunHistoryQuery,
	RunHistoryPage,
	SettingsRepository,
	ConnectionRepository,
} from './repositories.js';

/**
|--------------------------------------------------
| In-memory user repository
|--------------------------------------------------
*/
@Injectable()
export class InMemoryUserRepository implements UserRepository {
	/**
	|--------------------------------------------------
	| Users keyed by identifier
	|--------------------------------------------------
	*/
	private readonly users = new Map<string, User>();

	/**
	|--------------------------------------------------
	| Persist a new user
	|--------------------------------------------------
	*/
	async create(user: User): Promise<User> {
		this.users.set(user.id, user);
		return user;
	}

	/**
	|--------------------------------------------------
	| Find a user by email
	|--------------------------------------------------
	*/
	async findByEmail(email: string): Promise<User | undefined> {
		return [...this.users.values()].find((user) => user.email === email);
	}

	/**
	|--------------------------------------------------
	| Find a user by identifier
	|--------------------------------------------------
	*/
	async findById(id: string): Promise<User | undefined> {
		return this.users.get(id);
	}
}

/**
|--------------------------------------------------
| In-memory connection repository
|--------------------------------------------------
*/
@Injectable()
export class InMemoryConnectionRepository implements ConnectionRepository {
	/**
	|--------------------------------------------------
	| Connections keyed by identifier
	|--------------------------------------------------
	*/
	private readonly connections = new Map<string, Connection>();

	/**
	|--------------------------------------------------
	| Insert or replace a connection by user and provider
	|--------------------------------------------------
	*/
	async upsert(connection: Connection): Promise<Connection> {
		const existing = await this.find(connection.userId, connection.provider);
		if (existing) this.connections.delete(existing.id);
		this.connections.set(connection.id, connection);
		return connection;
	}

	/**
	|--------------------------------------------------
	| Find a connection by user and provider
	|--------------------------------------------------
	*/
	async find(userId: string, provider: ConnectionProvider): Promise<Connection | undefined> {
		return [...this.connections.values()].find((c) => c.userId === userId && c.provider === provider);
	}

	/**
	|--------------------------------------------------
	| List connections owned by a user
	|--------------------------------------------------
	*/
	async list(userId: string): Promise<Connection[]> {
		return [...this.connections.values()].filter((c) => c.userId === userId);
	}

	async remove(userId: string, provider: ConnectionProvider): Promise<boolean> {
		const connection = await this.find(userId, provider);
		return connection ? this.connections.delete(connection.id) : false;
	}
}

/**
|--------------------------------------------------
| In-memory account settings repository
|--------------------------------------------------
*/
@Injectable()
export class InMemorySettingsRepository implements SettingsRepository {
	private readonly settings = new Map<string, AccountSettings>();

	async upsert(settings: AccountSettings): Promise<AccountSettings> {
		this.settings.set(settings.userId, settings);
		return settings;
	}

	async find(userId: string): Promise<AccountSettings | undefined> {
		return this.settings.get(userId);
	}
}

/**
|--------------------------------------------------
| In-memory profile repository
|--------------------------------------------------
*/
@Injectable()
export class InMemoryProfileRepository implements ProfileRepository {
	/**
	|--------------------------------------------------
	| Profiles keyed by identifier
	|--------------------------------------------------
	*/
	private readonly profiles = new Map<string, Profile>();

	/**
	|--------------------------------------------------
	| Persist a new profile
	|--------------------------------------------------
	*/
	async create(profile: Profile): Promise<Profile> {
		this.profiles.set(profile.id, profile);
		return profile;
	}

	/**
	|--------------------------------------------------
	| List profiles owned by a user
	|--------------------------------------------------
	*/
	async list(userId: string): Promise<Profile[]> {
		return [...this.profiles.values()].filter((profile) => profile.userId === userId);
	}

	/**
	|--------------------------------------------------
	| Find a profile owned by a user
	|--------------------------------------------------
	*/
	async find(userId: string, id: string): Promise<Profile | undefined> {
		const profile = this.profiles.get(id);
		return profile && profile.userId === userId ? profile : undefined;
	}

	/**
	|--------------------------------------------------
	| Remove a profile owned by a user
	|--------------------------------------------------
	*/
	async remove(userId: string, id: string): Promise<boolean> {
		const profile = await this.find(userId, id);
		if (!profile) return false;
		return this.profiles.delete(id);
	}
}

/**
|--------------------------------------------------
| In-memory run repository
|--------------------------------------------------
*/
@Injectable()
export class InMemoryRunRepository implements RunRepository {
	/**
	|--------------------------------------------------
	| Runs keyed by identifier
	|--------------------------------------------------
	*/
	private readonly runs = new Map<string, RunRecord>();

	/**
	|--------------------------------------------------
	| Persist or replace a run record
	|--------------------------------------------------
	*/
	async save(run: RunRecord): Promise<void> {
		this.runs.set(run.id, run);
	}

	/**
	|--------------------------------------------------
	| Find a run by identifier
	|--------------------------------------------------
	*/
	async find(id: string): Promise<RunRecord | undefined> {
		return this.runs.get(id);
	}

	/**
	|--------------------------------------------------
	| List runs owned by a user, newest first
	|--------------------------------------------------
	*/
	async listByUser(userId: string, query: RunHistoryQuery): Promise<RunHistoryPage> {
		return queryRuns([...this.runs.values()], userId, query);
	}
}

const queryRuns = (runs: RunRecord[], userId: string, query: RunHistoryQuery): RunHistoryPage => {
	const search = query.search?.trim().toLowerCase();
	const filtered = runs
		.filter((run) => run.userId === userId)
		.filter((run) => query.from === undefined || run.createdAt >= query.from)
		.filter((run) => query.to === undefined || run.createdAt <= query.to)
		.filter((run) => {
			if (!search) return true;
			return [
				run.id,
				run.source,
				run.status,
				run.error ?? '',
				...run.results.map((result) => result.path),
			].some((value) => value.toLowerCase().includes(search));
		})
		.sort((left, right) => right.createdAt - left.createdAt);
	const start = (query.page - 1) * query.pageSize;
	return { total: filtered.length, items: filtered.slice(start, start + query.pageSize) };
};

export { queryRuns };
