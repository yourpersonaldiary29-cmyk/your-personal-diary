/**
 * The files of the Downloads page, managed in the Server card (docs/server-tasks/SERVER-CARD-V2.md Part A):
 * server/src/hosted/downloads.ts (the merged list, the public side, the uploads), server/src/routes/server-downloads.ts
 * (the owner's API), the e-mails of server/src/mail/templates.ts. Against a real hosted server (startHosted) with the
 * real site in a temporary UI folder (built with fictional settings, as hosted-site-page.test.ts does), a capturing
 * mail transport and small stand-in installers - nothing leaves the machine:
 *
 *   - the signatures: a Windows program (MZ + PE at e_lfanew), an Android package (a ZIP whose central directory
 *     holds AndroidManifest.xml and classes.dex), a Mac disk image (the koly trailer) - and what is none of them;
 *   - nothing uploaded: the 20 Downloads pages are the builder's pages byte for byte; a name that is not listed,
 *     a path and the list file itself are 404;
 *   - the owner only, over HTTPS only; the body before the password; the password like every confirmed action;
 *   - a publication: streamed, measured, hashed, checked, named by the server, listed, served like the image's files
 *     (content type, no-cache, ranges); every Downloads page then is exactly the page the builder writes for the
 *     merged list; removeOlder; one e-mail in the owner's language and one log line without personal data;
 *   - the token: once, 15 minutes, this session only; a path in it; another user's session;
 *   - the body: too small, too large, another type, no length, a wrong signature for each platform, cut off -
 *     nothing published, no temporary file left; a disk without room; one upload at a time; the daily limit;
 *   - removing an uploaded file (deleted) and a file of the image (removed.json) - still removed after a restart,
 *     the page shows the empty-state text; mail not set up and an account without an address: done, and said so;
 *   - server archives leave the installers out; the local server has no such routes.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '@shared/i18n';
import type { AuthResponse, ServerDownloadResult, ServerDownloadRow, ServerDownloads, ServerDownloadUploadTicket } from '@shared/types';
import { LOCALES, readSiteUrl } from '../../scripts/legal/build-pages.mjs';
import { buildSite, contentFile, FILES_DIR, IMAGE_LIST_FILE, pageFile, readSiteSettings, renderSitePage, ROOT, writeSite, type Downloads } from '../../scripts/site/build-site.mjs';
import { PUBLIC_NAMES } from '../../scripts/site/downloads-shared.mjs';
import { loadConfig, loadHostedEnv } from '../src/config';
import { startHosted, type HostedStartOptions, type RunningHosted } from '../src/hosted';
import { isArchivedPath } from '../src/hosted/archive';
import { isAndroidPackage, isMacDiskImage, isWindowsProgram, zipEntryNames } from '../src/hosted/downloads';
import {
  DOWNLOADS_BUSY_KEY,
  DOWNLOADS_CONTENT_TYPE_KEY,
  DOWNLOADS_EXISTS_KEY,
  DOWNLOADS_LENGTH_REQUIRED_KEY,
  DOWNLOADS_NO_SPACE_KEY,
  DOWNLOADS_NOT_ANDROID_KEY,
  DOWNLOADS_NOT_LISTED_KEY,
  DOWNLOADS_NOT_MAC_KEY,
  DOWNLOADS_NOT_WINDOWS_KEY,
  DOWNLOADS_PASSWORD_REQUIRED_KEY,
  DOWNLOADS_PLATFORM_KEY,
  DOWNLOADS_TOKEN_KEY,
  DOWNLOADS_TOO_LARGE_KEY,
  DOWNLOADS_TOO_MANY_KEY,
  DOWNLOADS_TOO_SMALL_KEY,
  DOWNLOADS_UNAVAILABLE_KEY,
  DOWNLOADS_VERSION_KEY,
  DOWNLOADS_WRONG_PASSWORD_KEY,
} from '../src/hosted/downloads-errors';
import { OWNER_UNSET_KEY } from '../src/hosted/owner';
import type { SmtpTransport } from '../src/mail/transport';
import { cleanupTempDirs, makeTestApp, tempDataDir, testHostedOptions } from './helpers';
import { decodeWords, headersOf, partsOf } from './mail-fixtures';

const PASSWORD = 'Passw0rd!';
const FAST = { kdf: { N: 1024, r: 8, p: 1 } };
const HOST = 'diary.example';
const MiB = 1024 * 1024;
const SENDER = 'sender@example.test';
/** Fictional values: the owner's are never written into a test. */
const SETTINGS = { publisherName: 'Example Publisher', contactEmail: 'help@example.test', effectiveDate: '2026-11-08', termsEffectiveDate: '2026-11-12', minimumAge: 16 };
const START = Date.UTC(2026, 10, 18, 9, 0, 0);
const built = buildSite({ settings: SETTINGS });
const running: RunningHosted[] = [];

afterEach(async () => {
  for (const r of running.splice(0)) await r.stop();
});
afterAll(cleanupTempDirs);

// Stand-in installers ---------------------------------------------------------------------------

let serial = 0;
/** Bytes that differ from file to file, so that every file has its own SHA-256. */
function filler(size: number): Buffer {
  const bytes = Buffer.alloc(size, 0x2e);
  bytes.write(`stand-in ${(serial += 1)}`, 2, 'latin1');
  return bytes;
}
/** "MZ", e_lfanew = 0x80, "PE\0\0" there. */
function windowsExe(size = MiB + 4096): Buffer {
  const bytes = filler(size);
  bytes.write('MZ', 0, 'latin1');
  bytes.writeUInt32LE(0x80, 0x3c);
  bytes.write('PE\0\0', 0x80, 'latin1');
  return bytes;
}
/** A ZIP whose central directory names `names` (stored entries are not needed by the check), with a comment. */
function androidApk(size = MiB + 4096, names = ['AndroidManifest.xml', 'classes.dex', 'resources.arsc'], comment = 'signed'): Buffer {
  const directory = Buffer.concat(
    names.map((name) => {
      const header = Buffer.alloc(46);
      header.writeUInt32LE(0x02014b50, 0);
      header.writeUInt16LE(Buffer.byteLength(name), 28);
      return Buffer.concat([header, Buffer.from(name)]);
    }),
  );
  const note = Buffer.from(comment);
  const body = filler(size - directory.length - 22 - note.length);
  body.write('PK\x03\x04', 0, 'latin1');
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(names.length, 8);
  end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(body.length, 16);
  end.writeUInt16LE(note.length, 20);
  return Buffer.concat([body, directory, end, note]);
}
/** A UDIF trailer: "koly", version 4, header size 512, in the last 512 bytes. */
function macDmg(size = MiB + 4096): Buffer {
  const bytes = filler(size);
  const at = size - 512;
  bytes.fill(0, at);
  bytes.write('koly', at, 'latin1');
  bytes.writeUInt32BE(4, at + 4);
  bytes.writeUInt32BE(512, at + 8);
  return bytes;
}
const sha256 = (data: Buffer): string => createHash('sha256').update(data).digest('hex');

// The server ----------------------------------------------------------------------------------------

let uiFolder: string | null = null;
/** A UI folder like the image's ui/: the web client's index.html plus the real site, written once by the real builder. */
function ui(): string {
  if (!uiFolder) {
    const dir = tempDataDir();
    fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>Your Personal Diary</title><div id="root"></div>');
    writeSite(built, dir);
    uiFolder = dir;
  }
  return uiFolder;
}

