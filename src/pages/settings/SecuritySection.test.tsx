/**
 * Phone (Android app) branch of the Security card: "Lock when I leave the app", the privacy screen
 * and - when the build offers it - biometric unlock, which needs the account password to turn on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { T } from '@/constants/texts';
import { setPhoneSecurity, type PhoneBiometric, type PhoneSecurity, type PhoneSecurityPrefs } from '@/context/LockContext';
import { tr } from '@/i18n/runtime';
import { renderWithProviders } from '@/test/render';
import { SecuritySection } from './SecuritySection';
import { ST } from './texts';

function fakeSecurity(biometric: PhoneBiometric | null = null) {
  const listeners = new Set<(prefs: PhoneSecurityPrefs) => void>();
  let prefs: PhoneSecurityPrefs = { lockOnLeave: true, privacyScreen: true, biometricUnlock: false };
  const notify = () => {
    for (const l of listeners) l(prefs);
  };
  const security: PhoneSecurity & { prefs: () => PhoneSecurityPrefs } = {
    prefs: () => prefs,
    get: () => prefs,
    setLockOnLeave: vi.fn(async (value: boolean) => {
      prefs = { ...prefs, lockOnLeave: value };
      notify();
    }),
    setPrivacyScreen: vi.fn(async (value: boolean) => {
      prefs = { ...prefs, privacyScreen: value };
      notify();
    }),
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    biometric,
  };
  return security;
}

describe('phone: Security card', () => {
  beforeEach(() => vi.stubGlobal('__MOBILE__', true));
  afterEach(() => {
    setPhoneSecurity(null);
    vi.unstubAllGlobals();
  });

  it('shows the two device settings on (their defaults) and saves a change through the bridge', async () => {
    const security = fakeSecurity();
    setPhoneSecurity(security);
    const { user } = renderWithProviders(<SecuritySection />, { auth: 'authenticated' });
    const lockOnLeave = screen.getByRole('checkbox', { name: tr('mobile.security.lockOnLeave') });
    const privacy = screen.getByRole('checkbox', { name: tr('mobile.security.privacyScreen') });
    expect(lockOnLeave).toBeChecked();
    expect(privacy).toBeChecked();
    expect(screen.queryByRole('checkbox', { name: tr('mobile.security.biometric') })).not.toBeInTheDocument();
    // The desktop part of the card is still there.
    expect(screen.getByRole('button', { name: ST.lockNow })).toBeInTheDocument();

    await user.click(lockOnLeave);
    await waitFor(() => expect(security.setLockOnLeave).toHaveBeenCalledWith(false));
    await waitFor(() => expect(lockOnLeave).not.toBeChecked());
    await user.click(privacy);
    await waitFor(() => expect(security.setPrivacyScreen).toHaveBeenCalledWith(false));
  });

  it('biometric unlock: turning it on asks for the password once and enables through the bridge', async () => {
    const biometric: PhoneBiometric = {
      isAvailable: vi.fn(async () => true),
      enable: vi.fn(async () => true),
      disable: vi.fn(async () => undefined),
      unlock: vi.fn(async () => 'unlocked' as const),
    };
    setPhoneSecurity(fakeSecurity(biometric));
    const { user } = renderWithProviders(<SecuritySection />, { auth: 'authenticated' });
    const box = screen.getByRole('checkbox', { name: tr('mobile.security.biometric') });
    await waitFor(() => expect(box).toBeEnabled());
    await user.click(box);
    expect(biometric.enable).not.toHaveBeenCalled();
    const password = document.getElementById('settings-biometric-password') as HTMLInputElement;
    expect(password).toHaveAccessibleName(expect.stringContaining(T.password));
    await user.type(password, 'secret-pass');
    await user.click(screen.getByRole('button', { name: tr('mobile.security.biometric') }));
    await waitFor(() => expect(biometric.enable).toHaveBeenCalledWith('secret-pass'));
  });

  it('biometric unlock is disabled with an explanation when the phone has no fingerprint or face set up', async () => {
    const biometric: PhoneBiometric = { isAvailable: vi.fn(async () => false), enable: vi.fn(), disable: vi.fn(), unlock: vi.fn() };
    setPhoneSecurity(fakeSecurity(biometric));
    renderWithProviders(<SecuritySection />, { auth: 'authenticated' });
    const box = screen.getByRole('checkbox', { name: tr('mobile.security.biometric') });
    await waitFor(() => expect(screen.getByText(tr('mobile.security.biometricUnavailable'))).toBeInTheDocument());
    expect(box).toBeDisabled();
  });

  it('without the bridge nothing phone-specific is rendered', () => {
    renderWithProviders(<SecuritySection />, { auth: 'authenticated' });
    expect(screen.queryByTestId('phone-security')).not.toBeInTheDocument();
  });
});
