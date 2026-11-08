import type { NextFunction, Request, Response } from 'express';
import { ApiError, isApiError } from '../errors';
import { localeOf } from './locale';

/**
 * Final error handler: every error becomes `{ code, message, field? }`. Errors
 * created with `ApiError.localized` (or a convenience constructor given a catalogue
 * key) are rendered in `req.locale`; literal messages are sent as they are.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const locale = localeOf(req);
  if (isApiError(err)) {
    if (err.retryAfterSec !== undefined) res.setHeader('Retry-After', String(err.retryAfterSec));
    res.status(err.status).json(err.toBody(locale));
    return;
  }
  // express.json() malformed body
  const anyErr = err as { type?: string; status?: number; message?: string };
  if (anyErr && anyErr.type === 'entity.parse.failed') {
    res.status(400).json(ApiError.validation('server.error.badJson').toBody(locale));
    return;
  }
  if (anyErr && anyErr.type === 'entity.too.large') {
    res.status(413).json(ApiError.validation('server.error.bodyTooLarge').toBody(locale));
    return;
  }
  // Never leak stack traces or paths to the client; log locally only.
  console.error('[diary-server] unhandled error:', err);
  res.status(500).json(ApiError.other('server.error.internal').toBody(locale));
}

export function notFoundApi(req: Request, res: Response): void {
  res.status(404).json(ApiError.notFound('server.error.notFound.route').toBody(localeOf(req)));
}
