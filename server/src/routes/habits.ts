/**
 * /api/habits - habit definitions, logs, progress and due reminders (docs/API.md).
 *
 * Route order matters: the fixed paths (/progress, /templates, /status, /reorder,
 * /logs, /reminders/due) are registered before the '/:id' family. Reminder texts and
 * validation errors are rendered in the request language.
 */
import { Router } from 'express';
import { HABIT_TEMPLATES } from '@shared/constants';
import { DEFAULT_LOCALE, t, type Locale } from '@shared/i18n';
import type { DueReminder } from '@shared/types';
import type { AppDeps } from '../app';
import {
  createHabit,
  deleteHabit,
  deleteHabitLog,
  habitDayStatuses,
  habitsWithProgress,
  listHabits,
  listLogs,
  logHabit,
  reorderHabits,
  setArchived,
  updateHabit,
  validateHabitInput,
  validateHabitLogInput,
} from '../db/habits-repo';
import { getSettings } from '../db/settings-repo';
import { ApiError } from '../errors';
import { ctxOf } from '../middleware/auth';
import { localeOf } from '../middleware/locale';
import { addDays, isHHMM, nowHHMM, todayIso } from '../util/dates';
import { parseDateParam, parseId, queryBool, queryDate, queryString, wrap } from './entries';

/**
 * How late (in minutes) a reminder may still be delivered. The client polls once a minute from
 * whenever the page was opened, so the poll for a reminder's exact minute can come before the
 * reminder was saved (a reminder set for the current minute), be skipped by timer drift or by a
 * throttled background window, or be missed while the computer slept. A reminder is therefore
 * due from its minute until REMINDER_GRACE_MINUTES later - still at most once a day per session.
 */
export const REMINDER_GRACE_MINUTES = 10;

