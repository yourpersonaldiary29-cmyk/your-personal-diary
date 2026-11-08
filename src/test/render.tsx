/**
 * Test helper: renders a component inside the same providers the app uses.
 *
 * Two modes:
 *  - fake (default): AuthContext / SettingsContext / LockContext are replaced
 *    by plain values you control (`auth: 'anonymous' | 'authenticated' | 'loading'`).
 *    No API mock is needed.
 *  - real (`auth: 'real'`): the real AuthProvider / SettingsProvider /
 *    LockProvider run. The test file must mock `@/api` (see api-mock.ts).
 *
 * The announcer and toast providers are always real so tests can assert
 * announcements (`assertiveRegion()`) and toasts (`findByText`).
 *
 * UI language: importing this module pins the language to DEFAULT_TEST_LOCALE
 * ('he') before every test of the file and re-detects the default (English)
 * after it, so the existing Hebrew expectations stay valid. A test that wants
 * another language passes `{ locale: 'en' }` to renderWithProviders, calls
 * `setCurrentLocale()` itself, or uses `pinLocaleForTests()` inside its describe.
 */
import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { render, screen, type RenderOptions, type RenderResult } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { Locale } from '@shared/i18n';
import type { AppSettings, UserProfile } from '@shared/types';
import { afterEach, beforeEach, vi } from 'vitest';
import { DEFAULT_APP_SETTINGS } from '@/constants/settings';
import { AnnouncerProvider } from '@/context/AnnouncerContext';
import { AuthContext, AuthProvider, type AuthContextValue } from '@/context/AuthContext';
import { LockContext, LockProvider, type LockContextValue } from '@/context/LockContext';
import { SettingsContext, SettingsProvider, type SettingsContextValue } from '@/context/SettingsContext';
import { ToastProvider } from '@/context/ToastContext';
import { __resetLocaleForTests, setCurrentLocale } from '@/i18n/runtime';

/** Language the tests run in unless they choose another one (the original wording of the app). */
export const DEFAULT_TEST_LOCALE: Locale = 'he';

beforeEach(() => {
  setCurrentLocale(DEFAULT_TEST_LOCALE);
});
afterEach(() => {
  __resetLocaleForTests();
});

export const sampleUser: UserProfile = {
  id: 'u1',
  username: 'dana',
  email: 'dana@example.com',
  firstName: 'דנה',
  lastName: 'כהן',
  createdAt: '2026-09-01T08:00:00.000Z',
};

export type FakeAuthStatus = 'anonymous' | 'authenticated' | 'loading';

export interface ProviderOptions {
  /** Initial route (default "/"). */
  route?: string;
  /** Several history entries (paths or partial locations with state); the last one is current (overrides `route`). */
  initialEntries?: NonNullable<ComponentProps<typeof MemoryRouter>['initialEntries']>;
  /** Fake status, or 'real' to use the real providers (requires an @/api mock). */
  auth?: FakeAuthStatus | 'real';
  /** User for the fake authenticated state. */
  user?: UserProfile;
  /** Overrides for the fake auth value (e.g. `register: vi.fn()`). */
  authOverrides?: Partial<AuthContextValue>;
  /** Overrides for the fake settings. */
  settings?: Partial<AppSettings>;
  /** Overrides for the fake lock value. */
  lock?: Partial<LockContextValue>;
  /** UI language for this render (default DEFAULT_TEST_LOCALE); applied before rendering. */
  locale?: Locale;
}

/** Builds a fake AuthContext value. */
export function fakeAuth(status: FakeAuthStatus = 'anonymous', user: UserProfile = sampleUser, overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status,
    user: status === 'authenticated' ? user : null,
    sessionRemembered: false,
    sessionLocked: false,
    login: vi.fn().mockResolvedValue(user),
    register: vi.fn().mockResolvedValue(user),
    logout: vi.fn().mockResolvedValue(undefined),
    endSession: vi.fn(),
    refreshUser: vi.fn().mockResolvedValue(undefined),
    verifyPassword: vi.fn().mockResolvedValue(true),
    withPasswordCheck: vi.fn(async (fn: () => Promise<unknown>) => fn()) as AuthContextValue['withPasswordCheck'],
    notice: null,
    dismissNotice: vi.fn(),
    ...overrides,
  };
}

/** Builds a fake SettingsContext value. */
export function fakeSettings(overrides: Partial<AppSettings> = {}): SettingsContextValue {
  const settings = { ...DEFAULT_APP_SETTINGS, ...overrides };
  return {
    settings,
    loaded: true,
    error: null,
    update: vi.fn(async (patch: Partial<AppSettings>) => ({ ...settings, ...patch })),
    reload: vi.fn().mockResolvedValue(undefined),
  };
}

/** Builds a fake LockContext value. */
export function fakeLock(overrides: Partial<LockContextValue> = {}): LockContextValue {
  return { locked: false, restoredLocked: false, lock: vi.fn(), unlock: vi.fn(), ...overrides };
}

/** Renders the current pathname so tests can assert navigation. */
export function LocationDisplay() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}</p>;
}

/** The current pathname rendered by <LocationDisplay>. */
export function currentPath(): string {
  return screen.getByTestId('location').textContent ?? '';
}

/** The global assertive live region (AnnouncerProvider). */
export function assertiveRegion(): HTMLElement {
  const announcer = document.querySelector('[data-testid="announcer"]');
  const region = announcer?.querySelector<HTMLElement>('[data-testid="live-region-assertive"]');
  if (!region) throw new Error('assertive live region not found');
  return region;
}

/** The global polite live region (AnnouncerProvider). */
export function politeRegion(): HTMLElement {
  const announcer = document.querySelector('[data-testid="announcer"]');
  const region = announcer?.querySelector<HTMLElement>('[data-testid="live-region-polite"]');
  if (!region) throw new Error('polite live region not found');
  return region;
}

export function Providers({ children, options = {} }: { children: ReactNode; options?: ProviderOptions }) {
  const entries = options.initialEntries ?? [options.route ?? '/'];
  const auth = options.auth ?? 'anonymous';
  if (auth === 'real') {
    return (
      <MemoryRouter initialEntries={entries}>
        <AuthProvider>
          <SettingsProvider>
            <AnnouncerProvider>
              <ToastProvider>
                <LockProvider>{children}</LockProvider>
              </ToastProvider>
            </AnnouncerProvider>
          </SettingsProvider>
        </AuthProvider>
      </MemoryRouter>
    );
  }
  return (
    <MemoryRouter initialEntries={entries}>
      <AuthContext.Provider value={fakeAuth(auth, options.user, options.authOverrides)}>
        <SettingsContext.Provider value={fakeSettings(options.settings)}>
          <AnnouncerProvider>
            <ToastProvider>
              <LockContext.Provider value={fakeLock(options.lock)}>{children}</LockContext.Provider>
            </ToastProvider>
          </AnnouncerProvider>
        </SettingsContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

export type RenderWithProvidersResult = RenderResult & { user: UserEvent };

/** Renders `ui` inside the providers and returns a userEvent instance too. */
export function renderWithProviders(ui: ReactElement, options: ProviderOptions = {}, renderOptions: RenderOptions = {}): RenderWithProvidersResult {
  if (options.locale) setCurrentLocale(options.locale);
  const user = userEvent.setup();
  const result = render(<Providers options={options}>{ui}</Providers>, renderOptions);
  return { ...result, user };
}
