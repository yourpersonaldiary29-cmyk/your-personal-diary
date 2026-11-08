/**
 * Typed API functions - one per endpoint in docs/API.md. Pages import from here
 * and never build URLs themselves.
 */
import type {
  AppSettings,
  AuthResponse,
  BackupFileInfo,
  BackupInfo,
  BackupRequest,
  CalendarDay,
  CalendarMonth,
  ChangePasswordRequest,
  DataDirInfo,
  DaySummary,
  DueReminder,
  Entry,
  EntryFilter,
  EntryInput,
  EntryPage,
  ExportRequest,
  ExportResult,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  Habit,
  HabitDayStatus,
  HabitInput,
  HabitLog,
  HabitLogInput,
  HabitTemplate,
  HabitWithProgress,
  HomeSummary,
  InsightsReport,
  LoginRequest,
  MailSettingsUpdate,
  MailSettingsView,
  MailTestResult,
  ParsedQuery,
  Period,
  RegisterRequest,
  RemoteSettingsUpdate,
  RemoteStatus,
  RemoteTestResult,
  ResetPasswordRequest,
  ResetPasswordResponse,
  RestoreInfo,
  SearchRequest,
  SearchResult,
  SeedDemoRequest,
  SeedDemoResult,
  ServerArchiveRequest,
  ServerArchiveResult,
  ServerInfo,
  ServerSettings,
  ServerStatus,
  SessionInfo,
  StatsOverview,
  TagCount,
  UserProfile,
} from '@shared/types';
import { tr } from '@/i18n/runtime';
import { offlineAware } from '@/offline/facade';
import { request, requestBlob } from './client';

export * from './client';
export * from './connection';

// Offline mode (docs/android-tasks/OFFLINE-DESIGN.md section 4.3): the groups `entries`, `habits`,
// `settings`, `calendar` and `insights` are wrapped by `offlineAware`. Signatures do not change, and
// while no offline engine is armed (local builds, page tests, old servers, guests) every call goes
// straight to the function written below - the requests are identical to today's.

/** One account registered on this computer, as GET /api/auth/accounts reports it (no id, no secrets). */
export interface AccountSummary {
  username: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  /** Last sign-in on this computer (ISO) as the server remembers it; null when unknown, absent from older servers. */
  lastLoginAt?: string | null;
  /** E-mail registered with the account ('' for accounts created before the field existed; absent from older servers). */
  email?: string;
}

export interface AccountsResponse {
  /** The account that signed in most recently first (the server keeps that in its registry), then by creation time. */
  accounts: AccountSummary[];
}

