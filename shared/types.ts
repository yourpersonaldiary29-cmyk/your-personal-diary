/**
 * Shared type contract between the local Node.js server (`server/`) and the
 * React frontend (`src/`). This file is the single source of truth for every
 * object that crosses the HTTP boundary. Keep it dependency-free.
 *
 * Conventions
 * - Dates are ISO strings `YYYY-MM-DD`; times are `HH:MM` (24h); timestamps are ISO 8601.
 * - Ratings (mood, energy, stress, sleepQuality) are integers 1..=10.
 * - `null` means "not reported". Analysis must skip nulls and never treat them as 0.
 * - All user-facing strings produced by the server are Hebrew.
 */

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type ErrorCode =
  | 'UNAUTHORIZED' // missing/invalid session token
  | 'SESSION_EXPIRED'
  | 'WRONG_PASSWORD'
  | 'WEAK_PASSWORD'
  | 'USERNAME_TAKEN'
  | 'USER_NOT_FOUND'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'DB'
  | 'CRYPTO'
  | 'IO'
  | 'BACKUP'
  | 'EXPORT'
  | 'FORBIDDEN'
  | 'LAN_DISABLED'
  | 'LOCKED' // the session is locked (lock screen): only /me, /verify-password, /lock, /logout and GET /settings answer
  | 'OTHER';

/** Every non-2xx response body has this shape. */
export interface ApiErrorBody {
  code: ErrorCode;
  /** Hebrew, user-facing. */
  message: string;
  /** Optional field name for validation errors. */
  field?: string;
}

// ---------------------------------------------------------------------------
// Accounts & sessions
// ---------------------------------------------------------------------------

export interface UserProfile {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  /** E-mail address given at registration (stored locally only; never used to send mail). Empty for accounts created before the field existed. */
  email: string;
  createdAt: string;
  /**
   * True for the temporary guest account of the tour mode (mobile only, POST /api/auth/guest):
   * demo data, nothing is saved, and account actions (password, profile, backup, delete) answer 403.
   * Absent for every real account.
   */
  guest?: boolean;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  username: string;
  /** Required. Validated for shape only (local app, no verification mail). Must be unique among local accounts. */
  email: string;
  password: string;
  confirmPassword: string;
  /** Persist the session across restarts (desktop + phone). */
  rememberMe?: boolean;
  /** Free-form device label, e.g. "מחשב" / "טלפון". */
  deviceName?: string;
  /**
   * The checkbox "I have read the Privacy policy and agree to it" (docs/android-tasks/PRIVACY-CHECKBOX.md).
   * The registration page sends no request at all until it is ticked, then `true`. A hosted server answers
   * `400 VALIDATION` with `field: "privacyAccepted"` unless it is exactly `true`, and stores the time and the
   * policy version with the account; local developer mode neither requires nor stores it.
   */
  privacyAccepted?: boolean;
  /**
   * The Terms of Use (docs/apple-tasks/TERMS.md), confirmed with the SAME checkbox ("I have read the Privacy
   * Policy and the Terms of Use, and I agree to them"): the page sends `true` together with `privacyAccepted`.
   * A hosted server answers `400 VALIDATION` with `field: "termsAccepted"` unless it is exactly `true`, and
   * stores the time and the terms version with the account; local developer mode neither requires nor stores it.
   */
  termsAccepted?: boolean;
}

