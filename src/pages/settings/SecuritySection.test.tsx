/**
 * Phone (Android / iPhone app) branch of the Security card: "Lock when I leave the app", the privacy
 * screen - worded per platform, since iOS covers the app switcher but lets no app block screenshots -
 * and, when the build offers it, biometric unlock, which needs the account password to turn on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { LOCALE_CODES } from '@shared/i18n';
import { getArea } from '@shared/i18n/messages';
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

/** The installed app on a phone of this platform: Capacitor's global, as the native bridge sets it. */
function installedOn(platform: 'android' | 'ios'): void {
  vi.stubGlobal('Capacitor', { isNativePlatform: () => true, getPlatform: () => platform });
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

  it('iPhone app (Capacitor, platform ios): the privacy screen promises the app-switcher cover only - iOS cannot block screenshots', async () => {
    installedOn('ios');
    const security = fakeSecurity();
    setPhoneSecurity(security);
    const { user } = renderWithProviders(<SecuritySection />, { auth: 'authenticated', locale: 'en' });
    const privacy = screen.getByRole('checkbox', { name: 'Hide content in the app switcher' });
    expect(privacy).toHaveAccessibleDescription('The app shows a blank screen in the app switcher. On iPhone, apps cannot block screenshots.');
    expect(privacy).toBeChecked();
    // The Android wording ("... and block screenshots", "screenshots of it are blocked") is not on the card.
    expect(screen.queryByRole('checkbox', { name: tr('mobile.security.privacyScreen') })).not.toBeInTheDocument();
    expect(screen.queryByText(tr('mobile.security.privacyScreenHint'))).not.toBeInTheDocument();
    // Only the words differ: the same device setting is behind the box.
    await user.click(privacy);
    await waitFor(() => expect(security.setPrivacyScreen).toHaveBeenCalledWith(false));
  });

  it('iPhone app in Hebrew: the owner’s wording of the label and the hint', () => {
    installedOn('ios');
    setPhoneSecurity(fakeSecurity());
    // The tests' default language (src/test/render.tsx): Hebrew.
    renderWithProviders(<SecuritySection />, { auth: 'authenticated' });
    const privacy = screen.getByRole('checkbox', { name: 'הסתרת התוכן במחליף האפליקציות' });
    expect(privacy).toHaveAccessibleDescription('האפליקציה מוצגת כמסך ריק במחליף האפליקציות. באייפון אפליקציות לא יכולות לחסום צילומי מסך.');
  });

  it('Android app (Capacitor, platform android): keeps "Hide content in recent apps and block screenshots" - FLAG_SECURE does block them', () => {
    installedOn('android');
    setPhoneSecurity(fakeSecurity());
    renderWithProviders(<SecuritySection />, { auth: 'authenticated', locale: 'en' });
    const privacy = screen.getByRole('checkbox', { name: 'Hide content in recent apps and block screenshots' });
    expect(privacy).toHaveAccessibleDescription('The app shows a blank card in the recent-apps screen and screenshots of it are blocked.');
    expect(screen.queryByRole('checkbox', { name: tr('mobile.security.privacyScreenIos') })).not.toBeInTheDocument();
    expect(screen.queryByText(tr('mobile.security.privacyScreenIosHint'))).not.toBeInTheDocument();
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

describe('the iPhone wording of the privacy screen in the catalogues', () => {
  it('all 20 languages have their own iPhone label and hint: never the Android text, and translated outside English', () => {
    expect(LOCALE_CODES).toHaveLength(20);
    const en = getArea('en', 'mobile');
    const pairs = [
      ['mobile.security.privacyScreenIos', 'mobile.security.privacyScreen'],
      ['mobile.security.privacyScreenIosHint', 'mobile.security.privacyScreenHint'],
    ] as const;
    // Collect every problem first so one run reports all languages.
    const problems: string[] = [];
    for (const code of LOCALE_CODES) {
      const mobile = getArea(code, 'mobile');
      for (const [ios, android] of pairs) {
        const text = mobile[ios];
        if (typeof text !== 'string' || text.trim() === '') problems.push(`${code}: ${ios} is missing`);
        else if (text === mobile[android]) problems.push(`${code}: ${ios} repeats the Android text`);
        else if (code !== 'en' && text === en[ios]) problems.push(`${code}: ${ios} is not translated`);
      }
    }
    expect(problems).toEqual([]);
  });
});