// Server ---------------------------------------------------------------------
export const server = {
  info: () => request<ServerInfo>('/api/server/info', { anonymous: true }),
  /**
   * Server settings (GET /api/server/settings). Also says whether the signed-in account owns
   * remote access / sending e-mail (`isRemoteOwner` / `isMailOwner`; absent from older servers).
   */
  getSettings: () => request<ServerSettings>('/api/server/settings'),
  /** Phone access: owner only; turning it on (or another port) needs the account password. */
  updateSettings: (patch: Partial<ServerSettings> & { password?: string }) =>
    request<ServerSettings>('/api/server/settings', { method: 'PUT', body: patch }),
  health: () => request<{ ok: boolean; version: string }>('/api/health', { anonymous: true }),
  /**
   * Remote access over the internet (DuckDNS name + HTTPS). Every call needs a session and is
   * answered only over loopback (403 from a phone or from the internet), and only to the owner - the
   * account created first on this computer (403 FORBIDDEN 'server.remote.notOwner' to every other
   * account; `ServerSettings.isRemoteOwner` says it beforehand).
   */
  remote: {
    /** Current settings and progress (GET /api/server/remote). Poll while `busy`. */
    get: () => request<RemoteStatus>('/api/server/remote'),
    /**
     * Changes the given fields and starts / stops remote access (PUT /api/server/remote). Always
     * carries the account password (400 WRONG_PASSWORD with field 'password' when it is wrong).
     */
    put: (body: RemoteSettingsUpdate) => request<RemoteStatus>('/api/server/remote', { method: 'PUT', body }),
    /** Forces a certificate renewal (POST /api/server/remote/renew). */
    renew: () => request<RemoteStatus>('/api/server/remote/renew', { method: 'POST' }),
    /** DuckDNS update + UPnP discovery + DNS lookup of the saved name (POST /api/server/remote/test). */
    test: () => request<RemoteTestResult>('/api/server/remote/test', { method: 'POST' }),
  },
  /**
   * Sending e-mail (password reset) - the SMTP account the diary sends reset e-mails from. Like
   * remote access: every call needs a session, is answered only over loopback, and only to the
   * owner - the account created first on this computer (403 FORBIDDEN 'server.mail.notOwner' to
   * every other account; `ServerSettings.isMailOwner` says it beforehand). The SMTP
   * password (Gmail App Password) is write-only: the answer only says `smtpPasswordSet`.
   */
  mail: {
    /** Current settings (GET /api/server/mail). */
    get: () => request<MailSettingsView>('/api/server/mail'),
    /** Changes the given fields; always carries the account password (400 WRONG_PASSWORD, field 'password', when wrong). */
    put: (body: MailSettingsUpdate) => request<MailSettingsView>('/api/server/mail', { method: 'PUT', body }),
    /** Sends a test e-mail to the owner's own address (POST /api/server/mail/test). */
    test: () => request<MailTestResult>('/api/server/mail/test', { method: 'POST' }),
  },
  // The owner's "Server" card of the hosted server (docs/android-tasks/SERVER-CARD.md). Mounted on hosted
  // servers only; answered to the configured owner (`DIARY_OWNER_ID`) over HTTPS only - every other
  // account, a tour guest and a plain-HTTP request get 403 FORBIDDEN ('server.error.forbidden', or
  // 'server.owner.unset' while no owner is configured). `ServerSettings.isServerOwner` says it beforehand.
  /** Version, uptime, accounts, disk, storage, memory and the archives on the volume (GET /api/server/status). */
  status: (signal?: AbortSignal) => request<ServerStatus>('/api/server/status', { signal }),
  /**
   * Writes an encrypted server archive to the volume (POST /api/server/archive) and answers its name,
   * size, SHA-256 and the owner's download command - the archive itself is never served by the API.
   * Needs the account password (400 WRONG_PASSWORD, field 'password'; the confirmation lockout answers
   * 429 'server.remote.loginLocked') and a passphrase of 12..1024 characters (400 VALIDATION, field
   * 'passphrase'). One archive per 10 minutes (429 'server.archive.tooSoon'); 507
   * 'server.archive.noSpace' when the volume has too little free space.
   */
  archive: (body: ServerArchiveRequest) => request<ServerArchiveResult>('/api/server/archive', { method: 'POST', body }),
};

