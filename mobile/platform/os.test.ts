/**
 * The OS switch of the phone features (docs/APPLE-PLAN.md WP-A2): iOS only when Capacitor says so,
 * Android otherwise.
 */
import { describe, expect, it } from 'vitest';
import { phoneOsOf } from './os';

describe('phoneOsOf', () => {
  it('is iOS for "ios" and Android for everything else (the Android paths are the default)', () => {
    expect(phoneOsOf('ios')).toBe('ios');
    expect(phoneOsOf('android')).toBe('android');
    expect(phoneOsOf('web')).toBe('android');
    expect(phoneOsOf('IOS')).toBe('android');
    expect(phoneOsOf('')).toBe('android');
    expect(phoneOsOf(null)).toBe('android');
    expect(phoneOsOf(undefined)).toBe('android');
  });
});
