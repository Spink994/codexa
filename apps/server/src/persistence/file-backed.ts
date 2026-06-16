/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { FileCollection, dataDir } from './file-collection.js';
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
import { queryRuns } from './in-memory.js';

/**
|--------------------------------------------------
| Resolve a data file inside the data directory
|--------------------------------------------------
*/
const file = (name: string): string => join(dataDir(), name);

/**
|--------------------------------------------------
| File-backed user repository
|--------------------------------------------------
*/
@Injectable()
export class FileUserRepository implements UserRepository {
	/**
	|--------------------------------------------------
	| Durable user collection
	|--------------------------------------------------
	*/
	private readonly users = new FileCollection<User>(file('users.json'), (user) => user.id);

	/**
	|--------------------------------------------------
	| Persist a new user
	|--------------------------------------------------
	*/
	async create(user: User): Promise<User> {
		this.users.set(user);
		return user;
	}

	/**
	|--------------------------------------------------
	| Find a user by email
	|--------------------------------------------------
	*/
	async findByEmail(email: string): Promise<User | undefined> {
		return this.users.values().find((user) => user.email === email);
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
| File-backed connection repository
|--------------------------------------------------
*/
@Injectable()
export class FileConnectionRepository implements ConnectionRepository {
	/**
	|--------------------------------------------------
	| Durable connection collection
	|--------------------------------------------------
	*/
	private readonly connections = new FileCollection<Connection>(file('connections.json'), (c) => c.id);

	/**
	|--------------------------------------------------
	| Insert or replace a connection by user and provider
	|--------------------------------------------------
	*/
	async upsert(connection: Connection): Promise<Connection> {
		const existing = await this.find(connection.userId, connection.provider);
		if (existing) this.connections.delete(existing.id);
		this.connections.set(connection);
		return connection;
	}

	/**
	|--------------------------------------------------
	| Find a connection by user and provider
	|--------------------------------------------------
	*/
	async find(userId: string, provider: ConnectionProvider): Promise<Connection | undefined> {
		return this.connections.values().find((c) => c.userId === userId && c.provider === provider);
	}

	/**
	|--------------------------------------------------
	| List connections owned by a user
	|--------------------------------------------------
	*/
	async list(userId: string): Promise<Connection[]> {
		return this.connections.values().filter((c) => c.userId === userId);
	}

	async remove(userId: string, provider: ConnectionProvider): Promise<boolean> {
		const connection = await this.find(userId, provider);
		return connection ? this.connections.delete(connection.id) : false;
	}
}

/**
|--------------------------------------------------
| File-backed account settings repository
|--------------------------------------------------
*/
@Injectable()
export class FileSettingsRepository implements SettingsRepository {
	private readonly settings = new FileCollection<AccountSettings>(file('settings.json'), (entry) => entry.userId);

	async upsert(settings: AccountSettings): Promise<AccountSettings> {
		this.settings.set(settings);
		return settings;
	}

	async find(userId: string): Promise<AccountSettings | undefined> {
		return this.settings.get(userId);
	}
}

/**
|--------------------------------------------------
| File-backed profile repository
|--------------------------------------------------
*/
@Injectable()
export class FileProfileRepository implements ProfileRepository {
	/**
	|--------------------------------------------------
	| Durable profile collection
	|--------------------------------------------------
	*/
	private readonly profiles = new FileCollection<Profile>(file('profiles.json'), (profile) => profile.id);

	/**
	|--------------------------------------------------
	| Persist a new profile
	|--------------------------------------------------
	*/
	async create(profile: Profile): Promise<Profile> {
		this.profiles.set(profile);
		return profile;
	}

	/**
	|--------------------------------------------------
	| List profiles owned by a user
	|--------------------------------------------------
	*/
	async list(userId: string): Promise<Profile[]> {
		return this.profiles.values().filter((profile) => profile.userId === userId);
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
| File-backed run repository
|--------------------------------------------------
*/
@Injectable()
export class FileRunRepository implements RunRepository {
	/**
	|--------------------------------------------------
	| Durable run collection
	|--------------------------------------------------
	*/
	private readonly runs = new FileCollection<RunRecord>(file('runs.json'), (run) => run.id);

	/**
	|--------------------------------------------------
	| Persist or replace a run record
	|--------------------------------------------------
	*/
	async save(run: RunRecord): Promise<void> {
		this.runs.set(run);
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
		return queryRuns(this.runs.values(), userId, query);
	}
}
