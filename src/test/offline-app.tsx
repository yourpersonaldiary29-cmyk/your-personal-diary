/**
 * Test helper for the automatic offline mode in the app (WP-H10c): the whole app as main.tsx mounts it -
 * the connection provider, the real auth / settings / lock providers, the announcer, the toasts, the
 * sync provider and <App /> - in a memory router, with the REAL api client. The test points the client
 * at the engine's in-memory diary server (src/offline/test-utils: `wireDevice` / `bootDevice`), so the
 * offline engine, the facade and the pages run exactly as on a device; nothing touches the network.
 *
 * `LocationDisplay` (src/test/render.tsx) is rendered next to the app so a test can read the address.
 */
import type { ReactNode } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '@/App';
import { __resetSyncGateForTests } from '@/components/sync/syncGate';
import { AnnouncerProvider } from '@/context/AnnouncerContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ConnectionProvider, __resetConnectionContextForTests } from '@/context/ConnectionContext';
import { LockProvider } from '@/context/LockContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { SyncProvider } from '@/context/SyncContext';
import { ToastProvider } from '@/context/ToastContext';
import { setCurrentLocale } from '@/i18n/runtime';
import { offline } from '@/offline';
import { fakeUser } from '@/offline/test-utils/fake-sync-server';
import { resetOfflineTestEnv } from '@/offline/test-utils/env';
import { LocationDisplay } from './render';

/** A button that signs out through the real AuthProvider (the account menu's "Log out"). */
export function LogoutButton() {
  const { logout } = useAuth();
  return (
    <button type="button" data-testid="test-logout" onClick={() => void logout()}>
      test: sign out
    </button>
  );
}

/** The provider tree of main.tsx around `children` (default: <App />), in English. */
export function OfflineAppProviders({ children }: { children: ReactNode }) {
  return (
    <ConnectionProvider>
      <AuthProvider>
        <SettingsProvider>
          <AnnouncerProvider>
            <ToastProvider>
              <SyncProvider>
                <LockProvider>{children}</LockProvider>
              </SyncProvider>
            </ToastProvider>
          </AnnouncerProvider>
        </SettingsProvider>
      </AuthProvider>
    </ConnectionProvider>
  );
}

export type OfflineAppResult = RenderResult & { user: UserEvent };

/** Renders the whole app at `route` (plus `extra`, e.g. <LogoutButton />) with the real providers. */
export function renderOfflineApp(route = '/', extra?: ReactNode): OfflineAppResult {
  setCurrentLocale('en');
  const user = userEvent.setup();
  const view = render(
    <MemoryRouter initialEntries={[route]}>
      <OfflineAppProviders>
        <App />
        <LocationDisplay />
        {extra}
      </OfflineAppProviders>
    </MemoryRouter>,
  );
  return { ...view, user };
}

/**
 * Between tests: waits for an engine start the AuthProvider may still have in flight (starts are
 * serialised: a guest start queues behind it and tears the engine down), then resets the engine, the
 * api client, the seams, the connection store and the sign-out gate.
 */
export async function resetOfflineApp(): Promise<void> {
  await offline.start({ user: { ...fakeUser('u_0000000000000000'), guest: true }, rememberMe: false }).catch(() => undefined);
  await resetOfflineTestEnv();
  __resetConnectionContextForTests();
  __resetSyncGateForTests();
}
