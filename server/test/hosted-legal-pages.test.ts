/**
 * The legal pages on the hosted server (docs/play-tasks/PLAY-LEGAL.md item 3): scripts/legal/build-pages.mjs
 * writes public/privacy/** and public/delete-account/**, Vite copies public/ into dist/, and the hosted
 * composition serves dist/ with express.static BEFORE the SPA fallback - so the pages need no server change.
 * This proves that claim against the real pages copied into a temporary UI folder:
 *   - /privacy and /delete-account (no slash) redirect to the folder; the folder serves the English page;
 *   - /privacy/<locale>/ serves that language (Hebrew right-to-left);
 *   - the pages pass the public-host check and carry the hosted security headers (the CSP allows their
 *     inline style and they have no script), and are not cached forever;
 *   - a language that does not exist falls back to the web client, as every other unknown path does.
 * Fictional host, TEST-NET client address.
 */
import fs from 'node:fs';
import path from 'node:path';
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { loadConfig, loadHostedEnv } from '../src/config';
import { startHosted, type RunningHosted } from '../src/hosted';
import { cleanupTempDirs, tempDataDir } from './helpers';

const FAST = { kdf: { N: 1024, r: 8, p: 1 } };
const HOST = 'diary.example';
const PUBLIC_DIR = path.resolve(__dirname, '..', '..', 'public');
const running: RunningHosted[] = [];

afterEach(async () => {
  for (const r of running.splice(0)) await r.stop();
});
afterAll(cleanupTempDirs);

/** A UI folder like dist/: the web client's index.html plus the real legal pages from public/. */
function uiDir(): string {
  const dir = tempDataDir();
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>Your Personal Diary</title><div id="root"></div>');
  for (const page of ['privacy', 'delete-account', 'terms']) fs.cpSync(path.join(PUBLIC_DIR, page), path.join(dir, page), { recursive: true });
  return dir;
}

async function boot() {
  const env = loadHostedEnv({ DIARY_MODE: 'hosted', DIARY_PUBLIC_URL: `https://${HOST}`, DIARY_BIND: '127.0.0.1' });
  const config = loadConfig(['--data-dir', tempDataDir(), '--static', uiDir()], { DIARY_MODE: 'hosted' });
  const srv = await startHosted(config, env, { port: 0, quiet: true, auth: FAST });
  running.push(srv);
  const agent = supertest(srv.localUrl);
  return (url: string, host = HOST) => agent.get(url).set('Host', host).set('X-Forwarded-Proto', 'https').set('X-Forwarded-For', '203.0.113.9');
}

describe('legal pages on the hosted server', () => {
  it('serves /privacy, /delete-account and /terms in English, each locale in its folder, with the hosted headers', async () => {
    const get = await boot();
    for (const page of ['privacy', 'delete-account', 'terms']) {
      const bare = await get(`/${page}`);
      expect(bare.status, page).toBe(301);
      expect(bare.headers.location, page).toBe(`/${page}/`);

      const english = await get(`/${page}/`);
      expect(english.status, page).toBe(200);
      expect(english.headers['content-type'], page).toMatch(/^text\/html/);
      expect(english.text, page).toContain('<html lang="en" dir="ltr">');
      expect(english.text, page).toContain('Your Personal Diary');
      expect(english.text, page).not.toContain('<div id="root">');
      // The hosted security headers apply to the pages too; their inline <style> is allowed, scripts are not needed.
      expect(english.headers['content-security-policy'], page).toContain("style-src 'self' 'unsafe-inline'");
      expect(english.headers['content-security-policy'], page).toContain("script-src 'self'");
      expect(english.headers['strict-transport-security'], page).toBeDefined();
      expect(english.headers['cache-control'], page).toBe('no-cache');

      const hebrew = await get(`/${page}/he/`);
      expect(hebrew.status, page).toBe(200);
      expect(hebrew.text, page).toContain('<html lang="he" dir="rtl">');
      expect((await get(`/${page}/he`)).headers.location, page).toBe(`/${page}/he/`);
    }
  });

  it('every locale folder is served', async () => {
    const get = await boot();
    const locales = fs.readdirSync(path.join(PUBLIC_DIR, 'privacy')).filter((name) => fs.statSync(path.join(PUBLIC_DIR, 'privacy', name)).isDirectory());
    expect(locales).toHaveLength(20);
    for (const code of locales) {
      const res = await get(`/privacy/${code}/`);
      expect(res.status, code).toBe(200);
      expect(res.text, code).toContain(`<html lang="${code}"`);
    }
  });

  it('a missing language falls back to the web client; another Host is refused before anything is served', async () => {
    const get = await boot();
    const missing = await get('/privacy/xx/');
    expect(missing.status).toBe(200);
    expect(missing.text).toContain('<div id="root">');
    expect((await get('/privacy/', 'evil.example')).status).toBe(421);
  });
});
