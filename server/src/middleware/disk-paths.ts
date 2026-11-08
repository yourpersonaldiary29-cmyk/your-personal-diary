/**
 * Refuses "save to / read from a path on the server's disk" requests: a `destPath` (backup create,
 * export) or `srcPath` (backup inspect / restore) in the body answers 400 VALIDATION with the given
 * catalogue key before the router runs. Used by the hosted composition (docs/HOSTED-PLAN.md 2.3 -
 * a public server never writes where a client says) and by the Android core (mobile/core/app.ts,
 * where a path outside the virtual file system would only look saved). No imports beyond the
 * errors module, so both bundles can carry it.
 */
import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../errors';

function bodyField(req: Request, name: string): unknown {
  const body = req.body;
  return body && typeof body === 'object' ? (body as Record<string, unknown>)[name] : undefined;
}

function isPathGiven(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Refuses `destPath` / `srcPath` bodies with 400 VALIDATION (field: the offending one). Runs
 * after the body parser of its route group, before the router.
 */
export function refuseDiskPaths(keys: { destPath?: string; srcPath?: string }) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (keys.destPath && isPathGiven(bodyField(req, 'destPath'))) return next(ApiError.validation(keys.destPath, 'destPath'));
    if (keys.srcPath && isPathGiven(bodyField(req, 'srcPath'))) return next(ApiError.validation(keys.srcPath, 'srcPath'));
    next();
  };
}
