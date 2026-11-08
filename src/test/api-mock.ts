/**
 * Mock for the `@/api` module. Keeps the real client helpers (token storage,
 * ApiClientError, isTauri...) and replaces every endpoint group with vi.fn()s.
 *
 * Usage in a test file (the factory is hoisted by vitest):
 *
 *   vi.mock('@/api', async (importOriginal) => {
 *     const { createApiMock } = await import('@/test/api-mock');
 *     return createApiMock(await importOriginal());
 *   });
 *   import * as api from '@/api';
 *   vi.mocked(api.auth.login).mockResolvedValue(...);
 */
import { vi } from 'vitest';
import type { MailSettingsView, RemoteStatus, ServerArchiveInfo, ServerStatus } from '@shared/types';
import { DEFAULT_APP_SETTINGS } from '@/constants/settings';

/**
 * A remote-access status with remote access off and nothing configured (GET /api/server/remote), as
 * the owner sees it (the owner - the first account - is fixed from the start: `hasOwner` is true).
 */
export function remoteStatusFixture(overrides: Partial<RemoteStatus> = {}): RemoteStatus {
  return {
    enabled: false,
    hostname: '',
    tokenSet: false,
    publicPort: 443,
    upnp: true,
    staging: false,
    publicIp: null,
    certificate: null,
    steps: [
      { id: 'duckdns', state: 'idle', messageKey: '', params: {}, at: null },
      { id: 'certificate', state: 'idle', messageKey: '', params: {}, at: null },
      { id: 'listener', state: 'idle', messageKey: '', params: {}, at: null },
      { id: 'upnp', state: 'idle', messageKey: '', params: {}, at: null },
    ],
    lastError: null,
    urls: [],
    tlsPort: null,
    lanIps: [],
    nextRetryAt: null,
    busy: false,
    hasOwner: true,
    ...overrides,
  };
}

/** One archive on the hosted server's volume (fictional name, hash and size), as GET /api/server/status lists it. */
export function serverArchiveFixture(overrides: Partial<ServerArchiveInfo> = {}): ServerArchiveInfo {
  const fileName = overrides.fileName ?? 'your-personal-diary-server-2026-10-01T09-30-00Z.mpda';
  const sha256 = overrides.sha256 === undefined ? 'ab'.repeat(32) : overrides.sha256;
  return {
    fileName,
    path: `/data/archive/${fileName}`,
    sizeBytes: 5 * 1024 * 1024,
    sha256,
    createdAt: '2026-10-01T09:30:00.000Z',
    downloadCommand: `C:\\Users\\AVI\\.fly\\bin\\flyctl.exe ssh sftp get /data/archive/${fileName} .\\${fileName} -a yourpersonaldiary`,
    hashCommand: sha256 ? `(Get-FileHash .\\${fileName} -Algorithm SHA256).Hash -eq '${sha256}'` : '',
    ...overrides,
  };
}

/** GET /api/server/status of a healthy hosted server with no archive yet (fictional numbers). */
export function serverStatusFixture(overrides: Partial<ServerStatus> = {}): ServerStatus {
  return {
    version: '0.1.0',
    mode: 'hosted',
    publicUrl: 'https://diary.example.org',
    startedAt: '2026-10-20T08:00:00.000Z',
    uptimeSec: 3 * 86_400 + 2 * 3600,
    accounts: 12,
    maxAccounts: 100,
    registrationsLast24h: 2,
    registration: 'invite',
    maxDiaryBytes: 10 * 1024 * 1024,
    disk: { totalBytes: 3 * 1024 ** 3, freeBytes: 2 * 1024 ** 3, freePct: 66 },
    storageOk: true,
    lastPersistAt: '2026-10-23T07:45:00.000Z',
    lastPersistErrorAt: null,
    openVaults: 3,
    liveSessions: 4,
    guests: 0,
    maxGuests: 20,
    rssBytes: 120 * 1024 * 1024,
    lastArchiveAt: null,
    diskLow: false,
    dataBytes: 40 * 1024 * 1024,
    archiveDue: true,
    archives: [],
    archiveBusy: false,
    archiveRetryAfterSec: 0,
    ...overrides,
  };
}

/** Mail settings with nothing configured yet (GET /api/server/mail before the first save, as the owner sees it). */
export function mailSettingsFixture(overrides: Partial<MailSettingsView> = {}): MailSettingsView {
  return {
    enabled: false,
    host: 'smtp.gmail.com',
    port: 465,
    security: 'tls',
    username: '',
    smtpPasswordSet: false,
    fromAddress: '',
    ready: false,
    hasOwner: true,
    ...overrides,
  };
}

