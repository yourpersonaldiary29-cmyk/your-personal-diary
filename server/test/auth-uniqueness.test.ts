/**
 * One account per e-mail address and per username (both case-insensitive, at registration and when
 * the profile is edited); first and last names may repeat freely. The duplicate errors carry the
 * owner's exact wording in the request language.
 */
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import type { AuthResponse } from '@shared/types';
import { startServer, type RunningServer } from '../src/server';
import { cleanupTempDirs, testConfig } from './helpers';

const PASSWORD = 'Passw0rd!';
const EMAIL_TAKEN = {
  en: 'Error: This email address is already registered.',
  he: 'שגיאה: כתובת המייל הזו כבר רשומה במערכת.',
};
const USERNAME_TAKEN = {
  en: 'Error: This username is already taken. Please choose another one.',
  he: 'שגיאה: שם המשתמש הזה כבר תפוס. יש לבחור שם אחר.',
};

const running: RunningServer[] = [];
afterEach(async () => {
  for (const r of running.splice(0)) await r.stop();
});
afterAll(cleanupTempDirs);

async function boot() {
  const srv = await startServer(testConfig(), { port: 0, quiet: true, auth: { kdf: { N: 1024, r: 8, p: 1 } } });
  running.push(srv);
  return supertest(`http://127.0.0.1:${srv.port}`);
}

function registration(username: string, email: string, first = 'Dana', last = 'Cohen') {
  return { firstName: first, lastName: last, username, email, password: PASSWORD, confirmPassword: PASSWORD };
}

describe('unique e-mail and username', () => {
  it('refuses a registered e-mail or username in any letter case, in the request language; names may repeat', async () => {
    const http = await boot();
    expect((await http.post('/api/auth/register').send(registration('dana', 'dana@example.com'))).status).toBe(201);

    for (const lang of ['en', 'he'] as const) {
      const email = await http.post('/api/auth/register').set('Accept-Language', lang).send(registration(`dana_${lang}`, ' DANA@Example.COM '));
      expect(email.status).toBe(409);
      expect(email.body).toEqual({ code: 'VALIDATION', message: EMAIL_TAKEN[lang], field: 'email' });

      const username = await http.post('/api/auth/register').set('Accept-Language', lang).send(registration('DaNa', `other_${lang}@example.com`));
      expect(username.status).toBe(409);
      expect(username.body).toEqual({ code: 'USERNAME_TAKEN', message: USERNAME_TAKEN[lang], field: 'username' });
    }

    // Same first and last name, different username and e-mail: fine.
    expect((await http.post('/api/auth/register').send(registration('dana.cohen2', 'dana.cohen2@example.com'))).status).toBe(201);
  });

  it('refuses taking another account\'s e-mail through the profile editor, but allows changing the case of one\'s own', async () => {
    const http = await boot();
    expect((await http.post('/api/auth/register').send(registration('dana', 'dana@example.com'))).status).toBe(201);
    const avi = (await http.post('/api/auth/register').send(registration('avi', 'avi@example.com', 'Avi', 'Levi'))).body as AuthResponse;
    const edit = (body: object, lang = 'he') =>
      http.put('/api/auth/profile').set('Authorization', `Bearer ${avi.token}`).set('Accept-Language', lang).send(body);

    const taken = await edit({ email: 'Dana@EXAMPLE.com' });
    expect(taken.status).toBe(409);
    expect(taken.body).toEqual({ code: 'VALIDATION', message: EMAIL_TAKEN.he, field: 'email' });
    expect((await edit({ email: 'dana@example.com' }, 'en')).body.message).toBe(EMAIL_TAKEN.en);

    const own = await edit({ email: 'AVI@example.com', firstName: 'Dana', lastName: 'Cohen' });
    expect(own.status).toBe(200);
    expect(own.body).toMatchObject({ username: 'avi', email: 'AVI@example.com', firstName: 'Dana', lastName: 'Cohen' });
    // Sign-in by e-mail keeps working case-insensitively after the edit.
    expect((await http.post('/api/auth/login').send({ username: 'avi@EXAMPLE.com', password: PASSWORD })).status).toBe(200);
  });
});
