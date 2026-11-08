/**
 * Habit reminders as system notifications (WP-8): the plan, the scheduler against a fake plugin,
 * the permission flow and the transport watcher for habit logs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalNotificationSchema } from '@capacitor/local-notifications';
import type { Habit, HabitWithProgress } from '@shared/types';
import type { ApiTransport } from '@/api/client';
import {
  changesHabits,
  createReminderScheduler,
  ID_STRIDE,
  IOS_MAX_SCHEDULED_REMINDERS,
  loggedTodayOf,
  MAX_SCHEDULED_REMINDERS,
  maxScheduledReminders,
  observeHabitChanges,
  observeHabitLogs,
  planReminders,
  REMINDER_CHANNEL_ID,
  REMINDER_HORIZON_DAYS,
  reminderMoment,
  reminderNotificationId,
  toLocalNotification,
  toNotificationPermission,
  type LocalNotificationsLike,
  type ReminderTexts,
} from './notifications';

function habit(id: number, overrides: Partial<Habit> = {}): Habit {
  return {
    id,
    name: `Habit ${id}`,
    description: '',
    target: 1,
    unit: 'x',
    frequency: 'daily',
    reminderTime: '08:30',
    reminderEnabled: true,
    isArchived: false,
    sortOrder: id,
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function progress(h: Habit, loggedToday: boolean): HabitWithProgress {
  return {
    habit: h,
    today: loggedToday ? { id: 1, habitId: h.id, date: '2026-10-17', value: 1, completed: true, note: '' } : null,
    currentStreak: 0,
    bestStreak: 0,
    weekTotal: 0,
    completedLast30: 0,
    completionRate30: 0,
    targetMet: loggedToday,
  };
}

const texts: ReminderTexts = {
  title: 'Reminder',
  genericBody: 'Time for one of your habits.',
  namedBody: (name) => `Time for: ${name}`,
  channelName: 'Habit reminders',
  channelDescription: 'desc',
};

/** Friday 2026-10-17, 07:00 local time. */
const NOW = new Date(2026, 9, 17, 7, 0, 0, 0);

