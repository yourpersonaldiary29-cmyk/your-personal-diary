/**
 * The required update (app version 1.1.0): per platform - android, ios, windows, mac - the OLDEST version of the app
 * that may still be used, or no rule. In the owner's hands only (routes/server-app-update.ts): a store reviews an
 * update and rolls it out over hours or days, so a rule never comes on by itself with a deploy. Built only by the
 * hosted composition (hosted.ts): the desktop sidecar and the Android core never load it.
 *
 * The rules - one file on the data volume, next to the files of the Downloads page:
 *   <dataDir>/site/app-update.json   { "rules": { "android": "1.1.0", "ios": null, "windows": null, "mac": null } }
 * Missing (every platform off - the state after this package until the owner turns a rule on), unreadable or
 * damaged (not JSON, no "rules" object, a value that is neither null nor a.b.c): NO rule at all - nobody is refused,
 * `ServerInfo.appUpdate` is absent - and one log line without secrets; the owner's next save writes a whole new file
 * and so repairs it. A change is written atomically (a temporary file, then a rename - as the Downloads list). The
 * rules are read once at start and kept in memory: they change only through the owner's route of this process, so
 * neither the server info nor the refusal ever reads the disk.
 *
 * The store links - ONE home, site/settings.json `links`: the site builder writes them next to the list of the
 * installers, <staticDir>/about/files/store-links.json (STORE_LINKS_FILE of scripts/site/downloads-shared.mjs; the
 * hosted server never serves it), and this module reads them once at start. A link is used only when it is an https
 * address on the store's own host - play.google.com for Google Play (android), apps.apple.com for the App Store (ios)
 * - without a user, a password or a port; a missing file, an empty link or any other address means: no link.
 *
 * What the apps get:
 *   - from 1.1.0 on: `ServerInfo.appUpdate` (info()) - the platforms whose rule is on, each with its oldest allowed
 *     version and, for android and ios, the store link when the site has one. The app decides by itself;
 *   - before 1.1.0 (1.0.0, 1.0.1 - they know no such screen): an app origin WITHOUT the mark CLIENT_MARK_HEADER is
 *     refused on the session routes only (refuseOld, mounted on /api/auth) while its platform's rule is 1.1.0 or
 *     later (a rule of 1.0.0 or 1.0.1 refuses nobody) - see LAST_UNMARKED_VERSION, SESSION_ROUTES and
 *     APP_ORIGIN_PLATFORMS below. Every other route answers an old version exactly as before (its
 *     queued changes keep uploading through /api/sync), and nothing else is ever refused. The message names the
 *     App Store for the iPhone and gives the Downloads page of the site for every other platform - for Android
 *     also when the site has a Google Play link (refusalFor says why).
 *
 * The owner's route cannot save a rule below FIRST_UPDATE_AWARE_VERSION (1.1.0) - checkChange; a rule of 1.0.x that
 * is already in the file (written by hand or by an earlier build) is still read as it is and refuses nobody.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { APP_VERSION, CLIENT_MARK_HEADER, FIRST_UPDATE_AWARE_VERSION } from '@shared/constants';
import { DEFAULT_LOCALE, type Locale } from '@shared/i18n';
import { APP_PLATFORMS, type AppPlatform, type AppUpdateInfo, type AppUpdateRule, type ServerAppUpdate } from '@shared/types';
import { compareVersions, STORE_LINKS_FILE } from '../../../scripts/site/downloads-shared.mjs';
import { ApiError } from '../errors';
import { isSmtpError, mailFailureTag } from '../mail/errors';
import { appUpdateChangedEmail } from '../mail/templates';
import { localeOf } from '../middleware/locale';
import { APP_UPDATE_PLATFORM_KEY, APP_UPDATE_TOO_NEW_KEY, APP_UPDATE_TOO_OLD_KEY, APP_UPDATE_VERSION_KEY, appUpdateFailed, updateRequired } from './app-update-errors';
import { SITE_DATA_DIR, UPLOAD_VERSION_RE, type DownloadsMailer } from './downloads';
import type { AppUpdateChange, AppUpdateController, DownloadNotice } from './types';

/** <dataDir>/site/app-update.json */
export const APP_UPDATE_FILE = 'app-update.json';
/** Where the site is in the built UI (SITE_ID of scripts/site/build-site.mjs). */
const SITE_FOLDER = 'about';

