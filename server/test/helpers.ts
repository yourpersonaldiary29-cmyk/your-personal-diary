/**
 * Shared test helpers. Route/module tests should not spawn a real HTTP server;
 * they build the Express app with `makeTestApp()` and call it through supertest.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import supertest from 'supertest';
import type { ServerSettings } from '@shared/types';
import { createApp, type AppDeps } from '../src/app';
import { loadConfig, type ServerConfig } from '../src/config';
import { DiaryDb } from '../src/db/database';
import type { HostedAppOptions, RegistrationGate } from '../src/hosted/types';
import type { AccountRecord, AuthContext, AuthService, Session, UserVault } from '../src/security/session-types';
import { toUserProfile } from '../src/security/session-types';

/** Fresh temporary data directory (deleted by `cleanupTempDirs`). */
const tempDirs: string[] = [];
export function tempDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpd-test-'));
  tempDirs.push(dir);
  return dir;
}
export function cleanupTempDirs(): void {
  for (const d of tempDirs.splice(0)) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

export function testConfig(dataDir = tempDataDir()): ServerConfig {
  return loadConfig(['--data-dir', dataDir, '--port', '0'], {});
}

export const TEST_ACCOUNT: AccountRecord = {
  id: 'u_test',
  username: 'tester',
  usernameLower: 'tester',
  firstName: 'דנה',
  lastName: 'כהן',
  createdAt: '2026-01-01T00:00:00.000Z',
  kdf: { algorithm: 'scrypt', N: 1 << 15, r: 8, p: 1, saltHex: '00'.repeat(16) },
  verifierHex: '00'.repeat(32),
  dbFile: 'u_test.mpd',
};

/** A vault that keeps everything in memory (no encryption, no disk). */
export function fakeVault(db: DiaryDb, userId = TEST_ACCOUNT.id): UserVault {
  let current = db;
  const vault: UserVault = {
    userId,
    dbPath: path.join(os.tmpdir(), `${userId}.mpd`),
    get db() {
      return current;
    },
    refCount: 1,
    persist: async () => {},
    rekey: async () => {},
    getKey: () => Buffer.alloc(32, 7),
    replaceDatabase: async (newDb: DiaryDb) => {
      current = newDb;
    },
    close: async () => {},
  } as UserVault;
  return vault;
}

export function fakeSession(userId = TEST_ACCOUNT.id): Session {
  return {
    id: 's_test',
    tokenHash: 'hash',
    userId,
    deviceName: 'בדיקה',
    createdAt: '2026-01-01T00:00:00.000Z',
    lastSeenAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2099-01-01T00:00:00.000Z',
    rememberMe: false,
    notified: new Set(),
  };
}

/** Auth service that accepts the token "test-token" and maps it to `db`. */
export function fakeAuth(db: DiaryDb, account: AccountRecord = TEST_ACCOUNT): AuthService {
  const vault = fakeVault(db, account.id);
  const session = fakeSession(account.id);
  const ctx: AuthContext = { session, account, user: toUserProfile(account), vault, db };
  return {
    register: async () => {
      throw new Error('not supported in fakeAuth');
    },
    login: async () => {
      throw new Error('not supported in fakeAuth');
    },
    updateProfile: async (_ctx, patch) => {
      Object.assign(account, patch);
      return account;
    },
    authenticate: async (token: string) => (token === 'test-token' ? { ...ctx, db: vault.db } : null),
    logout: async () => {},
    verifyPassword: async (_a, password) => password === 'Passw0rd!',
    setSessionLocked: () => true,
    changePassword: async () => {},
    listSessions: () => [session],
    listAccounts: () => [{ ...account, kdf: { ...account.kdf } }],
    revokeSession: async () => true,
    deleteAccount: async () => {},
    shutdown: async () => {},
  };
}

type Body = object | string;

/** Unauthenticated request factory; every request asks for Hebrew unless the test overrides the header. */
export interface AnonAgent {
  get(url: string): supertest.Test;
  post(url: string): supertest.Test;
  put(url: string): supertest.Test;
  patch(url: string): supertest.Test;
  delete(url: string): supertest.Test;
  options(url: string): supertest.Test;
}

export interface TestApp {
  app: ReturnType<typeof createApp>;
  db: DiaryDb;
  config: ServerConfig;
  /** Convenience: authenticated request helpers (Authorization header pre-set). */
  get: (url: string) => supertest.Test;
  post: (url: string, body?: Body) => supertest.Test;
  put: (url: string, body?: Body) => supertest.Test;
  patch: (url: string, body?: Body) => supertest.Test;
  del: (url: string) => supertest.Test;
  /** Unauthenticated request (for auth/public endpoints). */
  anon: () => AnonAgent;
  settings: ServerSettings;
}

/**
 * Hosted-mode app options for `makeTestApp({ hosted })` (docs/HOSTED-PLAN.md Part B): the public
 * host `diary.example`, one proxy hop, `X-Forwarded-For` as the client address, open registration
 * with the production limits, no owner unless the test sets one. Every field can be overridden.
 */
export function testHostedOptions(overrides: Partial<HostedAppOptions> = {}): HostedAppOptions {
  const registration: RegistrationGate = {
    mode: 'open',
    maxAccounts: 300,
    check: () => {},
    registered: () => {},
    recentCount: () => 0,
  };
  return {
    publicHost: 'diary.example',
    publicUrl: 'https://diary.example',
    trustProxy: 1,
    clientIpHeader: 'x-forwarded-for',
    loginPerMinute: 10,
    authGlobalPerMinute: 300,
    registration,
    ownerId: () => '',
    maxDiaryBytes: 0,
    ...overrides,
  };
}

/** Builds an app around a fresh in-memory DB and a fake auth service. */
export async function makeTestApp(
  opts: { auth?: AuthService; db?: DiaryDb; config?: ServerConfig; guestAllowed?: boolean; hosted?: HostedAppOptions } = {},
): Promise<TestApp> {
  const db = opts.db ?? (await DiaryDb.create());
  const config = opts.config ?? testConfig();
  const settings: ServerSettings = { port: 0, lanEnabled: false };
  const deps: AppDeps = {
    config,
    auth: opts.auth ?? fakeAuth(db),
    getServerSettings: () => settings,
    setServerSettings: async (next) => {
      settings.port = next.port;
      settings.lanEnabled = next.lanEnabled;
      return settings;
    },
    getListenInfo: () => ({ port: 0, lanUrls: [], startedAt: new Date().toISOString() }),
    // Only the mobile core sets this (POST /api/auth/guest); left out unless a test asks for it.
    ...(opts.guestAllowed === undefined ? {} : { guestAllowed: opts.guestAllowed }),
    // Only the hosted composition sets this; left out unless a test asks for it.
    ...(opts.hosted === undefined ? {} : { hosted: opts.hosted }),
  };
  const app = createApp(deps);
  // The suite was written for the Hebrew UI: helper requests ask for Hebrew unless a test overrides the header.
  const authz = (t: supertest.Test) => t.set('Authorization', 'Bearer test-token').set('Accept-Language', 'he');
  const withBody = (t: supertest.Test, body?: Body) => (body === undefined ? t : t.send(body));
  return {
    app,
    db,
    config,
    settings,
    get: (url) => authz(supertest(app).get(url)),
    post: (url, body) => withBody(authz(supertest(app).post(url)), body),
    put: (url, body) => withBody(authz(supertest(app).put(url)), body),
    patch: (url, body) => withBody(authz(supertest(app).patch(url)), body),
    del: (url) => authz(supertest(app).delete(url)),
    anon: () => {
      const st = supertest(app);
      const he = (t: supertest.Test) => t.set('Accept-Language', 'he');
      return {
        get: (url: string) => he(st.get(url)),
        post: (url: string) => he(st.post(url)),
        put: (url: string) => he(st.put(url)),
        patch: (url: string) => he(st.patch(url)),
        delete: (url: string) => he(st.delete(url)),
        options: (url: string) => he(st.options(url)),
      };
    },
  };
}

/** Minimal valid entry payload for tests. */
export function sampleEntry(overrides: Record<string, unknown> = {}) {
  return {
    date: '2026-09-07',
    time: '21:30',
    title: 'יום רגיל',
    body: 'הרגשתי טוב היום, הלכתי ברגל ופגשתי את דנה.',
    mood: 7,
    emotions: ['calm', 'satisfied'],
    energy: 6,
    stress: 3,
    sleepQuality: 7,
    sleepHours: 7.5,
    exerciseMinutes: 30,
    exerciseType: 'הליכה',
    events: ['פגישה בעבודה'],
    people: ['דנה'],
    location: 'בית',
    notes: '',
    tags: ['עבודה'],
    ...overrides,
  };
}