describe('planReminders', () => {
  it('plans one notification per habit and day over the horizon, from the next occurrence on', () => {
    const plans = planReminders({ habits: [habit(1)], loggedToday: new Set(), now: NOW, showNames: false, texts });
    expect(plans).toHaveLength(REMINDER_HORIZON_DAYS);
    expect(plans[0].at).toEqual(new Date(2026, 9, 17, 8, 30));
    expect(plans[1].at).toEqual(new Date(2026, 9, 18, 8, 30));
    expect(plans[0].id).toBe(reminderNotificationId(1, 0));
    expect(plans[1].id).toBe(1 * ID_STRIDE + 1);
    expect(plans.every((p) => p.body === texts.genericBody && p.title === 'Reminder')).toBe(true);
  });

  it("skips today's reminder when its time has passed and when the habit was logged today", () => {
    const late = new Date(2026, 9, 17, 9, 0);
    const passed = planReminders({ habits: [habit(1)], loggedToday: new Set(), now: late, showNames: false, texts });
    expect(passed[0].at).toEqual(new Date(2026, 9, 18, 8, 30));
    expect(passed).toHaveLength(REMINDER_HORIZON_DAYS - 1);

    const logged = planReminders({ habits: [habit(1)], loggedToday: new Set([1]), now: NOW, showNames: false, texts });
    expect(logged[0].at).toEqual(new Date(2026, 9, 18, 8, 30));
    expect(logged).toHaveLength(REMINDER_HORIZON_DAYS - 1);
  });

  it('ignores archived habits, habits without a reminder and invalid times; weekly habits remind like daily ones', () => {
    const habits = [
      habit(1, { isArchived: true }),
      habit(2, { reminderEnabled: false }),
      habit(3, { reminderTime: null }),
      habit(4, { reminderTime: '25:99' }),
      habit(5, { frequency: 'weekly', reminderTime: '21:15' }),
    ];
    const plans = planReminders({ habits, loggedToday: new Set(), now: NOW, showNames: false, texts });
    expect(new Set(plans.map((p) => p.habitId))).toEqual(new Set([5]));
    expect(plans[0].at).toEqual(new Date(2026, 9, 17, 21, 15));
  });

  it('names the habit only when "show habit names" is on', () => {
    const named = planReminders({ habits: [habit(7, { name: 'Water' })], loggedToday: new Set(), now: NOW, showNames: true, texts });
    expect(named[0].body).toBe('Time for: Water');
  });

  it('keeps the nearest notifications when there are too many', () => {
    const many = Array.from({ length: 30 }, (_, i) => habit(i + 1));
    const plans = planReminders({ habits: many, loggedToday: new Set(), now: NOW, showNames: false, texts });
    expect(plans).toHaveLength(MAX_SCHEDULED_REMINDERS);
    const times = plans.map((p) => p.at.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    // 30 habits x 14 days = 420 > 200: the first days are complete, the far ones dropped.
    expect(plans.filter((p) => p.at.getDate() === 17)).toHaveLength(30);
  });

  it('reminderMoment handles local dates and rejects bad times', () => {
    expect(reminderMoment(NOW, 0, '08:30')).toEqual(new Date(2026, 9, 17, 8, 30));
    expect(reminderMoment(new Date(2026, 9, 31, 7, 0), 1, '00:05')).toEqual(new Date(2026, 10, 1, 0, 5));
    expect(reminderMoment(NOW, 0, '8:30')).toBeNull();
  });

  it('toLocalNotification asks for inexact alarms, the reminder channel and the habit in `extra`', () => {
    const [plan] = planReminders({ habits: [habit(3)], loggedToday: new Set(), now: NOW, showNames: false, texts });
    const schema = toLocalNotification(plan);
    expect(schema).toMatchObject({ id: 300, channelId: REMINDER_CHANNEL_ID, isExactNotification: false, extra: { habitId: 3 } });
    expect(schema.schedule?.at).toEqual(plan.at);
    expect(schema.schedule?.allowWhileIdle).toBe(true);
  });

  it('helpers: permission mapping and logged-today set', () => {
    expect(toNotificationPermission('granted')).toBe('granted');
    expect(toNotificationPermission('denied')).toBe('denied');
    expect(toNotificationPermission('prompt')).toBe('prompt');
    expect(toNotificationPermission('prompt-with-rationale')).toBe('prompt');
    expect(loggedTodayOf([progress(habit(1), true), progress(habit(2), false)])).toEqual(new Set([1]));
  });
});

/** A fake @capacitor/local-notifications that keeps the pending list. */
function fakePlugin(permission: 'granted' | 'denied' | 'prompt' = 'granted') {
  const pending = new Map<number, unknown>();
  const channels: unknown[] = [];
  let listener: ((action: { actionId: string; notification: { extra?: unknown } }) => void) | null = null;
  const plugin: LocalNotificationsLike & { pending: typeof pending; channels: typeof channels; tap(extra: unknown): void; state: string } = {
    pending,
    channels,
    state: permission,
    tap(extra) {
      listener?.({ actionId: 'tap', notification: { extra } });
    },
    schedule: vi.fn(async ({ notifications }: { notifications: LocalNotificationSchema[] }) => {
      for (const n of notifications) pending.set(n.id, n);
      return { notifications: notifications.map((n) => ({ id: n.id })) };
    }),
    cancel: vi.fn(async ({ notifications }: { notifications: { id: number }[] }) => {
      for (const n of notifications) pending.delete(n.id);
    }),
    getPending: vi.fn(async () => ({ notifications: [...pending.values()] as never })),
    createChannel: vi.fn(async (channel) => {
      channels.push(channel);
    }),
    checkPermissions: vi.fn(async () => ({ display: plugin.state as never })),
    requestPermissions: vi.fn(async () => {
      if (plugin.state === 'prompt') plugin.state = 'granted';
      return { display: plugin.state as never };
    }),
    addListener: vi.fn(async (_name: string, fn: never) => {
      listener = fn;
      return { remove: async () => undefined };
    }) as never,
  };
  return plugin;
}

describe('createReminderScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function scheduler(plugin: ReturnType<typeof fakePlugin>, habits: Habit[], logged: number[] = []) {
    const loadHabits = vi.fn(async () => habits);
    const loadProgress = vi.fn(async () => habits.map((h) => progress(h, logged.includes(h.id))));
    const onTap = vi.fn();
    const s = createReminderScheduler({ plugin, loadHabits, loadProgress, texts: () => texts, onTap, resyncDebounceMs: 0, log: () => undefined });
    return { s, loadHabits, loadProgress, onTap };
  }

  it('schedules the plan, creates the channel and replaces everything on the next sync', async () => {
    const plugin = fakePlugin();
    const { s } = scheduler(plugin, [habit(1), habit(2)]);
    const first = await s.sync({ enabled: true, showNames: false });
    expect(first).toEqual({ scheduled: 2 * REMINDER_HORIZON_DAYS, reason: 'scheduled' });
    expect(plugin.pending.size).toBe(2 * REMINDER_HORIZON_DAYS);
    expect(plugin.channels[0]).toMatchObject({ id: REMINDER_CHANNEL_ID, name: 'Habit reminders', importance: 4 });

    // The second sync (habit 2 gone) leaves none of habit 2's notifications behind.
    const { s: again } = scheduler(plugin, [habit(1)]);
    await again.sync({ enabled: true, showNames: false });
    expect([...plugin.pending.keys()].every((id) => Math.floor(id / ID_STRIDE) === 1)).toBe(true);
    expect(plugin.pending.size).toBe(REMINDER_HORIZON_DAYS);
  });

  it('cancels everything when reminders are disabled or the permission is missing', async () => {
    const plugin = fakePlugin();
    const { s } = scheduler(plugin, [habit(1)]);
    await s.sync({ enabled: true, showNames: false });
    expect(plugin.pending.size).toBeGreaterThan(0);

    expect(await s.sync({ enabled: false, showNames: false })).toEqual({ scheduled: 0, reason: 'disabled' });
    expect(plugin.pending.size).toBe(0);

    await s.sync({ enabled: true, showNames: false });
    plugin.state = 'denied';
    expect(await s.sync({ enabled: true, showNames: false })).toEqual({ scheduled: 0, reason: 'no-permission' });
    expect(plugin.pending.size).toBe(0);
  });

  /** A failing loader with the shape of the API client's error (status) and the host's 401 test. */
  function failingScheduler(plugin: ReturnType<typeof fakePlugin>, status: number) {
    return createReminderScheduler({
      plugin,
      loadHabits: async () => {
        throw Object.assign(new Error(String(status)), { status });
      },
      loadProgress: async () => [],
      texts: () => texts,
      isSessionGone: (e) => (e as { status?: number }).status === 401,
      resyncDebounceMs: 0,
      log: () => undefined,
    });
  }

  it('keeps the plan when the session is LOCKED (423): the app comes back locked with "lock when I leave" on', async () => {
    const plugin = fakePlugin();
    const { s } = scheduler(plugin, [habit(1), habit(2)]);
    await s.sync({ enabled: true, showNames: false });
    const before = [...plugin.pending.keys()];
    expect(before.length).toBe(2 * REMINDER_HORIZON_DAYS);
    vi.mocked(plugin.cancel).mockClear();

    const locked = failingScheduler(plugin, 423);
    expect(await locked.sync({ enabled: true, showNames: false })).toEqual({ scheduled: before.length, reason: 'kept' });
    expect([...plugin.pending.keys()]).toEqual(before);
    expect(plugin.cancel).not.toHaveBeenCalled();
    // Resumes while locked (resync) keep it too.
    locked.resync();
    await vi.advanceTimersByTimeAsync(1);
    expect(plugin.pending.size).toBe(before.length);
  });

  it('keeps the plan on any other load failure (the core busy) - and without isSessionGone always', async () => {
    const plugin = fakePlugin();
    const { s } = scheduler(plugin, [habit(1)]);
    await s.sync({ enabled: true, showNames: false });
    expect(await failingScheduler(plugin, 503).sync({ enabled: true, showNames: false })).toMatchObject({ reason: 'kept' });
    expect(plugin.pending.size).toBe(REMINDER_HORIZON_DAYS);

    const noTest = createReminderScheduler({
      plugin,
      loadHabits: async () => {
        throw new Error('401');
      },
      loadProgress: async () => [],
      texts: () => texts,
      log: () => undefined,
    });
    expect(await noTest.sync({ enabled: true, showNames: false })).toMatchObject({ reason: 'kept' });
    expect(plugin.pending.size).toBe(REMINDER_HORIZON_DAYS);
  });

  it('cancels the stale plan only when the session is gone (401)', async () => {
    const plugin = fakePlugin();
    const { s } = scheduler(plugin, [habit(1)]);
    await s.sync({ enabled: true, showNames: false });
    expect(await failingScheduler(plugin, 401).sync({ enabled: true, showNames: false })).toEqual({ scheduled: 0, reason: 'failed' });
    expect(plugin.pending.size).toBe(0);
  });

  it("drops today's notification of a habit logged today on resync, and brings it back when un-logged", async () => {
    const plugin = fakePlugin();
    const habits = [habit(1)];
    const logged: number[] = [];
    const loadProgress = vi.fn(async () => habits.map((h) => progress(h, logged.includes(h.id))));
    const s = createReminderScheduler({ plugin, loadHabits: async () => habits, loadProgress, texts: () => texts, resyncDebounceMs: 0, log: () => undefined });
    await s.sync({ enabled: true, showNames: false });
    expect(plugin.pending.has(reminderNotificationId(1, 0))).toBe(true);

    logged.push(1);
    s.resync();
    await vi.advanceTimersByTimeAsync(1);
    expect(plugin.pending.has(reminderNotificationId(1, 0))).toBe(false);
    expect(plugin.pending.has(reminderNotificationId(1, 1))).toBe(true);

    logged.length = 0;
    s.resync();
    await vi.advanceTimersByTimeAsync(1);
    expect(plugin.pending.has(reminderNotificationId(1, 0))).toBe(true);
  });

  it('resync before the first sync does nothing; bursts are coalesced', async () => {
    const plugin = fakePlugin();
    const { s, loadHabits } = scheduler(plugin, [habit(1)]);
    s.resync();
    await vi.advanceTimersByTimeAsync(10);
    expect(loadHabits).not.toHaveBeenCalled();

    const debounced = createReminderScheduler({ plugin, loadHabits, loadProgress: async () => [], texts: () => texts, resyncDebounceMs: 50, log: () => undefined });
    await debounced.sync({ enabled: true, showNames: false });
    loadHabits.mockClear();
    debounced.resync();
    debounced.resync();
    debounced.resync();
    await vi.advanceTimersByTimeAsync(60);
    expect(loadHabits).toHaveBeenCalledTimes(1);
  });

  it('serialises syncs: the last options win', async () => {
    const plugin = fakePlugin();
    const { s } = scheduler(plugin, [habit(1)]);
    const a = s.sync({ enabled: true, showNames: false });
    const b = s.sync({ enabled: false, showNames: false });
    await Promise.all([a, b]);
    expect(plugin.pending.size).toBe(0);
  });

  it('permission: reports the state and re-plans once granted', async () => {
    const plugin = fakePlugin('prompt');
    const { s } = scheduler(plugin, [habit(1)]);
    expect(await s.permission()).toBe('prompt');
    expect(await s.sync({ enabled: true, showNames: false })).toMatchObject({ reason: 'no-permission' });
    expect(await s.requestPermission()).toBe('granted');
    await vi.advanceTimersByTimeAsync(1);
    expect(plugin.pending.size).toBe(REMINDER_HORIZON_DAYS);
  });

  it('a tapped notification calls onTap with the habit and re-plans', async () => {
    const plugin = fakePlugin();
    const { s, onTap, loadHabits } = scheduler(plugin, [habit(4)]);
    const stop = s.start();
    await s.sync({ enabled: true, showNames: false });
    loadHabits.mockClear();
    plugin.tap({ habitId: 4 });
    expect(onTap).toHaveBeenCalledWith(4);
    await vi.advanceTimersByTimeAsync(1);
    expect(loadHabits).toHaveBeenCalledTimes(1);
    plugin.tap(undefined);
    expect(onTap).toHaveBeenLastCalledWith(null);
    stop();
  });
});

