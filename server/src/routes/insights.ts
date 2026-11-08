/**
 * GET /api/insights?period=30d  -> InsightsReport
 * GET /api/home                 -> HomeSummary
 *
 * `period` must be one of PERIODS; when omitted the user's `defaultPeriod` setting is used
 * (falling back to 30d when settings cannot be read).
 */
import { Router, type Request, type Response } from 'express';
import { PERIODS } from '@shared/constants';
import type { AppSettings, Period } from '@shared/types';
import { generateInsights } from '../analysis/engine';
import type { AppDeps } from '../app';
import type { DiaryDb } from '../db/database';
import { getSettings } from '../db/settings-repo';
import { ApiError } from '../errors';
import { ctxOf } from '../middleware/auth';
import { localeOf } from '../middleware/locale';
import { homeSummary } from '../stats/home';
import { todayIso } from '../util/dates';

const PERIOD_VALUES = PERIODS.map((p) => p.value);

export function isPeriod(value: unknown): value is Period {
  return typeof value === 'string' && (PERIOD_VALUES as string[]).includes(value);
}

/** User settings, or null when the settings module is unavailable or throws. */
function safeSettings(db: DiaryDb): AppSettings | null {
  try {
    return getSettings(db);
  } catch {
    return null;
  }
}

/** Resolves the period from the query string, the settings default, or 30d. */
export function resolvePeriod(raw: unknown, settings: AppSettings | null): Period {
  if (raw === undefined || raw === null || raw === '') {
    return settings && isPeriod(settings.defaultPeriod) ? settings.defaultPeriod : '30d';
  }
  if (isPeriod(raw)) return raw;
  throw ApiError.validation('server.insights.periodInvalid', 'period', { values: PERIOD_VALUES.join(', ') });
}

export function insightsRouter(_deps: AppDeps): Router {
  const r = Router();

  r.get('/', (req: Request, res: Response, next) => {
    try {
      const { db } = ctxOf(req);
      const settings = safeSettings(db);
      const period = resolvePeriod(req.query.period, settings);
      const firstDayOfWeek = settings?.firstDayOfWeek === 1 ? 1 : 0;
      res.json(generateInsights(db, period, todayIso(), { firstDayOfWeek }, localeOf(req)));
    } catch (e) {
      next(e);
    }
  });

  return r;
}

export function homeRouter(_deps: AppDeps): Router {
  const r = Router();

  r.get('/', (req: Request, res: Response, next) => {
    try {
      const { db } = ctxOf(req);
      res.json(homeSummary(db, todayIso(), localeOf(req)));
    } catch (e) {
      next(e);
    }
  });

  return r;
}
