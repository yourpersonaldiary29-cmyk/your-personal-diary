/**
 * Habit reminders as system notifications (WP-8), scheduled on the phone with
 * @capacitor/local-notifications so they fire while the app is closed.
 *
 * Plan: for every active habit with a reminder, one notification per day for the next
 * REMINDER_HORIZON_DAYS days at the habit's time - except today's when the habit was already logged
 * today (the same rule as the desktop's GET /api/habits/reminders/due: a reminder is for a habit
 * not yet done today, whatever its frequency). The plan is re-made ("sync") whenever something it
 * depends on changes: login / logout, the reminders setting, the language, the core's
 * `habits-changed` event, a habit logged or un-logged (mobile/host wraps the transport), the app
 * coming back to the foreground, a tapped notification, the unlock of a locked session, and the
 * phone's "show habit names" setting. Every successful sync replaces ALL pending notifications of
 * the app, so stale ones never survive; a sync that cannot read the habits because the session is
 * LOCKED (423 - the usual state when the app comes back with "lock when I leave the app" on)
 * keeps the plan: the reminders must go on firing while the app is closed and locked.
 * A phone that does not open the app for two weeks stops reminding until it is opened again - the
 * honest limit of one-shot notifications (the plugin's repeating schedules cannot skip a day).
 *
 * Android rules honoured here:
 *  - inexact alarms only: `isExactNotification: false` on every notification (the plugin would
 *    otherwise open the "Alarms & reminders" settings screen on Android 12+); the manifest removes
 *    SCHEDULE_EXACT_ALARM. A reminder may arrive a few minutes late - the settings card says so;
 *  - after a reboot the plugin's BOOT_COMPLETED receiver re-arms the pending notifications itself
 *    (LocalNotificationRestoreReceiver; RECEIVE_BOOT_COMPLETED stays in the manifest);
 *  - Android 13+: POST_NOTIFICATIONS is asked from the Reminders card (`requestPermission`), never
 *    at start-up; without it nothing is scheduled and the in-app polling of useReminders shows the
 *    reminders as toasts while the app is open;
 *  - privacy: the text is generic ("Time for one of your habits.") unless the user turned on "Show
 *    habit names in notifications"; the channel is public, so the generic text is readable on the
 *    lock screen and the named one only when the user chose it.
 *
 * iOS (`os: 'ios'`, docs/APPLE-PLAN.md WP-A2; checked against the plugin's own iOS source,
 * node_modules/@capacitor/local-notifications/ios/Sources/LocalNotificationsPlugin, 8.3.1) differs
 * in three places, each behind that one switch - the Android calls are exactly what they were:
 *  - no notification channels: `createChannel` is `call.unimplemented()` there and REJECTS, so it
 *    is not called at all (calling it would fail every sync before anything was scheduled);
 *  - at most 64 pending notifications per app - the system keeps the soonest ones and drops the
 *    rest without an error - so the plan is cut at IOS_MAX_SCHEDULED_REMINDERS (the nearest first,
 *    as always: many habits shorten the horizon instead of losing tomorrow's reminders);
 *  - the Android-only fields (channel, small icon, exact / idle flags) are left out of the
 *    notification: the iOS plugin never reads them, and it keeps the whole object it was given.
 * The permission flow needs no branch: `checkPermissions` answers 'prompt' until the user was
 * asked and `requestPermissions` shows the system alert - from the Reminders card, as on Android
 * (the plan is only scheduled once the answer is 'granted', so `schedule` never asks by itself).
 * There is no boot receiver on iOS and none is needed: pending requests survive a restart.
 */
import type { LocalNotificationSchema, LocalNotificationsPlugin, PendingLocalNotificationSchema } from '@capacitor/local-notifications';
import type { Habit, HabitWithProgress } from '@shared/types';
import type { ApiTransport } from '@/api/client';
import type { PhoneOs } from './os';

export type LocalNotificationsLike = Pick<
  LocalNotificationsPlugin,
  'schedule' | 'cancel' | 'getPending' | 'createChannel' | 'checkPermissions' | 'requestPermissions' | 'addListener'
>;

export const REMINDER_CHANNEL_ID = 'habit-reminders';
/** How many days ahead one-shot notifications are planned. */
export const REMINDER_HORIZON_DAYS = 14;
/** Upper bound of pending notifications (Android allows 500 alarms per app; stay well below). */
export const MAX_SCHEDULED_REMINDERS = 200;
/**
 * The same bound on iOS, where the system keeps only the 64 soonest pending notifications of an
 * app and silently discards the others; a few are left free so that a sync racing a delivery
 * never reaches the cap.
 */
