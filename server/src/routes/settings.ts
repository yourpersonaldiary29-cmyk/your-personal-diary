/**
 * /api/settings - per-user app settings, data directory info and the demo seed.
 * Texts (the encryption summary, validation errors) are rendered in the request language.
 */
import fs from 'node:fs';
import { Router } from 'express';
import { t, type Locale } from '@shared/i18n';
import type { AppSettings, DataDirInfo, SeedDemoRequest } from '@shared/types';
import type { AppDeps } from '../app';
import { seedDemoData, SEED_DEFAULT_DAYS, SEED_DEFAULT_SEED, SEED_MAX_DAYS, SEED_MIN_DAYS } from '../db/seed';
import { getSettings, saveSettings } from '../db/settings-repo';
import { ApiError } from '../errors';
import { ctxOf } from '../middleware/auth';
import { localeOf } from '../middleware/locale';
import { todayIso } from '../util/dates';
import { wrap } from './entries';

/** Catalogue key of the at-rest encryption description (ARCHITECTURE.md section 6). */
export const ENCRYPTION_SUMMARY_KEY = 'server.settings.encryptionSummary';

/** Description of the at-rest encryption shown on the privacy page, in `locale`. */
export function encryptionSummary(locale: Locale): string {
  return t(locale, ENCRYPTION_SUMMARY_KEY);
}

export function settingsRouter(deps: AppDeps): Router {
  const r = Router();

  // GET /api/settings -> AppSettings
  r.get(
    '/',
    wrap((req, res) => {
      res.json(getSettings(ctxOf(req).db));
    }),
  );

  // PUT /api/settings Partial<AppSettings> -> AppSettings
  r.put(
    '/',
    wrap((req, res) => {
      const { db } = ctxOf(req);
      res.json(saveSettings(db, (req.body ?? {}) as Partial<AppSettings>));
    }),
  );

  // GET /api/settings/data-dir -> DataDirInfo (paths are revealed to the desktop client only)
  r.get(
    '/data-dir',
    wrap((req, res) => {
      const { vault } = ctxOf(req);
      let dbExists = false;
      let dbSizeBytes = 0;
      try {
        const st = fs.statSync(vault.dbPath);
        dbExists = st.isFile();
        dbSizeBytes = dbExists ? st.size : 0;
      } catch {
        dbExists = false;
      }
      const info: DataDirInfo = {
        dataDir: req.isLocal ? deps.config.dataDir : '',
        dbPath: req.isLocal ? vault.dbPath : '',
        dbExists,
        dbSizeBytes,
        encryptionSummary: encryptionSummary(localeOf(req)),
      };
      res.json(info);
    }),
  );

  // POST /api/settings/seed-demo SeedDemoRequest -> SeedDemoResult (only when the diary is empty)
  // The demo texts follow the request language (Hebrew or English; other languages get English).
  r.post(
    '/seed-demo',
    wrap((req, res) => {
      const { db } = ctxOf(req);
      const body = (req.body ?? {}) as SeedDemoRequest;
      let days = SEED_DEFAULT_DAYS;
      if (body.days !== undefined && body.days !== null) {
        if (typeof body.days !== 'number' || !Number.isInteger(body.days) || body.days < SEED_MIN_DAYS || body.days > SEED_MAX_DAYS) {
          throw ApiError.validation('server.settings.daysRange', 'days', { min: SEED_MIN_DAYS, max: SEED_MAX_DAYS });
        }
        days = body.days;
      }
      res.json(seedDemoData(db, days, SEED_DEFAULT_SEED, todayIso(), localeOf(req)));
    }),
  );

  return r;
}
