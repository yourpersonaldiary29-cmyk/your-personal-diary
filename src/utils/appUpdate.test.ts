/**
 * The pure decision of a required update (src/utils/appUpdate.ts, app version 1.1.0): platform x the app's own
 * version x the server info of this run -> the update this app needs, or nothing; what its button opens; and
 * which app this UI runs in. Fictional addresses only; the store links are put together from parts (the
 * network audit, scripts/check-no-network.mjs, refuses a literal external address in src/).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { APP_PLATFORMS, type AppUpdateInfo, type ServerInfo } from '@shared/types';
import { DEFAULT_SERVER_URL } from '@/config/server-default';
import {
  compareVersions,
  currentAppPlatform,
  httpsLink,
  otherUpdateTarget,
  parseVersion,
  storeLink,
  updateRequirement,
  updateTarget,
} from './appUpdate';

const PLAY = ['https:', '', 'play.google.com', 'store', 'apps', 'details?id=app.example'].join('/');
const APPLE = ['https:', '', 'apps.apple.com', 'app', 'id000000000'].join('/');

/** The hosted server's self-description with the given rules (or none). */
function info(appUpdate?: AppUpdateInfo): ServerInfo {
  return {
    version: '1.1.0',
    port: 8080,
    lanEnabled: false,
    lanUrls: [],
    dataDir: '',
    isLocalRequest: false,
    startedAt: '2026-11-25T08:00:00.000Z',
    mode: 'hosted',
    ...(appUpdate ? { appUpdate } : {}),
  };
}

describe('versions', () => {
  it('reads a.b.c only (each part 0..9999 without a leading zero) and compares part by part', () => {
    expect(parseVersion('1.1.0')).toEqual([1, 1, 0]);
    expect(parseVersion('9999.0.10')).toEqual([9999, 0, 10]);
    for (const bad of ['', '1.1', '1.1.0.0', '01.1.0', '1.01.0', 'v1.1.0', '1.1.0-beta', ' 1.1.0', '1.1.0 ', '10000.0.0', null, 110, undefined]) {
      expect(parseVersion(bad), String(bad)).toBeNull();
    }
    expect(compareVersions('1.0.1', '1.1.0')).toBeLessThan(0);
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('2.0.0', '1.99.99')).toBeGreaterThan(0);
    expect(compareVersions('1.1.0', '1.1.0')).toBe(0);
    expect(compareVersions('1.1', '1.1.0')).toBeNull();
  });

  it('a link counts only when it is an https address without credentials', () => {
    expect(httpsLink(PLAY)).toBe(PLAY);
    expect(httpsLink(APPLE)).toBe(APPLE);
    for (const bad of [
      PLAY.replace('https:', 'http:'),
      'javascript:alert(1)',
      'market://details?id=app.example',
      'itms-apps://apps.apple.com/app/id0',
      PLAY.replace('https://', 'https://user:pw@'),
      'not a url',
      '',
      null,
      42,
    ]) {
      expect(httpsLink(bad), String(bad)).toBeNull();
    }
  });
});

