import { Router, type NextFunction, type Request, type Response } from 'express';
import { PERIODS } from '@shared/constants';
import type { Period } from '@shared/types';
import type { AppDeps } from '../app';
import { ApiError } from '../errors';
import { ctxOf } from '../middleware/auth';
import { localeOf } from '../middleware/locale';
import { statsOverview } from '../stats/series';
import { todayIso } from '../util/dates';

const PERIOD_VALUES = new Set<string>(PERIODS.map((p) => p.value));

/** Parses `?period=` (default 30d); throws a localised validation error for unknown values. */
export function parsePeriodParam(raw: unknown): Period {
  if (raw === undefined || raw === null || raw === '') return '30d';
  if (typeof raw !== 'string' || !PERIOD_VALUES.has(raw)) {
    throw ApiError.validation('server.stats.periodInvalid', 'period', { values: [...PERIOD_VALUES].join(', ') });
  }
  return raw as Period;
}

/**
 * GET /api/stats?period=30d -> StatsOverview (series labels/units in the request language)
 */
export function statsRouter(_deps: AppDeps): Router {
  const r = Router();

  r.get('/', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { db } = ctxOf(req);
      const period = parsePeriodParam(req.query.period);
      res.json(statsOverview(db, period, todayIso(), localeOf(req)));
    } catch (e) {
      next(e);
    }
  });

  return r;
}
