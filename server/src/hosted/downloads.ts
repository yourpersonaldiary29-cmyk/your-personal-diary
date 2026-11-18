/**
 * The files of the public site's Downloads page, managed from the Server card (docs/server-tasks/SERVER-CARD-V2.md
 * Part A). Built only by the hosted composition (hosted.ts): the desktop sidecar and the Android core never load it.
 *
 * Two sources, merged at run time:
 *   - the image: the installers the release routine put on the site (scripts/site/add-download.mjs). The builder
 *     staged them into <staticDir>/about/files/ together with the list it built the pages from,
 *     <staticDir>/about/files/downloads.json (IMAGE_LIST_FILE of scripts/site/downloads-shared.mjs);
 *   - the volume: what the owner uploaded in the Server card - <dataDir>/site/files/<name>, listed in
 *     <dataDir>/site/downloads.json (the row shape of site/downloads.json), and <dataDir>/site/removed.json: the image
 *     rows the owner removed ({ platform, version, sha256 }) - such a row is never shown again, also after later
 *     deploys (a later build of the same version is another file, another SHA-256, and is shown).
 * The list of a platform = the image rows that were not removed + the volume rows, newest version first; the same
 * version in both: the volume row. The file of an uploaded row has the public name of add-download.mjs
 * (PUBLIC_NAMES): the server builds it, the uploaded file's own name is never used.
 *
 * The public side (`site`, mounted by app.ts before the static files):
 *   GET / HEAD /about/files/<name>   a name of the merged list only: the volume's file for an uploaded row, the
 *                                    image's for the others, with the headers of the static files (content type,
 *                                    no-cache, ranges); any other name - a removed one, the list file itself, a
 *                                    path - 404
 *   GET / HEAD the 20 Downloads pages (/about/downloads/, /about/<code>/downloads/, and their index.html): the page
 *                                    of the image with its list regions written for the merged list -
 *                                    replaceDownloadRegions, the builder's own function, so an unchanged list is the
 *                                    builder's page byte for byte; cached per page until the list changes
 *   Both are decided on the path as the static files would read it from the disk (resolvedSitePath: escapes
 *   decoded, '//', '.' and '..' collapsed, any case), so no other spelling reaches the image's own files or pages.
 *
 * The owner's API (routes/server-downloads.ts checks HTTPS, the owner and the password, then calls this):
 *   list()                       the merged list and the limits
 *   checkIntent() / issueToken() before / after the password: a one-time upload token, TOKEN_MINUTES, bound to the
 *                                session that asked (only the newest token is kept)
 *   upload()                     the body of PUT /api/server/downloads/upload/<token>, streamed into
 *                                <dataDir>/site/tmp/ (never held in memory) with its SHA-256 computed on the way;
 *                                then: at least MIN_BYTES, the platform's signature, the file plus the low-disk
 *                                margin fits - and only then renamed into files/ and listed (`removeOlder`: the
 *                                older rows of the platform go as in remove()). Any failure deletes the temporary
 *                                file. One upload at a time; PER_DAY uploads started a day.
 *   checkRemove() / remove()     a volume row: its file is deleted and the row removed (and an image row of the
 *                                same version, hidden behind it, is recorded as removed); an image row: removed.json
 * Every publication and every removal: one e-mail to the owner's own account address (mail/templates.ts) and one
 * log line without personal data. Mail not set up: the action is done, and the answer says no e-mail was sent.
 *
 * File system calls: only those the Android core's node:fs facade also has (mobile/test/vfs/server-usage.test.ts
 * scans all of server/src), although only the hosted composition imports this module. So the signature checks work
 * on what was kept while the file streamed - its first UPLOAD_HEAD_BYTES and its last UPLOAD_TAIL_BYTES - never on
 * reads of the file afterwards.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import type { IncomingMessage } from 'node:http';
import path from 'node:path';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { DEFAULT_LOCALE, LOCALE_CODES, localeDef } from '@shared/i18n';
import {
  SERVER_DISK_LOW_PCT,
  SERVER_DOWNLOAD_MAX_BYTES,
  SERVER_DOWNLOAD_MIN_BYTES,
  SERVER_DOWNLOAD_TOKEN_MINUTES,
  SERVER_DOWNLOADS_PER_DAY,
  type ServerDownloadEmail,
  type ServerDownloadPlatform,
  type ServerDownloadResult,
  type ServerDownloadRow,
  type ServerDownloads,
  type ServerDownloadUploadTicket,
} from '@shared/types';
import {
  cleanDownloads,
  compareVersions,
  downloadsProblems,
  FILES_DIR,
  formatDownloads,
  IMAGE_LIST_FILE,
  isSha256,
  isVersion,
  PLATFORMS,
  PUBLIC_NAMES,
  replaceDownloadRegions,
  type DownloadPage,
  type DownloadRow,
  type Downloads,
} from '../../../scripts/site/downloads-shared.mjs';
import { ApiError } from '../errors';
import { isSmtpError, mailFailureTag } from '../mail/errors';
import type { MailContent } from '../mail/mime';
import { downloadPublishedEmail, downloadRemovedEmail, type DownloadEmailInput } from '../mail/templates';
import {
  DOWNLOADS_BAD_BODY_KEY,
  DOWNLOADS_BUSY_KEY,
  DOWNLOADS_CONTENT_TYPE_KEY,
  DOWNLOADS_EXISTS_KEY,
  DOWNLOADS_INCOMPLETE_KEY,
  DOWNLOADS_LENGTH_REQUIRED_KEY,
  DOWNLOADS_NOT_ANDROID_KEY,
  DOWNLOADS_NOT_LISTED_KEY,
  DOWNLOADS_NOT_MAC_KEY,
  DOWNLOADS_NOT_WINDOWS_KEY,
  DOWNLOADS_PLATFORM_KEY,
  DOWNLOADS_TOKEN_KEY,
  DOWNLOADS_TOO_LARGE_KEY,
  DOWNLOADS_TOO_SMALL_KEY,
  DOWNLOADS_VERSION_KEY,
  downloadsFailed,
  downloadsNoSpace,
  downloadsTooMany,
} from './downloads-errors';
import type { DownloadIntent, DownloadNotice, DownloadsController, DownloadTarget } from './types';

type Platform = ServerDownloadPlatform;

/** `<dataDir>/site/`: the uploaded files (files/), their list, the removed image rows, the uploads in progress (tmp/). */
export const SITE_DATA_DIR = 'site';
export const VOLUME_LIST_FILE = 'downloads.json';
export const REMOVED_LIST_FILE = 'removed.json';
/** Where the site is in the built UI (SITE_ID of scripts/site/build-site.mjs; the contact form uses /about/ too). */
const SITE_FOLDER = 'about';
const SITE_PREFIX = `/${SITE_FOLDER}/`;
/** What an upload keeps of the file while it streams, for the signature checks. */
export const UPLOAD_HEAD_BYTES = 64 * 1024;
/** The end of the file: the Mac trailer (512 bytes) and an Android package's central directory. */
export const UPLOAD_TAIL_BYTES = 8 * 1024 * 1024;
/** An upload that sends no byte for this long is given up (the one-at-a-time lock is freed). */
export const UPLOAD_IDLE_MS = 60_000;
/**
 * The request timeout of the hosted server (hosted.ts sets it on the listener): Node's default of 5 minutes would cut
 * an upload of more than 5 minutes; 30 minutes carry the largest file (300 MB) at about 1.4 Mbit/s.
 */