describe('updateRequirement - the pure decision', () => {
  it('an app older than the rule of ITS platform must update; equal or newer may go on', () => {
    const rules: AppUpdateInfo = { android: { minVersion: '1.2.0' } };
    expect(updateRequirement('android', '1.1.0', info(rules))).toEqual({ platform: 'android', installed: '1.1.0', minVersion: '1.2.0', storeUrl: null });
    expect(updateRequirement('android', '1.2.0', info(rules))).toBeNull();
    expect(updateRequirement('android', '1.3.0', info(rules))).toBeNull();
    // Only Android has a rule: the iPhone, Windows and Mac apps are not asked.
    expect(updateRequirement('ios', '1.1.0', info(rules))).toBeNull();
    expect(updateRequirement('windows', '1.1.0', info(rules))).toBeNull();
    expect(updateRequirement('mac', '1.1.0', info(rules))).toBeNull();
  });

  it('every platform reads its own rule', () => {
    const rules: AppUpdateInfo = Object.fromEntries(APP_PLATFORMS.map((p) => [p, { minVersion: '2.0.0' }]));
    for (const platform of APP_PLATFORMS) expect(updateRequirement(platform, '1.1.0', info(rules))?.platform).toBe(platform);
  });

  it('the web version is never asked to update, whatever the server says', () => {
    const rules: AppUpdateInfo = Object.fromEntries(APP_PLATFORMS.map((p) => [p, { minVersion: '9.0.0' }]));
    expect(updateRequirement(null, '1.1.0', info(rules))).toBeNull();
  });

  it('without the server info of this run (no connection, a start from the cache) nothing is blocked', () => {
    expect(updateRequirement('android', '1.1.0', null)).toBeNull();
    expect(updateRequirement('android', '1.1.0', undefined)).toBeNull();
    // The offline start's snapshot keeps only mode, publicUrl, offlineSync, guestTour, passwordResetAvailable.
    expect(updateRequirement('windows', '1.1.0', { ...info(), offlineSync: 1 })).toBeNull();
  });

  it('no rule, a broken rule or an unreadable version of the app blocks nothing', () => {
    expect(updateRequirement('android', '1.1.0', info())).toBeNull();
    expect(updateRequirement('android', '1.1.0', info({}))).toBeNull();
    expect(updateRequirement('android', '1.1.0', { ...info(), appUpdate: { android: { minVersion: 'soon' } } })).toBeNull();
    expect(updateRequirement('android', '1.1.0', { ...info(), appUpdate: { android: null } } as unknown as ServerInfo)).toBeNull();
    expect(updateRequirement('android', '1.1.0', { ...info(), appUpdate: 'on' } as unknown as ServerInfo)).toBeNull();
    expect(updateRequirement('android', 'dev', info({ android: { minVersion: '1.2.0' } }))).toBeNull();
  });

  it('the store link is kept for the phones only, and only when it is an https address', () => {
    expect(updateRequirement('android', '1.1.0', info({ android: { minVersion: '1.2.0', storeUrl: PLAY } }))?.storeUrl).toBe(PLAY);
    expect(updateRequirement('ios', '1.1.0', info({ ios: { minVersion: '1.2.0', storeUrl: APPLE } }))?.storeUrl).toBe(APPLE);
    expect(updateRequirement('android', '1.1.0', info({ android: { minVersion: '1.2.0', storeUrl: 'javascript:alert(1)' } }))?.storeUrl).toBeNull();
    expect(updateRequirement('ios', '1.1.0', info({ ios: { minVersion: '1.2.0', storeUrl: APPLE.replace('https:', 'http:') } }))?.storeUrl).toBeNull();
    // Windows and Mac open the Downloads page: a link the server sent for them is not used.
    expect(updateRequirement('windows', '1.1.0', info({ windows: { minVersion: '1.2.0', storeUrl: PLAY } }))?.storeUrl).toBeNull();
    expect(updateRequirement('mac', '1.1.0', info({ mac: { minVersion: '1.2.0', storeUrl: APPLE } }))?.storeUrl).toBeNull();
  });

  it('the store link must be on the store host of its platform (a second check after the server): any other https host is "no link"', () => {
    const other = ['https:', '', 'example.com', 'store', 'apps', 'details?id=app.example'].join('/');
    const lookalike = PLAY.replace('play.google.com', 'play.google.com.example.com');
    const withPort = PLAY.replace('play.google.com', 'play.google.com:8443');
    for (const bad of [other, lookalike, withPort, APPLE]) {
      expect(updateRequirement('android', '1.1.0', info({ android: { minVersion: '1.2.0', storeUrl: bad } }))?.storeUrl, bad).toBeNull();
    }
    for (const bad of [other, PLAY, APPLE.replace('apps.apple.com', 'apps.apple.com.example.com')]) {
      expect(updateRequirement('ios', '1.1.0', info({ ios: { minVersion: '1.2.0', storeUrl: bad } }))?.storeUrl, bad).toBeNull();
    }
    expect(storeLink('android', PLAY)).toBe(PLAY);
    expect(storeLink('ios', APPLE)).toBe(APPLE);
    expect(storeLink('windows', PLAY)).toBeNull();
    // Without a usable link the screen falls back: the Downloads page on Android, the sentence on the iPhone.
    const android = updateRequirement('android', '1.1.0', info({ android: { minVersion: '1.2.0', storeUrl: other } }));
    expect(android && updateTarget(android, 'en').kind).toBe('downloads');
    const ios = updateRequirement('ios', '1.1.0', info({ ios: { minVersion: '1.2.0', storeUrl: other } }));
    expect(ios && updateTarget(ios, 'en').kind).toBe('none');
  });
});