/**
 * Which app origin belongs to which platform - the `Origin` the WebView of each app sends with its requests to the
 * hosted server (all five are HOSTED_ORIGINS of middleware/access.ts):
 *
 *   https://localhost         android   Capacitor, capacitor.config.ts `server.androidScheme: 'https'`, hostname
 *                                       left at its default 'localhost'
 *   capacitor://localhost     ios       Capacitor's default `server.iosScheme` 'capacitor' (it cannot be http(s) on
 *                                       iOS), hostname 'localhost' (capacitor.config.ts, docs/APPLE-PLAN.md)
 *   http://tauri.localhost    windows   Tauri 2 on Windows serves the UI as http://tauri.localhost
 *                                       (src-tauri/tauri.conf.json sets no `useHttpsScheme`)
 *   https://tauri.localhost   windows   the same with `useHttpsScheme` - allowed by the server, kept with Windows
 *   tauri://localhost         mac       Tauri 2 on macOS (and Linux, for which there is no app) uses
 *                                       <scheme>://localhost (src-tauri/tauri.macos.conf.json, docs/APPLE-PLAN.md)
 *
 * Nothing else is attributed and so nothing else is ever refused: a request without an Origin, the server's own
 * origin (the web version, always the newest), the developer origins (DEV_ORIGINS: the Vite dev servers on ports
 * 1420 and 1430), the Android developer build with the core in the WebView (it sends no HTTP request at all) and any
 * other origin.
 */
export const APP_ORIGIN_PLATFORMS: ReadonlyMap<string, AppPlatform> = new Map<string, AppPlatform>([
  ['https://localhost', 'android'],
  ['capacitor://localhost', 'ios'],
  ['http://tauri.localhost', 'windows'],
  ['https://tauri.localhost', 'windows'],
  ['tauri://localhost', 'mac'],
]);

/** The platform of an app origin; null for every origin that is not one of APP_ORIGIN_PLATFORMS. */
export function platformOfOrigin(origin: string | string[] | undefined): AppPlatform | null {
  if (typeof origin !== 'string') return null;
  return APP_ORIGIN_PLATFORMS.get(origin) ?? null;
}

/**
 * The routes under /api/auth that open or check a session (routes/auth.ts): GET /me checks the session of a token
 * the app already holds; POST /login, /register and /guest are the only routes that hand out a session token
 * (POST /reset-password answers the user name, never a token). These - and nothing else - are refused to a version
 * before 1.1.0 while its platform's rule is 1.1.0 or later. HEAD /me is the same route for Express.
 */
export const SESSION_ROUTES: readonly { method: string; path: string }[] = [
  { method: 'GET', path: '/me' },
  { method: 'HEAD', path: '/me' },
  { method: 'POST', path: '/login' },
  { method: 'POST', path: '/register' },
  { method: 'POST', path: '/guest' },
];

/**
 * True for a session route, `routePath` relative to /api/auth - spelled as Express' router matches it (any case,
 * trailing slashes), so that no other spelling of the same route gets past the refusal.
 */
export function isSessionRoute(method: string, routePath: string): boolean {
  const p = routePath.toLowerCase().replace(/\/+$/, '');
  const m = method.toUpperCase();
  return SESSION_ROUTES.some((route) => route.method === m && route.path === p);
}

/**
 * The newest version of the apps that sends NO mark: 1.0.0 and 1.0.1 are the only released versions without it, and
 * every version from 1.1.0 on sends it. An unmarked request is therefore a version of at most this one - which one,
 * the server cannot tell. So a rule refuses unmarked requests only when it is ABOVE this version (1.1.0 or later):
 * then every unmarked version is older than the rule. A rule of 1.0.1 or 1.0.0 ("1.0.0 must update" / "every
 * version may be used") cannot tell 1.0.0 from 1.0.1 and refuses nobody - refusing nobody is the safe side, it never
 * locks out a version the owner allowed. (The apps from 1.1.0 on decide by themselves through ServerInfo.appUpdate
 * and are newer than such a rule anyway.)
 */
export const LAST_UNMARKED_VERSION = '1.0.1';

/** True when a rule of `minVersion` refuses the unmarked versions (those of at most LAST_UNMARKED_VERSION). */
export function ruleRefusesUnmarked(minVersion: string | null | undefined): boolean {
  return !!minVersion && compareVersions(minVersion, LAST_UNMARKED_VERSION) > 0;
}

/** At most this many bytes are read of the rules file and of the store-links file; a bigger file counts as damaged. */
export const MAX_SMALL_FILE_BYTES = 64 * 1024;

