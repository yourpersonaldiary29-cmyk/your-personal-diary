import type { NextFunction, Request, Response } from 'express';
import { resolveLocale } from '@shared/i18n';
import { getSettings } from '../db/settings-repo';
import { ApiError } from '../errors';
import { guestNotAllowed, isGuestContext } from '../security/guest';
import type { AuthService } from '../security/session-types';
import { hasLocaleHeader } from './locale';

export function bearerToken(req: Request): string | null {
  const h = req.header('authorization') || '';
  const m = /^Bearer\s+([A-Za-z0-9._~+/=-]+)$/i.exec(h.trim());
  return m ? m[1] : null;
}

/**
 * What a LOCKED session (lock screen) may still do: see who it is, unlock with the password, lock,
 * sign out, and read the settings the lock screen is shown in (language, theme). Everything else -
 * entries, habits, search, export, backup, profile changes - answers 423 LOCKED, so reloading the
 * page or calling the API with the token of a locked device reveals nothing.
 */
export function allowedWhileLocked(method: string, path: string): boolean {
  const p = path.replace(/\/+$/, '');
  if (p === '/api/auth/me' && method === 'GET') return true;
  if (method === 'POST' && (p === '/api/auth/verify-password' || p === '/api/auth/lock' || p === '/api/auth/logout')) return true;
  return p === '/api/settings' && method === 'GET';
}

/**
 * Attaches `req.auth` or responds 401 (423 LOCKED for a locked session, see `allowedWhileLocked`).
 * When the request carries no Accept-Language header, `req.locale` becomes the account's settings.language.
 */
export function requireAuth(auth: AuthService) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token = bearerToken(req);
      if (!token) throw ApiError.unauthorized();
      const ctx = await auth.authenticate(token);
      if (!ctx) throw ApiError.sessionExpired();
      if (!hasLocaleHeader(req)) {
        try {
          req.locale = resolveLocale(getSettings(ctx.db).language);
        } catch {
          /* settings unavailable: keep the negotiated / default locale */
        }
      }
      // After the locale, so the 423 is in the account's language too.
      if (ctx.session?.locked && !allowedWhileLocked(req.method, `${req.baseUrl}${req.path}`)) throw ApiError.locked();
      req.auth = ctx;
      next();
    } catch (e) {
      next(e);
    }
  };
}

/**
 * After `requireAuth`: refuses the guest of the tour mode with 403 'server.auth.guestNotAllowed'.
 * For everything that needs a real account - password, profile, lock, account deletion, backup.
 */
export function refuseGuest(req: Request, _res: Response, next: NextFunction): void {
  next(isGuestContext(req.auth) ? guestNotAllowed() : undefined);
}

/** Helper for handlers: returns the auth context or throws 401. */
export function ctxOf(req: Request) {
  if (!req.auth) throw ApiError.unauthorized();
  return req.auth;
}