/**
 * iOS (docs/APPLE-PLAN.md WP-A2): the plugin has no notification channels there - `createChannel`
 * is unimplemented and rejects - and the system keeps 64 pending notifications at most.
 */
describe('reminders on iOS (os: "ios")', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** The fake plugin with iOS's `createChannel`: `call.unimplemented()` rejects the promise. */
  function iosPlugin(permission: 'granted' | 'denied' | 'prompt' = 'granted') {
    const plugin = fakePlugin(permission);
    vi.mocked(plugin.createChannel).mockImplementation(async () => {
      throw Object.assign(new Error('not implemented'), { code: 'UNIMPLEMENTED' });
    });
    return plugin;
  }

  function iosScheduler(plugin: ReturnType<typeof fakePlugin>, habits: Habit[]) {
    return createReminderScheduler({
      plugin,
      loadHabits: async () => habits,
      loadProgress: async () => habits.map((h) => progress(h, false)),
      texts: () => texts,
      resyncDebounceMs: 0,
      log: () => undefined,
      os: 'ios',
    });
  }

  it('the bound is 60 on iOS and 200 everywhere else', () => {
    expect(IOS_MAX_SCHEDULED_REMINDERS).toBe(60);
    expect(IOS_MAX_SCHEDULED_REMINDERS).toBeLessThan(64);
    expect(maxScheduledReminders('ios')).toBe(IOS_MAX_SCHEDULED_REMINDERS);
    expect(maxScheduledReminders('android')).toBe(MAX_SCHEDULED_REMINDERS);
    expect(maxScheduledReminders()).toBe(MAX_SCHEDULED_REMINDERS);
  });

  it('toLocalNotification leaves the Android-only fields out: id, texts, the moment and the habit only', () => {
    const [plan] = planReminders({ habits: [habit(3)], loggedToday: new Set(), now: NOW, showNames: false, texts });
    expect(toLocalNotification(plan, 'ios')).toEqual({ id: 300, title: 'Reminder', body: texts.genericBody, schedule: { at: plan.at }, extra: { habitId: 3 } });
    // Android (and no `os` at all) is what it was.
    expect(toLocalNotification(plan, 'android')).toEqual(toLocalNotification(plan));
    expect(toLocalNotification(plan)).toMatchObject({ channelId: REMINDER_CHANNEL_ID, isExactNotification: false });
  });

  it('schedules without ever creating a channel - the call that rejects on iOS', async () => {
    const plugin = iosPlugin();
    expect(await iosScheduler(plugin, [habit(1), habit(2)]).sync({ enabled: true, showNames: false })).toEqual({ scheduled: 2 * REMINDER_HORIZON_DAYS, reason: 'scheduled' });
    expect(plugin.createChannel).not.toHaveBeenCalled();
    expect(plugin.pending.size).toBe(2 * REMINDER_HORIZON_DAYS);
    for (const scheduled of plugin.pending.values()) {
      expect(Object.keys(scheduled as object).sort()).toEqual(['body', 'extra', 'id', 'schedule', 'title']);
      expect(Object.keys((scheduled as LocalNotificationSchema).schedule ?? {})).toEqual(['at']);
    }
  });

  it('why the switch exists: the Android sequence against such a plugin schedules nothing', async () => {
    const plugin = iosPlugin();
    const android = createReminderScheduler({
      plugin,
      loadHabits: async () => [habit(1)],
      loadProgress: async () => [],
      texts: () => texts,
      resyncDebounceMs: 0,
      log: () => undefined,
    });
    expect(await android.sync({ enabled: true, showNames: false })).toEqual({ scheduled: 0, reason: 'failed' });
    expect(plugin.pending.size).toBe(0);
  });

  it('never holds more than 60 pending: the nearest days are complete, the far ones dropped', async () => {
    const plugin = iosPlugin();
    const many = Array.from({ length: 30 }, (_, i) => habit(i + 1));
    expect(await iosScheduler(plugin, many).sync({ enabled: true, showNames: false })).toEqual({ scheduled: IOS_MAX_SCHEDULED_REMINDERS, reason: 'scheduled' });
    expect(plugin.pending.size).toBe(IOS_MAX_SCHEDULED_REMINDERS);
    const moments = [...plugin.pending.values()].map((n) => ((n as LocalNotificationSchema).schedule?.at as Date).getTime());
    // 30 habits a day: today's 30 and tomorrow's 30, nothing later.
    expect(moments.filter((t) => new Date(t).getDate() === 17)).toHaveLength(30);
    expect(moments.filter((t) => new Date(t).getDate() === 18)).toHaveLength(30);

    // Four habits fit the whole two-week horizon (4 x 14 = 56 <= 60).
    const few = iosPlugin();
    expect(await iosScheduler(few, many.slice(0, 4)).sync({ enabled: true, showNames: false })).toMatchObject({ scheduled: 4 * REMINDER_HORIZON_DAYS });
  });

  it('the permission flow is the same: nothing is scheduled before the user said yes', async () => {
    const plugin = iosPlugin('prompt');
    const s = iosScheduler(plugin, [habit(1)]);
    expect(await s.sync({ enabled: true, showNames: false })).toMatchObject({ reason: 'no-permission' });
    expect(plugin.schedule).not.toHaveBeenCalled();
    expect(await s.requestPermission()).toBe('granted');
    await vi.advanceTimersByTimeAsync(1);
    expect(plugin.pending.size).toBe(REMINDER_HORIZON_DAYS);
    expect(plugin.createChannel).not.toHaveBeenCalled();
  });
});

