/**
 * Request-locale wiring: Accept-Language negotiation (middleware), the
 * account-language fallback in requireAuth, ApiError.localized rendering per
 * locale and the error middleware, plus an HTTP round trip through supertest.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import supertest from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { t } from '@shared/i18n';
import type { DiaryDb } from '../src/db/database';
import { ApiError } from '../src/errors';
import { requireAuth } from '../src/middleware/auth';
import { errorHandler, notFoundApi } from '../src/middleware/error';
import { hasLocaleHeader, localeFromHeader, localeMiddleware, localeOf } from '../src/middleware/locale';
import type { AuthContext, AuthService } from '../src/security/session-types';
import { cleanupTempDirs, fakeAuth, makeTestApp } from './helpers';

afterAll(() => cleanupTempDirs());

const HEBREW = /[א-ת]/;

/** Minimal Express-like request: header lookup + the fields the middleware sets. */
function fakeReq(headers: Record<string, string> = {}): Request {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
  return { header: (name: string) => lower[name.toLowerCase()] } as unknown as Request;
}

function fakeRes() {
  const out: { status: number | null; body: unknown } = { status: null, body: null };
  const res = {
    status(code: number) {
      out.status = code;
      return res;
    },
    json(body: unknown) {
      out.body = body;
      return res;
    },
  };
  return { res: res as unknown as Response, out };
}

describe('locale negotiation', () => {
  it('picks the best supported language from Accept-Language and falls back to English', () => {
    expect(localeFromHeader('he-IL,he;q=0.9,en;q=0.8')).toBe('he');
    expect(localeFromHeader('fr-CA')).toBe('fr');
    expect(localeFromHeader('xx, de;q=0.5')).toBe('de');
    expect(localeFromHeader('zh-Hans-CN')).toBe('zh');
    expect(localeFromHeader('*')).toBe('en');
    expect(localeFromHeader('')).toBe('en');
    expect(localeFromHeader(undefined)).toBe('en');
    expect(localeFromHeader(null)).toBe('en');
  });

  it('middleware sets req.locale and localeOf defaults to English without it', () => {
    const req = fakeReq({ 'Accept-Language': 'ar' });
    const next = vi.fn();
    localeMiddleware(req, {} as Response, next as unknown as NextFunction);
    expect(req.locale).toBe('ar');
    expect(next).toHaveBeenCalledTimes(1);
    expect(hasLocaleHeader(req)).toBe(true);

    const bare = fakeReq();
    localeMiddleware(bare, {} as Response, next as unknown as NextFunction);
    expect(bare.locale).toBe('en');
    expect(hasLocaleHeader(bare)).toBe(false);
    expect(hasLocaleHeader(fakeReq({ 'Accept-Language': '   ' }))).toBe(false);
    expect(localeOf(undefined)).toBe('en');
    expect(localeOf({ locale: 'he' })).toBe('he');
  });
});

describe("requireAuth refines the locale with the account's language", () => {
  function authWithLanguage(language: string | null): AuthService {
    const rows = language === null ? [] : [{ key: 'language', value: JSON.stringify(language) }];
    const db = { all: () => rows } as unknown as DiaryDb;
    const ctx = { db } as unknown as AuthContext;
    return { authenticate: async (token: string) => (token === 'tok' ? ctx : null) } as unknown as AuthService;
  }

  async function run(auth: AuthService, headers: Record<string, string>) {
    const req = fakeReq({ Authorization: 'Bearer tok', ...headers });
    localeMiddleware(req, {} as Response, (() => undefined) as NextFunction);
    const next = vi.fn();
    await requireAuth(auth)(req, {} as Response, next as unknown as NextFunction);
    return { req, next };
  }

  it('uses settings.language when the request has no Accept-Language header', async () => {
    const { req, next } = await run(authWithLanguage('he'), {});
    expect(next).toHaveBeenCalledWith();
    expect(req.locale).toBe('he');
  });

  it('keeps the negotiated header locale when one is present', async () => {
    const { req } = await run(authWithLanguage('he'), { 'Accept-Language': 'de' });
    expect(req.locale).toBe('de');
  });

  it('falls back to English for an account without a stored language or an unreadable settings table', async () => {
    expect((await run(authWithLanguage(null), {})).req.locale).toBe('en');
    const broken = { authenticate: async () => ({ db: null }) } as unknown as AuthService;
    const { req, next } = await run(broken, {});
    expect(req.locale).toBe('en');
    expect(next).toHaveBeenCalledWith();
  });

  it('still answers 401 for a missing or unknown token', async () => {
    const next = vi.fn();
    await requireAuth(authWithLanguage('he'))(fakeReq(), {} as Response, next as unknown as NextFunction);
    expect((next.mock.calls[0][0] as ApiError).code).toBe('UNAUTHORIZED');
    const bad = fakeReq({ Authorization: 'Bearer nope' });
    await requireAuth(authWithLanguage('he'))(bad, {} as Response, next as unknown as NextFunction);
    expect((next.mock.calls[1][0] as ApiError).code).toBe('SESSION_EXPIRED');
  });
});