export const IOS_MAX_SCHEDULED_REMINDERS = 60;
/** Notification id: habitId * ID_STRIDE + dayOffset (dayOffset < ID_STRIDE). */
export const ID_STRIDE = 100;
/** Name of the monochrome launcher drawable used as the status-bar icon (android/app/src/main/res/drawable). */
export const REMINDER_SMALL_ICON = 'ic_launcher_monochrome';
/** Debounce of event-driven re-syncs (a burst of habit edits becomes one sync). */
export const DEFAULT_RESYNC_DEBOUNCE_MS = 300;

export type NotificationPermission = 'granted' | 'denied' | 'prompt';

export interface ReminderTexts {
  title: string;
  genericBody: string;
  namedBody: (habitName: string) => string;
  channelName: string;
  channelDescription: string;
}

export interface ReminderPlan {
  id: number;
  habitId: number;
  at: Date;
  title: string;
  body: string;
}

export interface PlanInput {
  habits: readonly Habit[];
  /** Ids of the habits with a log for today (their reminder of today is skipped). */
  loggedToday: ReadonlySet<number>;
  now: Date;
  showNames: boolean;
  texts: Pick<ReminderTexts, 'title' | 'genericBody' | 'namedBody'>;
  horizonDays?: number;
  maxScheduled?: number;
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function reminderNotificationId(habitId: number, dayOffset: number): number {
  return habitId * ID_STRIDE + dayOffset;
}

/** Local date of `now` shifted by `dayOffset` days, at `hh:mm` (local time; DST handled by Date). */
export function reminderMoment(now: Date, dayOffset: number, reminderTime: string): Date | null {
  const match = HHMM.exec(reminderTime);
  if (!match) return null;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, Number(match[1]), Number(match[2]), 0, 0);
}

/** The notifications to schedule (pure; see the module comment for the rule). */
export function planReminders(input: PlanInput): ReminderPlan[] {
  const horizon = Math.max(1, Math.min(ID_STRIDE, input.horizonDays ?? REMINDER_HORIZON_DAYS));
  const limit = Math.max(0, input.maxScheduled ?? MAX_SCHEDULED_REMINDERS);
  const plans: ReminderPlan[] = [];
  for (const habit of input.habits) {
    if (habit.isArchived || !habit.reminderEnabled || !habit.reminderTime) continue;
    const body = input.showNames ? input.texts.namedBody(habit.name) : input.texts.genericBody;
    for (let dayOffset = 0; dayOffset < horizon; dayOffset++) {
      const at = reminderMoment(input.now, dayOffset, habit.reminderTime);
      if (!at) break;
      if (at.getTime() <= input.now.getTime()) continue;
      if (dayOffset === 0 && input.loggedToday.has(habit.id)) continue;
      plans.push({ id: reminderNotificationId(habit.id, dayOffset), habitId: habit.id, at, title: input.texts.title, body });
    }
  }
  // The nearest ones matter most: when there are too many, the farthest days are dropped.
  plans.sort((a, b) => a.at.getTime() - b.at.getTime() || a.id - b.id);
  return plans.slice(0, limit);
}

/** How many pending notifications the phone may hold (see the two constants). */
export function maxScheduledReminders(os?: PhoneOs): number {
  return os === 'ios' ? IOS_MAX_SCHEDULED_REMINDERS : MAX_SCHEDULED_REMINDERS;
}

/** The plugin's shape of one planned reminder (Android's by default; iOS without the Android-only fields). */
export function toLocalNotification(plan: ReminderPlan, os?: PhoneOs): LocalNotificationSchema {
  if (os === 'ios') {
    return { id: plan.id, title: plan.title, body: plan.body, schedule: { at: plan.at }, extra: { habitId: plan.habitId } };
  }
  return {
    id: plan.id,
    title: plan.title,
    body: plan.body,
    schedule: { at: plan.at, allowWhileIdle: true },
    channelId: REMINDER_CHANNEL_ID,
    smallIcon: REMINDER_SMALL_ICON,
    extra: { habitId: plan.habitId },
    isExactNotification: false,
  };
}

/** The plugin's permission state as the three answers the UI knows. */
export function toNotificationPermission(state: string): NotificationPermission {
  if (state === 'granted') return 'granted';
  if (state === 'denied') return 'denied';
  return 'prompt';
}

/** Ids of the habits whose progress for today shows a log. */
export function loggedTodayOf(progress: readonly HabitWithProgress[]): Set<number> {
  const logged = new Set<number>();
  for (const item of progress) if (item.today) logged.add(item.habit.id);
  return logged;
}

export interface SyncOptions {
  /** The account's "Habit reminders" setting together with "a session exists". */
  enabled: boolean;
  /** The phone's "Show habit names in notifications" setting. */
  showNames: boolean;
}

export interface SyncResult {
  /** Pending notifications after this sync ('kept': the ones of the previous plan). */
  scheduled: number;
  reason: 'scheduled' | 'disabled' | 'no-permission' | 'kept' | 'failed';
}