export const UPLOAD_REQUEST_TIMEOUT_MS = 30 * 60_000;
/** Every other request must still arrive whole within Node's own default (limitRequestTime). */
export const REQUEST_TIMEOUT_MS = 5 * 60_000;

const requestLimits = new WeakMap<IncomingMessage, NodeJS.Timeout>();

/**
 * Called by the hosted listener for every request: a request that has still not arrived whole after `ms` loses its
 * connection - Node's own limit, which the listener's UPLOAD_REQUEST_TIMEOUT_MS would otherwise lift for every
 * request (a body sent byte by byte, to any route, would hold a connection for 30 minutes). Only an upload that the
 * owner's one-time token opened gets the longer time (upload() lifts this limit once its checks have passed).
 */
export function limitRequestTime(req: IncomingMessage, ms = REQUEST_TIMEOUT_MS): void {
  const timer = setTimeout(() => {
    requestLimits.delete(req);
    if (!req.complete) req.socket.destroy();
  }, ms);
  timer.unref?.();
  requestLimits.set(req, timer);
  const clear = (): void => {
    clearTimeout(timer);
    requestLimits.delete(req);
  };
  req.once('end', clear);
  req.once('close', clear);
}

/** The upload of a valid token: the listener's UPLOAD_REQUEST_TIMEOUT_MS instead of the limit above. */
function allowLongRequest(req: IncomingMessage): void {
  const timer = requestLimits.get(req);
  if (timer) clearTimeout(timer);
  requestLimits.delete(req);
}
/** The platforms as the page and the e-mails name them (product names: the same in every language). */
export const PLATFORM_NAMES: Readonly<Record<Platform, string>> = { windows: 'Windows', android: 'Android', mac: 'Mac' };
/** A version the owner may publish: x.y.z, each part 0..9999 without a leading zero (one spelling per version). */
export const UPLOAD_VERSION_RE = /^(?:0|[1-9]\d{0,3})\.(?:0|[1-9]\d{0,3})\.(?:0|[1-9]\d{0,3})$/;
/** An upload token: 32 random bytes, base64url. */
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const DAY_MS = 24 * 60 * 60_000;
const MB = 1024 * 1024;

// The signatures of the three kinds of installer ------------------------------------------------

/** Windows: "MZ" and, at the offset of the DOS header's e_lfanew (0x3C), the PE signature "PE\0\0". */
export function isWindowsProgram(head: Buffer): boolean {
  if (head.length < 0x40 || head[0] !== 0x4d || head[1] !== 0x5a) return false;
  const offset = head.readUInt32LE(0x3c);
  return offset >= 0x40 && offset + 4 <= head.length && head.readUInt32BE(offset) === 0x50450000;
}

/**
 * The entry names of a ZIP's central directory, read from `tail` - the last bytes of a file of `size` bytes; null when
 * there is no valid end record, or the directory is not inside `tail`, or the archive is ZIP64 (no Android package is).
 */
