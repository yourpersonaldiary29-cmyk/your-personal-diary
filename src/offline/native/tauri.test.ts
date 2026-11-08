import { afterEach, describe, expect, it, vi } from 'vitest';
import { getOfflinePlatform, __resetOfflinePlatformForTests } from '../seams';
import { isMacApp, isMacUserAgent } from '../session';
import {
  __setInvokeForTests,
  checkName,
  checkUserId,
  installTauriOfflinePlatform,
  tauriKeychainVault,
  tauriKeyVault,
  tauriMirror,
  tauriUserCheck,
} from './tauri';

const USER = 'u_0123456789abcdef';
const NAME = '7-11111111-1111-4111-8111-111111111111.op';
/** The user agents of the two desktop WebViews: WKWebView in the Mac app (also on Apple silicon), WebView2 on Windows. */
const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)';
const WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';
/** Safari on a Mac, and an iPad in desktop-class browsing (iPadOS 13+ reports itself as a Mac): the web UI, never the Mac app. */
const MAC_SAFARI_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const IPAD_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

/** What the page reports as `navigator.userAgent` (jsdom's own one is neither Mac nor Windows). */
function userAgent(ua: string): void {
  vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(ua);
}

/** The Tauri shell's global (src/api/client.ts `isTauri`): the Windows and the Mac app have it, a browser never. */
function tauriShell(on: boolean): void {
  const w = window as unknown as Record<string, unknown>;
  if (on) w.__TAURI_INTERNALS__ = {};
  else delete w.__TAURI_INTERNALS__;
}

describe('Tauri offline adapter (section 7, command contract)', () => {
  afterEach(() => {
    __setInvokeForTests(null);
    __resetOfflinePlatformForTests();
  });

  it('refuses user ids and file names outside the contract before any command runs', () => {
    expect(checkUserId(USER)).toBe(USER);
    expect(() => checkUserId('../../etc')).toThrow();
    expect(() => checkUserId('u_XYZ')).toThrow();
    expect(checkName(NAME)).toBe(NAME);
    expect(() => checkName('7-11111111-1111-4111-8111-111111111111.txt')).toThrow();
    expect(() => checkName('..\\x.op')).toThrow();
  });

  it('wraps and unwraps the key through offline_key_protect / offline_key_unprotect as base64', async () => {
    const invoke = vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
      if (cmd === 'offline_key_protect') return `blob(${args?.keyB64})`;
      if (cmd === 'offline_key_unprotect') return String(args?.blobB64).slice(5, -1);
      throw new Error(`unexpected ${cmd}`);
    });
    __setInvokeForTests(invoke as never);
    const key = new Uint8Array(32).fill(7);
    const blob = await tauriKeyVault.wrap(USER, key);
    expect(invoke).toHaveBeenCalledWith('offline_key_protect', { userId: USER, keyB64: btoa(String.fromCharCode(...key)) });
    const back = await tauriKeyVault.unwrap(USER, blob);
    expect([...back]).toEqual([...key]);
    expect(tauriKeyVault.kind).toBe('dpapi');
    await expect(tauriKeyVault.wrap('bad', key)).rejects.toThrow();
  });

  it('mirrors files through the five offline_mirror_* commands and filters names on list', async () => {
    const files = new Map<string, string>();
    const invoke = vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
      switch (cmd) {
        case 'offline_mirror_put':
          files.set(String(args?.name), String(args?.dataB64));
          return undefined;
        case 'offline_mirror_list':
          return [...files.keys(), 'not-a-mirror-file'];
        case 'offline_mirror_read':
          return files.get(String(args?.name));
        case 'offline_mirror_delete':
          files.delete(String(args?.name));
          return undefined;
        case 'offline_mirror_clear':
          files.clear();
          return undefined;
        default:
          throw new Error(cmd);
      }
    });
    __setInvokeForTests(invoke as never);
    await tauriMirror.put(USER, NAME, new Uint8Array([1, 2, 3]));
    expect(await tauriMirror.list(USER)).toEqual([NAME]);
    expect([...(await tauriMirror.read(USER, NAME))]).toEqual([1, 2, 3]);
    await tauriMirror.remove(USER, NAME);
    expect(await tauriMirror.list(USER)).toEqual([]);
    await tauriMirror.clear(USER);
    expect(invoke).toHaveBeenCalledWith('offline_mirror_clear', { userId: USER });
    await expect(tauriMirror.put(USER, 'x.op', new Uint8Array())).rejects.toThrow();
  });

  it('the user check maps the command answers and degrades to unavailable', async () => {
    const invoke = vi.fn(async (cmd: string) => (cmd === 'offline_user_check_available' ? true : 'cancelled'));
    __setInvokeForTests(invoke as never);
    expect(await tauriUserCheck.available()).toBe(true);
    expect(await tauriUserCheck.verify('Unlock your diary')).toBe('cancelled');
    expect(invoke).toHaveBeenCalledWith('offline_user_check', { message: 'Unlock your diary' });
    __setInvokeForTests((async () => {
      throw new Error('no such command');
    }) as never);
    expect(await tauriUserCheck.available()).toBe(false);
    expect(await tauriUserCheck.verify('x')).toBe('unavailable');
  });

  it('installs the three seams', () => {
    installTauriOfflinePlatform();
    const p = getOfflinePlatform();
    expect(p.keyVault).toBe(tauriKeyVault);
    expect(p.mirror).toBe(tauriMirror);
    expect(p.userCheck).toBe(tauriUserCheck);
  });
});