export interface ReminderSchedulerDeps {
  plugin: LocalNotificationsLike;
  /** The active habits of the signed-in account (rejects without a session, and while it is locked). */
  loadHabits: () => Promise<Habit[]>;
  /** Today's progress (which habits were logged today). */
  loadProgress: () => Promise<HabitWithProgress[]>;
  /**
   * Whether a load failure means "there is no session any more" (a 401): only then is the plan
   * cancelled. Every other failure - the session is LOCKED (423: the app was left with "lock when
   * I leave the app" on, or the auto-lock fired), the core busy - keeps the plan made while the
   * diary was unlocked: it is still right, and the next successful sync replaces it. Without this
   * no failure cancels anything.
   */
  isSessionGone?: (error: unknown) => boolean;
  /** The texts in the current language (read at every sync: the language may have changed). */
  texts: () => ReminderTexts;
  /** What happens when the user taps a notification (default: nothing; the host navigates). */
  onTap?: (habitId: number | null) => void;
  now?: () => Date;
  horizonDays?: number;
  resyncDebounceMs?: number;
  log?: (message: string, error?: unknown) => void;
  /** The phone (mobile/platform/os.ts); default Android. iOS: no channel, 60 pending at most (module comment). */
  os?: PhoneOs;
}

export interface ReminderScheduler {
  /** Re-plans everything with these options; runs are serialised. */
  sync(options: SyncOptions): Promise<SyncResult>;
  /** Re-plans with the last options (debounced); nothing happens before the first `sync`. */
  resync(): void;
  /** Cancels every pending notification of the app. */
  cancelAll(): Promise<void>;
  permission(): Promise<NotificationPermission>;
  /** Asks the system (Android 13+ shows the dialog); resolves with the new state. */
  requestPermission(): Promise<NotificationPermission>;
  /** Starts listening for taps; returns the function that stops. */
  start(): () => void;
}

export function createReminderScheduler(deps: ReminderSchedulerDeps): ReminderScheduler {
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? ((message: string, error?: unknown) => console.warn(`[mobile] reminders: ${message}`, error ?? ''));
  const debounceMs = deps.resyncDebounceMs ?? DEFAULT_RESYNC_DEBOUNCE_MS;
  let chain: Promise<unknown> = Promise.resolve();
  let lastOptions: SyncOptions | null = null;
  let resyncTimer: ReturnType<typeof setTimeout> | null = null;

  async function pendingIds(): Promise<number[]> {
    const { notifications } = await deps.plugin.getPending();
    return (notifications as PendingLocalNotificationSchema[]).map((n) => n.id);
  }

  async function cancelAll(): Promise<void> {
    const ids = await pendingIds();
    if (ids.length === 0) return;
    await deps.plugin.cancel({ notifications: ids.map((id) => ({ id })) });
  }

  async function ensureChannel(): Promise<void> {
    const texts = deps.texts();
    // createChannel is idempotent; the name and description follow the current language.
    await deps.plugin.createChannel({
      id: REMINDER_CHANNEL_ID,
      name: texts.channelName,
      description: texts.channelDescription,
      importance: 4,
      visibility: 1,
      vibration: true,
    });
  }

  async function run(options: SyncOptions): Promise<SyncResult> {
    try {
      if (!options.enabled) {
        await cancelAll();
        return { scheduled: 0, reason: 'disabled' };
      }
      const permission = toNotificationPermission((await deps.plugin.checkPermissions()).display);
      if (permission !== 'granted') {
        await cancelAll();
        return { scheduled: 0, reason: 'no-permission' };
      }
      let habits: Habit[];
      let progress: HabitWithProgress[];
      try {
        [habits, progress] = await Promise.all([deps.loadHabits(), deps.loadProgress()]);
      } catch (e) {
        if (deps.isSessionGone?.(e)) {
          // No session any more: nothing to plan from, and nothing stale may stay.
          log('no session - pending reminders cancelled', e);
          await cancelAll();
          return { scheduled: 0, reason: 'failed' };
        }
        // Locked (423), the core busy...: the plan made while the diary was unlocked stays. The
        // app re-plans after the unlock (useReminders follows the lock state).
        const kept = (await pendingIds()).length;
        log(`the habits could not be loaded - the ${kept} pending reminders are kept`, e);
        return { scheduled: kept, reason: 'kept' };
      }
      const plans = planReminders({
        habits,
        loggedToday: loggedTodayOf(progress),
        now: now(),
        showNames: options.showNames,
        texts: deps.texts(),
        horizonDays: deps.horizonDays,
        maxScheduled: maxScheduledReminders(deps.os),
      });
      // iOS has no notification channels (the plugin rejects the call there).
      if (deps.os !== 'ios') await ensureChannel();
      await cancelAll();
      if (plans.length > 0) await deps.plugin.schedule({ notifications: plans.map((plan) => toLocalNotification(plan, deps.os)) });
      return { scheduled: plans.length, reason: 'scheduled' };
    } catch (e) {
      log('sync failed', e);
      return { scheduled: 0, reason: 'failed' };
    }
  }

  function sync(options: SyncOptions): Promise<SyncResult> {
    lastOptions = options;
    const next = chain.then(() => run(options));
    chain = next.catch(() => undefined);
    return next;
  }

  function resync(): void {
    if (!lastOptions) return;
    if (resyncTimer !== null) clearTimeout(resyncTimer);
    resyncTimer = setTimeout(() => {
      resyncTimer = null;
      if (lastOptions) void sync(lastOptions);
    }, debounceMs);
  }

  return {
    sync,
    resync,
    cancelAll,
    async permission() {
      return toNotificationPermission((await deps.plugin.checkPermissions()).display);
    },
    async requestPermission() {
      const state = toNotificationPermission((await deps.plugin.requestPermissions()).display);
      if (state === 'granted') resync();
      return state;
    },
    start() {
      const handle = deps.plugin.addListener('localNotificationActionPerformed', (action) => {
        const extra = (action.notification?.extra ?? null) as { habitId?: unknown } | null;
        const habitId = typeof extra?.habitId === 'number' ? extra.habitId : null;
        deps.onTap?.(habitId);
        // The tapped one is gone from the shade; the plan is refreshed (today's may now be done).
        resync();
      });
      return () => {
        if (resyncTimer !== null) clearTimeout(resyncTimer);
        resyncTimer = null;
        void handle.then((h) => h.remove()).catch(() => undefined);
      };
    },
  };
}