/** The text of a small file written by the server or the site build; throws when it is bigger than MAX_SMALL_FILE_BYTES. */
function readSmallFile(file: string): string {
  if (fs.statSync(file).size > MAX_SMALL_FILE_BYTES) throw new Error('too big');
  return fs.readFileSync(file, 'utf8');
}

/** True when the request carries the mark of version 1.1.0 and later (any non-empty value: a later mark is never refused). */
export function hasClientMark(req: Pick<Request, 'headers'>): boolean {
  const raw = req.headers[CLIENT_MARK_HEADER.toLowerCase()];
  const value = Array.isArray(raw) ? raw.join(',') : raw;
  return typeof value === 'string' && value.trim() !== '';
}

/** The platforms as the e-mail names them (product names: the same in every language). */
export const APP_PLATFORM_NAMES: Readonly<Record<AppPlatform, string>> = { android: 'Android', ios: 'iPhone', windows: 'Windows', mac: 'Mac' };
/** The stores that have a link in site/settings.json, the key there, their name in the message, their one host. */
const STORES: Partial<Record<AppPlatform, { key: 'googlePlay' | 'appStoreIphone'; name: string; host: string }>> = {
  android: { key: 'googlePlay', name: 'Google Play', host: 'play.google.com' },
  ios: { key: 'appStoreIphone', name: 'App Store', host: 'apps.apple.com' },
};

/** A store link of STORE_LINKS_FILE that may be used: https on the store's own host, no user, password or port. */
export function storeLinkOf(value: unknown, host: string): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname !== host || url.username || url.password || url.port) return null;
  return url.href;
}

/** The Downloads page of the site in `locale`: <publicUrl>/about/downloads/ or <publicUrl>/about/<code>/downloads/. */
export function downloadsPageUrl(publicUrl: string, locale: Locale): string {
  return `${publicUrl.replace(/\/+$/, '')}/${SITE_FOLDER}/${locale === DEFAULT_LOCALE ? '' : `${locale}/`}downloads/`;
}

type Rules = Record<AppPlatform, string | null>;
const noRules = (): Rules => ({ android: null, ios: null, windows: null, mac: null });
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isPlatform = (value: unknown): value is AppPlatform => typeof value === 'string' && (APP_PLATFORMS as readonly string[]).includes(value);

/** The rules of a parsed app-update.json; null when it is damaged. Unknown keys are ignored. */
export function rulesOf(raw: unknown): Rules | null {
  if (!isRecord(raw) || !isRecord(raw.rules)) return null;
  const rules = noRules();
  for (const platform of APP_PLATFORMS) {
    const value = raw.rules[platform];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string' || !UPLOAD_VERSION_RE.test(value)) return null;
    rules[platform] = value;
  }
  return rules;
}

/** The text of app-update.json: every platform, one per line. */
export function formatRules(rules: Rules): string {
  return `{\n  "rules": {\n${APP_PLATFORMS.map((p) => `    ${JSON.stringify(p)}: ${JSON.stringify(rules[p])}`).join(',\n')}\n  }\n}\n`;
}

export interface AppUpdateOptions {
  dataDir: string;
  /** The built UI (config.staticDir): the store links are in <staticDir>/about/files/store-links.json. Undefined = no link. */
  staticDir?: string;
  /** The public origin of the server (env.publicUrl): the base of the Downloads page in the message. */
  publicUrl: string;
  mail: DownloadsMailer;
  /** Per platform, the newest version on the Downloads page (the owner's hint); default: none. */
  newestDownload?: () => Partial<Record<AppPlatform, string>>;
  /** The server's own version; default APP_VERSION (tests). A rule may not be above it. */
  serverVersion?: string;
  /** Clock of the e-mail's date (tests). */
  now?: () => number;
  /** Log line sink (default: stderr). It never gets a personal value. */
  log?: (line: string) => void;
}

/** A refusal is logged at most this often per platform (the operator sees that old versions still come). */
const REFUSAL_LOG_EVERY_MS = 10 * 60_000;