export interface LoginRequest {
  /** Username or e-mail address (matched case-insensitively). */
  username: string;
  password: string;
  rememberMe?: boolean;
  deviceName?: string;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
  /** ISO timestamp after which the token is rejected. */
  expiresAt: string;
  rememberMe: boolean;
  /** True when this is a guest session (tour mode, see UserProfile.guest). Absent otherwise. */
  guest?: boolean;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface VerifyPasswordRequest {
  password: string;
}

export interface SessionInfo {
  id: string;
  deviceName: string;
  createdAt: string;
  lastSeenAt: string;
  rememberMe: boolean;
  /** True for the session that issued the request. */
  current: boolean;
  /** True while the session is locked (lock screen / auto-lock); the password unlocks it. */
  locked?: boolean;
  /** True for the session of a guest account (tour mode, see UserProfile.guest). Absent otherwise. */
  guest?: boolean;
}

export interface DeleteAccountRequest {
  password: string;
}

// ---------------------------------------------------------------------------
// Password reset by e-mail (docs/API.md "איפוס סיסמה")
// ---------------------------------------------------------------------------

/** Body of `POST /api/auth/forgot-password` (public; works over the remote HTTPS address too). */
export interface ForgotPasswordRequest {
  /** The e-mail address the account was registered with (matched case-insensitively). */
  email: string;
}

/**
 * Answer of `POST /api/auth/forgot-password`: ALWAYS the same 200 answer, whether or not the
 * address is registered (no account enumeration). `message` is localised
 * ('server.reset.sent': "If this address is registered, we sent a link and a code to it.").
 */
export interface ForgotPasswordResponse {
  ok: true;
  message: string;
}

/**
 * Body of `POST /api/auth/reset-password`: EITHER `token` (from the e-mail link
 * `<base>/#/reset-password?token=<token>`) OR `email` + `code` (the 6-digit code from the same
 * e-mail), plus the new password twice. Wrong / expired / used: 400 VALIDATION 'server.reset.invalid'.
 */
export interface ResetPasswordRequest {
  token?: string;
  email?: string;
  /** 6 digits. */
  code?: string;
  newPassword: string;
  confirmPassword: string;
}

/** Answer of `POST /api/auth/reset-password` ('server.reset.done'). Every session of the account was signed out. */
export interface ResetPasswordResponse {
  ok: true;
  message: string;
  /**
   * The username of the account whose password was reset (the caller proved it reads the account's
   * mailbox, which received the username anyway): the app signs out only a session of THAT account
   * and prefills it on the login page. Absent from older servers.
   */
  username?: string;
}

// ---------------------------------------------------------------------------
// Diary entries
// ---------------------------------------------------------------------------

export interface Entry {
  id: number;
  date: string;
  time: string;
  title: string;
  body: string;
  mood: number | null;
  /** Emotion keys, see `shared/constants.ts` EMOTIONS. */
  emotions: string[];
  energy: number | null;
  stress: number | null;
  sleepQuality: number | null;
  /** 0..24, halves allowed. */
  sleepHours: number | null;
  /** Minutes of physical activity. 0 = explicitly none, null = not reported. */
  exerciseMinutes: number | null;
  /** Free text, e.g. "הליכה". */
  exerciseType: string;
  /** Significant events of the day. */
  events: string[];
  /** People met. */
  people: string[];
  location: string;
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type EntryInput = Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>;

export interface EntrySummary {
  id: number;
  date: string;
  time: string;
  title: string;
  /** First ~160 characters of the body. */
  excerpt: string;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  sleepHours: number | null;
  emotions: string[];
  tags: string[];
}

export interface EntryFilter {
  /** Inclusive ISO dates. */
  from?: string;
  to?: string;
  tag?: string;
  emotion?: string;
  /** Case-insensitive substring match over title, body, notes, events, people, location. */
  text?: string;
  limit?: number;
  offset?: number;
  /** Newest first (default true). */
  sortDesc?: boolean;
}

export interface EntryPage {
  items: EntrySummary[];
  total: number;
}

export interface TagCount {
  name: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Habits
// ---------------------------------------------------------------------------

export type HabitFrequency = 'daily' | 'weekly';

export interface Habit {
  id: number;
  name: string;
  description: string;
  /** Target amount per period (8 glasses per day, 3 sessions per week). */
  target: number;
  /** Unit label: "כוסות", "דקות", "פעמים", ... */
  unit: string;
  frequency: HabitFrequency;
  /** `HH:MM` local time. */
  reminderTime: string | null;
  reminderEnabled: boolean;
  isArchived: boolean;
  sortOrder: number;
  createdAt: string;
}

export type HabitInput = Pick<
  Habit,
  'name' | 'description' | 'target' | 'unit' | 'frequency' | 'reminderTime' | 'reminderEnabled'
>;

export interface HabitLog {
  id: number;
  habitId: number;
  date: string;
  /** Amount done that day in the habit's unit. */
  value: number;
  /** Daily habit: value >= target. Weekly habit: value > 0 (contributed that day). */
  completed: boolean;
  note: string;
}

export interface HabitLogInput {
  habitId: number;
  date: string;
  value: number;
  note?: string;
}

export interface HabitLogWithName {
  log: HabitLog;
  habitName: string;
  unit: string;
  target: number;
  frequency: HabitFrequency;
}

export interface HabitWithProgress {
  habit: Habit;
  /** Log for the requested date (usually today). */
  today: HabitLog | null;
  /** Consecutive completed days (daily) / weeks (weekly) ending at the requested date. */
  currentStreak: number;
  bestStreak: number;
  /** Sum of values in the week containing the requested date. */
  weekTotal: number;
  /** Completed days in the last 30 days (daily) or completed weeks in the last 4 weeks (weekly). */
  completedLast30: number;
  /** 0..1 */
  completionRate30: number;
  /** Day target (daily) or week target (weekly) already met. */
  targetMet: boolean;
}

export interface HabitDayStatus {
  habitId: number;
  habitName: string;
  date: string;
  value: number;
  completed: boolean;
}

export interface HabitTemplate {
  name: string;
  description: string;
  target: number;
  unit: string;
  frequency: HabitFrequency;
}

// ---------------------------------------------------------------------------
// Periods, calendar, timeline
// ---------------------------------------------------------------------------

export type Period = '7d' | '30d' | '3m' | '6m' | '1y' | 'all';

export interface CalendarDay {
  date: string;
  /** Mean of the day's entries. */
  mood: number | null;
  energy: number | null;
  stress: number | null;
  sleepHours: number | null;
  hasEntry: boolean;
  entryCount: number;
  habitsCompleted: number;
  habitsTotal: number;
  /** Titles of the day's entries (for calendar cell accessible names). */
  titles: string[];
}

export interface CalendarMonth {
  year: number;
  /** 1..12 */
  month: number;
  days: CalendarDay[];
}

export interface DaySummary {
  date: string;
  entries: Entry[];
  habitLogs: HabitLogWithName[];
  moodAvg: number | null;
  energyAvg: number | null;
  stressAvg: number | null;
  sleepHours: number | null;
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

export interface SeriesPoint {
  date: string;
  value: number | null;
}

export interface StatsSeries {
  /** Machine key: mood | energy | stress | sleepHours | sleepQuality | exerciseMinutes | entries */
  metric: string;
  /** Hebrew label. */
  label: string;
  unit: string;
  points: SeriesPoint[];
  /** 7-day moving average aligned to `points`. */
  movingAvg: SeriesPoint[];
  mean: number | null;
  min: number | null;
  max: number | null;
  /** Number of non-null points. */
  count: number;
  /** Mean of the previous period of equal length (for comparison), if available. */
  previousMean: number | null;
}

export interface HabitStats {
  habitId: number;
  name: string;
  unit: string;
  target: number;
  frequency: HabitFrequency;
  points: SeriesPoint[];
  completionRate: number;
  completedDays: number;
  totalDays: number;
  currentStreak: number;
  bestStreak: number;
}

export interface StatsOverview {
  period: Period;
  from: string;
  to: string;
  mood: StatsSeries;
  energy: StatsSeries;
  stress: StatsSeries;
  sleepHours: StatsSeries;
  sleepQuality: StatsSeries;
  exerciseMinutes: StatsSeries;
  /** Entries per day (value = count, never null). */
  entriesPerDay: StatsSeries;
  habits: HabitStats[];
  totalEntries: number;
  daysWithEntries: number;
  /** Weekday means (index 0 = Sunday) for mood/energy/stress; null when no data. */
  weekdayMood: (number | null)[];
  weekdayEnergy: (number | null)[];
  weekdayStress: (number | null)[];
}

// ---------------------------------------------------------------------------
// Insights (pattern detection)
// ---------------------------------------------------------------------------

export type InsightStrength = 'weak' | 'moderate' | 'strong';

export type InsightCategory =
  | 'weekly_trend'
  | 'monthly_trend'
  | 'mood_change'
  | 'stress_change'
  | 'sleep_change'
  | 'habit_improved'
  | 'habit_declined'
  | 'habit_mood'
  | 'sleep_energy'
  | 'sleep_mood'
  | 'exercise_energy'
  | 'exercise_mood'
  | 'weekday'
  | 'time_of_day'
  | 'best_days'
  | 'hard_days'
  | 'month_comparison'
  | 'streak'
  | 'anomaly'
  | 'correlation'
  | 'emotion_pattern'
  | 'people_places';

export interface KeyValue {
  key: string;
  value: string;
}

/** The raw numbers behind an insight ("למה קיבלתי את התובנה הזאת?"). */
export interface InsightEvidence {
  daysExamined: number;
  metricLabel: string;
  groupALabel: string;
  groupACount: number;
  groupAMean: number | null;
  groupBLabel: string;
  groupBCount: number;
  groupBMean: number | null;
  /** Pearson r when applicable. */
  correlation: number | null;
  /** Difference in units of the metric (A - B) or standardised effect size. */
  effectSize: number | null;
  /** Dates that support the insight (best days, anomalies, streaks...). */
  dates: string[];
  extra: KeyValue[];
}

export interface Insight {
  /** Stable id, e.g. "sleep_mood_lt6". */
  id: string;
  category: InsightCategory;
  strength: InsightStrength;
  /** Short Hebrew title. */
  title: string;
  /** Hebrew sentence using hedged wording ("נראה ש...", "קיים קשר אפשרי..."). */
  text: string;
  /** Hebrew explanation of the data that was checked (the "why" text). */
  explanation: string;
  evidence: InsightEvidence;
  periodStart: string;
  periodEnd: string;
  /** Sorting weight; higher = more relevant. */
  score: number;
  /** True when the insight is positive/encouraging (used for grouping, never colour-only). */
  positive: boolean | null;
}

export interface InsightsReport {
  generatedAt: string;
  period: Period;
  periodStart: string;
  periodEnd: string;
  daysWithData: number;
  insights: Insight[];
  /** Hebrew notes such as "אין מספיק נתונים כדי לבדוק קשר בין שינה למצב רוח (נדרשים 14 ימים)". */
  notes: string[];
  /** Name of the analysis provider that produced the report (e.g. "rules-v1"). */
  provider: string;
}

export interface HomeSummary {
  today: string;
  /** Hebrew weekday name for today. */
  todayWeekday: string;
  todayEntryCount: number;
  /** Consecutive days (ending today or yesterday) with at least one entry. */
  entryStreak: number;
  lastEntry: EntrySummary | null;
  weekMoodAvg: number | null;
  weekEnergyAvg: number | null;
  weekStressAvg: number | null;
  weekSleepAvg: number | null;
  habitsToday: HabitWithProgress[];
  topInsight: Insight | null;
  totalEntries: number;
}

// ---------------------------------------------------------------------------
// Smart search
// ---------------------------------------------------------------------------

export type SearchIntent =
  | 'best_days'
  | 'worst_days'
  | 'text_mention'
  | 'metric_filter'
  | 'trend_summary'
  | 'list_entries'
  | 'emotion_days'
  | 'unknown';

export type Metric = 'mood' | 'energy' | 'stress' | 'sleepHours' | 'sleepQuality' | 'exerciseMinutes';

export type Comparator = 'lt' | 'lte' | 'gt' | 'gte' | 'eq';

export interface ParsedQuery {
  intent: SearchIntent;
  metric: Metric | null;
  comparator: Comparator | null;
  threshold: number | null;
  /** Inclusive ISO range derived from the question ("בחודש האחרון"...). */
  from: string | null;
  to: string | null;
  /** Free-text terms to look for in entries. */
  textTerms: string[];
  /** Emotion keys detected in the question. */
  emotions: string[];
  /** Hebrew label for the detected period. */
  periodLabel: string;
  /** Hebrew explanation of how the question was understood. */
  explanation: string;
}

export interface SearchRequest {
  query: string;
  limit?: number;
}

export interface SearchResult {
  parsed: ParsedQuery;
  /** Hebrew natural-language answer. */
  answer: string;
  entries: EntrySummary[];
  days: CalendarDay[];
  series: StatsSeries | null;
  totalMatches: number;
}

// ---------------------------------------------------------------------------
// Settings, privacy, server
// ---------------------------------------------------------------------------

import type { CalendarExtras } from './calendars/types';
import type { Locale } from './i18n/locales';
export type { CalendarExtras } from './calendars/types';
export type { Locale } from './i18n/locales';

export interface AppSettings {
  /** Minutes of inactivity before the UI locks (password required again). 0 = off. */
  autoLockMinutes: number;
  /** Frontend refuses any network call that is not the local API. */
  offlinePrivacyMode: boolean;
  theme: 'system' | 'light' | 'dark' | 'high-contrast';
  /** 0.75..2 */
  fontScale: number;
  remindersEnabled: boolean;
  /** 0 = Sunday, 1 = Monday */
  firstDayOfWeek: 0 | 1;
  reduceMotion: boolean;
  defaultPeriod: Period;
  /** Which extra calendars (Hebrew, Hijri) and holiday sets the calendar/day views show. */
  calendarExtras: CalendarExtras;
  /** UI language (see shared/i18n/locales.ts). Default 'en'. */
  language: Locale;
}

/** Server-wide settings (not per user). Stored in `<dataDir>/server-settings.json`. */
export interface ServerSettings {
  /** Preferred TCP port. */
  port: number;
  /** Also listen on the LAN (0.0.0.0) so a phone on the same Wi-Fi can connect. Default false. */
  lanEnabled: boolean;
  /**
   * Remote access over the internet, as the API reports it (read-only here: it is changed through
   * `PUT /api/server/remote`, and `PUT /api/server/settings` leaves it untouched). Present only in
   * answers to the account that owns remote access (`isRemoteOwner`); left out for every other
   * account - and also for the next owner while the settings of a deleted owner are still stored
   * (they are cleared by its next `/api/server/remote*` request). Ignored in a request body.
   */
  remote?: RemoteAccessSettings;
  /**
   * True when the signed-in account owns remote access and may view / change it (`/api/server/remote*`;
   * every other account gets 403 'server.remote.notOwner'). The owner is the account created first on
   * this computer, or the account that set remote access up before that rule existed. Reported by
   * `GET/PUT /api/server/settings` only (ignored in a request body); absent from older servers - a
   * client then learns it from the 403 of `GET /api/server/remote`.
   */
  isRemoteOwner?: boolean;
  /** The same for sending e-mail (`/api/server/mail*`, 403 'server.mail.notOwner'). */
  isMailOwner?: boolean;
  /**
   * True when the signed-in account may turn phone access (`lanEnabled`) on or off: the first account
   * created on this computer. Every other account gets 403 'server.lan.notOwner' from
   * `PUT /api/server/settings`. Reported by GET/PUT only (ignored in a request body).
   */
  isLanOwner?: boolean;
  /**
   * Hosted server only (docs/android-tasks/SERVER-CARD.md): true for the configured owner
   * (`DIARY_OWNER_ID`) - the one account that may open the "Server" card (`GET /api/server/status`,
   * `POST /api/server/archive`; everyone else gets 403). False for every other account and for a tour
   * guest; ABSENT on local servers (the card never shows there) and on older hosted servers. Clients
   * render the card only when `ServerInfo.mode === 'hosted'` and this is exactly `true`.
   * Reported by GET /api/server/settings only (ignored in a request body).
   */
  isServerOwner?: boolean;
}

/**
 * Remote access settings (opt-in, off by default; docs/API.md "גישה מרחוק"). The diary stays on
 * this computer; its server becomes reachable at the owner's DuckDNS name over HTTPS with a
 * Let's Encrypt certificate. The DuckDNS token never leaves the server: on disk it is encrypted
 * with the device key, and the API only says whether one is saved (`tokenSet`).
 */
export interface RemoteAccessSettings {
  enabled: boolean;
  /** DuckDNS name, e.g. 'yourpersonaldiary.duckdns.org' ('' until set). Lower-case, no scheme. */
  hostname: string;
  /** True when a DuckDNS token is saved on the server. */
  tokenSet: boolean;
  /** Port opened on the router (the external port in the https URL). Default 443. */
  publicPort: number;
  /** Open the router port automatically with UPnP. Default true. */
  upnp: boolean;
  /** Use the Let's Encrypt staging environment (test certificates browsers do not trust). Default false. */
  staging: boolean;
}

/**
 * Body of `PUT /api/server/remote`: only the given settings change. Only the owner of remote access
 * (the account created first on this computer - see `ServerSettings.isRemoteOwner`) may send it;
 * every save, the first one included, carries that account's password.
 */
export interface RemoteSettingsUpdate {
  enabled?: boolean;
  /** DuckDNS name ('yourpersonaldiary' or 'yourpersonaldiary.duckdns.org'; a pasted https URL is accepted too). */
  hostname?: string;
  /** New DuckDNS token (8-4-4-4-12 hex). '' removes the saved token. Omit to keep the saved one. */
  duckdnsToken?: string;
  publicPort?: number;
  upnp?: boolean;
  staging?: boolean;
  /**
   * The signed-in account's password (never stored). Missing: 400 VALIDATION
   * 'server.remote.passwordRequired'; wrong: 400 WRONG_PASSWORD with field 'password' (not 401,
   * so the session survives).
   */
  password: string;
}

/** The settings part of `RemoteSettingsUpdate` (what the Remote access form edits). */
export type RemoteSettingsPatch = Omit<RemoteSettingsUpdate, 'password'>;

/** The steps of turning remote access on, in the order they run. */
export type RemoteStepId = 'duckdns' | 'certificate' | 'listener' | 'upnp';
export type RemoteStepState = 'idle' | 'running' | 'ok' | 'error';

/** A localised message: catalogue key ('server.remote.*') + parameters, rendered in the UI language. */
export interface RemoteMessage {
  messageKey: string;
  params: Record<string, string | number>;
}

export interface RemoteStep extends RemoteMessage {
  id: RemoteStepId;
  state: RemoteStepState;
  /** ISO time of the last change of this step; null when it never ran. */
  at: string | null;
}

export interface RemoteCertificateInfo {
  /** ISO time the certificate expires. */
  validTo: string;
  /** Issuer common name / organisation (e.g. "R11" / "Let's Encrypt"). */
  issuer: string;
  /** Whole days until `validTo` (0 when expired). Renewal starts below 30. */
  daysLeft: number;
  /** True for a Let's Encrypt staging (test) certificate. */
  staging: boolean;
}

/** `GET /api/server/remote` (and the answer of PUT / renew). */
export interface RemoteStatus extends RemoteAccessSettings {
  /** Public IPv4 address last reported by DuckDNS (or the router); null when unknown. */
  publicIp: string | null;
  certificate: RemoteCertificateInfo | null;
  /** Always the four steps, in order: duckdns, certificate, listener, upnp. */
  steps: RemoteStep[];
  /** The most recent failure (also shown on its step); null when the last run succeeded. */
  lastError: RemoteMessage | null;
  /**
   * Addresses to open from anywhere: the https address of the DuckDNS name (with ':<publicPort>' when
   * it is not 443). Empty until HTTPS is listening.
   */
  urls: string[];
  /** Local port of the HTTPS listener (publicPort, or 8443 when that port could not be opened); null while not listening. */
  tlsPort: number | null;
  /** IPv4 addresses of this computer on the home network (for manual port-forwarding instructions). */
  lanIps: string[];
  /** ISO time of the next automatic retry after a failure; null when none is scheduled. */
  nextRetryAt: string | null;
  /** True while the steps are running (poll GET until false). */
  busy: boolean;
  /**
   * True when remote access has an owner - since the owner is the account created first on this
   * computer (fixed before anything is configured), always true in answers of this server version.
   * The status is only ever sent to the owner - every other account gets 403
   * 'server.remote.notOwner' - so for the reader it means "only you can see and change this".
   * (Older servers reported false before the first save.)
   */
  hasOwner: boolean;
}

export type RemoteCheckId = 'duckdns' | 'upnp' | 'dns' | 'https';
export type RemoteCheckState = 'ok' | 'warning' | 'error' | 'skipped';

export interface RemoteCheck extends RemoteMessage {
  id: RemoteCheckId;
  state: RemoteCheckState;
}

/** `POST /api/server/remote/test`: DuckDNS update + UPnP discovery + DNS lookup of the name. */
export interface RemoteTestResult {
  checks: RemoteCheck[];
  publicIp: string | null;
  /** ISO time of the test. */
  at: string;
}

export interface ServerInfo {
  version: string;
  /** Actual port the server listens on. */
  port: number;
  lanEnabled: boolean;
  /** Candidate URLs for the phone (only when lanEnabled). */
  lanUrls: string[];
  dataDir: string;
  /** True when the request arrived over the loopback interface. */
  isLocalRequest: boolean;
  startedAt: string;
  /** True while remote access is on and HTTPS is listening. Optional: absent in older servers. */
  remoteEnabled?: boolean;
  /** The remote https address ('' when off). Only reported to the computer itself and to HTTPS (remote) requests. */
  remoteUrl?: string;
  /** True when this request arrived over the HTTPS (remote access) listener. */
  secure?: boolean;
  /**
   * True when password reset by e-mail can work: the owner set up and enabled sending mail
   * (`PUT /api/server/mail`). While false, `POST /api/auth/forgot-password` answers 503
   * 'server.mail.notConfigured'. Optional: absent in older servers.
   */
  passwordResetAvailable?: boolean;
  /**
   * `'hosted'` on the public Your Personal Diary server (docs/HOSTED-PLAN.md); absent on the local
   * server of a computer or phone. A hosted server also reports the fields below.
   */
  mode?: 'hosted';
  /** The public address (origin) of a hosted server, the same for every caller. */
  publicUrl?: string;
  /** False while the hosted server's storage is failing writes (a banner: changes are not being saved). */
  storageOk?: boolean;
  /** Who may register on a hosted server: open to everyone, with an invite code, or nobody. */
  registration?: 'open' | 'invite' | 'closed';
  /** True when the hosted server offers the tour ("Skip - just look around": `POST /api/auth/guest`). */
  guestTour?: boolean;
  /**
   * Hosted only: true once `DIARY_OWNER_ID` names an account that exists on the server (computed on
   * every request). While false the server is in its bootstrap state - nobody owns the owner cards
   * yet - and the Settings "Account" card shows the account ID to every signed-in user, so the
   * would-be owner can read his id; afterwards only the owner sees it (`ServerSettings.isMailOwner`).
   * Absent on local servers and on older hosted servers (clients then show the row to the owner only).
   */
  ownerConfigured?: boolean;
  /**
   * 1 when the hosted server accepts offline sync (`GET /api/sync/key`, `POST /api/sync/op`;
   * `shared/sync.ts`). Clients create offline work only while it is present. Absent on local
   * servers, on older servers and while the kill switch `DIARY_OFFLINE_SYNC=0` is set (the routes
   * then still answer so that queued changes can drain).
   */
  offlineSync?: 1;
}

/**
 * `GET /api/health` of a hosted server (local servers answer `{ ok, version }` only). HTTP 200
 * while the process can serve reads; `/api/health/strict` answers 503 when `storage` is not ok or
 * `freePct` is below the configured floor - that path is for the external uptime monitor.
 */
export interface HealthStatus {
  ok: boolean;
  version: string;
  mode?: 'hosted';
  uptimeSec?: number;
  storage?: 'ok' | 'degraded';
  /** Free space of the data volume in whole percent; null when it could not be measured. */
  freePct?: number | null;
  /** Only in a 503 of `/api/health/strict`. */
  reason?: 'storage';
}

/**
 * `GET /api/server/status` - the owner's "Server" card on a hosted server (owner by
 * `DIARY_OWNER_ID`, over HTTPS only; 403 'server.owner.unset' while no owner is configured).
 */
export interface ServerStatus {
  version: string;
  mode: 'hosted';
  publicUrl: string;
  startedAt: string;
  uptimeSec: number;
  /** Registered accounts. */
  accounts: number;
  /** Hard ceiling of registrations (`DIARY_MAX_ACCOUNTS`). */
  maxAccounts: number;
  /** Registrations in the last 24 hours. */
  registrationsLast24h: number;
  registration: 'open' | 'invite' | 'closed';
  /** Per-account quota on the diary image in bytes (0 = none). */
  maxDiaryBytes: number;
  /** The data volume; null when it could not be measured. */
  disk: { totalBytes: number; freeBytes: number; freePct: number } | null;
  /** False after a diary write failed and none succeeded since. */
  storageOk: boolean;
  /** ISO time of the last successful diary write (null: none since start). */
  lastPersistAt: string | null;
  /** ISO time of the last failed diary write (null: none since start). */
  lastPersistErrorAt: string | null;
  /** Diaries currently open in memory and live sessions. */
  openVaults: number;
  liveSessions: number;
  /** Tour guests in memory right now, and the cap (`DIARY_MAX_GUESTS`; 0 = the tour is off). */
  guests: number;
  maxGuests: number;
  /** Resident memory of the server process in bytes. */
  rssBytes: number;
  /** ISO time of the newest server archive on the volume (null: there is none). */
  lastArchiveAt: string | null;
  /**
   * WP-H8 (docs/android-tasks/SERVER-CARD.md). True when `disk.freePct` is below
   * `SERVER_DISK_LOW_PCT` (15): the card shows a clear warning ("grow the volume"). False when the
   * disk could not be measured.
   */
  diskLow: boolean;
  /**
   * Bytes a server archive would hold right now (the data directory without archive/, incoming/,
   * logs, temporary files and device.key); null when it could not be measured. An archive needs
   * 1.2 x this much free space (`POST /api/server/archive` answers 507 'server.archive.noSpace' otherwise).
   */
  dataBytes: number | null;
  /**
   * True when there is no archive yet or the newest one is older than `SERVER_ARCHIVE_DUE_DAYS`
   * (30) days: the card reminds the owner to prepare and download one.
   */
  archiveDue: boolean;
  /** The archives on the volume, newest first (the server keeps at most 2). */
  archives: ServerArchiveInfo[];
  /** True while an archive is being written. */
  archiveBusy: boolean;
  /** Seconds until `POST /api/server/archive` is accepted again (one per 10 minutes); 0 = now. */
  archiveRetryAfterSec: number;
}

/** Below this much free space (percent of the volume) `ServerStatus.diskLow` is true. */
export const SERVER_DISK_LOW_PCT = 15;
/** An archive older than this many days makes `ServerStatus.archiveDue` true. */
export const SERVER_ARCHIVE_DUE_DAYS = 30;
/** Shortest passphrase `POST /api/server/archive` accepts (characters, after NFKC normalisation). */
export const SERVER_ARCHIVE_PASSPHRASE_MIN = 12;
/** Longest passphrase it accepts. */
export const SERVER_ARCHIVE_PASSPHRASE_MAX = 1024;

/**
 * One encrypted server archive on the hosted server's volume (`/data/archive/<fileName>`). It is
 * NEVER downloadable through the API: the owner fetches it with `downloadCommand` in his own
 * PowerShell (flyctl ssh sftp get) and checks it with `hashCommand`.
 */
export interface ServerArchiveInfo {
  /** `your-personal-diary-server-<UTC yyyy-mm-ddThh-mm-ssZ>.mpda` */
  fileName: string;
  /** Absolute path on the server, e.g. `/data/archive/<fileName>`. */
  path: string;
  sizeBytes: number;
  /** Lower-case hex SHA-256 of the whole file; null when its checksum file is missing. */
  sha256: string | null;
  /** ISO time the archive was written (UTC, from the file name). */
  createdAt: string;
  /**
   * For the owner's own PowerShell window, e.g.
   * `C:\Users\AVI\.fly\bin\flyctl.exe ssh sftp get /data/archive/<fileName> .\<fileName> -a yourpersonaldiary`
   */
  downloadCommand: string;
  /**
   * PowerShell line run after the download, in the same folder: prints `True` when the file's
   * SHA-256 equals `sha256` (`(Get-FileHash .\<fileName> -Algorithm SHA256).Hash -eq '<sha256>'`);
   * '' when `sha256` is null.
   */
  hashCommand: string;
}

/**
 * Body of `POST /api/server/archive` (owner over HTTPS only). `password` is the signed-in owner's
 * account password (checked like the Mail card: the confirmation lockout applies); `passphrase`
 * (12..1024 characters; the UI asks for it twice) is the key of the archive - it is needed to
 * restore and cannot be recovered. Neither is stored or logged.
 */
export interface ServerArchiveRequest {
  password: string;
  passphrase: string;
}

/** Answer (201) of `POST /api/server/archive`: the new archive plus what it holds. */
export interface ServerArchiveResult extends ServerArchiveInfo {
  /** Files inside the archive. */
  files: number;
  /** Their total size before encryption, in bytes. */
  dataBytes: number;
  /** Older archives deleted to keep at most 2 on the volume (file names). */
  removed: string[];
}

// ---------------------------------------------------------------------------
// Sending e-mail (password reset) - docs/API.md "שליחת דואר"
// ---------------------------------------------------------------------------

/** How the SMTP connection is secured: implicit TLS (port 465) or STARTTLS (port 587). Plain text is never used. */
export type MailSecurity = 'tls' | 'starttls';

/**
 * `GET /api/server/mail` (and the answer of PUT): the SMTP settings the app sends password-reset
 * e-mails with. Owner-only, like remote access (`ServerSettings.isMailOwner`). The SMTP password (a Gmail App Password) never
 * leaves the server: on disk it is encrypted with the device key, and the API only says whether
 * one is saved (`smtpPasswordSet`).
 */
export interface MailSettingsView {
  /** Password-reset e-mails are sent only while true. Default false. */
  enabled: boolean;
  /** SMTP server. Default 'smtp.gmail.com'. */
  host: string;
  /** Default 465 (implicit TLS); 587 with 'starttls'. */
  port: number;
  security: MailSecurity;
  /** SMTP user name - for Gmail the full Gmail address (e.g. 'yourpersonaldiary29@gmail.com'). '' until set. */
  username: string;
  /** True when an SMTP password (App Password) is saved on the server. */
  smtpPasswordSet: boolean;
  /** Sender address of the e-mails ('' = the username). The sender name is always "Your Personal Diary". */
  fromAddress: string;
  /** True when enabled and complete (host, username, password, sender) - i.e. reset e-mails can be sent. */
  ready: boolean;
  /**
   * True when the mail settings have an owner - the account created first on this computer, fixed
   * before anything is configured - so always true in answers of this server version (older servers
   * reported false before the first save). The view is only sent to the owner - every other account
   * gets 403 'server.mail.notOwner'.
   */
  hasOwner: boolean;
}

/**
 * Body of `PUT /api/server/mail`: only the given settings change. Every save - the first one
 * included - carries the signed-in account's password (`password`), exactly like
 * `PUT /api/server/remote`.
 */
export interface MailSettingsUpdate {
  enabled?: boolean;
  host?: string;
  port?: number;
  security?: MailSecurity;
  username?: string;
  /** New SMTP password (Gmail App Password; spaces are ignored for Gmail). '' removes the saved one. Omit to keep it. */
  smtpPassword?: string;
  fromAddress?: string;
  /**
   * The signed-in account's password (never stored). Missing: 400 VALIDATION
   * 'server.mail.passwordRequired'; wrong: 400 WRONG_PASSWORD with field 'password' (not 401).
   */
  password: string;
}

/** The settings part of `MailSettingsUpdate` (what the E-mail settings form edits). */
export type MailSettingsPatch = Omit<MailSettingsUpdate, 'password'>;

/** `POST /api/server/mail/test`: a test e-mail was accepted by the SMTP server for `sentTo` (the owner's own address). */
export interface MailTestResult {
  ok: true;
  sentTo: string;
  /** ISO time of the test. */
  at: string;
  /** Localised confirmation ('server.mail.testSent'). */
  message: string;
}

export interface DataDirInfo {
  dataDir: string;
  dbPath: string;
  dbExists: boolean;
  dbSizeBytes: number;
  /** Hebrew description of the encryption scheme. */
  encryptionSummary: string;
}

// ---------------------------------------------------------------------------
// Backup & export
// ---------------------------------------------------------------------------

export interface BackupRequest {
  /**
   * Absolute path chosen with the desktop "save" dialog. When omitted (phone/browser)
   * the server streams the file as a download instead of writing it.
   */
  destPath?: string;
  /** Password for the backup file. Omit to use the account password. */
  password?: string;
}

export interface BackupInfo {
  path: string | null;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
}

export interface InspectBackupRequest {
  /** Absolute path (desktop). */
  srcPath?: string;
  /** Browser/phone: the file content as Base64 (bodies are JSON, max 25MB). */
  fileBase64?: string;
  fileName?: string;
}

export interface RestoreRequest extends InspectBackupRequest {
  /** Password of the backup file. */
  password: string;
}

export interface RestoreInfo {
  entries: number;
  habits: number;
  restoredAt: string;
}

export interface BackupFileInfo {
  valid: boolean;
  version: number | null;
  sizeBytes: number;
  /** Hebrew description. */
  description: string;
}

export type ExportFormat = 'txt' | 'csv' | 'json' | 'pdf';

export interface ExportRequest {
  format: ExportFormat;
  /** Absolute path (desktop). Omit to download (phone/browser). */
  destPath?: string;
  from?: string;
  to?: string;
  includeHabits?: boolean;
}

export interface ExportResult {
  path: string | null;
  fileName: string;
  entriesExported: number;
  sizeBytes: number;
}

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

export interface DueReminder {
  habitId: number;
  habitName: string;
  reminderTime: string;
  /** Hebrew notification text. */
  message: string;
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

export interface SeedDemoRequest {
  /** Number of days back to generate (default 120). */
  days?: number;
}

export interface SeedDemoResult {
  entries: number;
  habits: number;
  habitLogs: number;
}
