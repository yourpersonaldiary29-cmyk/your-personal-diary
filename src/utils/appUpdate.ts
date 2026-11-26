/**
 * Required update (app version 1.1.0; the owner's rule: server/src/hosted/app-update.ts, his section
 * "Required update" of the Server card: src/pages/settings/ServerAppUpdate.tsx).
 *
 * The PURE decision (`updateRequirement`): from the platform this app runs on, the app's own version
 * (`APP_VERSION`) and the server's self-description received IN THIS RUN (`GET /api/server/info`, its
 * optional `appUpdate`), whether this app must be updated before it can be used again. It is required
 * only when ALL of this holds:
 *  - the app is one of the four apps (android, ios, windows, mac) - the web version is never asked: the
 *    server always serves the newest one;
 *  - the server answered in this run and its answer carries a rule for this platform - without a
 *    connection nothing is blocked (an app that starts from its cache works as always), and the rule is
 *    never kept on the device: the session snapshot of the offline start keeps only the fields listed in
 *    src/offline/session.ts (`SessionSnapshot.serverInfo`), never `appUpdate`;
 *  - the rule's version and the app's own version are both versions `a.b.c`, and the app's is LOWER (a
 *    rule this app cannot read blocks nothing).
 *
 * What the screen offers (`updateTarget`): Android - Google Play when the server gave a store link, else
 * the Downloads page of the site in the app's language; iPhone - the App Store when the server gave a
 * link, else only the sentence to update in the App Store; Windows and Mac - the Downloads page of the
 * site (which carries the store button, once there is one, and the installer). A link the server gave is
 * used only when it is an https address without credentials on the store host of its platform
 * (`storeLink`: play.google.com for Android, apps.apple.com for the iPhone): anything else counts as "no link".
 * No address is written here: the store links come from the server, the Downloads page is built from the
 * diary server's own address (src/components/legal/LegalPageLink.tsx).
 */
import type { Locale } from '@shared/i18n';
import type { AppPlatform, AppUpdateRule, ServerInfo } from '@shared/types';
import { downloadsPageUrl } from '@/components/legal/LegalPageLink';
import { isMacApp } from '@/offline/session';
import { isNativeApp, isTauri, platformName } from '@/utils/platform';

/** `a.b.c`, each part 0..9999 without a leading zero - the server's rule for a version (shared/types.ts ServerAppUpdateChange). */
export const APP_VERSION_PATTERN = /^(?:0|[1-9]\d{0,3})\.(?:0|[1-9]\d{0,3})\.(?:0|[1-9]\d{0,3})$/;

/** The three numbers of a version `a.b.c`, or null for anything else. */
export function parseVersion(version: unknown): [number, number, number] | null {
  if (typeof version !== 'string' || !APP_VERSION_PATTERN.test(version)) return null;
  const [a, b, c] = version.split('.').map(Number);
  return [a, b, c];
}

/** Negative when `a` is older than `b`, 0 when equal, positive when newer; null when one of them is not a version. */
export function compareVersions(a: string, b: string): number | null {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return null;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/** The address itself when it is an https address without user name or password, else null ("no link"). */
export function httpsLink(url: unknown): string | null {
  if (typeof url !== 'string' || !url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !parsed.hostname) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * The one host a store link of each phone platform may point to - the same rule as the server's
 * (server/src/hosted/app-update.ts), checked here a second time: a link on any other host counts as "no link".
 * Host names only, never an address: nothing here is contacted, the system opens the link.
 */
export const STORE_LINK_HOSTS = { android: 'play.google.com', ios: 'apps.apple.com' } as const;

/** The store link for `platform` when it is an https address on that platform's store host, else null. */
export function storeLink(platform: AppPlatform, url: unknown): string | null {
  if (platform !== 'android' && platform !== 'ios') return null;
  const link = httpsLink(url);
  if (!link) return null;
  const parsed = new URL(link);
  return parsed.hostname === STORE_LINK_HOSTS[platform] && !parsed.port ? link : null;
}

/** An update this app needs: what the screen says and where its button goes. */
export interface UpdateRequirement {
  platform: AppPlatform;
  /** This app's own version (shown on the screen). */
  installed: string;
  /** The oldest version that may still be used (the server's rule). */
  minVersion: string;
  /** The store link of the server, when it is an https address on the platform's store host (android and ios only); null otherwise. */
  storeUrl: string | null;
}

/**
 * The pure decision (see the module comment): the update this app needs, or null when it may go on.
 * `platform` null is the web version (or any build that is not one of the four apps).
 */
export function updateRequirement(platform: AppPlatform | null, appVersion: string, info: ServerInfo | null | undefined): UpdateRequirement | null {
  if (!platform || !info) return null;
  const rules = info.appUpdate;
  if (!rules || typeof rules !== 'object') return null;
  const rule = (rules as Partial<Record<AppPlatform, AppUpdateRule>>)[platform];
  if (!rule || typeof rule !== 'object') return null;
  const order = compareVersions(appVersion, rule.minVersion);
  if (order === null || order >= 0) return null;
  const storeUrl = storeLink(platform, rule.storeUrl);
  return { platform, installed: appVersion, minVersion: rule.minVersion, storeUrl };
}

/** Where the screen's button goes. */
export type UpdateTarget =
  | { kind: 'googlePlay'; url: string }
  | { kind: 'appStore'; url: string }
  | { kind: 'downloads'; url: string }
  /** iPhone without a store link: only the sentence "Update the app in the App Store." */
  | { kind: 'none' };

/** The button of the screen for `requirement`, in `locale` (the Downloads page of the site in the app's language). */
export function updateTarget(requirement: UpdateRequirement, locale?: Locale): UpdateTarget {
  switch (requirement.platform) {
    case 'android':
      return requirement.storeUrl ? { kind: 'googlePlay', url: requirement.storeUrl } : { kind: 'downloads', url: downloadsPageUrl(locale) };
    case 'ios':
      return requirement.storeUrl ? { kind: 'appStore', url: requirement.storeUrl } : { kind: 'none' };
    default:
      return { kind: 'downloads', url: downloadsPageUrl(locale) };
  }
}

/**
 * The app this UI runs in: 'windows' / 'mac' in the desktop shell (Tauri; the Mac by `isMacApp`), 'android' /
 * 'ios' in the installed phone app (the mobile build in the Capacitor WebView), null in a browser - the web
 * version, and the mobile build opened in a plain browser during development. The phone branch sits behind the
 * build-time `__MOBILE__` (false in the desktop / browser build), so the Capacitor lookup of `platformName`
 * never reaches the desktop bundle (mobile/test/desktop-dist-clean.test.ts).
 */
export function currentAppPlatform(): AppPlatform | null {
  if (isTauri()) return isMacApp() ? 'mac' : 'windows';
  if (typeof __MOBILE__ !== 'undefined' && __MOBILE__ && isNativeApp()) {
    const name = platformName();
    if (name === 'android' || name === 'ios') return name;
  }
  return null;
}