export function createAppUpdateController(opts: AppUpdateOptions): AppUpdateController {
  const now = opts.now ?? Date.now;
  const log = opts.log ?? ((line: string) => console.error(`[diary-server] ${line}`));
  const say = (line: string): void => {
    try {
      log(`app-update: ${line}`);
    } catch {
      /* a log that cannot be written is no reason to fail a request */
    }
  };
  const serverVersion = opts.serverVersion ?? APP_VERSION;
  const siteDataDir = path.join(path.resolve(opts.dataDir), SITE_DATA_DIR);
  const rulesFile = path.join(siteDataDir, APP_UPDATE_FILE);

  // The store links of the deployed site ----------------------------------------------------------------
  const storeLinks: Partial<Record<AppPlatform, string>> = {};
  if (opts.staticDir) {
    const siteRoot = path.join(path.resolve(opts.staticDir), SITE_FOLDER);
    const file = path.join(siteRoot, ...STORE_LINKS_FILE.split('/'));
    if (fs.existsSync(file)) {
      try {
        const raw: unknown = JSON.parse(readSmallFile(file));
        if (!isRecord(raw)) throw new Error('invalid');
        for (const [platform, store] of Object.entries(STORES) as [AppPlatform, NonNullable<(typeof STORES)[AppPlatform]>][]) {
          const value = raw[store.key];
          const link = storeLinkOf(value, store.host);
          if (link) storeLinks[platform] = link;
          else if (typeof value === 'string' && value.trim()) say(`the ${store.name} link of the site is not an https address on ${store.host} - it is not used`);
        }
      } catch {
        say(`the store links of the site cannot be read (${SITE_FOLDER}/${STORE_LINKS_FILE}) - the apps are sent to the Downloads page`);
      }
    } else if (fs.existsSync(path.join(siteRoot, 'index.html'))) {
      say(`the image holds no store links (${SITE_FOLDER}/${STORE_LINKS_FILE}) - the apps are sent to the Downloads page`);
    }
  }

  // The rules -------------------------------------------------------------------------------------------
  const load = (): Rules => {
    if (!fs.existsSync(rulesFile)) return noRules();
    try {
      const rules = rulesOf(JSON.parse(readSmallFile(rulesFile)));
      if (!rules) throw new Error('invalid');
      return rules;
    } catch {
      say(`the rules cannot be read (${SITE_DATA_DIR}/${APP_UPDATE_FILE}) - no update is required until the owner saves a rule again`);
      return noRules();
    }
  };

  let rules = load();
  let published: AppUpdateInfo | undefined;
  const publish = (): void => {
    const info: AppUpdateInfo = {};
    for (const platform of APP_PLATFORMS) {
      const minVersion = rules[platform];
      if (!minVersion) continue;
      const rule: AppUpdateRule = { minVersion };
      const link = storeLinks[platform];
      if (link) rule.storeUrl = link;
      info[platform] = rule;
    }
    published = Object.keys(info).length ? info : undefined;
  };
  publish();
  const on = APP_PLATFORMS.filter((p) => rules[p]);
  if (on.length) say(`on for ${on.map((p) => `${p} (older than ${rules[p]})`).join(', ')}`);

  // The refusal of the versions before 1.1.0 --------------------------------------------------------------
  const lastRefusalLog = new Map<AppPlatform, number>();
  const refusalFor = (platform: AppPlatform, locale: Locale): ApiError => {
    // The iPhone app comes only from the App Store, so its message names the store, with or without a link on the
    // site (the Downloads page offers no iPhone file).
    if (platform === 'ios') return updateRequired({ store: 'App Store' });
    // Android, Windows and Mac: always the Downloads page of the site in the request's language - for Android also
    // when the site has a Google Play link. Android has two sources of the same app, and an install from one cannot
    // be updated from the other: the APK of the Downloads page is signed with the owner's upload key, what Google
    // Play installs is signed by Google with its own key (Play App Signing), and Android refuses an update with
    // another signature. Every Android install of 1.0.0 and 1.0.1 (the only unmarked versions) came from the site's
    // file - Google Play never had them - so only the site's file can update it; sending it to Google Play would
    // leave it nothing to install but a reinstall that deletes what the app keeps on the device. (Should 1.0.1 ever
    // reach Google Play, the Downloads page carries the Google Play button as well.) `ServerInfo.appUpdate` still
    // gives Android its store link: the apps from 1.1.0 on offer both ways.
    return updateRequired({ url: downloadsPageUrl(opts.publicUrl, locale) });
  };

  const refuseOld: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
    let refusal: ApiError | null = null;
    try {
      if (published && isSessionRoute(req.method, req.path) && !hasClientMark(req)) {
        const platform = platformOfOrigin(req.headers.origin);
        // Only a rule above the last unmarked version: see LAST_UNMARKED_VERSION.
        if (platform && ruleRefusesUnmarked(rules[platform])) {
          refusal = refusalFor(platform, localeOf(req));
          const t = now();
          if (t - (lastRefusalLog.get(platform) ?? -Infinity) >= REFUSAL_LOG_EVERY_MS) {
            lastRefusalLog.set(platform, t);
            say(`a version before 1.1.0 of the ${platform} app was asked to update (the first in 10 minutes)`);
          }
        }
      }
    } catch {
      // Whatever goes wrong here, the request goes on as before: the refusal never becomes a 500.
      refusal = null;
    }
    if (refusal) next(refusal);
    else next();
  };

  // The owner's view and changes --------------------------------------------------------------------------
  const view = (ownerEmail: string): ServerAppUpdate => {
    let newestDownload: Partial<Record<AppPlatform, string>> = {};
    try {
      newestDownload = opts.newestDownload?.() ?? {};
    } catch {
      newestDownload = {};
    }
    return {
      rules: { ...rules },
      serverVersion,
      newestDownload,
      email: !opts.mail.ready() ? 'notConfigured' : ownerEmail ? 'ready' : 'noAddress',
    };
  };

  const writeAtomic = (text: string): void => {
    fs.mkdirSync(siteDataDir, { recursive: true });
    const tmp = `${rulesFile}.tmp`;
    try {
      fs.writeFileSync(tmp, text, 'utf8');
      fs.renameSync(tmp, rulesFile);
    } catch (e) {
      try {
        fs.rmSync(tmp, { force: true });
      } catch {
        /* best effort */
      }
      throw e;
    }
  };

  const notify = async (notice: DownloadNotice, change: AppUpdateChange, at: number): Promise<void> => {
    if (!opts.mail.ready() || !notice.to) return;
    try {
      await opts.mail.send(
        appUpdateChangedEmail(notice.locale, { to: notice.to, firstName: notice.firstName, platformName: APP_PLATFORM_NAMES[change.platform], minVersion: change.minVersion, at: new Date(at).toISOString() }),
      );
    } catch (e) {
      // The catalogue key and the SMTP code only - never the text of a failure.
      say(`the e-mail about it was not sent (${isSmtpError(e) ? mailFailureTag(e) : 'unexpected error'})`);
    }
  };

  return {
    info: () => published,
    refuseOld,
    view,

    checkChange(body: Record<string, unknown>): AppUpdateChange {
      const platform = body.platform;
      if (!isPlatform(platform)) throw ApiError.validation(APP_UPDATE_PLATFORM_KEY, 'platform');
      const minVersion = body.minVersion;
      // Turning a rule off is always allowed.
      if (minVersion === null) return { platform, minVersion: null };
      if (typeof minVersion !== 'string' || !UPLOAD_VERSION_RE.test(minVersion)) throw ApiError.validation(APP_UPDATE_VERSION_KEY, 'minVersion');
      // A rule below the first version that knows the screen would refuse nobody (see LAST_UNMARKED_VERSION: the
      // server cannot tell 1.0.0 from 1.0.1, and every later app is newer than such a rule) while the owner's card
      // said "Versions older than 1.0.1 must update". So it cannot be saved. (A rule that is already in the file is
      // still read as it is, and refuses nobody.)
      if (compareVersions(minVersion, FIRST_UPDATE_AWARE_VERSION) < 0) throw ApiError.validation(APP_UPDATE_TOO_OLD_KEY, 'minVersion', { version: FIRST_UPDATE_AWARE_VERSION });
      // Nobody can have a newer app than the newest release: a typing mistake must not lock everybody out.
      if (compareVersions(minVersion, serverVersion) > 0) throw ApiError.validation(APP_UPDATE_TOO_NEW_KEY, 'minVersion', { version: serverVersion });
      return { platform, minVersion };
    },

    async change(change: AppUpdateChange, notice: DownloadNotice): Promise<ServerAppUpdate> {
      const next: Rules = { ...rules, [change.platform]: change.minVersion };
      try {
        writeAtomic(formatRules(next));
      } catch (e) {
        say(`the rule could not be saved (${(e as NodeJS.ErrnoException)?.code ?? 'error'}) - nothing changed`);
        throw appUpdateFailed();
      }
      rules = next;
      publish();
      const at = now();
      say(change.minVersion ? `${change.platform}: versions older than ${change.minVersion} must update` : `${change.platform}: turned off - no update is required`);
      await notify(notice, change, at);
      return view(notice.to);
    },
  };
}
