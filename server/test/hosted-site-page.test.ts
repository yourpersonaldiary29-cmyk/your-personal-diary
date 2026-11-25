/**
 * The public site of the app (docs/site-tasks/SITE.md, version 2) in the hosted image and on the hosted server.
 * scripts/site/build-site.mjs builds it from site/: eight pages in each of the 20 languages under /about/ (the
 * home page, and since 2026-11-22 "About the app" as a page of its own at /about/app/), one style sheet, one
 * script, the images and the installer files of the Downloads page. The site is
 * hosted-only, so scripts/hosted/stage-image.mjs writes it into the staged image at ui/about/ - next to the
 * web UI, never into public/ or dist/ - and the hosted composition serves ui/ with express.static BEFORE the
 * SPA fallback. The server adds POST /api/contact, where the form of every page posts (server/src/hosted/contact.ts,
 * tested in hosted-contact.test.ts), and the Downloads pages and installers of the merged list - the image's and
 * the owner's uploads (server/src/hosted/downloads.ts, tested in hosted-downloads.test.ts); with nothing uploaded
 * or removed they are the built files byte for byte. This file proves:
 *
 *   staging (stage-image.mjs run as the deploy runs it, with a stand-in bundle and a small UI folder):
 *     (a) a tree with a UI holds ui/about/ - the 160 pages, site.css, site.js, the images and the installers
 *         with the listed size and SHA-256 - and nothing of it anywhere else; --verify-only knows the site
 *         and notices a missing page, a missing image and an installer that is another file;
 *     (b) --no-ui stages no about/ at all;
 *     (c) a web UI that already has an "about" entry is refused.
 *   serving (the real site in a temporary UI folder, fictional publisher and host, TEST-NET client address):
 *     - every one of the 160 pages answers in its own language; a folder without its slash redirects to it;
 *       there is no /about/en/; a language or page that does not exist falls back to the web client;
 *     - site.css and site.js are served as a style sheet and a script, the images as image/png, the icon as
 *       SVG - byte for byte, never cached forever;
 *     - an installer is served whole, with its own content type, and can be resumed; a name that is not listed is 404;
 *     - the Content-Security-Policy the server sends allows everything a page needs - its style sheet, its
 *       script, its images, its form - and a page needs nothing the policy refuses;
 *     - only the two result pages keep search engines away;
 *     - the form of a page, posted as a browser posts it, is answered with a redirect to a result page of
 *       the same language that the site really has;
 *     - the site does not offer the web version (the owner's rule of 2026-11-23: "delete the option of opening
 *       the app in the browser. I want them to download."): the web client still answers at the root of the
 *       server, but no address in any of the 160 pages leads there, and the home page leads to Downloads;
 *     - another Host is refused before anything is served.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { LOCALES, readSiteUrl } from '../../scripts/legal/build-pages.mjs';
import { buildSite, CONTACT_ACTION, CSS_NAME, FILES_DIR, formatDownloads, IMAGE_LIST_FILE, pageFile, PLATFORMS, SCRIPT_NAME, SITE_ID, SITE_PAGES, siteDir, siteTreeProblems, writeSite } from '../../scripts/site/build-site.mjs';
import { loadConfig, loadHostedEnv } from '../src/config';
import { startHosted, type RunningHosted } from '../src/hosted';
import { cleanupTempDirs, tempDataDir } from './helpers';

const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const FAST = { kdf: { N: 1024, r: 8, p: 1 } };
const HOST = 'diary.example';
/** Fictional values: the owner's are never written into a test. */
const SETTINGS = { publisherName: 'Example Publisher', contactEmail: 'help@example.test', effectiveDate: '2026-11-08', termsEffectiveDate: '2026-11-12', minimumAge: 16 };
const PAGE_COUNT = SITE_PAGES.length * LOCALES.length;
const IMAGE_COUNT = LOCALES.length * 5 + 2;
const running: RunningHosted[] = [];

afterEach(async () => {
  for (const r of running.splice(0)) await r.stop();
});
afterAll(cleanupTempDirs);