describe('updateTarget - the button of the screen', () => {
  const need = (platform: 'android' | 'ios' | 'windows' | 'mac', storeUrl: string | null = null) => ({ platform, installed: '1.1.0', minVersion: '1.2.0', storeUrl });

  it('Android: Google Play with a store link, else the Downloads page in the app\'s language', () => {
    expect(updateTarget(need('android', PLAY), 'en')).toEqual({ kind: 'googlePlay', url: PLAY });
    expect(updateTarget(need('android'), 'en')).toEqual({ kind: 'downloads', url: `${DEFAULT_SERVER_URL}/about/downloads/` });
    expect(updateTarget(need('android'), 'he')).toEqual({ kind: 'downloads', url: `${DEFAULT_SERVER_URL}/about/he/downloads/` });
  });

  it('iPhone: the App Store with a store link, else no button (only the sentence)', () => {
    expect(updateTarget(need('ios', APPLE), 'en')).toEqual({ kind: 'appStore', url: APPLE });
    expect(updateTarget(need('ios'), 'en')).toEqual({ kind: 'none' });
  });

  it('Windows and Mac: the Downloads page of the site in the app\'s language', () => {
    expect(updateTarget(need('windows'), 'de')).toEqual({ kind: 'downloads', url: `${DEFAULT_SERVER_URL}/about/de/downloads/` });
    expect(updateTarget(need('mac'), 'en')).toEqual({ kind: 'downloads', url: `${DEFAULT_SERVER_URL}/about/downloads/` });
  });
});

describe('otherUpdateTarget - the second way of the screen (Android has two sources of the same app)', () => {
  const need = (platform: 'android' | 'ios' | 'windows' | 'mac', storeUrl: string | null = null) => ({ platform, installed: '1.1.0', minVersion: '1.2.0', storeUrl });

  it('Android with a store link: Google Play first, and the Downloads page of the site in the app\'s language as the other way', () => {
    expect(updateTarget(need('android', PLAY), 'he')).toEqual({ kind: 'googlePlay', url: PLAY });
    expect(otherUpdateTarget(need('android', PLAY), 'he')).toEqual({ kind: 'downloads', url: `${DEFAULT_SERVER_URL}/about/he/downloads/` });
    expect(otherUpdateTarget(need('android', PLAY), 'en')).toEqual({ kind: 'downloads', url: `${DEFAULT_SERVER_URL}/about/downloads/` });
  });

  it('Android without a store link: only the Downloads page, no other way', () => {
    expect(updateTarget(need('android'), 'en').kind).toBe('downloads');
    expect(otherUpdateTarget(need('android'), 'en')).toBeNull();
  });

  it('iPhone, Windows and Mac never have another way, with or without a link', () => {
    for (const platform of ['ios', 'windows', 'mac'] as const) {
      expect(otherUpdateTarget(need(platform), 'en'), platform).toBeNull();
      expect(otherUpdateTarget(need(platform, platform === 'ios' ? APPLE : PLAY), 'en'), `${platform} with a link`).toBeNull();
    }
  });
});

describe('currentAppPlatform - which app this UI runs in', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  it('a browser is the web version: null', () => {
    expect(currentAppPlatform()).toBeNull();
  });

  it('the desktop shell: windows, or mac with the Mac user agent', () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    vi.stubGlobal('navigator', { ...navigator, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/130.0' });
    expect(currentAppPlatform()).toBe('windows');
    vi.stubGlobal('navigator', { ...navigator, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15' });
    expect(currentAppPlatform()).toBe('mac');
  });

  it('the installed phone app (the mobile build in Capacitor): android or ios; the mobile build in a plain browser is the web', () => {
    vi.stubGlobal('__MOBILE__', true);
    vi.stubGlobal('Capacitor', { isNativePlatform: () => true, getPlatform: () => 'android' });
    expect(currentAppPlatform()).toBe('android');
    vi.stubGlobal('Capacitor', { isNativePlatform: () => true, getPlatform: () => 'ios' });
    expect(currentAppPlatform()).toBe('ios');
    vi.stubGlobal('Capacitor', { isNativePlatform: () => false, getPlatform: () => 'web' });
    expect(currentAppPlatform()).toBeNull();
  });

  it('the desktop / browser build (__MOBILE__ false) never asks Capacitor', () => {
    vi.stubGlobal('__MOBILE__', false);
    vi.stubGlobal('Capacitor', { isNativePlatform: () => true, getPlatform: () => 'android' });
    expect(currentAppPlatform()).toBeNull();
  });
});