function minutesOfDay(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

/** True when a reminder set for `reminderTime` is due at `now` (both HH:MM, same day). */
export function reminderDueAt(reminderTime: string, now: string): boolean {
  const late = minutesOfDay(now) - minutesOfDay(reminderTime);
  return late >= 0 && late < REMINDER_GRACE_MINUTES;
}

/** Notification text for a due habit reminder, in `locale`. */
export function reminderMessage(habitName: string, locale: Locale = DEFAULT_LOCALE): string {
  return t(locale, 'server.habits.reminder', { habitName });
}

export function habitsRouter(_deps: AppDeps): Router {
  const r = Router();

  // GET /api/habits?includeArchived=false -> Habit[]
  r.get(
    '/',
    wrap((req, res) => {
      const { db } = ctxOf(req);
      res.json(listHabits(db, queryBool(req, 'includeArchived') ?? false));
    }),
  );

  // GET /api/habits/progress?date=YYYY-MM-DD -> HabitWithProgress[] (active habits only)
  r.get(
    '/progress',
    wrap((req, res) => {
      const { db } = ctxOf(req);
      res.json(habitsWithProgress(db, queryDate(req, 'date') ?? todayIso()));
    }),
  );

  // GET /api/habits/templates -> HabitTemplate[]
  r.get(
    '/templates',
    wrap((_req, res) => {
      res.json(HABIT_TEMPLATES);
    }),
  );

  // GET /api/habits/status?from&to -> HabitDayStatus[] (defaults: the last 30 days)
  r.get(
    '/status',
    wrap((req, res) => {
      const { db } = ctxOf(req);
      const to = queryDate(req, 'to') ?? todayIso();
      const from = queryDate(req, 'from') ?? addDays(to, -29);
      if (from > to) throw ApiError.validation('server.habits.fromBeforeTo', 'from');
      res.json(habitDayStatuses(db, from, to));
    }),
  );

  // GET /api/habits/reminders/due?now=HH:MM -> DueReminder[]
  // A reminder is due from its time until REMINDER_GRACE_MINUTES later (see above); each one is
  // returned once per day per session (tracked in session.notified).
  r.get(
    '/reminders/due',
    wrap((req, res) => {
      const { db, session } = ctxOf(req);
      const nowRaw = queryString(req, 'now');
      if (nowRaw !== undefined && !isHHMM(nowRaw)) {
        throw ApiError.validation('server.habits.nowFormat', 'now');
      }
      const now = nowRaw ?? nowHHMM();
      const today = todayIso();
      const locale = localeOf(req);

      // Forget keys from previous days so the set never grows unbounded.
      for (const key of session.notified) {
        if (!key.endsWith(`:${today}`)) session.notified.delete(key);
      }

      const due: DueReminder[] = [];
      if (!getSettings(db).remindersEnabled) {
        res.json(due);
        return;
      }
      for (const habit of listHabits(db, false)) {
        if (!habit.reminderEnabled || !habit.reminderTime || !reminderDueAt(habit.reminderTime, now)) continue;
        const logged = db.scalar<number>('SELECT COUNT(*) FROM habit_logs WHERE habit_id = ? AND date = ?', [habit.id, today]);
        if (Number(logged ?? 0) > 0) continue;
        const key = `${habit.id}:${today}`;
        if (session.notified.has(key)) continue;
        session.notified.add(key);
        due.push({
          habitId: habit.id,
          habitName: habit.name,
          reminderTime: habit.reminderTime ?? now,
          message: reminderMessage(habit.name, locale),
        });
      }
      res.json(due);
    }),
  );

  // POST /api/habits -> 201 Habit
  r.post(
    '/',
    wrap((req, res) => {
      const { db } = ctxOf(req);
      res.status(201).json(createHabit(db, validateHabitInput(req.body)));
    }),
  );

  // PUT /api/habits/reorder { ids } -> Habit[]
  r.put(
    '/reorder',
    wrap((req, res) => {
      const { db } = ctxOf(req);
      const body = (req.body ?? {}) as { ids?: unknown };
      if (!Array.isArray(body.ids)) throw ApiError.validation('server.habits.idsRequiredField', 'ids');
      res.json(reorderHabits(db, body.ids as number[]));
    }),
  );

  // PUT /api/habits/logs HabitLogInput -> HabitLog (upsert by habit+date)
  r.put(
    '/logs',
    wrap((req, res) => {
      const { db } = ctxOf(req);
      res.json(logHabit(db, validateHabitLogInput(req.body)));
    }),
  );

  // GET /api/habits/:id/logs?from&to -> HabitLog[]
  r.get(
    '/:id/logs',
    wrap((req, res) => {
      const { db } = ctxOf(req);
      const id = parseId(req.params.id);
      res.json(listLogs(db, id, queryDate(req, 'from') ?? null, queryDate(req, 'to') ?? null));
    }),
  );

  // DELETE /api/habits/:id/logs/:date -> 204
  r.delete(
    '/:id/logs/:date',
    wrap((req, res) => {
      const { db } = ctxOf(req);
      deleteHabitLog(db, parseId(req.params.id), parseDateParam(req.params.date));
      res.status(204).end();
    }),
  );

  // PATCH /api/habits/:id/archive { archived } -> Habit
  r.patch(
    '/:id/archive',
    wrap((req, res) => {
      const { db } = ctxOf(req);
      const id = parseId(req.params.id);
      const body = (req.body ?? {}) as { archived?: unknown };
      if (typeof body.archived !== 'boolean') throw ApiError.validation('server.habits.archivedBoolean', 'archived');
      res.json(setArchived(db, id, body.archived));
    }),
  );

  // PUT /api/habits/:id HabitInput -> Habit
  r.put(
    '/:id',
    wrap((req, res) => {
      const { db } = ctxOf(req);
      const id = parseId(req.params.id);
      res.json(updateHabit(db, id, validateHabitInput(req.body)));
    }),
  );

  // DELETE /api/habits/:id -> 204 (logs are deleted too)
  r.delete(
    '/:id',
    wrap((req, res) => {
      const { db } = ctxOf(req);
      deleteHabit(db, parseId(req.params.id));
      res.status(204).end();
    }),
  );

  return r;
}