describe('Tauri offline adapter on the Mac (Keychain) and on Windows (DPAPI)', () => {
  afterEach(() => {
    __setInvokeForTests(null);
    __resetOfflinePlatformForTests();
    tauriShell(false);
    vi.restoreAllMocks();
  });

  // `isMacApp()` / `isMacUserAgent()` themselves are tested in session.test.ts; here: what the installer makes of them.
  it('a browser on a Mac, or an iPad in desktop-class browsing, is never the Mac app: the user agent alone decides nothing', () => {
    for (const ua of [MAC_UA, MAC_SAFARI_UA, IPAD_DESKTOP_UA]) {
      userAgent(ua);
      expect(isMacUserAgent(ua), ua).toBe(true); // the user agent says "Macintosh"...
      expect(isMacApp(), ua).toBe(false); // ...but without the shell's global it is the web UI
      // Were the installer ever called there, it would still not install the Keychain vault.
      installTauriOfflinePlatform();
      expect(getOfflinePlatform().keyVault, ua).toBe(tauriKeyVault);
      __resetOfflinePlatformForTests();
    }
  });

  it('the Mac vault wraps through the same commands and removes the Keychain item with offline_key_remove', async () => {
    const invoke = vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
      if (cmd === 'offline_key_protect') return `marker(${args?.keyB64})`;
      if (cmd === 'offline_key_unprotect') return String(args?.blobB64).slice(7, -1);
      if (cmd === 'offline_key_remove') return undefined;
      throw new Error(`unexpected ${cmd}`);
    });
    __setInvokeForTests(invoke as never);
    expect(tauriKeychainVault.kind).toBe('keychain');
    const key = new Uint8Array(32).fill(9);
    const blob = await tauriKeychainVault.wrap(USER, key);
    expect(invoke).toHaveBeenCalledWith('offline_key_protect', { userId: USER, keyB64: btoa(String.fromCharCode(...key)) });
    expect([...(await tauriKeychainVault.unwrap(USER, blob))]).toEqual([...key]);
    expect(invoke).toHaveBeenCalledWith('offline_key_unprotect', { userId: USER, blobB64: blob });
    await tauriKeychainVault.remove(USER);
    expect(invoke).toHaveBeenLastCalledWith('offline_key_remove', { userId: USER });
    // A user id outside the contract never reaches the shell.
    invoke.mockClear();
    await expect(tauriKeychainVault.remove('../u_0123456789abcdef')).rejects.toThrow('invalid user id');
    await expect(tauriKeychainVault.wrap('bad', key)).rejects.toThrow();
    expect(invoke).not.toHaveBeenCalled();
    // The shell's error reaches the engine (src/offline/keys.ts treats the removal as best effort).
    __setInvokeForTests((async () => {
      throw new Error('offline key: the Keychain could not remove the key');
    }) as never);
    await expect(tauriKeychainVault.remove(USER)).rejects.toThrow('Keychain');
  });

  it('the Windows vault stays as it was: kind dpapi, remove() calls nothing', async () => {
    const invoke = vi.fn(async () => undefined);
    __setInvokeForTests(invoke as never);
    expect(tauriKeyVault.kind).toBe('dpapi');
    await tauriKeyVault.remove(USER);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('the production call, installTauriOfflinePlatform() with no argument, installs the Keychain vault in the Mac app and the DPAPI vault in the Windows app, with the same mirror and user check', () => {
    tauriShell(true);
    userAgent(MAC_UA);
    installTauriOfflinePlatform();
    expect(getOfflinePlatform().keyVault).toBe(tauriKeychainVault);
    expect(getOfflinePlatform().mirror).toBe(tauriMirror);
    expect(getOfflinePlatform().userCheck).toBe(tauriUserCheck);
    userAgent(WINDOWS_UA);
    installTauriOfflinePlatform();
    expect(getOfflinePlatform().keyVault).toBe(tauriKeyVault);
    expect(getOfflinePlatform().mirror).toBe(tauriMirror);
    expect(getOfflinePlatform().userCheck).toBe(tauriUserCheck);
    // The installer reads nothing from its caller: a value passed by accident (a promise's resolved
    // value, a module namespace) cannot pick the vault.
    userAgent(MAC_UA);
    (installTauriOfflinePlatform as unknown as (x: unknown) => void)(WINDOWS_UA);
    expect(getOfflinePlatform().keyVault).toBe(tauriKeychainVault);
    expect(installTauriOfflinePlatform.length).toBe(0);
  });
});