interface Sent {
  envelope: { from: string; to: string };
  data: string;
}

async function boot(o: { dataDir?: string; downloads?: HostedStartOptions['downloads']; requestTimeoutMs?: number } = {}) {
  const dataDir = o.dataDir ?? tempDataDir();
  const logs: string[] = [];
  const sent: Sent[] = [];
  const transport: SmtpTransport = { send: async (_opts, envelope, data) => void sent.push({ envelope: { ...envelope }, data }) };
  let ownerId = '';
  const env = loadHostedEnv({ DIARY_MODE: 'hosted', DIARY_PUBLIC_URL: `https://${HOST}`, DIARY_BIND: '127.0.0.1' });
  const config = loadConfig(['--data-dir', dataDir, '--static', ui()], { DIARY_MODE: 'hosted' });
  const srv = await startHosted(config, env, {
    port: 0,
    quiet: true,
    auth: FAST,
    mailTransport: transport,
    ownerId: () => ownerId,
    log: (line) => logs.push(line),
    // A notional volume of 64 GiB, half free: the free space of the test machine's own disk decides nothing.
    downloads: { maxBytes: 3 * MiB, perDay: 50, volume: () => ({ totalBytes: 64 * 1024 * MiB, freeBytes: 32 * 1024 * MiB }), ...o.downloads },
    ...(o.requestTimeoutMs ? { requestTimeoutMs: o.requestTimeoutMs } : {}),
  });
  running.push(srv);
  const agent = supertest(srv.localUrl);
  const common = (r: supertest.Test, secure: boolean) => {
    r.set('Host', HOST).set('Accept-Language', 'en');
    return secure ? r.set('X-Forwarded-Proto', 'https') : r;
  };
  const as = (token: string, secure = true) => ({
    get: (url: string) => common(agent.get(url), secure).set('Authorization', `Bearer ${token}`),
    post: (url: string, body: object = {}) => common(agent.post(url), secure).set('Authorization', `Bearer ${token}`).send(body),
    put: (url: string, file: Buffer, type = 'application/octet-stream') => common(agent.put(url), secure).set('Authorization', `Bearer ${token}`).set('Content-Type', type).send(file),
  });
  /** The public site, as a visitor's browser asks for it (through the TLS edge). */
  const visit = (url: string) => common(agent.get(url), true);
  const register = async (username: string, extra: object = {}): Promise<AuthResponse> => {
    const res = await common(agent.post('/api/auth/register'), true).send({ firstName: 'Test', lastName: 'Owner', username, email: `${username}@example.test`, password: PASSWORD, confirmPassword: PASSWORD, privacyAccepted: true, termsAccepted: true, ...extra });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return res.body as AuthResponse;
  };
  const login = async (username: string): Promise<AuthResponse> => {
    const res = await common(agent.post('/api/auth/login'), true).send({ username, password: PASSWORD });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    return res.body as AuthResponse;
  };
  /** The owner registers (language `language`), becomes DIARY_OWNER_ID and - unless `mail` is false - fills in the E-mail card. */
  const owner = async (username = 'ownerdl', { mail = true, language = 'en' }: { mail?: boolean; language?: string } = {}) => {
    const auth = await register(username, { language });
    ownerId = auth.user.id;
    if (mail) {
      const saved = await common(agent.put('/api/server/mail'), true)
        .set('Authorization', `Bearer ${auth.token}`)
        .send({ enabled: true, host: 'smtp.mail.test', port: 465, security: 'tls', username: SENDER, smtpPassword: 'abcdefghijklmnop', password: PASSWORD });
      expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    }
    return { auth, o: as(auth.token) };
  };
  /** Intent + upload, as the card does it. */
  const publish = async (o: ReturnType<typeof as>, platform: string, version: string, file: Buffer, extra: object = {}) => {
    const intent = await o.post('/api/server/downloads/upload-intent', { platform, version, password: PASSWORD, ...extra });
    expect(intent.status, JSON.stringify(intent.body)).toBe(201);
    const ticket = intent.body as ServerDownloadUploadTicket;
    return { ticket, put: await o.put(ticket.uploadPath, file) };
  };
  return { srv, dataDir, logs, sent, as, visit, register, login, owner, publish, setOwner: (id: string) => void (ownerId = id) };
}

/**
 * A GET of the public site with the path sent exactly as written (supertest's URL parser would remove '.' segments and
 * decode some escapes before the request leaves), as a visitor's browser asks for it through the TLS edge.
 */
function rawGet(srv: RunningHosted, rawPath: string): Promise<{ status: number; type: string; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      { host: '127.0.0.1', port: srv.port, method: 'GET', path: rawPath, headers: { Host: HOST, 'X-Forwarded-Proto': 'https', 'Accept-Language': 'en' } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, type: String(res.headers['content-type'] ?? ''), body: Buffer.concat(chunks) }));
        res.on('error', reject);
      },
    );
    request.on('error', reject);
    request.end();
  });
}

/** A whole answer as bytes. */
function bytesOf(r: supertest.Test) {
  return r.buffer(true).parse((res, done) => {
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(chunk));
    res.on('end', () => done(null, Buffer.concat(chunks)));
  });
}

/** The rows of the merged list without `source`: the shape of site/downloads.json. */
function plain(platforms: ServerDownloads['platforms']): Downloads {
  const strip = (rows: ServerDownloadRow[]) => rows.map(({ version, date, file, bytes, sha256: hash }) => ({ version, date, file, bytes, sha256: hash }));
  return { windows: strip(platforms.windows), android: strip(platforms.android), mac: strip(platforms.mac) };
}

const siteSettings = readSiteSettings();
const siteUrl = readSiteUrl();
/** The Downloads page the builder writes for `downloads` in `code`. */
function builderPage(code: string, downloads: Downloads): string {
  const content: unknown = JSON.parse(fs.readFileSync(contentFile(ROOT, code), 'utf8'));
  return renderSitePage({ page: 'downloads', locale: code, content, settings: SETTINGS, siteSettings, siteUrl, downloads });
}
const downloadsUrl = (code: string): string => `/about/${pageFile('downloads', code).replace(/index\.html$/, '')}`;

/** Every file below `dir`, relative, forward slashes (none when it does not exist). */
function filesBelow(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return (fs.readdirSync(dir, { recursive: true }) as string[]).map((f) => String(f).split(path.sep).join('/')).filter((f) => fs.statSync(path.join(dir, f)).isFile()).sort();
}

// ---------------------------------------------------------------------------------------------------