export function zipEntryNames(tail: Buffer, size: number): Set<string> | null {
  const base = size - tail.length;
  const lowest = Math.max(0, tail.length - (22 + 0xffff));
  for (let end = tail.length - 22; end >= lowest; end -= 1) {
    if (tail.readUInt32LE(end) !== 0x06054b50) continue;
    if (end + 22 + tail.readUInt16LE(end + 20) !== tail.length) continue;
    const entries = tail.readUInt16LE(end + 10);
    const directorySize = tail.readUInt32LE(end + 12);
    const directoryOffset = tail.readUInt32LE(end + 16);
    if (entries === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) return null;
    let at = directoryOffset - base;
    if (at < 0 || directoryOffset + directorySize > base + end) return null;
    const names = new Set<string>();
    for (let n = 0; n < entries; n += 1) {
      if (at + 46 > end || tail.readUInt32LE(at) !== 0x02014b50) return null;
      const nameLength = tail.readUInt16LE(at + 28);
      if (at + 46 + nameLength > end) return null;
      names.add(tail.toString('utf8', at + 46, at + 46 + nameLength));
      at += 46 + nameLength + tail.readUInt16LE(at + 30) + tail.readUInt16LE(at + 32);
    }
    return names;
  }
  return null;
}

/** Android: a ZIP whose central directory holds AndroidManifest.xml and classes.dex. */
export function isAndroidPackage(tail: Buffer, size: number): boolean {
  const names = zipEntryNames(tail, size);
  return !!names && names.has('AndroidManifest.xml') && names.has('classes.dex');
}

/** Mac: a UDIF disk image - its last 512 bytes are the "koly" trailer (signature, version, header size 512). */
export function isMacDiskImage(tail: Buffer): boolean {
  if (tail.length < 512) return false;
  const trailer = tail.subarray(tail.length - 512);
  return trailer.toString('latin1', 0, 4) === 'koly' && trailer.readUInt32BE(8) === 512;
}

const NOT_THE_PLATFORM: Readonly<Record<Platform, string>> = { windows: DOWNLOADS_NOT_WINDOWS_KEY, android: DOWNLOADS_NOT_ANDROID_KEY, mac: DOWNLOADS_NOT_MAC_KEY };

/** True when the file whose first and last bytes these are is an installer of `platform`. */
export function installerSignatureOk(platform: Platform, head: Buffer, tail: Buffer, size: number): boolean {
  if (platform === 'windows') return isWindowsProgram(head);
  if (platform === 'android') return isAndroidPackage(tail, size);
  return isMacDiskImage(tail);
}

// The controller ---------------------------------------------------------------------------------------

/** What the e-mails need of the mail service (mail/service.ts). */
export interface DownloadsMailer {
  ready(): boolean;
  send(content: MailContent): Promise<void>;
}

export interface DownloadsOptions {
  dataDir: string;
  /** The built UI (config.staticDir): the site is at <staticDir>/about/. Undefined = no image list and no pages. */
  staticDir?: string;
  mail: DownloadsMailer;
  /** Clock of the token, the daily limit and the dates (tests). */
  now?: () => number;
  /** Log line sink (default: stderr). It never gets a personal value. */
  log?: (line: string) => void;
  maxBytes?: number;
  minBytes?: number;
  perDay?: number;
  tokenMinutes?: number;
  idleMs?: number;
  /** Total and free bytes of the volume holding `dir` (default: statfs); null when the platform cannot say. */
  volume?: (dir: string) => { totalBytes: number; freeBytes: number } | null;
}

/** An image row the owner removed. */
interface RemovedRow {
  platform: Platform;
  version: string;
  sha256: string;
}

/** A Downloads page of the image: its file in the site, and what its rows need (DownloadPage). */
interface PageDef extends DownloadPage {
  file: string;
}

/** The 20 Downloads pages by their path under /about/: 'downloads/', 'downloads/index.html', 'he/downloads/', ... */
function downloadsPages(): Map<string, PageDef> {
  const pages = new Map<string, PageDef>();
  for (const code of LOCALE_CODES) {
    const def = localeDef(code);
    const dir = code === DEFAULT_LOCALE ? 'downloads/' : `${code}/downloads/`;
    const page: PageDef = { file: `${dir}index.html`, dir, rtl: def.dir === 'rtl', intl: def.intl };
    pages.set(dir, page);
    pages.set(page.file, page);
  }
  return pages;
}

/**
 * A request path as the static files (express.static -> send) resolve it on the disk: percent escapes decoded, '\'
 * taken as '/', '//', '.' and '..' collapsed - so that no other spelling of /about/files/<name> or of a Downloads page
 * reaches the image's own files. Null: an escape that does not decode (send refuses it as well).
 */
export function resolvedSitePath(raw: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return path.posix.normalize(`/${decoded.replace(/\\/g, '/')}`);
}

const emptyLists = (): Downloads => ({ windows: [], android: [], mac: [] });
const copyLists = (lists: Downloads): Downloads => ({ windows: [...lists.windows], android: [...lists.android], mac: [...lists.mac] });
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isPlatform = (value: unknown): value is Platform => typeof value === 'string' && (PLATFORMS as readonly string[]).includes(value);