// Auth -----------------------------------------------------------------------
export const auth = {
  register: (body: RegisterRequest) =>
    request<AuthResponse>('/api/auth/register', { method: 'POST', body, anonymous: true }),
  login: (body: LoginRequest) => request<AuthResponse>('/api/auth/login', { method: 'POST', body, anonymous: true }),
  /**
   * Starts the tour mode of the phone app ("Skip - just look around"): a temporary guest account with
   * sample data that lives in memory only. The answer is an AuthResponse with `guest: true` (never
   * "Remember me"). The route exists only in the Android core: everywhere else it answers 404.
   */
  guest: (body: { deviceName?: string; language?: string } = {}) =>
    request<AuthResponse>('/api/auth/guest', { method: 'POST', body, anonymous: true }),
  /**
   * Asks for a password-reset e-mail (link + 6-digit code). Always the same 200 answer, whether or
   * not the address is registered; 503 'server.mail.notConfigured' while sending mail is not set up,
   * 429 when asked too often.
   */
  forgotPassword: (body: ForgotPasswordRequest) =>
    request<ForgotPasswordResponse>('/api/auth/forgot-password', { method: 'POST', body, anonymous: true }),
  /**
   * Sets a new password with the e-mail link's token, or the e-mail address + the 6-digit code.
   * The diary is kept; every session of the account is signed out. 400 'server.reset.invalid' when
   * the token / code is wrong, expired or used.
   */
  resetPassword: (body: ResetPasswordRequest) =>
    request<ResetPasswordResponse>('/api/auth/reset-password', { method: 'POST', body, anonymous: true }),
  /** Accounts registered on this computer (login screen). Answered only over loopback: 403 from a phone. */
  accounts: () => request<AccountsResponse>('/api/auth/accounts', { anonymous: true }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  me: () => request<{ user: UserProfile; session: SessionInfo }>('/api/auth/me'),
  /** Locks this session on the server (lock screen): data routes answer 423 until verifyPassword succeeds. */
  lock: () => request<void>('/api/auth/lock', { method: 'POST' }),
  verifyPassword: (password: string) =>
    request<{ ok: boolean }>('/api/auth/verify-password', { method: 'POST', body: { password } }),
  changePassword: (body: ChangePasswordRequest) =>
    request<{ ok: boolean }>('/api/auth/change-password', { method: 'POST', body }),
  /**
   * Updates the first name, last name and/or e-mail (PUT /api/auth/profile) and returns the saved
   * profile. A new e-mail address needs the account password in `currentPassword`.
   */
  updateProfile: (body: Partial<Pick<UserProfile, 'firstName' | 'lastName' | 'email'>> & { currentPassword?: string }) =>
    request<UserProfile>('/api/auth/profile', { method: 'PUT', body }),
  sessions: () => request<SessionInfo[]>('/api/auth/sessions'),
  revokeSession: (id: string) => request<void>(`/api/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  deleteAccount: (password: string) =>
    request<void>('/api/auth/delete-account', { method: 'POST', body: { password } }),
};

// Entries --------------------------------------------------------------------
export const entries = offlineAware('entries', {
  list: (filter: EntryFilter = {}) => request<EntryPage>('/api/entries', { query: { ...filter } }),
  get: (id: number) => request<Entry>(`/api/entries/${id}`),
  create: (input: EntryInput) => request<Entry>('/api/entries', { method: 'POST', body: input }),
  update: (id: number, input: EntryInput) => request<Entry>(`/api/entries/${id}`, { method: 'PUT', body: input }),
  remove: (id: number) => request<void>(`/api/entries/${id}`, { method: 'DELETE' }),
  day: (date: string) => request<DaySummary>(`/api/entries/day/${date}`),
  tags: () => request<TagCount[]>('/api/entries/meta/tags'),
  people: () => request<TagCount[]>('/api/entries/meta/people'),
  locations: () => request<TagCount[]>('/api/entries/meta/locations'),
});

// Habits ---------------------------------------------------------------------
export const habits = offlineAware('habits', {
  list: (includeArchived = false) => request<Habit[]>('/api/habits', { query: { includeArchived } }),
  progress: (date: string) => request<HabitWithProgress[]>('/api/habits/progress', { query: { date } }),
  templates: () => request<HabitTemplate[]>('/api/habits/templates'),
  create: (input: HabitInput) => request<Habit>('/api/habits', { method: 'POST', body: input }),
  update: (id: number, input: HabitInput) => request<Habit>(`/api/habits/${id}`, { method: 'PUT', body: input }),
  archive: (id: number, archived: boolean) =>
    request<Habit>(`/api/habits/${id}/archive`, { method: 'PATCH', body: { archived } }),
  reorder: (ids: number[]) => request<Habit[]>('/api/habits/reorder', { method: 'PUT', body: { ids } }),
  remove: (id: number) => request<void>(`/api/habits/${id}`, { method: 'DELETE' }),
  logs: (id: number, from?: string, to?: string) =>
    request<HabitLog[]>(`/api/habits/${id}/logs`, { query: { from, to } }),
  log: (input: HabitLogInput) => request<HabitLog>('/api/habits/logs', { method: 'PUT', body: input }),
  removeLog: (id: number, date: string) => request<void>(`/api/habits/${id}/logs/${date}`, { method: 'DELETE' }),
  status: (from: string, to: string) => request<HabitDayStatus[]>('/api/habits/status', { query: { from, to } }),
  dueReminders: (now: string) => request<DueReminder[]>('/api/habits/reminders/due', { query: { now } }),
});

// Calendar / timeline --------------------------------------------------------
export const calendar = offlineAware('calendar', {
  month: (year: number, month: number) => request<CalendarMonth>('/api/calendar/month', { query: { year, month } }),
  range: (from: string, to: string) => request<CalendarDay[]>('/api/calendar/range', { query: { from, to } }),
});

// Insights / home / stats ----------------------------------------------------
export const insights = offlineAware('insights', {
  report: (period: Period) => request<InsightsReport>('/api/insights', { query: { period } }),
  home: () => request<HomeSummary>('/api/home'),
});

export const stats = {
  overview: (period: Period) => request<StatsOverview>('/api/stats', { query: { period } }),
};

// Search ---------------------------------------------------------------------
export const search = {
  run: (body: SearchRequest) => request<SearchResult>('/api/search', { method: 'POST', body }),
  parse: (body: SearchRequest) => request<ParsedQuery>('/api/search/parse', { method: 'POST', body }),
};

// Settings -------------------------------------------------------------------
export const settings = offlineAware('settings', {
  get: () => request<AppSettings>('/api/settings'),
  update: (patch: Partial<AppSettings>) => request<AppSettings>('/api/settings', { method: 'PUT', body: patch }),
  dataDir: () => request<DataDirInfo>('/api/settings/data-dir'),
  seedDemo: (body: SeedDemoRequest = {}) =>
    request<SeedDemoResult>('/api/settings/seed-demo', { method: 'POST', body }),
});

// Backup ---------------------------------------------------------------------
export const backup = {
  /** Desktop: writes to destPath and returns info. */
  createToPath: (body: BackupRequest & { destPath: string }) =>
    request<BackupInfo>('/api/backup/create', { method: 'POST', body }),
  /** Browser/phone: downloads the encrypted file. */
  download: (body: Omit<BackupRequest, 'destPath'> = {}) => requestBlob('/api/backup/create', { method: 'POST', body }),
  inspectPath: (srcPath: string) =>
    request<BackupFileInfo>('/api/backup/inspect', { method: 'POST', body: { srcPath } }),
  inspectFile: async (file: File) => {
    const fileBase64 = await fileToBase64(file);
    return request<BackupFileInfo>('/api/backup/inspect', {
      method: 'POST',
      body: { fileBase64, fileName: file.name },
    });
  },
  restoreFromPath: (srcPath: string, password: string) =>
    request<RestoreInfo>('/api/backup/restore', { method: 'POST', body: { srcPath, password } }),
  restoreFromFile: async (file: File, password: string) => {
    const fileBase64 = await fileToBase64(file);
    return request<RestoreInfo>('/api/backup/restore', {
      method: 'POST',
      body: { fileBase64, fileName: file.name, password },
    });
  },
};

/** Reads a File as Base64 (without the data: prefix). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(tr('shell.fileReadFailed')));
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

// Export ---------------------------------------------------------------------
export const exportApi = {
  toPath: (body: ExportRequest & { destPath: string }) => request<ExportResult>('/api/export', { method: 'POST', body }),
  download: (body: Omit<ExportRequest, 'destPath'>) => requestBlob('/api/export', { method: 'POST', body }),
};