describe('the signatures of the three kinds of installer', () => {
  it('Windows: "MZ" and "PE\\0\\0" at the offset of e_lfanew', () => {
    const exe = windowsExe(8192);
    expect(isWindowsProgram(exe)).toBe(true);
    const noMz = Buffer.from(exe);
    noMz.write('ZM', 0, 'latin1');
    expect(isWindowsProgram(noMz)).toBe(false);
    const noPe = Buffer.from(exe);
    noPe.write('XX', 0x80, 'latin1');
    expect(isWindowsProgram(noPe)).toBe(false);
    // e_lfanew outside what was kept, or inside the DOS header itself.
    const far = Buffer.from(exe);
    far.writeUInt32LE(0xfffffff0, 0x3c);
    expect(isWindowsProgram(far)).toBe(false);
    const inside = Buffer.from(exe);
    inside.writeUInt32LE(0x10, 0x3c);
    expect(isWindowsProgram(inside)).toBe(false);
    expect(isWindowsProgram(Buffer.from('MZ'))).toBe(false);
  });

  it('Android: a ZIP whose central directory holds AndroidManifest.xml and classes.dex - read from the end of the file', () => {
    const apk = androidApk(64 * 1024);
    expect([...(zipEntryNames(apk, apk.length) ?? [])]).toEqual(['AndroidManifest.xml', 'classes.dex', 'resources.arsc']);
    expect(isAndroidPackage(apk, apk.length)).toBe(true);
    // Only the last part of the file was kept: the same answer.
    expect(isAndroidPackage(apk.subarray(apk.length - 4096), apk.length)).toBe(true);
    // A comment of the maximum length still finds the end record.
    const longComment = androidApk(200 * 1024, undefined, 'x'.repeat(0xffff));
    expect(isAndroidPackage(longComment, longComment.length)).toBe(true);
    expect(isAndroidPackage(androidApk(64 * 1024, ['AndroidManifest.xml', 'resources.arsc']), 64 * 1024)).toBe(false);
    expect(isAndroidPackage(androidApk(64 * 1024, ['classes.dex']), 64 * 1024)).toBe(false);
    // The directory is not inside the kept bytes, the end record lies, ZIP64, not a ZIP at all.
    expect(zipEntryNames(apk.subarray(apk.length - 30), apk.length)).toBeNull();
    const lying = Buffer.from(apk);
    lying.writeUInt32LE(apk.length, apk.length - 'signed'.length - 22 + 16);
    expect(isAndroidPackage(lying, lying.length)).toBe(false);
    const zip64 = Buffer.from(apk);
    zip64.writeUInt16LE(0xffff, apk.length - 'signed'.length - 22 + 10);
    expect(isAndroidPackage(zip64, zip64.length)).toBe(false);
    expect(isAndroidPackage(windowsExe(64 * 1024), 64 * 1024)).toBe(false);
  });

  it('Mac: "koly" with a header of 512 bytes at the start of the last 512 bytes', () => {
    expect(isMacDiskImage(macDmg(8192))).toBe(true);
    const other = macDmg(8192);
    other.write('kolx', 8192 - 512, 'latin1');
    expect(isMacDiskImage(other)).toBe(false);
    const size = macDmg(8192);
    size.writeUInt32BE(200, 8192 - 512 + 8);
    expect(isMacDiskImage(size)).toBe(false);
    // One byte more after the trailer: it is no longer at the start of the last 512 bytes.
    expect(isMacDiskImage(Buffer.concat([macDmg(8192), Buffer.from([0])]))).toBe(false);
    expect(isMacDiskImage(Buffer.from('koly'))).toBe(false);
  });
});

describe('the public side: the Downloads pages and /about/files/', () => {
  it('nothing uploaded or removed: the 20 pages are the builder\'s pages byte for byte; what is not listed is 404', async () => {
    const { visit } = await boot();
    expect(LOCALES).toHaveLength(20);
    for (const l of LOCALES) {
      for (const url of [downloadsUrl(l.code), `${downloadsUrl(l.code)}index.html`]) {
        const res = await visit(url);
        expect([url, res.status, res.headers['cache-control']]).toEqual([url, 200, 'no-cache']);
        expect(res.headers['content-type'], url).toMatch(/^text\/html/);
        expect(res.text, url).toBe(built.pages.get(pageFile('downloads', l.code)));
      }
    }
    // HEAD answers like GET, without a body; a conditional request is answered 304.
    const first = await visit('/about/downloads/');
    const etag = first.headers.etag as string;
    expect(etag).toBeTruthy();
    expect((await visit('/about/downloads/').set('If-None-Match', etag)).status).toBe(304);
    // The files of the image, by the names the page links.
    for (const platform of ['windows', 'android', 'mac'] as const) {
      const [row] = built.downloads[platform];
      const file = await bytesOf(visit(`/about/${FILES_DIR}/${row.file}`));
      expect([file.status, sha256(file.body as Buffer)]).toEqual([200, row.sha256]);
    }
    for (const url of [`/about/${FILES_DIR}/nothing.exe`, `/about/${IMAGE_LIST_FILE}`, `/about/${FILES_DIR}/..%2f..%2findex.html`, `/about/${FILES_DIR}/%2e%2e%2f%2e%2e%2faccounts.json`, `/about/${FILES_DIR}/`, `/about/${FILES_DIR}/a/b.exe`]) {
      expect([url, (await visit(url)).status]).toEqual([url, 404]);
    }
    // Every other page of the site is the static file as before.
    expect((await visit('/about/faq/')).text).toBe(built.pages.get(pageFile('faq', 'en')));
    expect((await visit('/about/he/downloads')).status).toBe(301);
  }, 60_000);

  it('another spelling of the same path gets the same answer: a removed file, the list file and the image\'s own pages stay out of reach', async () => {
    const b = await boot();
    const { o } = await b.owner('ownerpaths');
    const [gone] = built.downloads.android;
    const [kept] = built.downloads.windows;
    const removed = await o.post('/api/server/downloads/remove', { platform: 'android', version: gone.version, password: PASSWORD });
    expect(removed.status, JSON.stringify(removed.body)).toBe(200);
    // The ways express.static would still read about/files/<name> of the image: '//', '.', '..', escapes, '\', case.
    const spellings = (name: string) => [
      `/about//files/${name}`,
      `/about/./files/${name}`,
      `/about/%2e/files/${name}`,
      `/about/x/../files/${name}`,
      `/about/files%2F${name}`,
      `/about/files%2f${name}`,
      `/about/files%5C${name}`,
      `/about/%66iles/${name}`,
      `/about/fil%65s/${name}`,
      `/about/FILES/${name}`,
      `/about/files/./${name}`,
    ];
    for (const url of [`/about/${FILES_DIR}/${gone.file}`, ...spellings(gone.file), ...spellings('downloads.json')]) {
      const res = await rawGet(b.srv, url);
      expect([url, res.status, res.type]).toEqual([url, 404, 'text/plain; charset=utf-8']);
    }
    // A listed file is served by any of them.
    for (const url of spellings(kept.file)) {
      const res = await rawGet(b.srv, url);
      expect([url, res.status, sha256(res.body)]).toEqual([url, 200, kept.sha256]);
    }
    // The Downloads pages: the merged list under every spelling, never the page of the image behind it.
    const english = (await rawGet(b.srv, '/about/downloads/')).body.toString('utf8');
    const hebrew = (await rawGet(b.srv, '/about/he/downloads/')).body.toString('utf8');
    expect(english).not.toContain(gone.file);
    expect(built.pages.get(pageFile('downloads', 'en'))).toContain(gone.file);
    const pages: Array<[string, string]> = [
      ['/about//downloads/', english],
      ['/about/./downloads/', english],
      ['/about/%64ownloads/', english],
      ['/about/downloads/%69ndex.html', english],
      ['/about/downloads%2Findex.html', english],
      ['/about/x/../downloads/', english],
      ['/about/DOWNLOADS/', english],
      ['/about/he//downloads/', hebrew],
      ['/about//he/downloads/', hebrew],
      ['/about/%68e/downloads/index.html', hebrew],
    ];
    for (const [url, page] of pages) {
      const res = await rawGet(b.srv, url);
      expect([url, res.status]).toEqual([url, 200]);
      expect(res.body.toString('utf8'), url).toBe(page);
    }
  }, 60_000);
});

