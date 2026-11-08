import { Router, type NextFunction, type Request, type Response } from 'express';
import type { AppDeps } from '../app';
import { ctxOf } from '../middleware/auth';
import { localeOf } from '../middleware/locale';
import { parseQuery, smartSearch, validateSearchRequest } from '../search';
import { todayIso } from '../util/dates';

/**
 * POST /api/search        { query, limit? } -> SearchResult
 * POST /api/search/parse  { query }         -> ParsedQuery ("כך הבנתי את השאלה")
 * Answer / explanation texts are rendered in the request locale (Accept-Language).
 */
export function searchRouter(_deps: AppDeps): Router {
  const r = Router();

  r.post('/', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { db } = ctxOf(req);
      const body = validateSearchRequest(req.body);
      res.json(smartSearch(db, body, todayIso(), localeOf(req)));
    } catch (e) {
      next(e);
    }
  });

  r.post('/parse', (req: Request, res: Response, next: NextFunction) => {
    try {
      ctxOf(req);
      const body = validateSearchRequest(req.body);
      res.json(parseQuery(body.query, todayIso(), localeOf(req)));
    } catch (e) {
      next(e);
    }
  });

  return r;
}
