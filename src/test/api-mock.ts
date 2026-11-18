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
import type {
  MailSettingsView,
  RemoteStatus,
  ServerArchiveInfo,
  ServerDiskChange,
  ServerDiskInfo,
  ServerDownloadRow,
  ServerDownloads,
  ServerStatus,
} from '@shared/types';
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

/**
 * GET /api/server/status of a healthy hosted server with no archive yet (fictional numbers). Its
 * capacity is the model's answer for the 3 GiB disk: 12 diaries of 96 KB on average (below the 1 MiB
 * of a typical diary), each account 6 x 1 MiB, 435 typical users - more than the ceiling of 100
 * accounts, so no note - and 43 at the 10 MiB quota.
 */
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
    capacity: {
      usableBytes: 2_738_041_651,
      averageDiaryBytes: 96 * 1024,
      diaries: 12,
      perUserTypicalBytes: 6 * 1024 * 1024,
      usersTypical: 435,
      usersAtQuota: 43,
      countedDiaryBytes: 1024 * 1024,
      copies: 6,
      keptFreePct: 15,
    },
    ...overrides,
  };
}

/** One file of the Downloads page (fictional hash and size): the Windows installer of 1.0.0 that came with the server update. */
export function serverDownloadRowFixture(overrides: Partial<ServerDownloadRow> = {}): ServerDownloadRow {
  const version = overrides.version ?? '1.0.0';
  return {
    version,
    date: '2026-11-10',
    file: `YourPersonalDiary-${version}-windows-x64-setup.exe`,
    bytes: 85 * 1024 * 1024,
    sha256: 'ef'.repeat(32),
    source: 'image',
    ...overrides,
  };
}

/**
 * GET /api/server/downloads of a server with the three files of 1.0.0 that came with its update, no
 * upload today, the e-mail ready.
 */
export function serverDownloadsFixture(overrides: Partial<ServerDownloads> = {}): ServerDownloads {
  return {
    platforms: {
      windows: [serverDownloadRowFixture()],
      android: [serverDownloadRowFixture({ file: 'YourPersonalDiary-1.0.0-android.apk', bytes: 40 * 1024 * 1024 })],
      mac: [serverDownloadRowFixture({ file: 'YourPersonalDiary-1.0.0-mac-universal.dmg', bytes: 120 * 1024 * 1024 })],
    },
    limits: {
      maxBytes: 300 * 1024 * 1024,
      minBytes: 1024 * 1024,
      perDay: 10,
      usedToday: 0,
      tokenMinutes: 15,
      keepFreePct: 15,
      freeBytes: 30 * 1024 ** 3,
    },
    busy: false,
    email: 'ready',
    ...overrides,
  };
}

/** One change of the disk size (fictional id): 50 GB to 60 GB, just started. */
export function serverDiskChangeFixture(overrides: Partial<ServerDiskChange> = {}): ServerDiskChange {
  return {
    id: 'd_0123456789ab',
    state: 'snapshot',
    fromGb: 50,
    toGb: 60,
    startedAt: '2026-11-18T10:00:00.000Z',
    updatedAt: '2026-11-18T10:00:00.000Z',
    finishedAt: null,
    errorKey: null,
    email: null,
    ...overrides,
  };
}

/** GET /api/server/disk of a server whose disk button is set up: 50 GB, at most 100, no change yet. */
export function serverDiskFixture(overrides: Partial<ServerDiskInfo> = {}): ServerDiskInfo {
  return {
    available: true,
    sizeGb: 50,
    usedBytes: 2 * 1024 ** 3,
    totalBytes: 49 * 1024 ** 3,
    maxGb: 100,
    pricePerGbMonth: 0.15,
    changesPerDay: 3,
    changesLeftToday: 3,
    nextChangeAt: null,
    job: null,
    history: [],
    setupCommand: 'powershell -NoProfile -ExecutionPolicy Bypass -File "C:\\Users\\AVI\\Projects\\my-personal-diary\\scripts\\hosted\\set-disk-key.ps1"',
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
  // The Server card's downloads and disk parts read their state on open; the actions are set up by each test.
  const downloads = fnGroup(['list', 'intent', 'upload', 'remove'] as const);
  downloads.list.mockImplementation(async () => serverDownloadsFixture());
  const disk = fnGroup(['get', 'extend', 'restart'] as const);
  disk.get.mockImplementation(async () => serverDiskFixture());
  const server = { ...serverCalls, remote, mail, downloads, disk };

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