describe('the owner\'s API: who, how, and the body before the password', () => {
  it('the owner only, over HTTPS only; 403 for everyone while no owner is configured; the local server has no such routes', async () => {
    const b = await boot();
    const first = await b.register('ownerone');
    const second = await b.register('othertwo');
    const o = b.as(first.token);
    const x = b.as(second.token);
    const intent = { platform: 'windows', version: '1.1.0', password: PASSWORD };
    // No owner yet.
    const unset = await o.get('/api/server/downloads');
    expect([unset.status, unset.body.message]).toEqual([403, t('en', OWNER_UNSET_KEY)]);
    b.setOwner(first.user.id);
    // Another account, plain HTTP, no session: refused before anything is looked at.
    for (const res of [
      await x.get('/api/server/downloads'),
      await x.post('/api/server/downloads/upload-intent', intent),
      await x.post('/api/server/downloads/remove', intent),
      await b.as(first.token, false).get('/api/server/downloads'),
      await b.as(first.token, false).post('/api/server/downloads/upload-intent', intent),
    ]) {
      expect(res.status).toBe(403);
    }
    expect((await b.as('not-a-token').get('/api/server/downloads')).status).toBe(401);
    // The owner sees the list of the image and the limits.
    const list = (await o.get('/api/server/downloads')).body as ServerDownloads;
    expect(plain(list.platforms)).toEqual(built.downloads);
    expect(list.platforms.windows.map((row) => row.source)).toEqual(built.downloads.windows.map(() => 'image'));
    expect(list.limits).toMatchObject({ maxBytes: 3 * MiB, minBytes: MiB, perDay: 50, usedToday: 0, tokenMinutes: 15, keepFreePct: 15 });
    expect(list.busy).toBe(false);
    expect(list.email).toBe('notConfigured');

    // The local server (desktop, phone): no such route; a hosted app built by hand without the controller: 403.
    const local = await makeTestApp();
    expect((await local.get('/api/server/downloads')).status).toBe(404);
    const bare = await makeTestApp({ hosted: testHostedOptions({ ownerId: () => 'u_test' }) });
    const unavailable = await bare.get('/api/server/downloads').set('X-Forwarded-Proto', 'https').set('Host', 'diary.example');
    expect([unavailable.status, unavailable.body.code]).toEqual([403, 'FORBIDDEN']);
    expect(unavailable.body.message).toBe(t('he', DOWNLOADS_UNAVAILABLE_KEY));
  });

  it('the intent: platform, version, already listed - before the password; then the password like every confirmed action', async () => {
    const b = await boot();
    const { o } = await b.owner();
    const post = (body: object) => o.post('/api/server/downloads/upload-intent', body);
    const field = (res: supertest.Response) => [res.status, res.body.code, res.body.field, res.body.message];
    expect(field(await post({ platform: 'iphone', version: '1.1.0', password: PASSWORD }))).toEqual([400, 'VALIDATION', 'platform', t('en', DOWNLOADS_PLATFORM_KEY)]);
    for (const version of ['1.1', '1.1.0.0', '01.1.0', '1.1.0-beta', '10000.0.0', ' 1.1.0', 110]) {
      expect(field(await post({ platform: 'windows', version, password: PASSWORD })), String(version)).toEqual([400, 'VALIDATION', 'version', t('en', DOWNLOADS_VERSION_KEY)]);
    }
    // The version of the image is listed: refused before the password (a wrong one costs nothing here).
    const listed = built.downloads.windows[0];
    expect(field(await post({ platform: 'windows', version: listed.version, password: 'wrong-password' }))).toEqual([409, 'VALIDATION', 'version', t('en', DOWNLOADS_EXISTS_KEY, { platform: 'Windows', version: listed.version })]);
    expect(field(await post({ platform: 'windows', version: '1.1.0', removeOlder: 'yes', password: PASSWORD }))[0]).toBe(400);
    expect((await o.post('/api/server/downloads/upload-intent', [1, 2])).status).toBe(400);
    expect(field(await post({ platform: 'windows', version: '1.1.0' }))).toEqual([400, 'VALIDATION', 'password', t('en', DOWNLOADS_PASSWORD_REQUIRED_KEY)]);
    expect(field(await post({ platform: 'windows', version: '1.1.0', password: 'Wrong-Passw0rd' }))).toEqual([400, 'WRONG_PASSWORD', 'password', t('en', DOWNLOADS_WRONG_PASSWORD_KEY)]);
    // The right password: a ticket for this platform and version, under the public name.
    const ok = await post({ platform: 'windows', version: '1.1.0', password: PASSWORD, removeOlder: true, bytes: 2 * MiB });
    expect(ok.status).toBe(201);
    const ticket = ok.body as ServerDownloadUploadTicket;
    expect(ticket.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(ticket).toMatchObject({ uploadPath: `/api/server/downloads/upload/${ticket.token}`, platform: 'windows', version: '1.1.0', file: PUBLIC_NAMES.windows('1.1.0'), removeOlder: true, maxBytes: 3 * MiB, minBytes: MiB });
    expect(Date.parse(ticket.expiresAt) - Date.now()).toBeGreaterThan(14 * 60_000);
    // The size, when the card gives it, is checked before anything is uploaded.
    expect(field(await post({ platform: 'windows', version: '1.1.0', password: PASSWORD, bytes: 4 * MiB }))).toEqual([413, 'VALIDATION', 'file', t('en', DOWNLOADS_TOO_LARGE_KEY, { maxMb: 3 })]);
    expect(field(await post({ platform: 'windows', version: '1.1.0', password: PASSWORD, bytes: 1000 }))).toEqual([400, 'VALIDATION', 'file', t('en', DOWNLOADS_TOO_SMALL_KEY, { minMb: 1 })]);
  });
});

describe('publishing a file', () => {
  it('streamed, hashed, checked, named by the server, listed and served like the files of the image; the pages are the builder\'s pages of the new list; one e-mail, one log line', async () => {
    const b = await boot();
    const { auth, o } = await b.owner('ownerpub', { language: 'he' });
    const exe = windowsExe(MiB + 12345);
    const { ticket, put } = await b.publish(o, 'windows', '1.1.0', exe);
    expect(put.status, JSON.stringify(put.body)).toBe(201);
    const result = put.body as ServerDownloadResult;
    const row: ServerDownloadRow = { version: '1.1.0', date: new Date().toISOString().slice(0, 10), file: ticket.file, bytes: exe.length, sha256: sha256(exe), source: 'uploaded' };
    expect(result).toMatchObject({ action: 'published', row, removedOlder: [], email: 'sent' });
    expect(result.downloads.platforms.windows).toEqual([row, ...built.downloads.windows.map((r) => ({ ...r, source: 'image' }))]);
    // On the volume: the file under its public name, its row in the list; nothing left in tmp/.
    const site = path.join(b.dataDir, 'site');
    expect(filesBelow(site)).toEqual(['downloads.json', `files/${ticket.file}`]);
    expect(sha256(fs.readFileSync(path.join(site, 'files', ticket.file)))).toBe(row.sha256);
    expect(JSON.parse(fs.readFileSync(path.join(site, 'downloads.json'), 'utf8'))).toEqual({ windows: [{ version: row.version, date: row.date, file: row.file, bytes: row.bytes, sha256: row.sha256 }], android: [], mac: [] });

    // Served like a file of the image: its content type, no-cache, whole, resumable.
    const image = await bytesOf(b.visit(`/about/${FILES_DIR}/${built.downloads.windows[0].file}`));
    const file = await bytesOf(b.visit(`/about/${FILES_DIR}/${ticket.file}`));
    expect([file.status, file.headers['content-type'], file.headers['cache-control'], file.headers['accept-ranges'], file.headers['x-content-type-options']]).toEqual([
      200,
      image.headers['content-type'],
      'no-cache',
      'bytes',
      'nosniff',
    ]);
    expect(file.headers['content-type']).toBe('application/x-msdos-program');
    expect((file.body as Buffer).equals(exe)).toBe(true);
    const rest = await bytesOf(b.visit(`/about/${FILES_DIR}/${ticket.file}`).set('Range', `bytes=${exe.length - 100}-`));
    expect([rest.status, rest.headers['content-range']]).toEqual([206, `bytes ${exe.length - 100}-${exe.length - 1}/${exe.length}`]);
    expect((rest.body as Buffer).equals(exe.subarray(exe.length - 100))).toBe(true);
    expect((await b.visit(`/about/${FILES_DIR}/${ticket.file}`).set('Host', 'evil.example')).status).toBe(421);

    // Every Downloads page: exactly the page the builder writes for the merged list.
    const merged = plain(result.downloads.platforms);
    for (const l of LOCALES) {
      const res = await b.visit(downloadsUrl(l.code));
      expect(res.text, l.code).toBe(builderPage(l.code, merged));
      expect(res.text, l.code).toContain(`<tr data-file="${ticket.file}" data-bytes="${exe.length}" data-sha256="${row.sha256}">`);
    }

    // The e-mail: one, to the owner's own address, in his language (Hebrew: right to left), with what was published.
    expect(b.sent).toHaveLength(1);
    expect(b.sent[0].envelope).toEqual({ from: SENDER, to: 'ownerpub@example.test' });
    expect(decodeWords(headersOf(b.sent[0].data).subject)).toBe(t('he', 'server.email.downloads.published.subject'));
    const { text, html } = partsOf(b.sent[0].data);
    for (const part of [ticket.file, '1.1.0', row.sha256, 'Windows', String(exe.length), t('he', 'server.email.downloads.published.notYou')]) expect(text).toContain(part);
    expect(html).toContain('<html lang="he" dir="rtl">');
    expect(auth.user.id).toBeTruthy();
    // The log: one line for the publication, without anything personal.
    const lines = b.logs.filter((line) => line.startsWith('downloads: '));
    expect(lines).toEqual([`downloads: published windows 1.1.0 (${exe.length} bytes)`]);
    for (const line of b.logs) expect(line).not.toMatch(/ownerpub|example\.test|203\.0\.113|127\.0\.0\.1|Test Owner/);

    // The same version again: refused (remove it first).
    const again = await o.post('/api/server/downloads/upload-intent', { platform: 'windows', version: '1.1.0', password: PASSWORD });
    expect([again.status, again.body.message]).toEqual([409, t('en', DOWNLOADS_EXISTS_KEY, { platform: 'Windows', version: '1.1.0' })]);
  }, 60_000);

  it('removeOlder takes the older versions of the platform off the page - the image\'s into removed.json - and says so in the e-mail', async () => {
    const b = await boot();
    const { o } = await b.owner('owneroldr');
    const apk = androidApk(MiB + 777);
    const older = built.downloads.android;
    const { put } = await b.publish(o, 'android', '9.0.0', apk, { removeOlder: true });
    expect(put.status, JSON.stringify(put.body)).toBe(201);
    const result = put.body as ServerDownloadResult;
    expect(result.removedOlder.map((row) => [row.version, row.source])).toEqual(older.map((row) => [row.version, 'image']));
    expect(result.downloads.platforms.android.map((row) => row.version)).toEqual(['9.0.0']);
    expect(plain(result.downloads.platforms).windows).toEqual(built.downloads.windows);
    expect(JSON.parse(fs.readFileSync(path.join(b.dataDir, 'site', 'removed.json'), 'utf8'))).toEqual(older.map((row) => ({ platform: 'android', version: row.version, sha256: row.sha256 })));
    // The file of the image that left the page is no longer served.
    expect((await b.visit(`/about/${FILES_DIR}/${older[0].file}`)).status).toBe(404);
    expect((await bytesOf(b.visit(`/about/${FILES_DIR}/${PUBLIC_NAMES.android('9.0.0')}`))).headers['content-type']).toBe('application/vnd.android.package-archive');
    expect((await b.visit('/about/he/downloads/')).text).toBe(builderPage('he', plain(result.downloads.platforms)));
    expect(partsOf(b.sent[0].data).text).toContain(t('en', 'server.email.downloads.olderRemoved', { versions: older.map((row) => row.version).join(', ') }));
    expect(b.logs.filter((line) => line.startsWith('downloads: '))).toEqual([`downloads: published android 9.0.0 (${apk.length} bytes; ${older.length} older removed)`]);
  }, 60_000);

  it('the body: too small, too large, another type, no length, a wrong signature for each platform - nothing published, nothing left behind', async () => {
    const b = await boot();
    const { auth, o } = await b.owner('ownerbody', { mail: false });
    const site = path.join(b.dataDir, 'site');
    const before = (await o.get('/api/server/downloads')).body as ServerDownloads;
    const refused = async (platform: string, version: string, file: Buffer, type?: string) => {
      const intent = await o.post('/api/server/downloads/upload-intent', { platform, version, password: PASSWORD });
      expect(intent.status, JSON.stringify(intent.body)).toBe(201);
      return o.put((intent.body as ServerDownloadUploadTicket).uploadPath, file, type);
    };
    const shape = (res: supertest.Response) => [res.status, res.body.code, res.body.message];
    // (A body refused before it is read is kept small here: supertest asks for "Connection: close", and a server that
    // answers such a request early closes the socket under the rest of a large body. Browsers keep the connection.)
    expect(shape(await refused('windows', '1.2.0', windowsExe(1000)))).toEqual([400, 'VALIDATION', t('en', DOWNLOADS_TOO_SMALL_KEY, { minMb: 1 })]);
    expect(shape(await refused('windows', '1.2.0', Buffer.from('MZ - not sent as a file'), 'text/plain'))).toEqual([415, 'VALIDATION', t('en', DOWNLOADS_CONTENT_TYPE_KEY)]);
    // Each platform's signature: another installer, or something that only looks like one.
    const notWindows = t('en', DOWNLOADS_NOT_WINDOWS_KEY);
    const notAndroid = t('en', DOWNLOADS_NOT_ANDROID_KEY);
    const notMac = t('en', DOWNLOADS_NOT_MAC_KEY);
    const noPe = windowsExe();
    noPe.write('NE', 0x80, 'latin1');
    for (const [platform, file, message] of [
      ['windows', macDmg(), notWindows],
      ['windows', noPe, notWindows],
      ['android', windowsExe(), notAndroid],
      ['android', androidApk(MiB + 10, ['AndroidManifest.xml', 'resources.arsc']), notAndroid],
      ['mac', androidApk(), notMac],
      ['mac', filler(MiB + 10), notMac],
    ] as const) {
      const res = await refused(platform, '1.2.0', file);
      expect([platform, ...shape(res), res.body.field]).toEqual([platform, 400, 'VALIDATION', message, 'file']);
    }
    // No length (a chunked body): 411 before a byte is read, and the connection closes (the rest is never read).
    const intent = await o.post('/api/server/downloads/upload-intent', { platform: 'mac', version: '1.2.0', password: PASSWORD });
    const noLength = await rawPut(b.srv, (intent.body as ServerDownloadUploadTicket).uploadPath, auth.token, { chunked: true, file: macDmg(), cutAt: 4096, hold: true });
    expect([noLength.status, JSON.parse(noLength.body).message]).toEqual([411, t('en', DOWNLOADS_LENGTH_REQUIRED_KEY)]);
    // Over the limit, said in advance: 413 before a byte is read.
    const big = await o.post('/api/server/downloads/upload-intent', { platform: 'mac', version: '1.2.0', password: PASSWORD });
    const tooBig = await rawPut(b.srv, (big.body as ServerDownloadUploadTicket).uploadPath, auth.token, { file: macDmg(3 * MiB + 1), cutAt: 4096, hold: true });
    expect([tooBig.status, JSON.parse(tooBig.body).message]).toEqual([413, t('en', DOWNLOADS_TOO_LARGE_KEY, { maxMb: 3 })]);
    // Nothing was published, nothing is left on the volume, and every refusal was logged without a personal value.
    expect((await o.get('/api/server/downloads')).body.platforms).toEqual(before.platforms);
    expect(filesBelow(site)).toEqual([]);
    expect(b.logs.filter((line) => line.startsWith('downloads: upload refused (not an installer for '))).toHaveLength(6);
  }, 60_000);
});

/**
 * A PUT through a socket of its own: a chunked body, or a body that stops after `cutAt` bytes - and then either goes
 * away (the client is gone) or, with `hold`, waits. Resolves with the answer, or status 0 when the connection ended
 * without one.
 */
function rawPut(srv: RunningHosted, uploadPath: string, token: string, o: { file: Buffer; chunked?: boolean; cutAt?: number; hold?: boolean }): Promise<{ status: number; body: string }> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (status: number, body: string) => {
      if (settled) return;
      settled = true;
      resolve({ status, body });
    };
    const request = http.request(
      {
        host: '127.0.0.1',
        port: srv.port,
        method: 'PUT',
        path: uploadPath,
        headers: {
          Host: HOST,
          'X-Forwarded-Proto': 'https',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
          ...(o.chunked ? { 'Transfer-Encoding': 'chunked' } : { 'Content-Length': String(o.file.length) }),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => finish(res.statusCode ?? 0, Buffer.concat(chunks).toString('utf8')));
        res.on('error', () => finish(res.statusCode ?? 0, Buffer.concat(chunks).toString('utf8')));
      },
    );
    request.on('error', (e) => finish(0, String(e)));
    if (o.cutAt === undefined) request.end(o.file);
    else {
      request.write(o.file.subarray(0, o.cutAt));
      if (!o.hold) setTimeout(() => request.destroy(), 50);
    }
  });
}

