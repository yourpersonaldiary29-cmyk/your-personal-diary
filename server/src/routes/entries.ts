/**
 * /api/entries - diary entries (see docs/API.md).
 *
 * Also exports the small query/param parsing helpers shared by the habits and
 * settings routers (all three are owned by the data layer). Validation errors are
 * catalogue keys ('server.entries.*') rendered in the request language.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import { EMOTION_KEYS } from '@shared/constants';
import type { EntryFilter } from '@shared/types';
import type { AppDeps } from '../app';
import {
  createEntry,
  deleteEntry,
  getDay,
  getEntry,
  listEntries,
  listLocations,
  listPeople,
  listTags,
  updateEntry,
  validateEntryInput,
} from '../db/entries-repo';
import { ApiError } from '../errors';
import { ctxOf } from '../middleware/auth';
import { isIsoDate } from '../util/dates';

// ---------------------------------------------------------------------------
// Parsing helpers (exported for the other data routers)
// ---------------------------------------------------------------------------

/** Positive integer path parameter or 400. */
export function parseId(raw: unknown, field = 'id'): number {
  const s = String(raw ?? '').trim();
  if (!/^\d{1,15}$/.test(s) || Number(s) <= 0) throw ApiError.validation('server.entries.idPositiveInteger', field);
  return Number(s);
}

/** First string value of a query parameter (undefined when absent or empty). */
export function queryString(req: Request, name: string): string | undefined {
  const v = (req.query as Record<string, unknown>)[name];
  const first = Array.isArray(v) ? v[0] : v;
  if (typeof first !== 'string') return undefined;
  const trimmed = first.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** Integer query parameter or 400 (undefined when absent). */
export function queryInt(req: Request, name: string): number | undefined {
  const s = queryString(req, name);
  if (s === undefined) return undefined;
  if (!/^-?\d{1,15}$/.test(s)) throw ApiError.validation('server.entries.paramInteger', name, { name });
  return Number(s);
}

/** Boolean query parameter: true/false/1/0/yes/no (undefined when absent, 400 otherwise). */
export function queryBool(req: Request, name: string): boolean | undefined {
  const s = queryString(req, name);
  if (s === undefined) return undefined;
  const v = s.toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  throw ApiError.validation('server.entries.paramBoolean', name, { name });
}

/** ISO date query parameter or 400 (undefined when absent). */
export function queryDate(req: Request, name: string): string | undefined {
  const s = queryString(req, name);
  if (s === undefined) return undefined;
  if (!isIsoDate(s)) throw ApiError.validation('server.entries.paramDate', name, { name });
  return s;
}

/** ISO date path parameter or 400. */
export function parseDateParam(raw: unknown, field = 'date'): string {
  const s = String(raw ?? '').trim();
  if (!isIsoDate(s)) throw ApiError.validation('server.entries.badDate', field);
  return s;
}

type Handler = (req: Request, res: Response) => void | Promise<void>;

/** Wraps a handler so thrown errors (sync or async) reach the error middleware. */
export function wrap(handler: Handler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve()
      .then(() => handler(req, res))
      .catch(next);
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function entriesRouter(_deps: AppDeps): Router {
  const r = Router();

  // GET /api/entries?from&to&tag&emotion&text&limit&offset&sortDesc -> EntryPage
  r.get(
    '/',
    wrap((req, res) => {
      const { db } = ctxOf(req);
      const emotion = queryString(req, 'emotion');
      if (emotion !== undefined && !EMOTION_KEYS.has(emotion)) {
        throw ApiError.validation('server.entries.unknownEmotion', 'emotion', { emotion });
      }
      const filter: EntryFilter = {
        from: queryDate(req, 'from'),
        to: queryDate(req, 'to'),
        tag: queryString(req, 'tag'),
        emotion,
        text: queryString(req, 'text'),
        limit: queryInt(req, 'limit'),
        offset: queryInt(req, 'offset'),
        sortDesc: queryBool(req, 'sortDesc'),
      };
      res.json(listEntries(db, filter));
    }),
  );

  // POST /api/entries -> 201 Entry
  r.post(
    '/',
    wrap((req, res) => {
      const { db } = ctxOf(req);
      const entry = createEntry(db, validateEntryInput(req.body));
      res.status(201).json(entry);
    }),
  );

  // Meta and day routes must be registered before '/:id'.
  r.get(
    '/meta/tags',
    wrap((req, res) => {
      res.json(listTags(ctxOf(req).db));
    }),
  );
  r.get(
    '/meta/people',
    wrap((req, res) => {
      res.json(listPeople(ctxOf(req).db));
    }),
  );
  r.get(
    '/meta/locations',
    wrap((req, res) => {
      res.json(listLocations(ctxOf(req).db));
    }),
  );

  // GET /api/entries/day/:date -> DaySummary
  r.get(
    '/day/:date',
    wrap((req, res) => {
      const { db } = ctxOf(req);
      res.json(getDay(db, parseDateParam(req.params.date)));
    }),
  );

  // GET /api/entries/:id -> Entry
  r.get(
    '/:id',
    wrap((req, res) => {
      const { db } = ctxOf(req);
      res.json(getEntry(db, parseId(req.params.id)));
    }),
  );

  // PUT /api/entries/:id -> Entry
  r.put(
    '/:id',
    wrap((req, res) => {
      const { db } = ctxOf(req);
      const id = parseId(req.params.id);
      res.json(updateEntry(db, id, validateEntryInput(req.body)));
    }),
  );

  // DELETE /api/entries/:id -> 204
  r.delete(
    '/:id',
    wrap((req, res) => {
      const { db } = ctxOf(req);
      deleteEntry(db, parseId(req.params.id));
      res.status(204).end();
    }),
  );

  return r;
}
