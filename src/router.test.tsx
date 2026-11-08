import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { T } from '@/constants/texts';
import { WELCOME_TITLE, findRoute } from '@/constants/routes';
import { LANGUAGE_STORAGE_KEY } from '@/i18n/runtime';
import { Providers, renderWithProviders } from '@/test/render';
import { AppRoutes } from './router';

// Feature pages are owned by other agents; keep this test independent of them.
vi.mock('@/pages/HomePage', () => ({ default: () => <h1>דף הבית (מחובר)</h1> }));
vi.mock('@/pages/DiaryPage', () => ({ default: () => <h1>היומן שלי (מחובר)</h1> }));
vi.mock('@/pages/SettingsPage', () => ({ default: () => <h1>הגדרות (ציבורי)</h1> }));
vi.mock('@/pages/ForgotPasswordPage', () => ({ default: () => <h1>שכחתי סיסמה (ציבורי)</h1> }));
vi.mock('@/pages/ResetPasswordPage', () => ({ default: () => <h1>סיסמה חדשה (ציבורי)</h1> }));

// A desktop whose language was chosen already (installer or an earlier run). No platform has a
// first-run language screen (docs/android-tasks/HOSTED-IMPL.md item 13): the route table comes first.
beforeEach(() => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, 'he');
});

describe('AppRoutes / RequireAuth', () => {
  it('redirects an anonymous visitor from a protected page to /login with a toast and state.from', async () => {
    renderWithProviders(<AppRoutes />, { auth: 'anonymous', route: '/diary' });
    expect(await screen.findByRole('heading', { level: 1, name: T.loginTitle })).toBeInTheDocument();
    expect(await screen.findByText(T.loginRequired)).toBeInTheDocument();
    expect(screen.queryByText('היומן שלי (מחובר)')).not.toBeInTheDocument();
  });

  it('renders the protected page when authenticated', async () => {
    renderWithProviders(<AppRoutes />, { auth: 'authenticated', route: '/diary' });
    expect(await screen.findByRole('heading', { name: 'היומן שלי (מחובר)' })).toBeInTheDocument();
  });

  it('shows the session spinner while the session is being checked', () => {
    renderWithProviders(<AppRoutes />, { auth: 'loading', route: '/diary' });
    // The announcer's polite live region is role="status" too, so match the text.
    expect(screen.getByText(T.loadingSession).closest('[role="status"]')).toHaveClass('spinner');
  });

  it('"/" shows the welcome page for visitors and the home page for users', async () => {
    const first = renderWithProviders(<AppRoutes />, { auth: 'anonymous', route: '/' });
    expect(screen.getByRole('heading', { level: 1, name: T.welcomeTitle })).toBeInTheDocument();
    // MemoryRouter renders plain paths (the HashRouter in the app adds "#").
    expect(screen.getByRole('link', { name: T.register })).toHaveAttribute('href', '/register');
    expect(document.title).toContain(WELCOME_TITLE);
    first.unmount();

    renderWithProviders(<AppRoutes />, { auth: 'authenticated', route: '/' });
    expect(await screen.findByRole('heading', { name: 'דף הבית (מחובר)' })).toBeInTheDocument();
  });

  it('sends a signed-in user away from /login', async () => {
    renderWithProviders(<AppRoutes />, { auth: 'authenticated', route: '/login' });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'דף הבית (מחובר)' })).toBeInTheDocument());
  });

  it('after a logout on a protected page: goes home silently (no "login required" toast)', async () => {
    const { rerender } = renderWithProviders(<AppRoutes />, { auth: 'authenticated', route: '/diary' });
    expect(await screen.findByRole('heading', { name: 'היומן שלי (מחובר)' })).toBeInTheDocument();
    rerender(
      <Providers options={{ auth: 'anonymous', route: '/diary', authOverrides: { notice: { id: 1, message: T.loggedOut, kind: 'info' } } }}>
        <AppRoutes />
      </Providers>,
    );
    // rerender keeps the same router (still at /diary); the guard must send us home, not to /login.
    expect(await screen.findByRole('heading', { level: 1, name: T.welcomeTitle })).toBeInTheDocument();
    expect(screen.queryByText(T.loginRequired)).not.toBeInTheDocument();
  });

  it('after a session loss on a protected page: goes to /login silently, remembering the page', async () => {
    const { rerender } = renderWithProviders(<AppRoutes />, { auth: 'authenticated', route: '/diary' });
    await screen.findByRole('heading', { name: 'היומן שלי (מחובר)' });
    rerender(
      <Providers options={{ auth: 'anonymous', route: '/diary', authOverrides: { notice: { id: 2, message: T.sessionExpired, kind: 'info' } } }}>
        <AppRoutes />
      </Providers>,
    );
    expect(await screen.findByRole('heading', { level: 1, name: T.loginTitle })).toBeInTheDocument();
    expect(screen.queryByText(T.loginRequired)).not.toBeInTheDocument();
  });

  it('/settings is public and unknown paths show the 404 page', () => {
    const first = renderWithProviders(<AppRoutes />, { auth: 'anonymous', route: '/settings' });
    expect(screen.getByRole('heading', { name: 'הגדרות (ציבורי)' })).toBeInTheDocument();
    first.unmount();
    renderWithProviders(<AppRoutes />, { auth: 'anonymous', route: '/does-not-exist' });
    expect(screen.getByRole('heading', { level: 1, name: T.notFoundTitle })).toBeInTheDocument();
  });

  it('/forgot-password and /reset-password are public - also on a device that is still signed in', () => {
    for (const auth of ['anonymous', 'authenticated'] as const) {
      const forgot = renderWithProviders(<AppRoutes />, { auth, route: '/forgot-password' });
      expect(screen.getByRole('heading', { name: 'שכחתי סיסמה (ציבורי)' })).toBeInTheDocument();
      forgot.unmount();
      const reset = renderWithProviders(<AppRoutes />, { auth, route: '/reset-password?token=abc' });
      expect(screen.getByRole('heading', { name: 'סיסמה חדשה (ציבורי)' })).toBeInTheDocument();
      reset.unmount();
    }
    expect(findRoute('/forgot-password')).toMatchObject({ requiresAuth: false, title: T.forgotTitle });
    expect(findRoute('/reset-password')).toMatchObject({ requiresAuth: false, title: T.resetTitle });
  });
});