type ApiModule = typeof import('@/api');

function fnGroup<K extends string>(keys: readonly K[]): Record<K, ReturnType<typeof vi.fn>> {
  const out = {} as Record<K, ReturnType<typeof vi.fn>>;
  for (const k of keys) out[k] = vi.fn();
  return out;
}

export function createApiMock(actual: ApiModule): ApiModule {
  const auth = fnGroup([
    'register',
    'login',
    'accounts',
    'logout',
    'me',
    'lock',
    'verifyPassword',
    'changePassword',
    'sessions',
    'revokeSession',
    'deleteAccount',
    'forgotPassword',
    'resetPassword',
  ] as const);
  auth.logout.mockResolvedValue(undefined);
  auth.accounts.mockResolvedValue({ accounts: [] });
  auth.verifyPassword.mockResolvedValue({ ok: true });
  auth.lock.mockResolvedValue(undefined);

  const settings = fnGroup(['get', 'update', 'dataDir', 'seedDemo'] as const);
  settings.get.mockResolvedValue({ ...DEFAULT_APP_SETTINGS });
  settings.update.mockImplementation(async (patch: Record<string, unknown>) => ({ ...DEFAULT_APP_SETTINGS, ...patch }));

  const habits = fnGroup([
    'list',
    'progress',
    'templates',
    'create',
    'update',
    'archive',
    'reorder',
    'remove',
    'logs',
    'log',
    'removeLog',
    'status',
    'dueReminders',
  ] as const);
  habits.dueReminders.mockResolvedValue([]);
  habits.list.mockResolvedValue([]);
  habits.progress.mockResolvedValue([]);

  const entries = fnGroup(['list', 'get', 'create', 'update', 'remove', 'day', 'tags', 'people', 'locations'] as const);
  entries.list.mockResolvedValue({ items: [], total: 0 });
  entries.tags.mockResolvedValue([]);
  entries.people.mockResolvedValue([]);
  entries.locations.mockResolvedValue([]);

  const calendar = fnGroup(['month', 'range'] as const);
  const insights = fnGroup(['report', 'home'] as const);
  const stats = fnGroup(['overview'] as const);
  const search = fnGroup(['run', 'parse'] as const);
  const backup = fnGroup(['createToPath', 'download', 'inspectPath', 'inspectFile', 'restoreFromPath', 'restoreFromFile'] as const);
  const exportApi = fnGroup(['toPath', 'download'] as const);
  const remote = fnGroup(['get', 'put', 'renew', 'test'] as const);
  remote.get.mockImplementation(async () => remoteStatusFixture());
  remote.put.mockImplementation(async ({ password: _password, ...body }: Partial<RemoteStatus> & { password?: string }) =>
    remoteStatusFixture({ ...body, hasOwner: true }),
  );
  remote.renew.mockImplementation(async () => remoteStatusFixture());
  remote.test.mockResolvedValue({ checks: [], publicIp: null, at: '2026-09-28T12:00:00.000Z' });
  const mail = fnGroup(['get', 'put', 'test'] as const);
  mail.get.mockImplementation(async () => mailSettingsFixture());
  mail.put.mockImplementation(async ({ password: _password, smtpPassword, ...body }: Partial<MailSettingsView> & { password?: string; smtpPassword?: string }) =>
    mailSettingsFixture({ ...body, smtpPasswordSet: !!smtpPassword, hasOwner: true }),
  );
  mail.test.mockResolvedValue({ ok: true, sentTo: 'dana@example.com', at: '2026-09-29T12:00:00.000Z', message: 'A test e-mail was sent.' });
  const serverCalls = fnGroup(['info', 'getSettings', 'updateSettings', 'health', 'status', 'archive'] as const);
  serverCalls.status.mockImplementation(async () => serverStatusFixture());
  serverCalls.archive.mockImplementation(async () => ({ ...serverArchiveFixture(), files: 5, dataBytes: 40 * 1024 * 1024, removed: [] }));
  const server = { ...serverCalls, remote, mail };

  return {
    ...actual,
    auth,
    settings,
    habits,
    entries,
    calendar,
    insights,
    stats,
    search,
    backup,
    exportApi,
    server,
  } as unknown as ApiModule;
}
