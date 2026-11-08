/**
 * Request locale (docs/API.md, "כללי" -> "שפה").
 *
 * `localeMiddleware` sets `req.locale` from the `Accept-Language` header the UI
 * sends on every request (falling back to English). `requireAuth` refines it
 * with the account's `settings.language` when the header is absent (curl, old
 * clients). Text-producing modules receive it as a trailing parameter and
 * render through `t(locale, key, params)` from '@shared/i18n'.
 */
import type { NextFunction, Request, Response } from 'express';
import { DEFAULT_LOCALE, negotiateLocale, type Locale } from '@shared/i18n';

export const LOCALE_HEADER = 'accept-language';

/** True when the request carries a non-empty Accept-Language header. */
export function hasLocaleHeader(req: Pick<Request, 'header'>): boolean {
  const raw = req.header(LOCALE_HEADER);
  return typeof raw === 'string' && raw.trim() !== '';
}

/** Best supported locale for an Accept-Language header value ('en' when absent or unsupported). */
export function localeFromHeader(header: string | undefined | null): Locale {
  return negotiateLocale(header ?? undefined);
}

/** Express middleware: `req.locale = negotiateLocale(Accept-Language)`. */
export function localeMiddleware(req: Request, _res: Response, next: NextFunction): void {
  req.locale = localeFromHeader(req.header(LOCALE_HEADER));
  next();
}

/** The request locale, or English when the middleware did not run (unit tests, fake requests). */
export function localeOf(req: Pick<Request, 'locale'> | undefined | null): Locale {
  return req?.locale ?? DEFAULT_LOCALE;
}
