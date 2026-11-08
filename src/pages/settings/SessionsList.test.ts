/**
 * Device labels of the "Connected devices" list: the names the app generates are stored in the
 * language of the moment the session was created, and shown in the current language.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { t } from '@shared/i18n';
import type { SessionInfo } from '@shared/types';
import { getCurrentLocale, setCurrentLocale } from '@/i18n/runtime';
import { deviceLabel } from './SessionsList';
import { ST } from './texts';

const session = (deviceName: string): SessionInfo => ({
  id: 's1',
  deviceName,
  createdAt: '2026-09-30T08:00:00.000Z',
  lastSeenAt: '2026-09-30T08:00:00.000Z',
  rememberMe: false,
  current: false,
});

const initial = getCurrentLocale();
afterEach(() => setCurrentLocale(initial));

describe('deviceLabel', () => {
  it('shows a generated name in the current language, whatever language it was saved in', () => {
    setCurrentLocale('he');
    expect(deviceLabel(session(t('en', 'shell.device.browser')))).toBe(t('he', 'shell.device.browser'));
    expect(deviceLabel(session(t('fr', 'shell.device.phone')))).toBe(t('he', 'shell.device.phone'));
    expect(deviceLabel(session(t('en', 'server.auth.defaultDeviceName')))).toBe(t('he', 'server.auth.defaultDeviceName'));
    setCurrentLocale('en');
    expect(deviceLabel(session(t('he', 'shell.device.computer')))).toBe('Computer');
  });

  it('keeps any other name as it is, and names a missing one "unknown device"', () => {
    setCurrentLocale('en');
    expect(deviceLabel(session('Noa laptop'))).toBe('Noa laptop');
    expect(deviceLabel(session('  '))).toBe(ST.unknownDevice);
  });
});