function write(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

const sha256 = (data: Buffer): string => createHash('sha256').update(data).digest('hex');

/** Every file under `dir`, relative, with forward slashes. */
function filesUnder(dir: string): string[] {
  const found: string[] = [];
  const walk = (current: string): void => {
    for (const name of fs.readdirSync(current)) {
      const full = path.join(current, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else found.push(path.relative(dir, full).split(path.sep).join('/'));
    }
  };
  walk(dir);
  return found.sort();
}

describe('scripts/hosted/stage-image.mjs: the public site in the staged image', () => {
  function stage(args: string[]) {
    const r = spawnSync(process.execPath, ['scripts/hosted/stage-image.mjs', ...args], { cwd: ROOT, encoding: 'utf8', timeout: 120_000 });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
  }

  /**
   * A stand-in for the hosted bundle and the operator tool next to it. stage-image.mjs copies the bundle and
   * audits its text; it never runs it (the real bundle is staged by hosted-bundle-audit.test.ts).
   */
  function standInBundle(): string {
    const dir = tempDataDir();
    write(path.join(dir, 'server-hosted.cjs'), "'use strict';\nmodule.exports = {};\n");
    write(path.join(dir, 'admin.cjs'), 'const http = require("node:http");\nhttp.request({ host: "127.0.0.1", port: 8080 });\n');
    return path.join(dir, 'server-hosted.cjs');
  }

  /** A built web UI like dist/: every file of public/ (a UI older than public/ is refused) plus the client's index.html. */
  function webUi(extra: Record<string, string> = {}): string {
    const dir = tempDataDir();
    fs.cpSync(PUBLIC_DIR, dir, { recursive: true });
    write(path.join(dir, 'index.html'), '<!doctype html><title>Your Personal Diary</title><div id="root"></div>');
    write(path.join(dir, 'assets', 'index-abc12345.js'), 'console.log(1);');
    for (const [rel, text] of Object.entries(extra)) write(path.join(dir, ...rel.split('/')), text);
    return dir;
  }

  it('(a) a tree with a UI holds ui/about/ - pages, style sheet, script, images, installers; --verify-only knows the site', () => {
    const outDir = path.join(tempDataDir(), 'image');
    const staged = stage([`--bundle=${standInBundle()}`, `--ui=${webUi()}`, `--out=${outDir}`]);
    // The texts that wait for their translation are staged with a warning; nothing else may be said.
    const waiting = /^\[stage-image\] WARNING: .*(?:TODO-TRANSLATE|behind the English document).*\n/gm;
    expect({ status: staged.status, stderr: staged.stderr.replace(waiting, '') }).toEqual({ status: 0, stderr: '' });
    expect(staged.stdout).toContain('[stage-image] OK');
    expect(staged.stdout).toContain('ui/, ui/about/');

    const ui = path.join(outDir, 'ui');
    const about = path.join(ui, 'about');
    // The web UI as before, the legal pages with it ...
    expect(fs.readFileSync(path.join(ui, 'index.html'), 'utf8')).toContain('<div id="root">');
    expect(fs.existsSync(path.join(ui, 'privacy', 'he', 'index.html'))).toBe(true);
    // ... and the site: the pages of every language, the style sheet, the script, the images, the installers.
    const built = buildSite();
    const installers = PLATFORMS.flatMap((platform) => built.downloads[platform]);
    expect(built.pages.size).toBe(PAGE_COUNT);
    expect(installers.length).toBeGreaterThanOrEqual(3);
    expect(filesUnder(about)).toEqual([...built.pages.keys(), ...built.files.keys(), ...built.assets.keys()].sort());
    // The pages, site.css, site.js, the list of the installers (files/downloads.json, for the server), the images, the installers.
    expect(filesUnder(about)).toHaveLength(PAGE_COUNT + 3 + IMAGE_COUNT + installers.length);
    expect(fs.readFileSync(path.join(about, ...IMAGE_LIST_FILE.split('/')), 'utf8')).toBe(formatDownloads(built.downloads));
    for (const [rel, html] of built.pages) expect(fs.readFileSync(path.join(about, ...rel.split('/')), 'utf8'), rel).toBe(html);
    expect(fs.readFileSync(path.join(about, 'he', 'faq', 'index.html'), 'utf8')).toContain('<html lang="he" dir="rtl">');
    expect(fs.existsSync(path.join(about, 'en'))).toBe(false);
    expect(fs.readFileSync(path.join(about, CSS_NAME), 'utf8')).toBe(built.files.get(CSS_NAME));
    expect(fs.readFileSync(path.join(about, SCRIPT_NAME), 'utf8')).toBe(fs.readFileSync(path.join(ROOT, 'site', 'site.js'), 'utf8'));
    expect(fs.readFileSync(path.join(about, 'img', 'he', 'phone-home.png')).equals(fs.readFileSync(path.join(ROOT, 'play', 'screenshots', 'iw-IL', '01-home.png')))).toBe(true);
    expect(fs.readFileSync(path.join(about, 'img', 'en', 'desktop-home.png')).equals(fs.readFileSync(path.join(ROOT, 'store', 'screenshots', 'en-US', '01-home.png')))).toBe(true);
    expect(fs.readFileSync(path.join(about, 'img', 'icon.svg')).equals(fs.readFileSync(path.join(PUBLIC_DIR, 'favicon.svg')))).toBe(true);
    for (const row of installers) {
      const copy = fs.readFileSync(path.join(about, FILES_DIR, row.file));
      expect([row.file, copy.length, sha256(copy)]).toEqual([row.file, row.bytes, row.sha256]);
    }
    expect(siteTreeProblems(ui)).toEqual([]);
    // Nowhere else in the image: not next to the server, and the web UI itself got no file of the site.
    expect(fs.existsSync(path.join(outDir, 'about'))).toBe(false);
    expect(filesUnder(outDir).filter((rel) => /\.(?:exe|apk|dmg)$/.test(rel) && !rel.startsWith(`ui/about/${FILES_DIR}/`))).toEqual([]);
    expect(fs.existsSync(path.join(ui, CSS_NAME)) || fs.existsSync(path.join(ui, SCRIPT_NAME)) || fs.existsSync(path.join(ui, FILES_DIR))).toBe(false);

    const manifest = JSON.parse(fs.readFileSync(path.join(outDir, '.staged.json'), 'utf8')) as {
      ui: boolean;
      files: string[];
      site: { pages: number; images: number; installers: Array<{ file: string; version: string; bytes: number; sha256: string }>; untranslated: string[]; behind: string[] };
    };
    expect(manifest.ui).toBe(true);
    expect(manifest.files).toEqual(expect.arrayContaining(['ui/', 'ui/about/']));
    expect(manifest.site).toEqual({
      pages: PAGE_COUNT,
      images: IMAGE_COUNT,
      installers: installers.map((row) => ({ file: row.file, version: row.version, bytes: row.bytes, sha256: row.sha256 })),
      untranslated: built.untranslated,
      behind: built.behind,
    });

    // The script's own verification passes on the tree, and notices what is missing or is another file.
    const verify = (): ReturnType<typeof stage> => stage([`--out=${outDir}`, '--verify-only']);
    expect(verify()).toMatchObject({ status: 0 });
    fs.rmSync(path.join(about, 'img', 'de', 'desktop-home.png'));
    const hole = verify();
    expect(hole.status).toBe(1);
    // The screens are on the About page of the language (the home page shows the first phone screen only).
    expect(hole.stderr).toContain('ui/about/img/de/desktop-home.png is missing (de/app/index.html refers to it)');
    fs.rmSync(path.join(about, 'fr', 'downloads'), { recursive: true });
    expect(verify().stderr).toContain('ui/about/fr/downloads/index.html is missing');
    fs.writeFileSync(path.join(about, FILES_DIR, installers[0].file), 'another file');
    const changed = verify();
    expect(changed.status).toBe(1);
    expect(changed.stderr).toContain(`ui/about/${FILES_DIR}/${installers[0].file} is 12 bytes, the Downloads page says ${installers[0].bytes}`);
    fs.rmSync(path.join(about, CSS_NAME));
    expect(verify().stderr).toContain('ui/about/site.css is missing (index.html refers to it)');
    fs.rmSync(about, { recursive: true });
    const gone = verify();
    expect(gone.status).toBe(1);
    expect(gone.stderr).toContain('ui/about/index.html missing from the staged tree');
  }, 180_000);

  it('(b) --no-ui stages no about/ at all', () => {
    const outDir = path.join(tempDataDir(), 'image');
    const staged = stage([`--bundle=${standInBundle()}`, `--out=${outDir}`, '--no-ui']);
    expect({ status: staged.status, stderr: staged.stderr }).toEqual({ status: 0, stderr: '' });
    expect(fs.existsSync(path.join(outDir, 'ui'))).toBe(false);
    expect(filesUnder(outDir).filter((rel) => rel.split('/').includes(SITE_ID) || /\.(?:exe|apk|dmg)$/.test(rel))).toEqual([]);
    const manifest = JSON.parse(fs.readFileSync(path.join(outDir, '.staged.json'), 'utf8')) as { ui: boolean; files: string[]; site?: unknown };
    expect(manifest.ui).toBe(false);
    expect(manifest.files.filter((name) => name.startsWith('ui'))).toEqual([]);
    expect(manifest.site).toBeUndefined();
    expect(stage([`--out=${outDir}`, '--no-ui', '--verify-only'])).toMatchObject({ status: 0 });
  }, 120_000);

  it('(c) a web UI that already has an "about" entry is refused: nothing in the client may claim the address', () => {
    const claims: Array<Record<string, string>> = [{ 'about/index.html': '<h1>About</h1>' }, { about: 'a file, not a folder' }];
    for (const extra of claims) {
      const outDir = path.join(tempDataDir(), 'image');
      const refused = stage([`--bundle=${standInBundle()}`, `--ui=${webUi(extra)}`, `--out=${outDir}`]);
      expect(refused.status).toBe(1);
      expect(refused.stderr).toContain('about exists - the web UI may not hold an "about" entry');
      // Neither the client's page nor ours was staged under that name.
      expect(fs.existsSync(path.join(outDir, 'ui', 'about'))).toBe(false);
    }
    // --ui must be a folder (usage error), and public/ itself holds no such entry (it is copied into every client).
    expect(stage([`--bundle=${standInBundle()}`, `--ui=${path.join(tempDataDir(), 'missing')}`, `--out=${path.join(tempDataDir(), 'image')}`]).status).toBe(2);
    expect(fs.existsSync(path.join(PUBLIC_DIR, SITE_ID))).toBe(false);
  }, 120_000);
});

describe('the public site on the hosted server', () => {
  const built = buildSite({ settings: SETTINGS });

  /** A UI folder like the image's ui/: the web client's index.html plus the site, written by the real builder. */
  function uiDir(): string {
    const dir = tempDataDir();
    write(path.join(dir, 'index.html'), '<!doctype html><title>Your Personal Diary</title><div id="root"></div>');
    writeSite(built, dir);
    return dir;
  }

  async function boot() {
    const env = loadHostedEnv({ DIARY_MODE: 'hosted', DIARY_PUBLIC_URL: `https://${HOST}`, DIARY_BIND: '127.0.0.1' });
    const config = loadConfig(['--data-dir', tempDataDir(), '--static', uiDir()], { DIARY_MODE: 'hosted' });
    const srv = await startHosted(config, env, { port: 0, quiet: true, auth: FAST });
    running.push(srv);
    const agent = supertest(srv.localUrl);
    const get = (url: string, host = HOST) => agent.get(url).set('Host', host).set('X-Forwarded-Proto', 'https').set('X-Forwarded-For', '203.0.113.9');
    /** The form of a page as a browser posts it: urlencoded, from the site's own origin. */
    const post = (fields: Record<string, string>) =>
      agent
        .post(CONTACT_ACTION)
        .set('Host', HOST)
        .set('X-Forwarded-Proto', 'https')
        .set('X-Forwarded-For', '203.0.113.9')
        .set('Origin', `https://${HOST}`)
        .set('Referer', `https://${HOST}/about/`)
        .type('form')
        .send(fields);
    return { get, post };
  }

  /** A whole file as bytes, whatever its content type. */
  const bytes = (res: supertest.Response): Buffer => (Buffer.isBuffer(res.body) ? res.body : Buffer.from(res.text ?? '', 'utf8'));

  /** A Content-Security-Policy header as directive -> sources. */
  function directives(header: string): Record<string, string[]> {
    return Object.fromEntries(
      header
        .split(';')
        .map((part) => part.trim().split(/\s+/))
        .filter((words) => words[0])
        .map(([name, ...sources]) => [name, sources]),
    );
  }

  it('serves the 160 pages, each in its own language; a folder without its slash redirects; there is no /about/en/', async () => {
    const { get } = await boot();
    const bare = await get('/about');
    expect(bare.status).toBe(301);
    expect(bare.headers.location).toBe('/about/');

    const english = await get('/about/');
    expect(english.status).toBe(200);
    expect(english.headers['content-type']).toMatch(/^text\/html/);
    expect(english.text).toBe(built.pages.get('index.html'));
    expect(english.text).toContain('<html lang="en" dir="ltr">');
    expect(english.text).toContain('<bdi lang="en" dir="ltr">Your Personal Diary</bdi>');
    expect(english.text).not.toContain('<div id="root">');
    expect(english.headers['cache-control']).toBe('no-cache');
    expect(english.headers['strict-transport-security']).toBeDefined();
    expect(english.headers['x-content-type-options']).toBe('nosniff');

    expect(LOCALES).toHaveLength(20);
    expect(SITE_PAGES).toHaveLength(8);
    expect(built.pages.size).toBe(160);
    for (const l of LOCALES) {
      for (const page of SITE_PAGES) {
        const url = `/about/${siteDir(page.id, l.code)}`;
        const res = await get(url);
        expect(res.status, url).toBe(200);
        expect(res.headers['content-type'], url).toMatch(/^text\/html/);
        expect(res.headers['cache-control'], url).toBe('no-cache');
        expect(res.text, url).toBe(built.pages.get(pageFile(page.id, l.code)));
        expect(res.text, url).toContain(`<html lang="${l.code}" dir="${l.dir}">`);
      }
    }
    // The addresses of SITE.md section 1, by their literal paths. The home page starts with the logo and the name;
    // "About the app" is a page of its own.
    for (const [url, mark] of [
      ['/about/', '<p class="home-brand"><img class="home-icon" src="./img/icon.svg" width="96" height="96" alt=""><bdi lang="en" dir="ltr">Your Personal Diary</bdi></p>'],
      ['/about/app/', '<h1>About the app</h1>'],
      ['/about/app/', '<section id="features">'],
      ['/about/he/app/', '<html lang="he" dir="rtl">'],
      ['/about/terms/', '<h1>Terms of Use - Your Personal Diary</h1>'],
      ['/about/faq/', '<h1>Questions and answers</h1>'],
      ['/about/privacy/', '<h1>Privacy Policy - Your Personal Diary</h1>'],
      ['/about/downloads/', '<h1>Downloads</h1>'],
      ['/about/contact/sent/', '<h1>Your message was sent</h1>'],
      ['/about/contact/error/', '<h1>Your message was not sent</h1>'],
      ['/about/he/terms/', '<html lang="he" dir="rtl">'],
      ['/about/he/contact/sent/', '<html lang="he" dir="rtl">'],
    ]) {
      expect((await get(url)).text, url).toContain(mark);
    }
    // The home page no longer holds what the About page shows, and the logo of every page leads to it.
    expect(english.text).not.toContain('<section id="features">');
    expect((await get('/about/app/')).text).toContain('<a class="brand" href="../">');
    expect((await get('/about/he/app/')).text).toContain('<a class="brand" href="../">');
    for (const [url, location] of [
      ['/about/he', '/about/he/'],
      ['/about/app', '/about/app/'],
      ['/about/he/app', '/about/he/app/'],
      ['/about/terms', '/about/terms/'],
      ['/about/he/downloads', '/about/he/downloads/'],
      ['/about/contact/sent', '/about/contact/sent/'],
    ]) {
      const res = await get(url);
      expect([url, res.status, res.headers.location]).toEqual([url, 301, location]);
    }
    // English has no folder of its own, and what does not exist is answered by the web client like any unknown path.
    for (const url of ['/about/en/', '/about/en/app/', '/about/xx/', '/about/he/nothing/', '/about/contact/']) {
      const res = await get(url);
      expect([url, res.status]).toEqual([url, 200]);
      expect(res.text, url).toContain('<div id="root">');
    }
  }, 60_000);

  it('serves site.css and site.js as a style sheet and a script, the images as image/png and the icon as SVG - never cached forever', async () => {
    const { get } = await boot();
    const css = await get('/about/site.css');
    expect([css.status, css.headers['cache-control'], css.headers['x-content-type-options']]).toEqual([200, 'no-cache', 'nosniff']);
    expect(css.headers['content-type']).toMatch(/^text\/css/);
    expect(css.text).toBe(built.files.get(CSS_NAME));
    const script = await get('/about/site.js');
    expect([script.status, script.headers['cache-control'], script.headers['x-content-type-options']]).toEqual([200, 'no-cache', 'nosniff']);
    // "nosniff" makes a browser refuse a script that is not served as one.
    expect(script.headers['content-type']).toMatch(/^(?:text|application)\/javascript/);
    expect(bytes(script).toString('utf8')).toBe(fs.readFileSync(path.join(ROOT, 'site', 'site.js'), 'utf8'));

    // The images of the two pages that show the app: the home page (the logo of the header, the same icon large in
    // the brand block, and the phone) and the About page (the logo and the five screens) - six files in all.
    const served = new Set<string>();
    for (const [base, count, pattern] of [
      ['/about/he/', 3, /^\.\.\/img\/(?:icon\.svg|he\/phone-home\.png)$/],
      ['/about/he/app/', 6, /^\.\.\/\.\.\/img\/(?:icon\.svg|he\/[a-z-]+\.png)$/],
    ] as const) {
      const page = (await get(base)).text;
      const sources = [...page.matchAll(/<img[^>]* src="([^"]+)"/g)].map((m) => m[1]);
      expect(sources, base).toHaveLength(count);
      for (const src of new Set(sources)) {
        expect(src, base).toMatch(pattern);
        const url = new URL(src, `https://${HOST}${base}`).pathname;
        const image = await get(url);
        expect(image.status, url).toBe(200);
        expect(image.headers['content-type'], url).toBe(url.endsWith('.svg') ? 'image/svg+xml' : 'image/png');
        expect(image.headers['x-content-type-options'], url).toBe('nosniff');
        expect(image.headers['cache-control'], url).toBe('no-cache');
        served.add(url);
      }
    }
    expect([...served].sort()).toEqual(['/about/img/he/desktop-home.png', '/about/img/he/phone-entry.png', '/about/img/he/phone-habits.png', '/about/img/he/phone-home.png', '/about/img/he/phone-insights.png', '/about/img/icon.svg']);
    const phone = await get('/about/img/he/phone-home.png');
    expect((phone.body as Buffer).equals(fs.readFileSync(path.join(ROOT, 'play', 'screenshots', 'iw-IL', '01-home.png')))).toBe(true);
    const share = await get('/about/img/share.png');
    expect([share.status, share.headers['content-type'], share.headers['cache-control']]).toEqual([200, 'image/png', 'no-cache']);
  });

  it('serves an installer whole, with its own content type, and lets a download be resumed', async () => {
    const { get } = await boot();
    // What express.static says of the three kinds of file: never text/html, and for the Android package the type
    // a phone needs to offer the installation.
    const TYPES: Record<string, string> = { windows: 'application/x-msdos-program', android: 'application/vnd.android.package-archive', mac: 'application/x-apple-diskimage' };
    const downloads = (await get('/about/downloads/')).text;
    for (const platform of PLATFORMS) {
      const [row] = built.downloads[platform];
      // The link of the page, followed as a browser follows it.
      expect(downloads).toContain(`<a class="get" href="../${FILES_DIR}/${row.file}" download>`);
      const url = new URL(`../${FILES_DIR}/${row.file}`, `https://${HOST}/about/downloads/`).pathname;
      expect(url).toBe(`/about/${FILES_DIR}/${row.file}`);
      const file = await get(url)
        .buffer(true)
        .parse((res, done) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => done(null, Buffer.concat(chunks)));
        });
      expect(file.status, url).toBe(200);
      expect(file.headers['content-type'], url).toBe(TYPES[platform]);
      expect(Number(file.headers['content-length']), url).toBe(row.bytes);
      expect(file.headers['x-content-type-options'], url).toBe('nosniff');
      expect(file.headers['cache-control'], url).toBe('no-cache');
      expect(file.headers['accept-ranges'], url).toBe('bytes');
      const body = file.body as Buffer;
      expect([body.length, sha256(body)], url).toEqual([row.bytes, row.sha256]);
      // A download that was interrupted goes on where it stopped.
      const rest = await get(url)
        .set('Range', `bytes=${row.bytes - 1000}-`)
        .buffer(true)
        .parse((res, done) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => done(null, Buffer.concat(chunks)));
        });
      expect([rest.status, rest.headers['content-range']], url).toEqual([206, `bytes ${row.bytes - 1000}-${row.bytes - 1}/${row.bytes}`]);
      expect((rest.body as Buffer).equals(body.subarray(row.bytes - 1000)), url).toBe(true);
    }
    // A file that is not listed does not exist (docs/server-tasks/SERVER-CARD-V2.md A2): 404 - never another file of
    // the disk, never the list of the installers itself, never the web client.
    for (const url of [`/about/${FILES_DIR}/nothing.exe`, `/about/${FILES_DIR}/..%2f..%2findex.html`, `/about/${IMAGE_LIST_FILE}`, `/about/${FILES_DIR}/`, `/about/${FILES_DIR}`]) {
      const missing = await get(url);
      expect([url, missing.status], url).toEqual([url, 404]);
      expect(missing.text, url).not.toContain('<div id="root">');
      expect(missing.text, url).not.toContain('<h1>');
    }
  }, 60_000);

  it('the Content-Security-Policy the server sends allows a page: its style sheet, its script, its images and its form', async () => {
    const { get } = await boot();
    for (const url of ['/about/', '/about/app/', '/about/he/app/', '/about/downloads/', '/about/he/faq/', '/about/terms/', '/about/contact/error/']) {
      const res = await get(url);
      const csp = directives(res.headers['content-security-policy'] as string);
      // What a page needs: one style sheet, one script, images and an icon from its own origin, a form that
      // posts to its own origin - and nothing else.
      expect(csp['default-src']).toEqual(["'self'"]);
      expect(csp['script-src']).toEqual(["'self'"]);
      expect(csp['style-src']).toContain("'self'");
      expect(csp['img-src']).toContain("'self'");
      expect(csp['form-action']).toEqual(["'self'"]);
      expect(csp['base-uri']).toEqual(["'self'"]);
      const html = res.text;
      // What the policy refuses, a page does not have: no inline script, no event handler, no style attribute,
      // no inline style sheet, no frame, no <base>.
      const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
      expect(scripts.map((m) => m[2]), url).toEqual(['']);
      expect(scripts[0][1], url).toMatch(/^ src="(?:\.\.?\/)+site\.js" defer$/);
      expect(html, url).not.toMatch(/\son[a-z]+\s*=/i);
      expect(html, url).not.toMatch(/\sstyle\s*=/i);
      expect(html, url).not.toMatch(/<style\b/i);
      expect(html, url).not.toMatch(/javascript:/i);
      expect(html, url).not.toMatch(/<(?:iframe|object|embed|base)\b/i);
      // Every resource a page loads is a relative address inside the site, so it is the page's own origin.
      const loaded = [...html.matchAll(/<(?:img|script)[^>]* src="([^"]+)"/g), ...html.matchAll(/<link rel="(?:icon|stylesheet)"[^>]* href="([^"]+)"/g)].map((m) => m[1]);
      expect(loaded.length, url).toBeGreaterThanOrEqual(4);
      for (const address of loaded) {
        expect(address, url).toMatch(/^(?:\.\.?\/)+(?:site\.css|site\.js|img\/[a-z0-9/.-]+\.(?:png|svg))$/);
        expect(new URL(address, `https://${HOST}${url}`).pathname.startsWith('/about/'), `${url}: ${address}`).toBe(true);
      }
      // The form posts to the same origin (form-action 'self'); the result pages have none.
      const actions = [...html.matchAll(/<form\b[^>]* action="([^"]+)"/g)].map((m) => m[1]);
      expect(actions, url).toEqual(url.includes('/contact/') ? [] : [CONTACT_ACTION]);
    }
    // The answers of the files carry the same policy and are not sniffed either.
    const page = await get('/about/');
    for (const url of ['/about/site.js', '/about/site.css', '/about/img/en/phone-home.png']) {
      expect((await get(url)).headers['content-security-policy'], url).toBe(page.headers['content-security-policy']);
    }
  });

  it('only the two result pages keep search engines away', async () => {
    const { get } = await boot();
    for (const page of SITE_PAGES) {
      for (const code of ['en', 'he']) {
        const url = `/about/${siteDir(page.id, code)}`;
        const res = await get(url);
        expect(res.headers['x-robots-tag'], url).toBeUndefined();
        expect(/<meta name="robots" content="noindex">/.test(res.text), url).toBe(page.id === 'sent' || page.id === 'error');
        expect(res.text, url).toContain('<link rel="canonical" href="');
      }
    }
    // The server has no robots.txt: the path is answered by the web client like any unknown path - no rules, so
    // nothing is disallowed.
    const robots = await get('/robots.txt');
    expect(robots.text).not.toMatch(/disallow/i);
    expect(robots.headers['x-robots-tag']).toBeUndefined();
  });

  it('the form of a page, posted as a browser posts it, leads to a result page of the same language that exists', async () => {
    const { get, post } = await boot();
    // The fields a page really has: read from the markup, not written here a second time.
    const html = (await get('/about/he/downloads/')).text;
    const form = /<form\b[^>]*>([\s\S]*?)<\/form>/.exec(html)?.[1] ?? '';
    const names = [...form.matchAll(/<(?:input|textarea)\b[^>]* name="([^"]+)"/g)].map((m) => m[1]);
    expect(names).toEqual(['lang', 'website', 'firstName', 'lastName', 'email', 'message']);
    expect(/<input type="hidden" name="lang" value="([a-z]+)">/.exec(form)?.[1]).toBe('he');
    expect(html).toContain(`<form class="form list" method="post" action="${CONTACT_ACTION}">`);
    const message = { firstName: 'Dana', lastName: 'Levi', email: 'dana@example.test', message: 'A question about the diary.' };

    // A robot that fills the hidden field is told "sent" (and nothing is sent); no mail is set up on this test
    // server, so a real message is answered with the error page. Both answers are redirects inside the site.
    for (const [fields, outcome] of [
      [{ lang: 'he', website: 'https://spam.example', ...message }, 'sent'],
      [{ lang: 'en', website: 'x', ...message }, 'sent'],
      [{ lang: 'he', website: '', ...message }, 'error'],
      [{ lang: 'en', website: '', ...message }, 'error'],
    ] as const) {
      const res = await post(fields);
      const where = `${fields.lang} ${outcome}`;
      expect(res.status, where).toBe(303);
      expect(res.headers.location, where).toBe(`/about/${siteDir(outcome, fields.lang)}`);
      expect(res.headers['set-cookie'], where).toBeUndefined();
      // The page the visitor lands on is a page of the site, in the language of the form.
      const landed = await get(res.headers.location as string);
      expect(landed.status, where).toBe(200);
      expect(landed.text, where).toBe(built.pages.get(pageFile(outcome, fields.lang)));
      expect(landed.text, where).toContain(`<html lang="${fields.lang}"`);
    }
  });

  it('the site does not offer the web version: the web client answers at the root, and no address in a page leads there (the owner, 2026-11-23)', async () => {
    const { get } = await boot();
    // The web version itself is untouched: the root of the server answers with the web client, as before.
    const root = await get('/');
    expect([root.status, root.text.includes('<div id="root">')]).toEqual([200, true]);

    // What a visitor can follow from a page: every address in its markup, resolved from the address of the page -
    // on this server (the relative addresses) and on the fixed server (the absolute ones, which name it).
    const fixedHost = new URL(readSiteUrl()).host;
    const opensWebVersion = (address: string, pageUrl: string): boolean => {
      let url: URL;
      try {
        url = new URL(address, pageUrl);
      } catch {
        return false;
      }
      return /^https?:$/.test(url.protocol) && (url.host === HOST || url.host === fixedHost) && url.pathname === '/';
    };
    // The check sees the links the pages held until that day, and leaves the others alone.
    expect(opensWebVersion(`https://${fixedHost}/`, `https://${HOST}/about/`)).toBe(true);
    expect(opensWebVersion(`https://${fixedHost}`, `https://${HOST}/about/privacy/`)).toBe(true);
    expect(opensWebVersion('../', `https://${HOST}/about/`)).toBe(true);
    expect(opensWebVersion('../../', `https://${HOST}/about/he/`)).toBe(true);
    expect(opensWebVersion('/', `https://${HOST}/about/he/faq/`)).toBe(true);
    expect(opensWebVersion('./', `https://${HOST}/about/`)).toBe(false);
    expect(opensWebVersion('../', `https://${HOST}/about/he/`)).toBe(false);
    expect(opensWebVersion(`https://${fixedHost}/support/`, `https://${HOST}/about/`)).toBe(false);
    expect(opensWebVersion(CONTACT_ACTION, `https://${HOST}/about/`)).toBe(false);

    // The server answers every page with the built bytes (the first test), so the addresses are read from them.
    let read = 0;
    for (const l of LOCALES) {
      for (const page of SITE_PAGES) {
        const url = `/about/${siteDir(page.id, l.code)}`;
        const html = built.pages.get(pageFile(page.id, l.code)) ?? '';
        const addresses = [...html.matchAll(/\s(?:href|src|action|value)="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
        expect(addresses.length, url).toBeGreaterThan(40);
        read += addresses.length;
        expect(addresses.filter((address) => opensWebVersion(address, `https://${HOST}${url}`)), url).toEqual([]);
        expect(html.includes(`href="https://${fixedHost}"`) || html.includes(`href="https://${fixedHost}/"`), url).toBe(false);
        // Nor does a page send the visitor on by itself: a <meta http-equiv="refresh"> would hold an address that
        // the scan above does not read, so no page has a <meta http-equiv> at all.
        expect(/http-equiv/i.test(html), url).toBe(false);
      }
    }
    expect(read).toBeGreaterThan(PAGE_COUNT * 40);

    // The home page as the server answers it: two actions - Downloads, the primary button, and About the app -
    // and both lead to pages the server has.
    const home = (await get('/about/')).text;
    expect(home).toContain('<p class="actions"><a class="btn primary" href="./downloads/"><span>Downloads</span></a><a class="btn" href="./app/"><span>About the app</span></a></p>');
    expect(home).not.toContain('Open in your browser');
    const hebrewHome = (await get('/about/he/')).text;
    expect(hebrewHome.match(/<p class="actions">(?:<a class="btn(?: primary)?" href="\.\/(?:downloads|app)\/"><span>[^<]+<\/span><\/a>){2}<\/p>/)).not.toBeNull();
    for (const url of ['/about/downloads/', '/about/app/', '/about/he/downloads/', '/about/he/app/']) expect((await get(url)).status, url).toBe(200);
    // The Downloads page ends with the tabs and does not name the iPhone: an iPhone owner has nothing to download
    // yet, and the owner had the note that stood under the tabs deleted (2026-11-24). (So while site/settings.json
    // names no App Store link, as today; with that link set, a section with the heading "iPhone", one sentence and
    // the button of the App Store stands there - scripts/site/build-site.test.mjs, "downloads: a store link that is
    // set ...".) The Questions page has 29 questions.
    for (const url of ['/about/downloads/', '/about/he/downloads/']) {
      const downloads = (await get(url)).text;
      expect(downloads, url).not.toContain('<section class="more">');
      expect(downloads, url).not.toContain('iPhone');
      expect(downloads.match(/<section class="panel" id="(?:windows|android|mac)">/g) ?? [], url).toHaveLength(3);
    }
    expect(((await get('/about/faq/')).text.match(/<details class="qa">/g) ?? []).length).toBe(29);
  });

  it('another Host is refused before anything is served', async () => {
    const { get } = await boot();
    for (const url of ['/about/', '/about/he/faq/', '/about/site.js', '/about/img/en/phone-home.png', `/about/${FILES_DIR}/${built.downloads.windows[0].file}`]) {
      expect((await get(url, 'evil.example')).status, url).toBe(421);
    }
  });
});
