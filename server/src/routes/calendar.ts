import { Router, type NextFunction, type Request, type Response } from 'express';
import type { AppDeps } from '../app';
import { ApiError, ref } from '../errors';
import { ctxOf } from '../middleware/auth';
import { calendarMonth, calendarRange } from '../stats/calendar';

function queryString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Parses an integer query parameter; throws a localised validation error when missing or malformed.
 * `labelKey` is the catalogue key of the parameter's display name ('server.calendar.param.year'...).
 */
export function parseIntParam(raw: unknown, field: string, labelKey: string): number {
  const s = queryString(raw);
  if (s === undefined || s.trim() === '') throw ApiError.validation('server.calendar.paramMissing', field, { label: ref(labelKey) });
  if (!/^-?\d+$/.test(s.trim())) throw ApiError.validation('server.calendar.paramInteger', field, { label: ref(labelKey) });
  return Number(s.trim());
}

/**
 * GET /api/calendar/month?year=2026&month=9 -> CalendarMonth
 * GET /api/calendar/range?from&to           -> CalendarDay[] (only days with data)
 */
export function calendarRouter(_deps: AppDeps): Router {
  const r = Router();

  r.get('/month', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { db } = ctxOf(req);
      const year = parseIntParam(req.query.year, 'year', 'server.calendar.param.year');
      const month = parseIntParam(req.query.month, 'month', 'server.calendar.param.month');
      res.json(calendarMonth(db, year, month));
    } catch (e) {
      next(e);
    }
  });

  r.get('/range', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { db } = ctxOf(req);
      const from = queryString(req.query.from);
      const to = queryString(req.query.to);
      if (!from) throw ApiError.validation('server.calendar.fromMissing', 'from');
      if (!to) throw ApiError.validation('server.calendar.toMissing', 'to');
      res.json(calendarRange(db, from, to));
    } catch (e) {
      next(e);
    }
  });

  return r;
}