describe('ApiError.localized', () => {
  it('renders the message per locale and keeps status, code and field', () => {
    const err = ApiError.localized(400, 'VALIDATION', 'shell.errorStatus', { status: 418 }, 'teapot');
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION');
    expect(err.field).toBe('teapot');
    expect(err.key).toBe('shell.errorStatus');
    expect(err.message).toBe('Error (418)');
    expect(err.messageFor('he')).toBe('שגיאה (418)');
    expect(err.toBody('he')).toEqual({ code: 'VALIDATION', message: 'שגיאה (418)', field: 'teapot' });
    expect(err.toBody('en')).toEqual({ code: 'VALIDATION', message: 'Error (418)', field: 'teapot' });
    expect(err.toBody()).toEqual(err.toBody('en'));
    // Every locale has its own catalogue.
    expect(err.messageFor('de')).toBe('Fehler (418)');
  });

  it('leaves literal (Hebrew) errors untouched whatever the locale', () => {
    const err = ApiError.validation('ערך לא תקין', 'mood');
    expect(err.key).toBeUndefined();
    expect(err.toBody('en')).toEqual({ code: 'VALIDATION', message: 'ערך לא תקין', field: 'mood' });
    expect(err.messageFor('de')).toBe('ערך לא תקין');
  });

  it('errorHandler renders localised errors in req.locale and literal ones as they are', () => {
    const localised = ApiError.localized(503, 'OTHER', 'shell.noServer');
    const he = fakeRes();
    errorHandler(localised, { locale: 'he' } as Request, he.res, (() => undefined) as NextFunction);
    expect(he.out).toEqual({ status: 503, body: { code: 'OTHER', message: t('he', 'shell.noServer') } });
    expect((he.out.body as { message: string }).message).toMatch(HEBREW);

    const en = fakeRes();
    errorHandler(localised, { locale: 'en' } as Request, en.res, (() => undefined) as NextFunction);
    expect(en.out.body).toEqual({ code: 'OTHER', message: 'No connection to the local diary server.' });

    const none = fakeRes();
    errorHandler(localised, {} as Request, none.res, (() => undefined) as NextFunction);
    expect((none.out.body as { message: string }).message).toBe('No connection to the local diary server.');

    const literal = fakeRes();
    errorHandler(ApiError.notFound('הפריט'), { locale: 'en' } as Request, literal.res, (() => undefined) as NextFunction);
    // notFound() wraps its argument in the localised 'not found' sentence; the Hebrew name is kept verbatim.
    expect(literal.out.status).toBe(404);
    expect((literal.out.body as { message: string }).message).toContain('הפריט');

    const missing = fakeRes();
    notFoundApi({ locale: 'en' } as Request, missing.res);
    expect(missing.out.status).toBe(404);
    expect((missing.out.body as { message: string }).message).not.toMatch(HEBREW);
  });
});

describe('HTTP round trip', () => {
  function localisedApp() {
    const app = express();
    app.use(localeMiddleware);
    app.get('/boom', (_req: Request, _res: Response, next: NextFunction) => {
      next(ApiError.localized(409, 'OTHER', 'shell.errorStatus', { status: 409 }));
    });
    app.get('/echo', (req: Request, res: Response) => {
      res.json({ locale: req.locale });
    });
    app.use(errorHandler);
    return app;
  }

  it('answers localised errors in the Accept-Language language (English without the header)', async () => {
    const app = localisedApp();
    const he = await supertest(app).get('/boom').set('Accept-Language', 'he-IL,he;q=0.9');
    expect(he.status).toBe(409);
    expect(he.body).toEqual({ code: 'OTHER', message: 'שגיאה (409)' });
    const en = await supertest(app).get('/boom').set('Accept-Language', 'en-US,en;q=0.9');
    expect(en.body).toEqual({ code: 'OTHER', message: 'Error (409)' });
    const none = await supertest(app).get('/boom');
    expect(none.body.message).toBe('Error (409)');
    expect((await supertest(app).get('/echo').set('Accept-Language', 'tr')).body).toEqual({ locale: 'tr' });
    expect((await supertest(app).get('/echo').set('Accept-Language', 'xx')).body).toEqual({ locale: 'en' });
  });

  it('the real app runs the middleware on every route and renders validation errors in the request language', async () => {
    const app = await makeTestApp();
    const res = await app.get('/api/entries/abc').set('Accept-Language', 'en');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION', field: 'id' });
    expect(res.body.message).not.toMatch(HEBREW);
    const he = await app.get('/api/entries/abc').set('Accept-Language', 'he');
    expect(he.body.message).toMatch(HEBREW);
    const missing = await app.anon().get('/api/nope').set('Accept-Language', 'de');
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('NOT_FOUND');
    // The fake auth service still authenticates (the locale refinement never breaks auth).
    const withAccount = await makeTestApp({ auth: fakeAuth(app.db) });
    const list = await withAccount.get('/api/entries');
    expect(list.status).toBe(200);
  });
});