function statfsVolume(dir: string): { totalBytes: number; freeBytes: number } | null {
  try {
    const s = fs.statfsSync(dir);
    const bsize = Number(s.bsize);
    const totalBytes = Number(s.blocks) * bsize;
    const freeBytes = Number(s.bavail) * bsize;
    return Number.isFinite(totalBytes) && totalBytes > 0 && Number.isFinite(freeBytes) ? { totalBytes, freeBytes } : null;
  } catch {
    return null;
  }
}

/** removed.json: one row per line. */
function formatRemoved(rows: readonly RemovedRow[]): string {
  if (!rows.length) return '[]\n';
  return `[\n${rows.map((row) => `  ${JSON.stringify({ platform: row.platform, version: row.version, sha256: row.sha256 })}`).join(',\n')}\n]\n`;
}

/** What an upload kept of the file while it streamed. */
interface Received {
  bytes: number;
  sha256: string;
  head: Buffer;
  tail: Buffer;
}

/** A change of the lists: the next state, and the uploaded files it deletes once it is saved. */
interface Change {
  volume: Downloads;
  removed: RemovedRow[];
  removedChanged: boolean;
  files: string[];
}

export function createDownloadsController(opts: DownloadsOptions): DownloadsController {
  const now = opts.now ?? Date.now;
  const log = opts.log ?? ((line: string) => console.error(`[diary-server] ${line}`));
  const say = (line: string): void => {
    try {
      log(`downloads: ${line}`);
    } catch {
      /* a log that cannot be written is no reason to fail a request */
    }
  };
  const maxBytes = opts.maxBytes ?? SERVER_DOWNLOAD_MAX_BYTES;
  const minBytes = opts.minBytes ?? SERVER_DOWNLOAD_MIN_BYTES;
  const perDay = opts.perDay ?? SERVER_DOWNLOADS_PER_DAY;
  const tokenMinutes = opts.tokenMinutes ?? SERVER_DOWNLOAD_TOKEN_MINUTES;
  const idleMs = opts.idleMs ?? UPLOAD_IDLE_MS;
  const volumeOf = opts.volume ?? statfsVolume;
  const dataDir = path.resolve(opts.dataDir);
  const siteDataDir = path.join(dataDir, SITE_DATA_DIR);
  const filesDir = path.join(siteDataDir, FILES_DIR);
  const tmpDir = path.join(siteDataDir, 'tmp');
  const volumeListFile = path.join(siteDataDir, VOLUME_LIST_FILE);
  const removedListFile = path.join(siteDataDir, REMOVED_LIST_FILE);
  const siteRoot = opts.staticDir ? path.join(path.resolve(opts.staticDir), SITE_FOLDER) : null;
  const imageFilesDir = siteRoot ? path.join(siteRoot, FILES_DIR) : null;
  const pages = downloadsPages();

  // Loading --------------------------------------------------------------------------------------------

  /** The list of the image (ui/about/files/downloads.json). Missing or broken: no image row (and one log line). */
  const loadImage = (): Downloads => {
    if (!siteRoot) return emptyLists();
    const file = path.join(siteRoot, ...IMAGE_LIST_FILE.split('/'));
    if (!fs.existsSync(file)) {
      if (fs.existsSync(path.join(siteRoot, 'index.html'))) say('the image holds no list of its installers (about/files/downloads.json) - only uploaded files are shown');
      return emptyLists();
    }
    try {
      const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (downloadsProblems(raw, { allowEmpty: true }).length) throw new Error('invalid');
      return cleanDownloads(raw);
    } catch {
      say('the list of the installers of the image cannot be read - only uploaded files are shown');
      return emptyLists();
    }
  };

  /** The uploaded files: their list, each row with its public name and its file there with the listed size. */
  const loadVolume = (): Downloads => {
    if (!fs.existsSync(volumeListFile)) return emptyLists();
    let lists: Downloads;
    try {
      const raw: unknown = JSON.parse(fs.readFileSync(volumeListFile, 'utf8'));
      if (downloadsProblems(raw, { allowEmpty: true }).length) throw new Error('invalid');
      lists = cleanDownloads(raw);
    } catch {
      say('the list of the uploaded files cannot be read - no uploaded file is shown until the next upload replaces the list');
      return emptyLists();
    }
    for (const platform of PLATFORMS) {
      lists[platform] = lists[platform].filter((row) => {
        let ok = row.file === PUBLIC_NAMES[platform](row.version);
        if (ok) {
          try {
            const st = fs.statSync(path.join(filesDir, row.file));
            ok = st.isFile() && st.size === row.bytes;
          } catch {
            ok = false;
          }
        }
        // For example after a restore of a server archive, which does not hold the uploaded files.
        if (!ok) say(`${platform} ${row.version} is listed as uploaded, but its file is missing or not the listed one - left out`);
        return ok;
      });
    }
    return lists;
  };

  /** The image rows the owner removed. */
  const loadRemoved = (): RemovedRow[] => {
    if (!fs.existsSync(removedListFile)) return [];
    try {
      const raw: unknown = JSON.parse(fs.readFileSync(removedListFile, 'utf8'));
      if (!Array.isArray(raw)) throw new Error('invalid');
      return raw
        .filter((entry): entry is Record<string, unknown> => isRecord(entry) && isPlatform(entry.platform) && isVersion(entry.version) && isSha256(entry.sha256))
        .map((entry) => ({ platform: entry.platform as Platform, version: entry.version as string, sha256: entry.sha256 as string }));
    } catch {
      say('the list of the removed files cannot be read - the files of the image are shown again until the next removal');
      return [];
    }
  };

  // An upload a crash or a restart interrupted.
  try {
    for (const name of fs.readdirSync(tmpDir)) fs.rmSync(path.join(tmpDir, name), { recursive: true, force: true });
  } catch {
    /* no such folder yet */
  }

  const image = loadImage();
  let volume = loadVolume();
  let removed = loadRemoved();

  // The merged list ------------------------------------------------------------------------------------

  const isRemoved = (platform: Platform, row: DownloadRow): boolean => removed.some((r) => r.platform === platform && r.version === row.version && r.sha256 === row.sha256);

  const merge = (): Record<Platform, ServerDownloadRow[]> => {
    const out = {} as Record<Platform, ServerDownloadRow[]>;
    for (const platform of PLATFORMS) {
      const uploaded = volume[platform].map((row): ServerDownloadRow => ({ ...row, source: 'uploaded' }));
      const versions = new Set(uploaded.map((row) => row.version));
      const fromImage = image[platform].filter((row) => !versions.has(row.version) && !isRemoved(platform, row)).map((row): ServerDownloadRow => ({ ...row, source: 'image' }));
      out[platform] = [...uploaded, ...fromImage].sort((a, b) => compareVersions(b.version, a.version));
    }
    return out;
  };

  let merged = merge();
  let byName = new Map<string, ServerDownloadRow>();
  /** The rendered Downloads pages (page file -> HTML) of the current list; the image's pages (never change). */
  const rendered = new Map<string, string>();
  const templates = new Map<string, string | null>();
  const unmarked = new Set<string>();

  const refresh = (): void => {
    merged = merge();
    byName = new Map(PLATFORMS.flatMap((platform) => merged[platform].map((row) => [row.file, row] as const)));
    rendered.clear();
  };
  refresh();

  const listed = (platform: Platform, version: string): ServerDownloadRow | undefined => merged[platform].find((row) => row.version === version);

  // The public side ------------------------------------------------------------------------------------

  const notFound = (res: Response): void => {
    res.status(404).type('text/plain; charset=utf-8').send('Not found\n');
  };

  const serveFile = (name: string, res: Response): void => {
    const row = byName.get(name);
    const root = row?.source === 'uploaded' ? filesDir : imageFilesDir;
    if (!row || !root) return notFound(res);
    // The headers of the static files of the site (app.ts): their content type, never cached without asking, ranges.
    res.sendFile(row.file, { root, cacheControl: false, headers: { 'Cache-Control': 'no-cache' } }, (err) => {
      if (err && !res.headersSent) notFound(res);
    });
  };

  const templateOf = (file: string): string | null => {
    if (!templates.has(file)) {
      let html: string | null = null;
      try {
        if (siteRoot) html = fs.readFileSync(path.join(siteRoot, ...file.split('/')), 'utf8');
      } catch {
        html = null;
      }
      templates.set(file, html);
    }
    return templates.get(file) ?? null;
  };

  const servePage = (page: PageDef, res: Response, next: NextFunction): void => {
    let html = rendered.get(page.file);
    if (html === undefined) {
      const template = templateOf(page.file);
      if (template === null) return next();
      const replaced = replaceDownloadRegions(template, merged, page);
      if (replaced === null && !unmarked.has(page.file)) {
        unmarked.add(page.file);
        say(`the page ${page.file} has no list markers - it is served as it was built`);
      }
      html = replaced ?? template;
      rendered.set(page.file, html);
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(html);
  };

  /** `/about/files` itself or a path below it; ignoring case, as a file system that ignores it would. */
  const filesPrefix = `${SITE_PREFIX}${FILES_DIR}`;
  const isUnderFiles = (p: string): boolean => {
    const lower = p.toLowerCase();
    return lower === filesPrefix || lower.startsWith(`${filesPrefix}/`);
  };

  const site: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    // Decided on the path as the static files would read it, never on its spelling: /about//files/<name>,
    // /about/%66iles/<name> or /about/./downloads/ must not reach the image's files and pages behind this handler.
    const resolved = resolvedSitePath(req.path);
    if (isUnderFiles(req.path) || (resolved !== null && isUnderFiles(resolved))) {
      if (resolved === null || !isUnderFiles(resolved)) return notFound(res);
      return serveFile(resolved.slice(filesPrefix.length + 1), res);
    }
    if (resolved === null || !resolved.toLowerCase().startsWith(SITE_PREFIX)) return next();
    // The Windows spellings of the same file (an NTFS stream such as index.html::$DATA, a trailing dot or space):
    // ordinary names on Linux, but on Windows they would hand the image's own page to the static files.
    if (/:|[. ](?:\/|$)/.test(resolved)) return notFound(res);
    const page = pages.get(resolved.slice(SITE_PREFIX.length).toLowerCase());
    if (page) return servePage(page, res, next);
    next();
  };

  // The limits -------------------------------------------------------------------------------------------

  let busy = false;
  /** When the uploads of the last 24 hours started, oldest first. */
  const started: number[] = [];
  let pending: (DownloadIntent & { token: string; sessionId: string; expiresAt: number }) | null = null;

  const usedToday = (): number => {
    const t = now();
    while (started.length && t - started[0] >= DAY_MS) started.shift();
    return started.length;
  };

  const marginOf = (totalBytes: number): number => Math.ceil((totalBytes * SERVER_DISK_LOW_PCT) / 100);

  /** The file of `bytes` and the low-disk margin fit on the volume (an unknown volume is not refused). */
  const assertRoom = (bytes: number): void => {
    const vol = volumeOf(dataDir);
    if (!vol) return;
    const need = bytes + marginOf(vol.totalBytes);
    if (vol.freeBytes < need) {
      say('upload refused (not enough free space)');
      throw downloadsNoSpace(need, vol.freeBytes);
    }
  };

  const assertSize = (bytes: number): void => {
    if (bytes > maxBytes) throw ApiError.localized(413, 'VALIDATION', DOWNLOADS_TOO_LARGE_KEY, { maxMb: Math.floor(maxBytes / MB) }, 'file');
    if (bytes < minBytes) throw ApiError.localized(400, 'VALIDATION', DOWNLOADS_TOO_SMALL_KEY, { minMb: Math.max(1, Math.ceil(minBytes / MB)) }, 'file');
  };

  /** Not busy, under the daily limit, and the platform and version not listed yet. */
  const assertCanUpload = (platform: Platform, version: string): void => {
    if (busy) throw ApiError.localized(429, 'FORBIDDEN', DOWNLOADS_BUSY_KEY);
    if (usedToday() >= perDay) throw downloadsTooMany(perDay, started[0] + DAY_MS - now());
    if (listed(platform, version)) throw ApiError.localized(409, 'VALIDATION', DOWNLOADS_EXISTS_KEY, { platform: PLATFORM_NAMES[platform], version }, 'version');
  };

  const platformOf = (value: unknown): Platform => {
    if (!isPlatform(value)) throw ApiError.validation(DOWNLOADS_PLATFORM_KEY, 'platform');
    return value;
  };

  // Changing the lists ---------------------------------------------------------------------------------

  /** The state after `rows` of `platform` leave the page (not saved yet). */
  const planRemoval = (platform: Platform, rows: readonly ServerDownloadRow[], base: Change = { volume: copyLists(volume), removed: [...removed], removedChanged: false, files: [] }): Change => {
    const change = base;
    const hide = (row: DownloadRow): void => {
      if (change.removed.some((r) => r.platform === platform && r.version === row.version && r.sha256 === row.sha256)) return;
      change.removed.push({ platform, version: row.version, sha256: row.sha256 });
      change.removedChanged = true;
    };
    for (const row of rows) {
      if (row.source === 'uploaded') {
        change.volume[platform] = change.volume[platform].filter((r) => r.version !== row.version);
        change.files.push(row.file);
        // An image row of the same version was hidden behind it: it would come back - it goes too.
        for (const hidden of image[platform].filter((r) => r.version === row.version)) hide(hidden);
      } else {
        hide(row);
      }
    }
    return change;
  };

  const writeAtomic = (file: string, text: string): void => {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, text, 'utf8');
    fs.renameSync(tmp, file);
  };

  const removeQuietly = (file: string): void => {
    try {
      fs.rmSync(file, { force: true });
    } catch {
      /* best effort */
    }
  };

  /** Saves a change (removed.json first, then the list) and makes it the state; on a failed write nothing changed. */
  const commit = (change: Change): void => {
    fs.mkdirSync(siteDataDir, { recursive: true });
    if (change.removedChanged) writeAtomic(removedListFile, formatRemoved(change.removed));
    try {
      writeAtomic(volumeListFile, formatDownloads(change.volume));
    } catch (e) {
      if (change.removedChanged) {
        try {
          writeAtomic(removedListFile, formatRemoved(removed));
        } catch {
          /* the next start reads what is there */
        }
      }
      throw e;
    }
    volume = change.volume;
    removed = change.removed;
    refresh();
    for (const file of change.files) removeQuietly(path.join(filesDir, file));
  };

  // The e-mail -----------------------------------------------------------------------------------------

  const notify = async (kind: 'published' | 'removed', notice: DownloadNotice, platform: Platform, row: ServerDownloadRow, older: readonly ServerDownloadRow[], at: number): Promise<ServerDownloadEmail> => {
    if (!opts.mail.ready()) return 'notConfigured';
    if (!notice.to) return 'noAddress';
    const input: DownloadEmailInput = {
      to: notice.to,
      firstName: notice.firstName,
      platformName: PLATFORM_NAMES[platform],
      version: row.version,
      file: row.file,
      bytes: row.bytes,
      sha256: row.sha256,
      at: new Date(at).toISOString(),
      olderRemoved: older.map((r) => r.version),
    };
    try {
      await opts.mail.send(kind === 'published' ? downloadPublishedEmail(notice.locale, input) : downloadRemovedEmail(notice.locale, input));
      return 'sent';
    } catch (e) {
      // The catalogue key and the SMTP code only - never the text of a failure.
      say(`the e-mail about it was not sent (${isSmtpError(e) ? mailFailureTag(e) : 'unexpected error'})`);
      return 'failed';
    }
  };

  // The API --------------------------------------------------------------------------------------------

  const list = (ownerEmail: string): ServerDownloads => {
    const vol = volumeOf(dataDir);
    return {
      platforms: { windows: [...merged.windows], android: [...merged.android], mac: [...merged.mac] },
      limits: { maxBytes, minBytes, perDay, usedToday: usedToday(), tokenMinutes, keepFreePct: SERVER_DISK_LOW_PCT, freeBytes: vol ? vol.freeBytes : null },
      busy,
      email: !opts.mail.ready() ? 'notConfigured' : ownerEmail ? 'ready' : 'noAddress',
    };
  };

  /** Streams the body into `file`: its SHA-256, its first and last bytes; never more than `expected` bytes. */
  const receive = async (req: Request, file: string, expected: number): Promise<Received> => {
    const hash = createHash('sha256');
    const head: Buffer[] = [];
    let headLength = 0;
    const tail: Buffer[] = [];
    let tailLength = 0;
    let bytes = 0;
    const fh = await fs.promises.open(file, 'wx', 0o600);
    const idle = setTimeout(() => req.destroy(new Error('no data')), idleMs);
    idle.unref?.();
    try {
      for await (const chunk of req) {
        idle.refresh();
        const data = chunk as Buffer;
        bytes += data.length;
        if (bytes > expected) throw ApiError.localized(413, 'VALIDATION', DOWNLOADS_TOO_LARGE_KEY, { maxMb: Math.floor(maxBytes / MB) }, 'file');
        hash.update(data);
        if (headLength < UPLOAD_HEAD_BYTES) {
          const part = data.subarray(0, UPLOAD_HEAD_BYTES - headLength);
          head.push(part);
          headLength += part.length;
        }
        tail.push(data);
        tailLength += data.length;
        while (tail.length > 1 && tailLength - tail[0].length >= UPLOAD_TAIL_BYTES) tailLength -= (tail.shift() as Buffer).length;
        let offset = 0;
        while (offset < data.length) {
          const { bytesWritten } = await fh.write(data, offset, data.length - offset);
          offset += bytesWritten;
        }
      }
      await fh.sync();
    } finally {
      clearTimeout(idle);
      await fh.close();
    }
    const end = Buffer.concat(tail);
    return { bytes, sha256: hash.digest('hex'), head: Buffer.concat(head), tail: end.subarray(Math.max(0, end.length - UPLOAD_TAIL_BYTES)) };
  };

  const sameToken = (a: string, b: string): boolean => {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
  };

  return {
    site,
    list,

    checkIntent(body: Record<string, unknown>): DownloadIntent {
      const platform = platformOf(body.platform);
      const version = body.version;
      if (typeof version !== 'string' || !UPLOAD_VERSION_RE.test(version)) throw ApiError.validation(DOWNLOADS_VERSION_KEY, 'version');
      if (body.removeOlder !== undefined && typeof body.removeOlder !== 'boolean') throw ApiError.validation(DOWNLOADS_BAD_BODY_KEY, 'removeOlder');
      const bytes = body.bytes;
      if (bytes !== undefined && !(typeof bytes === 'number' && Number.isSafeInteger(bytes) && bytes >= 0)) throw ApiError.validation(DOWNLOADS_BAD_BODY_KEY, 'bytes');
      assertCanUpload(platform, version);
      if (typeof bytes === 'number') {
        assertSize(bytes);
        assertRoom(bytes);
      }
      return { platform, version, removeOlder: body.removeOlder === true };
    },

    issueToken(intent: DownloadIntent, sessionId: string): ServerDownloadUploadTicket {
      const token = randomBytes(32).toString('base64url');
      const expiresAt = now() + tokenMinutes * 60_000;
      pending = { ...intent, token, sessionId, expiresAt };
      return {
        token,
        expiresAt: new Date(expiresAt).toISOString(),
        uploadPath: `/api/server/downloads/upload/${token}`,
        platform: intent.platform,
        version: intent.version,
        file: PUBLIC_NAMES[intent.platform](intent.version),
        removeOlder: intent.removeOlder,
        maxBytes,
        minBytes,
      };
    },

    async upload(req: Request, token: string, sessionId: string, notice: DownloadNotice): Promise<ServerDownloadResult> {
      // The token: once, for the session that asked for it, within its minutes. A request that names the token uses
      // it up, whatever happens next; a path, a guess or another session's request gets nothing.
      const ticket = pending;
      const named = ticket !== null && TOKEN_RE.test(token) && sameToken(token, ticket.token);
      if (named) pending = null;
      if (!named || !ticket || ticket.sessionId !== sessionId || now() > ticket.expiresAt) {
        say('upload refused (the upload token is not valid)');
        throw ApiError.localized(403, 'FORBIDDEN', DOWNLOADS_TOKEN_KEY, { minutes: tokenMinutes });
      }
      const { platform, version, removeOlder } = ticket;
      // The request: the file as it is, with its size.
      const type = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
      if (type !== 'application/octet-stream') throw ApiError.localized(415, 'VALIDATION', DOWNLOADS_CONTENT_TYPE_KEY);
      const declared = req.headers['content-length'];
      if (typeof declared !== 'string' || !/^\d{1,15}$/.test(declared) || req.headers['transfer-encoding'] !== undefined) {
        throw ApiError.localized(411, 'VALIDATION', DOWNLOADS_LENGTH_REQUIRED_KEY);
      }
      const length = Number(declared);
      assertSize(length);
      assertCanUpload(platform, version);
      assertRoom(length);

      // From here on the upload counts against the daily limit, whatever its outcome - and it may take the listener's
      // whole UPLOAD_REQUEST_TIMEOUT_MS (UPLOAD_IDLE_MS still ends one that stops sending).
      busy = true;
      started.push(now());
      allowLongRequest(req);
      const tmp = path.join(tmpDir, `upload-${randomBytes(8).toString('hex')}.part`);
      let row: ServerDownloadRow;
      let older: ServerDownloadRow[];
      let at: number;
      try {
        fs.mkdirSync(tmpDir, { recursive: true });
        const received = await receive(req, tmp, length);
        if (received.bytes !== length) throw ApiError.localized(400, 'VALIDATION', DOWNLOADS_INCOMPLETE_KEY, undefined, 'file');
        if (!installerSignatureOk(platform, received.head, received.tail, received.bytes)) {
          say(`upload refused (not an installer for ${platform})`);
          throw ApiError.localized(400, 'VALIDATION', NOT_THE_PLATFORM[platform], undefined, 'file');
        }
        // The file is on the volume now: what is left must still be the margin.
        const vol = volumeOf(dataDir);
        if (vol && vol.freeBytes < marginOf(vol.totalBytes)) {
          say('upload refused (not enough free space)');
          throw downloadsNoSpace(length + marginOf(vol.totalBytes), vol.freeBytes + length);
        }
        // Publish: listed again? (a change while it streamed) - then the file, the lists, the older rows.
        if (listed(platform, version)) throw ApiError.localized(409, 'VALIDATION', DOWNLOADS_EXISTS_KEY, { platform: PLATFORM_NAMES[platform], version }, 'version');
        at = now();
        const published: DownloadRow = { version, date: new Date(at).toISOString().slice(0, 10), file: PUBLIC_NAMES[platform](version), bytes: received.bytes, sha256: received.sha256 };
        older = removeOlder ? merged[platform].filter((r) => compareVersions(r.version, version) < 0) : [];
        const change = planRemoval(platform, older);
        change.volume[platform] = [...change.volume[platform], published].sort((a, b) => compareVersions(b.version, a.version));
        fs.mkdirSync(filesDir, { recursive: true });
        const target = path.join(filesDir, published.file);
        fs.renameSync(tmp, target);
        try {
          commit(change);
        } catch (e) {
          removeQuietly(target);
          throw e;
        }
        row = { ...published, source: 'uploaded' };
      } catch (e) {
        removeQuietly(tmp);
        if (e instanceof ApiError) throw e;
        const code = (e as NodeJS.ErrnoException)?.code;
        if (code === 'ENOSPC' || code === 'EDQUOT') {
          say('upload failed (the volume is full)');
          const vol = volumeOf(dataDir);
          throw downloadsNoSpace(length + (vol ? marginOf(vol.totalBytes) : 0), vol ? vol.freeBytes : 0);
        }
        if (!req.complete) {
          say('upload refused (the file did not arrive whole)');
          throw ApiError.localized(400, 'VALIDATION', DOWNLOADS_INCOMPLETE_KEY, undefined, 'file');
        }
        say(`upload failed (${code ?? 'error'})`);
        throw downloadsFailed();
      } finally {
        busy = false;
      }
      // Published: the log line and the e-mail (the next upload need not wait for the mail server).
      say(`published ${platform} ${version} (${row.bytes} bytes${older.length ? `; ${older.length} older removed` : ''})`);
      const email = await notify('published', notice, platform, row, older, at);
      return { action: 'published', row, removedOlder: older, email, downloads: list(notice.to) };
    },

    checkRemove(body: Record<string, unknown>): DownloadTarget {
      const platform = platformOf(body.platform);
      const version = body.version;
      if (!isVersion(version)) throw ApiError.validation(DOWNLOADS_VERSION_KEY, 'version');
      if (!listed(platform, version)) throw ApiError.localized(404, 'NOT_FOUND', DOWNLOADS_NOT_LISTED_KEY, { platform: PLATFORM_NAMES[platform], version });
      return { platform, version };
    },

    async remove(target: DownloadTarget, notice: DownloadNotice): Promise<ServerDownloadResult> {
      const { platform, version } = target;
      const row = listed(platform, version);
      if (!row) throw ApiError.localized(404, 'NOT_FOUND', DOWNLOADS_NOT_LISTED_KEY, { platform: PLATFORM_NAMES[platform], version });
      try {
        commit(planRemoval(platform, [row]));
      } catch (e) {
        say(`removal failed (${(e as NodeJS.ErrnoException)?.code ?? 'error'})`);
        throw downloadsFailed();
      }
      const at = now();
      say(`removed ${platform} ${version} (${row.source === 'image' ? 'came with the server' : 'uploaded'})`);
      const email = await notify('removed', notice, platform, row, [], at);
      return { action: 'removed', row, removedOlder: [], email, downloads: list(notice.to) };
    },
  };
}