describe('observeHabitLogs', () => {
  function transport(status = 200): ApiTransport {
    return async () => new Response(null, { status });
  }

  it('fires for a successful habit log and un-log, not for other calls or failures', async () => {
    const onLogged = vi.fn();
    const wrapped = observeHabitLogs(transport(), onLogged);
    await wrapped('/api/habits/logs', { method: 'PUT' });
    await wrapped('/api/habits/12/logs/2026-10-17', { method: 'DELETE' });
    expect(onLogged).toHaveBeenCalledTimes(2);

    await wrapped('/api/habits', { method: 'POST' });
    await wrapped('/api/habits/12/logs?from=a&to=b', { method: 'GET' });
    await wrapped('/api/entries', { method: 'PUT' });
    expect(onLogged).toHaveBeenCalledTimes(2);

    const failing = observeHabitLogs(transport(423), onLogged);
    await failing('/api/habits/logs', { method: 'PUT' });
    expect(onLogged).toHaveBeenCalledTimes(2);
  });

  it('returns the original response untouched', async () => {
    const wrapped = observeHabitLogs(async () => new Response('{"ok":true}', { status: 201 }), () => undefined);
    const response = await wrapped('/api/habits/logs', { method: 'PUT' });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
  });
});

describe('changesHabits and the offline replay (OFFLINE-DESIGN E13)', () => {
  it('a successful POST /api/sync/op re-plans the reminders; the key fetch, other methods and failures do not', () => {
    expect(changesHabits('POST', '/api/sync/op', 200)).toBe(true);
    expect(changesHabits('post', '/api/sync/op/', 200)).toBe(true);
    expect(changesHabits('POST', '/api/sync/op?x=1', 200)).toBe(true);
    for (const status of [0, 400, 401, 409, 413, 423, 429, 500, 503, 507]) {
      expect(changesHabits('POST', '/api/sync/op', status), String(status)).toBe(false);
    }
    expect(changesHabits('GET', '/api/sync/key', 200)).toBe(false);
    expect(changesHabits('POST', '/api/sync/key', 200)).toBe(false);
    expect(changesHabits('GET', '/api/sync/op', 200)).toBe(false);
    expect(changesHabits('PUT', '/api/sync/op', 200)).toBe(false);
    expect(changesHabits('POST', '/api/sync/opx', 200)).toBe(false);
    expect(changesHabits('POST', '/api/sync', 200)).toBe(false);
    // The rules from before are unchanged.
    expect(changesHabits('POST', '/api/habits', 201)).toBe(true);
    expect(changesHabits('PUT', '/api/settings', 200)).toBe(true);
    expect(changesHabits('POST', '/api/entries', 201)).toBe(false);
  });

  it('observeHabitChanges fires once per acknowledged replay, absolute server URLs included', async () => {
    const onChanged = vi.fn();
    const answers = [200, 503, 200];
    const wrapped = observeHabitChanges(async () => new Response('{}', { status: answers.shift() ?? 200 }), onChanged);
    await wrapped('https://diary.example/api/sync/op', { method: 'POST', body: '{"v":1}' });
    await wrapped('https://diary.example/api/sync/op', { method: 'POST', body: '{"v":1}' });
    expect(onChanged).toHaveBeenCalledTimes(1);
    await wrapped('https://diary.example/api/sync/key', { method: 'GET' });
    expect(onChanged).toHaveBeenCalledTimes(1);
    await wrapped('/api/sync/op', { method: 'POST', body: '{"v":1}' });
    expect(onChanged).toHaveBeenCalledTimes(2);
  });
});