/** PUT of `file` in `parts` pieces, `gapMs` apart - an upload over a slow line. */
function slowPut(srv: RunningHosted, uploadPath: string, token: string, file: Buffer, parts: number, gapMs: number): Promise<{ status: number; body: string }> {
  return new Promise((resolve) => {
    const request = http.request(
      {
        host: '127.0.0.1',
        port: srv.port,
        method: 'PUT',
        path: uploadPath,
        headers: { Host: HOST, 'X-Forwarded-Proto': 'https', Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream', 'Content-Length': String(file.length) },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
      },
    );
    request.on('error', (e) => resolve({ status: 0, body: String(e) }));
    const size = Math.ceil(file.length / parts);
    let sent = 0;
    const next = (): void => {
      const part = file.subarray(sent * size, (sent + 1) * size);
      sent += 1;
      if (sent >= parts) request.end(part);
      else {
        request.write(part);
        setTimeout(next, gapMs);
      }
    };
    next();
  });
}

describe('the time a request may take', () => {
  it('a request that has not arrived whole in time loses its connection; an upload opened with the token may take longer', async () => {
    const b = await boot({ requestTimeoutMs: 400 });
    // A body sent byte by byte to another route: cut after the limit (the listener itself would wait 30 minutes).
    const closedAfter = await new Promise<number>((resolve) => {
      const at = Date.now();
      const socket = net.connect(b.srv.port, '127.0.0.1', () => {
        socket.write(`POST /api/auth/login HTTP/1.1\r\nHost: ${HOST}\r\nX-Forwarded-Proto: https\r\nContent-Type: application/json\r\nContent-Length: 1000\r\n\r\n{"username":`);
      });
      socket.on('error', () => {});
      socket.on('close', () => resolve(Date.now() - at));
      setTimeout(() => socket.destroy(), 10_000).unref();
    });
    expect(closedAfter).toBeGreaterThanOrEqual(350);
    expect(closedAfter).toBeLessThan(5_000);
    // The owner's upload over a slow line, longer than that limit: published.
    const { auth, o } = await b.owner('ownerslow');
    const intent = await o.post('/api/server/downloads/upload-intent', { platform: 'windows', version: '1.7.0', password: PASSWORD });
    expect(intent.status, JSON.stringify(intent.body)).toBe(201);
    const ticket = intent.body as ServerDownloadUploadTicket;
    const exe = windowsExe();
    const put = await slowPut(b.srv, ticket.uploadPath, auth.token, exe, 4, 300);
    expect(put.status, put.body).toBe(201);
    expect((JSON.parse(put.body) as ServerDownloadResult).row).toMatchObject({ version: '1.7.0', sha256: sha256(exe), source: 'uploaded' });
  }, 60_000);
});

describe('the upload token', () => {
  it('once, for 15 minutes, for the session that asked only; a path in it, a guess and another user get nothing', async () => {
    let clock = START;
    const b = await boot({ downloads: { now: () => clock } });
    const { o } = await b.owner('ownertok', { mail: false });
    const other = await b.register('strangertok');
    const exe = windowsExe();
    // (A refused upload carries a small body here: see the note in the test of the body.)
    const small = Buffer.from('a small body');
    // Replayed: the first use publishes, the second is refused.
    const { ticket, put } = await b.publish(o, 'windows', '1.3.0', exe);
    expect(put.status).toBe(201);
    const replay = await o.put(ticket.uploadPath, small);
    expect([replay.status, replay.body.message]).toEqual([403, t('en', DOWNLOADS_TOKEN_KEY, { minutes: 15 })]);
    // Expired: 15 minutes after the password.
    const late = (await o.post('/api/server/downloads/upload-intent', { platform: 'windows', version: '1.4.0', password: PASSWORD })).body as ServerDownloadUploadTicket;
    clock += 15 * 60_000 + 1000;
    expect((await o.put(late.uploadPath, small)).status).toBe(403);
    // Another session of the same owner (his phone): refused - and the token is used up for the first one as well.
    const phone = b.as((await b.login('ownertok')).token);
    const mine = (await o.post('/api/server/downloads/upload-intent', { platform: 'windows', version: '1.4.0', password: PASSWORD })).body as ServerDownloadUploadTicket;
    expect((await phone.put(mine.uploadPath, small)).status).toBe(403);
    expect((await o.put(mine.uploadPath, small)).status).toBe(403);
    // Another user's session: refused by the owner check, before the token is looked at - which stays usable.
    const fresh = (await o.post('/api/server/downloads/upload-intent', { platform: 'windows', version: '1.4.0', password: PASSWORD })).body as ServerDownloadUploadTicket;
    const stranger = await b.as(other.token).put(fresh.uploadPath, small);
    expect([stranger.status, stranger.body.code]).toEqual([403, 'FORBIDDEN']);
    // A path, a guess, a token of another length: nothing is written anywhere.
    for (const url of [
      '/api/server/downloads/upload/..%2F..%2Faccounts.json',
      '/api/server/downloads/upload/..%2F..%2F..%2F..%2Fetc%2Fpasswd',
      '/api/server/downloads/upload/%2e%2e%2f%2e%2e%2fsessions.json',
      `/api/server/downloads/upload/${'A'.repeat(43)}`,
      `/api/server/downloads/upload/${fresh.token}x`,
      '/api/server/downloads/upload/',
    ]) {
      const res = await o.put(url, small);
      expect([url, [403, 404].includes(res.status)]).toEqual([url, true]);
    }
    // The genuine token was named by none of them: it still works.
    const ok = await o.put(fresh.uploadPath, windowsExe());
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    expect(filesBelow(path.join(b.dataDir, 'site'))).toEqual(['downloads.json', `files/${PUBLIC_NAMES.windows('1.3.0')}`, `files/${PUBLIC_NAMES.windows('1.4.0')}`]);
    expect(fs.existsSync(path.join(b.dataDir, 'accounts.json'))).toBe(true);
  }, 60_000);
});

describe('the limits', () => {
  it('a disk without room for the file and the low-disk margin: 507, before the upload and before a byte is read', async () => {
    const b = await boot({ downloads: { volume: () => ({ totalBytes: 100 * MiB, freeBytes: 10 * MiB }) } });
    const { auth, o } = await b.owner('ownerroom', { mail: false });
    // 15 % of 100 MB must stay free: a file of 1.1 MB needs about 17 MB, 10 MB are free.
    const early = await o.post('/api/server/downloads/upload-intent', { platform: 'mac', version: '1.5.0', password: PASSWORD, bytes: Math.round(1.1 * MiB) });
    expect([early.status, early.body.code, early.body.message]).toEqual([507, 'IO', t('en', DOWNLOADS_NO_SPACE_KEY, { needMb: 17, freeMb: 10 })]);
    // Without the size in advance: the PUT is refused on its declared length, with a few bytes sent (the client waits).
    const ticket = (await o.post('/api/server/downloads/upload-intent', { platform: 'mac', version: '1.5.0', password: PASSWORD })).body as ServerDownloadUploadTicket;
    const late = await rawPut(b.srv, ticket.uploadPath, auth.token, { file: macDmg(Math.round(1.1 * MiB)), cutAt: 4096, hold: true });
    expect([late.status, JSON.parse(late.body).message]).toEqual([507, t('en', DOWNLOADS_NO_SPACE_KEY, { needMb: 17, freeMb: 10 })]);
    expect(filesBelow(path.join(b.dataDir, 'site'))).toEqual([]);
    expect(((await o.get('/api/server/downloads')).body as ServerDownloads).limits.freeBytes).toBe(10 * MiB);
  });

  it('one upload at a time; an upload that stops sending is given up; a cut-off upload leaves nothing', async () => {
    const b = await boot({ downloads: { idleMs: 1500 } });
    const { auth, o } = await b.owner('ownerbusy', { mail: false });
    const busyOf = async () => ((await o.get('/api/server/downloads')).body as ServerDownloads).busy;
    // The first upload sends half of its file and waits.
    const first = (await o.post('/api/server/downloads/upload-intent', { platform: 'windows', version: '2.0.0', password: PASSWORD })).body as ServerDownloadUploadTicket;
    const stalled = rawPut(b.srv, first.uploadPath, auth.token, { file: windowsExe(2 * MiB), cutAt: MiB, hold: true });
    await vi.waitFor(async () => expect(await busyOf()).toBe(true), { timeout: 5000, interval: 50 });
    const second = await o.post('/api/server/downloads/upload-intent', { platform: 'android', version: '2.0.0', password: PASSWORD });
    expect([second.status, second.body.message]).toEqual([429, t('en', DOWNLOADS_BUSY_KEY)]);
    // No byte for 1.5 s: the server gives the upload up, deletes what it had, and takes the next one.
    await stalled;
    await vi.waitFor(async () => expect(await busyOf()).toBe(false), { timeout: 10_000, interval: 100 });
    expect(filesBelow(path.join(b.dataDir, 'site'))).toEqual([]);
    expect(b.logs).toContain('downloads: upload refused (the file did not arrive whole)');
    // A client that goes away in the middle: the same.
    const cut = (await o.post('/api/server/downloads/upload-intent', { platform: 'android', version: '2.0.0', password: PASSWORD })).body as ServerDownloadUploadTicket;
    await rawPut(b.srv, cut.uploadPath, auth.token, { file: androidApk(2 * MiB), cutAt: MiB / 2 });
    await vi.waitFor(async () => expect(await busyOf()).toBe(false), { timeout: 10_000, interval: 100 });
    expect(filesBelow(path.join(b.dataDir, 'site'))).toEqual([]);
    expect(((await o.get('/api/server/downloads')).body as ServerDownloads).platforms.android.every((row) => row.source === 'image')).toBe(true);
    // And then an upload works again.
    const { put } = await b.publish(o, 'android', '2.0.0', androidApk());
    expect(put.status, JSON.stringify(put.body)).toBe(201);
  }, 60_000);

  it('at most the daily number of uploads - every upload that started counts; 24 hours later again', async () => {
    let clock = START;
    const b = await boot({ downloads: { perDay: 2, now: () => clock } });
    const { o } = await b.owner('ownerday', { mail: false });
    // One refused (not a Mac disk image) and one published: two uploads.
    const { put: refused } = await b.publish(o, 'mac', '3.0.0', windowsExe());
    expect(refused.status).toBe(400);
    clock += 60 * 60_000;
    const { put: ok } = await b.publish(o, 'mac', '3.0.0', macDmg());
    expect(ok.status).toBe(201);
    expect(((await o.get('/api/server/downloads')).body as ServerDownloads).limits.usedToday).toBe(2);
    const third = await o.post('/api/server/downloads/upload-intent', { platform: 'mac', version: '3.1.0', password: PASSWORD });
    expect([third.status, third.body.message]).toEqual([429, t('en', DOWNLOADS_TOO_MANY_KEY, { max: 2 })]);
    expect(Number(third.headers['retry-after'])).toBe(23 * 60 * 60);
    clock += 23 * 60 * 60_000;
    const { put: later } = await b.publish(o, 'mac', '3.1.0', macDmg());
    expect(later.status).toBe(201);
  }, 60_000);
});

describe('removing a file', () => {
  it('an uploaded file is deleted, a file of the image is recorded in removed.json - still removed after a restart; the empty platform shows its text', async () => {
    const dataDir = tempDataDir();
    const b = await boot({ dataDir });
    const { auth, o } = await b.owner('ownerrm');
    const exe = windowsExe();
    const { ticket, put } = await b.publish(o, 'windows', '1.6.0', exe);
    expect(put.status).toBe(201);
    const remove = (body: object) => o.post('/api/server/downloads/remove', body);
    // Not listed, no password, a wrong password: nothing changes.
    const missing = await remove({ platform: 'android', version: '7.7.7', password: PASSWORD });
    expect([missing.status, missing.body.message]).toEqual([404, t('en', DOWNLOADS_NOT_LISTED_KEY, { platform: 'Android', version: '7.7.7' })]);
    expect((await remove({ platform: 'windows', version: '1.6.0' })).status).toBe(400);
    expect((await remove({ platform: 'windows', version: '1.6.0', password: 'Wrong-Passw0rd' })).body.code).toBe('WRONG_PASSWORD');
    // The uploaded file: its row and its file go.
    const gone = await remove({ platform: 'windows', version: '1.6.0', password: PASSWORD });
    expect(gone.status, JSON.stringify(gone.body)).toBe(200);
    const removedUploaded = gone.body as ServerDownloadResult;
    expect(removedUploaded).toMatchObject({ action: 'removed', row: { version: '1.6.0', file: ticket.file, source: 'uploaded', sha256: sha256(exe) }, removedOlder: [], email: 'sent' });
    expect(fs.existsSync(path.join(dataDir, 'site', 'files', ticket.file))).toBe(false);
    expect((await b.visit(`/about/${FILES_DIR}/${ticket.file}`)).status).toBe(404);
    // Every file of the image for Windows: recorded, not deleted (the image cannot change).
    for (const row of built.downloads.windows) {
      const res = await remove({ platform: 'windows', version: row.version, password: PASSWORD });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect((res.body as ServerDownloadResult).row.source).toBe('image');
    }
    const after = (await o.get('/api/server/downloads')).body as ServerDownloads;
    expect(after.platforms.windows).toEqual([]);
    expect(JSON.parse(fs.readFileSync(path.join(dataDir, 'site', 'removed.json'), 'utf8'))).toEqual(built.downloads.windows.map((row) => ({ platform: 'windows', version: row.version, sha256: row.sha256 })));
    expect(fs.existsSync(path.join(ui(), 'about', FILES_DIR, built.downloads.windows[0].file))).toBe(true);
    // The page: Windows without a row shows the empty-state text - exactly the builder's page of that list.
    const page = (await b.visit('/about/downloads/')).text;
    expect(page).toBe(builderPage('en', plain(after.platforms)));
    expect(page).toContain('<!-- downloads:windows:empty -->\n<p class="empty">No installation file for this system yet.</p>');
    expect((await b.visit(`/about/${FILES_DIR}/${built.downloads.windows[0].file}`)).status).toBe(404);
    // One e-mail per removal, one log line each.
    expect(b.sent).toHaveLength(2 + built.downloads.windows.length);
    expect(decodeWords(headersOf(b.sent[1].data).subject)).toBe(t('en', 'server.email.downloads.removed.subject'));
    expect(partsOf(b.sent[1].data).text).toContain(t('en', 'server.email.downloads.removed.notYou'));
    expect(b.logs.filter((line) => line.startsWith('downloads: removed '))).toEqual(['downloads: removed windows 1.6.0 (uploaded)', ...built.downloads.windows.map((row) => `downloads: removed windows ${row.version} (came with the server)`)]);

    // A restart - a later deploy of the same image: the removed rows stay removed.
    await b.srv.stop();
    const again = await boot({ dataDir });
    again.setOwner(auth.user.id);
    const o2 = again.as((await again.login('ownerrm')).token);
    expect(((await o2.get('/api/server/downloads')).body as ServerDownloads).platforms.windows).toEqual([]);
    expect((await again.visit('/about/he/downloads/')).text).toBe(builderPage('he', plain(after.platforms)));
    expect((await again.visit(`/about/${FILES_DIR}/${built.downloads.windows[0].file}`)).status).toBe(404);
  }, 60_000);

  it('mail not set up, or an owner without an address: the action is done, and the answer says no e-mail was sent', async () => {
    const b = await boot();
    const { o } = await b.owner('ownernomail', { mail: false });
    expect(((await o.get('/api/server/downloads')).body as ServerDownloads).email).toBe('notConfigured');
    const { put } = await b.publish(o, 'android', '4.0.0', androidApk());
    expect([put.status, (put.body as ServerDownloadResult).email]).toEqual([201, 'notConfigured']);
    const gone = await o.post('/api/server/downloads/remove', { platform: 'android', version: '4.0.0', password: PASSWORD });
    expect([gone.status, (gone.body as ServerDownloadResult).email]).toEqual([200, 'notConfigured']);
    expect(b.sent).toHaveLength(0);

    // An owner account without an e-mail address (an account of the time before the address was asked for).
    const c = await boot();
    const { auth, o: noAddress } = await c.owner('owneraddr');
    const record = c.srv.auth.accounts.findById(auth.user.id);
    if (!record) throw new Error('the owner account is missing');
    c.srv.auth.accounts.update({ ...record, email: undefined, emailLower: undefined });
    expect(((await noAddress.get('/api/server/downloads')).body as ServerDownloads).email).toBe('noAddress');
    const { put: published } = await c.publish(noAddress, 'mac', '4.0.0', macDmg());
    expect([published.status, (published.body as ServerDownloadResult).email]).toEqual([201, 'noAddress']);
    expect(c.sent).toHaveLength(0);
  }, 60_000);
});

describe('server archives and the volume', () => {
  it('an archive leaves out the uploaded installers and the uploads in progress, and keeps their two small lists', () => {
    for (const [rel, dir, kept] of [
      ['site', true, true],
      ['site/downloads.json', false, true],
      ['site/removed.json', false, true],
      ['site/files', true, false],
      [`site/files/${PUBLIC_NAMES.windows('1.1.0')}`, false, false],
      ['site/tmp', true, false],
      ['site/tmp/upload-0123456789abcdef.part', false, false],
      ['users/u_1.mpd', false, true],
    ] as const) {
      expect([rel, isArchivedPath(rel, dir)]).toEqual([rel, kept]);
    }
  });

  it('a listed upload whose file is missing (a restored archive) is left out; an interrupted upload of an earlier run is cleaned', async () => {
    const dataDir = tempDataDir();
    const site = path.join(dataDir, 'site');
    fs.mkdirSync(path.join(site, 'tmp'), { recursive: true });
    fs.writeFileSync(path.join(site, 'tmp', 'upload-0123456789abcdef.part'), 'half a file');
    const row = { version: '5.0.0', date: '2026-11-18', file: PUBLIC_NAMES.mac('5.0.0'), bytes: 4096, sha256: 'ab'.repeat(32) };
    fs.writeFileSync(path.join(site, 'downloads.json'), JSON.stringify({ windows: [], android: [], mac: [row] }));
    const b = await boot({ dataDir });
    const { o } = await b.owner('ownerrestore', { mail: false });
    expect(((await o.get('/api/server/downloads')).body as ServerDownloads).platforms.mac.map((r) => r.version)).toEqual(built.downloads.mac.map((r) => r.version));
    expect(filesBelow(path.join(site, 'tmp'))).toEqual([]);
    expect(b.logs).toContain('downloads: mac 5.0.0 is listed as uploaded, but its file is missing or not the listed one - left out');
    expect((await b.visit(`/about/${FILES_DIR}/${row.file}`)).status).toBe(404);
  });
});