/** The API calls that log or un-log a habit: PUT /api/habits/logs, DELETE /api/habits/:id/logs/:date. */
const HABIT_LOG_CALL = /^\/api\/habits\/(?:logs$|\d+\/logs\/)/;

/**
 * Wraps the API transport so that every successful call that logged or un-logged a habit triggers
 * `onLogged` (the scheduler then drops today's reminder of a habit done today, or brings it back).
 * The narrower observer; `observeHabitChanges` below is what the platform installs.
 */
export function observeHabitLogs(transport: ApiTransport, onLogged: () => void): ApiTransport {
  return async (url, init) => {
    const response = await transport(url, init);
    const method = (init.method ?? 'GET').toUpperCase();
    if ((method === 'PUT' || method === 'DELETE') && response.ok) {
      const path = new URL(url, 'http://localhost').pathname;
      if (HABIT_LOG_CALL.test(path)) onLogged();
    }
    return response;
  };
}

/** Methods that change nothing. */
const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

/** The offline mode's replay route (server/src/routes/sync.ts, hosted only). */
const SYNC_OP_PATH = '/api/sync/op';

/**
 * True for a request after which the reminders must be planned again: a successful (2xx)
 * non-read request on the habits (create, edit, archive, delete, log, un-log), a restore, the demo
 * seed, or saved diary settings (the reminder preferences live there). The same rule as the core's
 * `habits-changed` event (mobile/core/boot.ts `changesHabits`), so that the server-mode app - whose
 * server posts no events - re-plans exactly when the local-core app does.
 *
 * Plus, for the automatic offline mode (docs/android-tasks/OFFLINE-DESIGN.md E13 and section 7): a
 * successful `POST /api/sync/op` - the replay of a change written without a connection, which may be
 * a habit create / edit / archive, a log or a settings patch. The operation itself is encrypted in
 * the outbox, so every acknowledged one re-plans; the scheduler's debounce folds a whole replay into
 * one sync. Only the hosted server has this route (the local core never answers it).
 */
export function changesHabits(method: string, path: string, status: number): boolean {
  if (status < 200 || status >= 300 || SAFE_METHODS.has(method.toUpperCase())) return false;
  const clean = path.split('?')[0].replace(/\/+$/, '');
  if (clean.startsWith('/api/habits')) return true;
  if (clean === SYNC_OP_PATH) return method.toUpperCase() === 'POST';
  return clean === '/api/backup/restore' || clean === '/api/settings/seed-demo' || clean === '/api/settings';
}

/**
 * Wraps the API transport so that every answer that `changesHabits` triggers `onChanged` (the
 * scheduler's debounced re-sync). A transport failure passes through untouched: nothing changed.
 */
export function observeHabitChanges(transport: ApiTransport, onChanged: () => void): ApiTransport {
  return async (url, init) => {
    const response = await transport(url, init);
    if (changesHabits(init.method ?? 'GET', new URL(url, 'http://localhost').pathname, response.status)) onChanged();
    return response;
  };
}
