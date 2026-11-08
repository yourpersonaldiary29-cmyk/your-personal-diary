/**
 * src/utils/platform.ts in the Android build (`__MOBILE__` is true under mobile/vitest.config.ts).
 * The Capacitor runtime is only ever read through its global, so a fake global is enough.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { isNativeApp, platformName } from '@/utils/platform';

type Globals = { Capacitor?: unknown; __TAURI_INTERNALS__?: unknown };

function setCapacitor(value: unknown): void {
  (globalThis as Globals).Capacitor = value;
}

describe('platform detection in the mobile build', () => {
  afterEach(() => {
    delete (globalThis as Globals).Capacitor;
    delete (window as unknown as Globals).__TAURI_INTERNALS__;
  });

  it('is built with __MOBILE__ = true', () => {
    expect(__MOBILE__).toBe(true);
  });

  it('is a plain browser when the mobile build runs outside the Capacitor WebView (mobile:dev)', () => {
    expect(isNativeApp()).toBe(false);
    expect(platformName()).toBe('browser');
  });

  it('is the native Android app inside the Capacitor WebView', () => {
    setCapacitor({ isNativePlatform: () => true, getPlatform: () => 'android' });
    expect(isNativeApp()).toBe(true);
    expect(platformName()).toBe('android');
  });

  it('reports iOS too', () => {
    setCapacitor({ isNativePlatform: () => true, getPlatform: () => 'ios' });
    expect(platformName()).toBe('ios');
  });

  it('is a browser when Capacitor runs as a web app, or reports an unknown platform', () => {
    setCapacitor({ isNativePlatform: () => false, getPlatform: () => 'web' });
    expect(isNativeApp()).toBe(false);
    expect(platformName()).toBe('browser');

    setCapacitor({ isNativePlatform: () => true, getPlatform: () => 'web' });
    expect(platformName()).toBe('browser');

    setCapacitor({});
    expect(isNativeApp()).toBe(false);
  });

  it('the desktop shell wins over everything else', () => {
    (window as unknown as Globals).__TAURI_INTERNALS__ = {};
    setCapacitor({ isNativePlatform: () => true, getPlatform: () => 'android' });
    expect(platformName()).toBe('desktop');
  });
});
