/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import type { User, Profile, Connection, RunRecord, AccountSettings, ConnectionProvider } from './entities.js';

export interface RunHistoryQuery {
	page: number;
	pageSize: number;
	search?: string;
	from?: number;
	to?: number;
}

export interface RunHistoryPage {
	items: RunRecord[];
	total: number;
}

/**
|--------------------------------------------------
| User repository contract
|--------------------------------------------------
*/
export interface UserRepository {
	create(user: User): Promise<User>;
	update(user: User): Promise<User>;
	findByEmail(email: string): Promise<User | undefined>;
	findById(id: string): Promise<User | undefined>;
	findByOauth(provider: NonNullable<User['oauthProvider']>, oauthId: string): Promise<User | undefined>;
}

/**
|--------------------------------------------------
| Connection repository contract
|--------------------------------------------------
*/
export interface ConnectionRepository {
	upsert(connection: Connection): Promise<Connection>;
	find(userId: string, provider: ConnectionProvider): Promise<Connection | undefined>;
	list(userId: string): Promise<Connection[]>;
	remove(userId: string, provider: ConnectionProvider): Promise<boolean>;
}

/**
|--------------------------------------------------
| Account settings repository contract
|--------------------------------------------------
*/
export interface SettingsRepository {
	upsert(settings: AccountSettings): Promise<AccountSettings>;
	find(userId: string): Promise<AccountSettings | undefined>;
}

/**
|--------------------------------------------------
| Profile repository contract
|--------------------------------------------------
*/
export interface ProfileRepository {
	create(profile: Profile): Promise<Profile>;
	list(userId: string): Promise<Profile[]>;
	find(userId: string, id: string): Promise<Profile | undefined>;
	remove(userId: string, id: string): Promise<boolean>;
}

/**
|--------------------------------------------------
| Run repository contract
|--------------------------------------------------
*/
export interface RunRepository {
	save(run: RunRecord): Promise<void>;
	find(id: string): Promise<RunRecord | undefined>;
	listByUser(userId: string, query: RunHistoryQuery): Promise<RunHistoryPage>;
}

/**
|--------------------------------------------------
| Injection tokens for repository implementations
|--------------------------------------------------
*/
export const USER_REPOSITORY = 'USER_REPOSITORY';
export const CONNECTION_REPOSITORY = 'CONNECTION_REPOSITORY';
export const SETTINGS_REPOSITORY = 'SETTINGS_REPOSITORY';
export const PROFILE_REPOSITORY = 'PROFILE_REPOSITORY';
export const RUN_REPOSITORY = 'RUN_REPOSITORY';
