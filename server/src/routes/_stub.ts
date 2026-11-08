import { Router } from 'express';
import { ApiError } from '../errors';

/** Placeholder router used until a module is implemented. Responds 501 for every path. */
export function stubRouter(name: string): Router {
  const r = Router();
  r.all(/.*/, (_req, _res, next) => {
    next(ApiError.localized(501, 'OTHER', 'server.error.notImplemented', { name }));
  });
  return r;
}
