import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BINDING_KEY, canStartFromCache, clearBinding, isMacApp, isMacUserAgent, loadSnapshot, lockedAtStart, matchingBinding, readBinding, saveSnapshot, tokenTagOf, writeBinding, type SessionSnapshot } from './session';
import { MemoryStore } from './store/memory';
import { DANA, installWebCrypto, testKeys } from './test-utils/env';
import { fakeUser } from './test-utils/fake-sync-server';

beforeAll(() => installWebCrypto());
beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

describe('offline start binding (section 4.7)', () => {
  it('stores only a 16-hex tag of the token, never the token', async () => {
    await writeBinding(DANA, 'secret-token-value');
    const raw = window.localStorage.getItem(BINDING_KEY) ?? '';
    expect(raw).not.toContain('secret-token-value');
    const binding = readBinding();
    expect(binding).toEqual({ userId: DANA, tokenTag: await tokenTagOf('secret-token-value') });
    expect(binding?.tokenTag).toMatch(/^[0-9a-f]{16}$/);
  });

  it('matches only the token it was written for', async () => {
    await writeBinding(DANA, 'tok-a');
    expect(await matchingBinding('tok-a')).toMatchObject({ userId: DANA });
    expect(await matchingBinding('tok-b')).toBeNull();
    expect(await matchingBinding(null)).toBeNull();
    clearBinding();
    expect(await matchingBinding('tok-a')).toBeNull();
  });

  it('ignores a malformed binding', () => {
    window.localStorage.setItem(BINDING_KEY, '{"userId": 5}');
    expect(readBinding()).toBeNull();
    window.localStorage.setItem(BINDING_KEY, 'not json');
    expect(readBinding()).toBeNull();
  });

  it('the offline-start decision needs a token, an app and a matching binding', () => {
    const binding = { userId: DANA, tokenTag: 'abcdefabcdefabcd' };
    expect(canStartFromCache({ hasToken: true, app: true, binding })).toBe(true);
    expect(canStartFromCache({ hasToken: false, app: true, binding })).toBe(false);
    expect(canStartFromCache({ hasToken: true, app: false, binding })).toBe(false);
    expect(canStartFromCache({ hasToken: true, app: true, binding: null })).toBe(false);
  });
});

describe('session snapshot', () => {
  const snapshot: SessionSnapshot = {
    user: fakeUser(DANA),
    rememberMe: true,
    locked: false,
    lastActivityAt: 1_000_000,
    serverInfo: { mode: 'hosted', publicUrl: 'https://diary.example.org', offlineSync: 1, guestTour: true, passwordResetAvailable: false },
  };

  it('round-trips encrypted and is unreadable with other keys', async () => {
    const store = new MemoryStore();
    const keys = await testKeys(DANA, 1);
    await saveSnapshot(store, keys, snapshot);
    expect(await loadSnapshot(store, keys)).toEqual(snapshot);
    expect(await loadSnapshot(store, await testKeys(DANA, 2))).toBeNull();
    const row = await store.tx(['meta'], 'readonly', (t) => t.get('meta', 'snapshot'));
    expect(ArrayBuffer.isView(row?.value)).toBe(true);
  });

  it('locked at start: the snapshot was locked, or the auto-lock time passed', () => {
    const base = { locked: false, lastActivityAt: 1_000_000 };
    expect(lockedAtStart(base, 1_000_000 + 9 * 60_000, 10)).toBe(false);
    expect(lockedAtStart(base, 1_000_000 + 11 * 60_000, 10)).toBe(true);
    expect(lockedAtStart(base, 1_000_000 + 11 * 60_000, 0)).toBe(false);
    expect(lockedAtStart({ ...base, locked: true }, 1_000_000, 10)).toBe(true);
  });
});

// `isMacApp()` decides which vault the Tauri adapter installs (src/offline/native/tauri.ts) and is the
// test a Mac-only branch of the UI takes; it lives here because no module but src/main.tsx may import
// the adapter (src/main.test.tsx).
describe('the Mac app (APPLE-PLAN WP-M3)', () => {
  /** The user agents of the two desktop WebViews: WKWebView in the Mac app (also on Apple silicon), WebView2 on Windows. */
  const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)';
  const WINDOWS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';
  /** Safari on a Mac, and an iPad in desktop-class browsing (iPadOS 13+ reports itself as a Mac): the web UI, never the Mac app. */
  const MAC_SAFARI_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
  const IPAD_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

  /** The Tauri shell's global (src/api/client.ts `isTauri`): the Windows and the Mac app have it, a browser never. */
  const tauriShell = (on: boolean) => {
    const w = window as unknown as Record<string, unknown>;
    if (on) w.__TAURI_INTERNALS__ = {};
    else delete w.__TAURI_INTERNALS__;
  };
  /** What the page reports as `navigator.userAgent` (jsdom's own one is neither Mac nor Windows). */
  const userAgent = (ua: string) => vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(ua);

  afterEach(() => {
    tauriShell(false);
    vi.restoreAllMocks();
  });

  it('tells the Mac app from the Windows app by the WebView user agent - inside the Tauri shell only', () => {
    expect(isMacUserAgent(MAC_UA)).toBe(true);
    expect(isMacUserAgent(WINDOWS_UA)).toBe(false);
    expect(isMacUserAgent('')).toBe(false);
    // The test environment (jsdom) is neither a Mac nor the shell.
    expect(isMacUserAgent(navigator.userAgent)).toBe(false);
    expect(isMacApp()).toBe(false);
    tauriShell(true);
    userAgent(WINDOWS_UA);
    expect(isMacApp()).toBe(false);
    userAgent(MAC_UA);
    expect(isMacApp()).toBe(true);
  });

  it('a browser on a Mac, or an iPad in desktop-class browsing, is never the Mac app: the user agent alone decides nothing', () => {
    for (const ua of [MAC_UA, MAC_SAFARI_UA, IPAD_DESKTOP_UA]) {
      userAgent(ua);
      expect(isMacUserAgent(ua), ua).toBe(true); // the user agent says "Macintosh"...
      expect(isMacApp(), ua).toBe(false); // ...but without the shell's global it is the web UI
    }
  });
});
