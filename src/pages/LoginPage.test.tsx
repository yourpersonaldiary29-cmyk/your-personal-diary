import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import type { AuthResponse, LoginRequest, ServerInfo } from '@shared/types';
import * as api from '@/api';
import { ApiClientError, TOKEN_KEY, type AccountSummary } from '@/api';
import { T } from '@/constants/texts';
import { LocationDisplay, assertiveRegion, currentPath, politeRegion, renderWithProviders, sampleUser } from '@/test/render';
import { LAST_USERNAME_KEY } from '@/utils/last-username';
import { USER_LANGUAGE_KEY_PREFIX } from '@/i18n/runtime';
import { t } from '@shared/i18n';
import LoginPage, { usernameFromState } from './LoginPage';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  const mock = createApiMock(await importOriginal());
  // api-mock.ts predates GET /api/auth/accounts: add the endpoint to the mocked group.
  const auth = mock.auth as unknown as Record<string, unknown>;
  if (typeof auth.accounts !== 'function') auth.accounts = vi.fn();
  return mock;
});

/** The mocked `auth.accounts` (typed loosely because api-mock.ts does not list it). */
const accountsMock = () => (api.auth as unknown as { accounts: ReturnType<typeof vi.fn> }).accounts;

function authResponse(req: LoginRequest): AuthResponse {
  return { token: 'tok-123', user: sampleUser, expiresAt: '2099-01-01T00:00:00.000Z', rememberMe: !!req.rememberMe };
}

function serverInfo(isLocalRequest: boolean): ServerInfo {
  return {
    version: '0.1.0',
    port: 47321,
    lanEnabled: false,
    lanUrls: [],
    dataDir: isLocalRequest ? 'C:\\data' : '',
    isLocalRequest,
    startedAt: '2026-09-01T08:00:00.000Z',
  };
}

const DANA: AccountSummary = { username: 'dana', firstName: 'דנה', lastName: 'כהן', createdAt: '2026-09-01T08:00:00.000Z' };
const RON: AccountSummary = { username: 'ron', firstName: 'רון', lastName: 'לוי', createdAt: '2026-09-02T08:00:00.000Z' };

/** Makes the page believe it runs on the user's computer with `accounts` registered. */
function localAccounts(accounts: AccountSummary[]) {
  vi.mocked(api.server.info).mockResolvedValue(serverInfo(true));
  accountsMock().mockResolvedValue({ accounts });
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<LocationDisplay />} />
    </Routes>,
    { auth: 'real', route: '/login' },
  );
}

const rememberCheckbox = () => screen.getByRole('checkbox', { name: new RegExp(T.rememberMe) });
/** The identifier field is labelled "שם משתמש או דוא״ל". */
const usernameInput = () => screen.getByLabelText(new RegExp(`^${T.usernameOrEmail}`));
const passwordInput = () => screen.getByLabelText(/^סיסמה/);

describe('LoginPage (real AuthProvider, mocked api)', () => {
  beforeEach(() => {
    vi.mocked(api.auth.login).mockReset();
    vi.mocked(api.auth.login).mockImplementation(async (req: LoginRequest) => authResponse(req));
    // Default: not on the computer itself (a phone / browser), so no account list.
    vi.mocked(api.server.info).mockReset();
    vi.mocked(api.server.info).mockResolvedValue(serverInfo(false));
    accountsMock().mockReset();
    accountsMock().mockResolvedValue({ accounts: [] });
  });

  it('"זכור אותי" is checked by default and stores the token in localStorage', async () => {
    const { user } = renderPage();
    expect(rememberCheckbox()).toBeChecked();
    expect(rememberCheckbox()).toHaveAccessibleDescription(T.rememberMeHint);
    await user.type(usernameInput(), 'dana');
    await user.type(passwordInput(), 'secret123');
    await user.click(screen.getByRole('button', { name: T.login }));

    await waitFor(() => expect(api.auth.login).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.auth.login).mock.calls[0][0]).toMatchObject({ username: 'dana', password: 'secret123', rememberMe: true });
    await waitFor(() => expect(window.localStorage.getItem(TOKEN_KEY)).toBe('tok-123'));
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(await screen.findByText(T.welcomeBack('דנה'))).toBeInTheDocument();
    await waitFor(() => expect(currentPath()).toBe('/'));
  });

  it('greets in the language the account used on this device (the UI switches to it), not in the login screen\'s', async () => {
    const key = `${USER_LANGUAGE_KEY_PREFIX}${sampleUser.id}`;
    window.localStorage.setItem(key, 'en');
    try {
      const { user } = renderPage();
      await user.type(usernameInput(), 'dana');
      await user.type(passwordInput(), 'secret123');
      await user.click(screen.getByRole('button', { name: T.login }));
      expect(await screen.findByText(t('en', 'auth.welcomeBack', { firstName: sampleUser.firstName }))).toBeInTheDocument();
      expect(screen.queryByText(t('he', 'auth.welcomeBack', { firstName: sampleUser.firstName }))).not.toBeInTheDocument();
    } finally {
      window.localStorage.removeItem(key);
    }
  });

  it('stores the token in sessionStorage after unchecking "זכור אותי"', async () => {
    const { user } = renderPage();
    await user.type(usernameInput(), 'dana');
    await user.type(passwordInput(), 'secret123');
    await user.click(rememberCheckbox());
    expect(rememberCheckbox()).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: T.login }));

    await waitFor(() => expect(window.sessionStorage.getItem(TOKEN_KEY)).toBe('tok-123'));
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(vi.mocked(api.auth.login).mock.calls[0][0]).toMatchObject({ rememberMe: false });
  });

  it('remembers the username (as the server spells it) after a successful login', async () => {
    vi.mocked(api.auth.login).mockImplementation(async (req) => ({ ...authResponse(req), user: { ...sampleUser, username: 'Dana' } }));
    const { user } = renderPage();
    expect(window.localStorage.getItem(LAST_USERNAME_KEY)).toBeNull();
    await user.type(usernameInput(), 'dana');
    await user.type(passwordInput(), 'secret123');
    await user.click(screen.getByRole('button', { name: T.login }));
    await waitFor(() => expect(window.localStorage.getItem(LAST_USERNAME_KEY)).toBe('Dana'));
  });

  it('does not remember the username when the login fails', async () => {
    vi.mocked(api.auth.login).mockRejectedValue(new ApiClientError(401, { code: 'WRONG_PASSWORD', message: 'שם המשתמש או הסיסמה שגויים' }));
    const { user } = renderPage();
    await user.type(usernameInput(), 'dana');
    await user.type(passwordInput(), 'wrong');
    await user.click(screen.getByRole('button', { name: T.login }));
    await waitFor(() => expect(document.querySelector('.alert--error:not([role])')).toBeInTheDocument());
    expect(window.localStorage.getItem(LAST_USERNAME_KEY)).toBeNull();
  });

  it('prefills the username remembered from the last login', () => {
    window.localStorage.setItem(LAST_USERNAME_KEY, 'dana');
    renderPage();
    expect(usernameInput()).toHaveValue('dana');
    expect(passwordInput()).toHaveValue('');
  });

  it('after a password reset starts with the account that was reset, not the one that signed in last', async () => {
    window.localStorage.setItem(LAST_USERNAME_KEY, 'dana');
    localAccounts([DANA, RON]);
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
      </Routes>,
      { auth: 'real', initialEntries: [{ pathname: '/login', state: { username: 'ron' } }] },
    );
    expect(usernameInput()).toHaveValue('ron');
    // The account list arriving later does not replace it with the most recent account.
    await waitFor(() => expect(accountsMock()).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(usernameInput()).toHaveValue('ron');
    expect(usernameFromState({ username: ' ron ' })).toBe('ron');
    expect(usernameFromState(null)).toBe('');
  });

  it('shows the server message in an alert for a wrong password and keeps the visitor on the page', async () => {
    vi.mocked(api.auth.login).mockRejectedValue(new ApiClientError(401, { code: 'WRONG_PASSWORD', message: 'שם המשתמש או הסיסמה שגויים' }));
    const { user } = renderPage();
    await user.type(usernameInput(), 'dana');
    await user.type(passwordInput(), 'wrong');
    await user.click(screen.getByRole('button', { name: T.login }));

    // The Alert box itself (no live role: the announcer speaks the message - once).
    await waitFor(() => expect(document.querySelector('.alert--error:not([role])')).toHaveTextContent('שם המשתמש או הסיסמה שגויים'));
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent('שם המשתמש או הסיסמה שגויים'));
    expect(passwordInput()).toHaveFocus();
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: T.loginTitle })).toBeInTheDocument();
  });

  it('validates required fields before calling the server', async () => {
    const { user } = renderPage();
    await user.click(screen.getByRole('button', { name: T.login }));
    expect(api.auth.login).not.toHaveBeenCalled();
    expect(usernameInput()).toHaveAttribute('aria-invalid', 'true');
    expect(usernameInput()).toHaveAccessibleDescription(T.fieldRequired(T.usernameOrEmail));
    expect(usernameInput()).toHaveFocus();
    expect(passwordInput()).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(T.fixErrors(2)));
  });

  it('labels the first field "שם משתמש או דוא״ל" and sends an e-mail address as the login identifier', async () => {
    const { user } = renderPage();
    const field = usernameInput() as HTMLInputElement;
    expect(field).toBe(screen.getByRole('textbox', { name: new RegExp(`^${T.usernameOrEmail}`) }));
    expect(field.labels?.[0]).toHaveTextContent(`${T.usernameOrEmail}(${T.required})`);
    expect(field).toHaveAttribute('autocomplete', 'username');
    expect(field).toHaveAttribute('dir', 'ltr');
    // The old "שם משתמש" label alone is gone.
    expect(screen.queryByLabelText(new RegExp(`^${T.username}\\(`))).not.toBeInTheDocument();

    await user.type(field, ' Dana@Example.com ');
    await user.type(passwordInput(), 'secret123');
    await user.click(screen.getByRole('button', { name: T.login }));

    await waitFor(() => expect(api.auth.login).toHaveBeenCalledTimes(1));
    // Sent as LoginRequest.username (trimmed; the server matches it case-insensitively).
    expect(vi.mocked(api.auth.login).mock.calls[0][0]).toMatchObject({ username: 'Dana@Example.com', password: 'secret123', rememberMe: true });
    // Remembered as the username the server reports, not the e-mail that was typed.
    await waitFor(() => expect(window.localStorage.getItem(LAST_USERNAME_KEY)).toBe('dana'));
    expect(await screen.findByText(T.welcomeBack('דנה'))).toBeInTheDocument();
  });

  it('shows "Forgot password?" right before the Log in button (document and Tab order) linking to /forgot-password', async () => {
    const { user } = renderPage();
    const link = screen.getByRole('link', { name: T.forgotPasswordLink });
    expect(T.forgotPasswordLink).toBe('שכחת את הסיסמה?');
    // MemoryRouter renders plain paths (the HashRouter in the app adds "#").
    expect(link).toHaveAttribute('href', '/forgot-password');
    const loginButton = screen.getByRole('button', { name: T.login });
    // The link comes before the button, with nothing focusable in between.
    expect(link.compareDocumentPosition(loginButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const form = loginButton.closest('form') as HTMLFormElement;
    const focusables = Array.from(form.querySelectorAll<HTMLElement>('a[href], button, input'));
    expect(focusables.indexOf(loginButton)).toBe(focusables.indexOf(link) + 1);
    expect(focusables.indexOf(link)).toBe(focusables.indexOf(rememberCheckbox()) + 1);
    await user.click(rememberCheckbox());
    await user.tab();
    expect(link).toHaveFocus();
    await user.tab();
    expect(loginButton).toHaveFocus();
  });

  it('"Forgot password?" carries an e-mail address typed as the identifier to the next page (router state, not the URL)', async () => {
    function ForgotProbe() {
      const location = useLocation();
      const email = (location.state as { email?: string } | null)?.email ?? '';
      return <p data-testid="forgot-probe">{`${location.pathname}${location.search}|${email}`}</p>;
    }
    const { user } = renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotProbe />} />
      </Routes>,
      { auth: 'real', route: '/login' },
    );
    await user.type(usernameInput(), ' Dana@Example.com ');
    await user.click(screen.getByRole('link', { name: T.forgotPasswordLink }));
    expect(screen.getByTestId('forgot-probe')).toHaveTextContent('/forgot-password|Dana@Example.com');
  });

  it('"Forgot password?" passes nothing when the identifier is a username', async () => {
    const { user } = renderPage();
    await user.type(usernameInput(), 'dana');
    await user.click(screen.getByRole('link', { name: T.forgotPasswordLink }));
    expect(currentPath()).toBe('/forgot-password');
    expect(api.auth.login).not.toHaveBeenCalled();
  });

  it('links to the registration page', () => {
    renderPage();
    expect(screen.getByText(T.noAccountYet)).toBeInTheDocument();
    // MemoryRouter renders plain paths (the HashRouter in the app adds "#").
    expect(screen.getByRole('link', { name: T.register })).toHaveAttribute('href', '/register');
  });

  describe('registered accounts on this computer', () => {
    it('lists the accounts as buttons; clicking one fills the username and focuses the password', async () => {
      localAccounts([DANA, RON]);
      const { user } = renderPage();

      const section = await screen.findByRole('region', { name: T.registeredAccounts });
      expect(within(section).getByRole('heading', { level: 2, name: T.registeredAccounts })).toBeInTheDocument();
      expect(within(section).getByText(T.registeredAccountsHint)).toBeInTheDocument();
      const buttons = within(section).getAllByRole('button');
      expect(buttons).toHaveLength(2);
      // The server lists the account that signed in most recently first: it is offered right away,
      // in the same render as the list, so its chip already carries the "(נבחר)" marker.
      expect(buttons[0]).toHaveAccessibleName(new RegExp(`^דנה כהן \\(dana\\)\\s*\\(${T.accountSelected}\\)$`));
      expect(buttons[1]).toHaveAccessibleName('רון לוי (ron)');
      expect(buttons[0]).toHaveAttribute('type', 'button');
      await waitFor(() => expect(usernameInput()).toHaveValue('dana'));
      expect(buttons[0]).toHaveAttribute('aria-current', 'true');
      expect(buttons[1]).not.toHaveAttribute('aria-current');
      expect(passwordInput()).toHaveValue('');

      await user.click(within(section).getByRole('button', { name: /רון לוי \(ron\)/ }));
      expect(usernameInput()).toHaveValue('ron');
      expect(passwordInput()).toHaveFocus();
      // The chosen account is marked for everyone (aria-current + text), not by colour alone.
      const ronButton = within(section).getByRole('button', { name: /רון לוי \(ron\)/ });
      expect(ronButton).toHaveAttribute('aria-current', 'true');
      expect(ronButton).toHaveAccessibleName(new RegExp(`^רון לוי \\(ron\\)\\s*\\(${T.accountSelected}\\)$`));
      expect(within(section).getByRole('button', { name: /דנה כהן/ })).not.toHaveAttribute('aria-current');
      await waitFor(() => expect(politeRegion()).toHaveTextContent(T.accountFilled('ron')));

      // Switching to the other account replaces the name; the password typed so far is kept.
      await user.type(passwordInput(), 'secret123');
      await user.click(within(section).getByRole('button', { name: /דנה כהן/ }));
      expect(usernameInput()).toHaveValue('dana');
      expect(passwordInput()).toHaveValue('secret123');
      expect(passwordInput()).toHaveFocus();

      await user.click(screen.getByRole('button', { name: T.login }));
      await waitFor(() => expect(api.auth.login).toHaveBeenCalledTimes(1));
      expect(vi.mocked(api.auth.login).mock.calls[0][0]).toMatchObject({ username: 'dana', password: 'secret123', rememberMe: true });
      expect(api.server.info).toHaveBeenCalled();
      expect(accountsMock()).toHaveBeenCalledTimes(1);
    });

    it('replaces a typed e-mail address with the account\'s username when a registered account is chosen', async () => {
      localAccounts([DANA, RON]);
      const { user } = renderPage();
      const section = await screen.findByRole('region', { name: T.registeredAccounts });
      await waitFor(() => expect(usernameInput()).toHaveValue('dana'));
      await user.clear(usernameInput());
      await user.type(usernameInput(), 'ron@example.com');
      // An e-mail matches no chip, so none is marked as selected.
      for (const b of within(section).getAllByRole('button')) expect(b).not.toHaveAttribute('aria-current');

      await user.click(within(section).getByRole('button', { name: /רון לוי \(ron\)/ }));
      expect(usernameInput()).toHaveValue('ron');
      expect(passwordInput()).toHaveFocus();
      await waitFor(() => expect(politeRegion()).toHaveTextContent(T.accountFilled('ron')));
    });

    it('keeps the account marked as selected while its e-mail address (any letter case) is typed instead of the username', async () => {
      localAccounts([{ ...DANA, email: 'dana@example.com' }, RON]);
      const { user } = renderPage();
      const section = await screen.findByRole('region', { name: T.registeredAccounts });
      await waitFor(() => expect(usernameInput()).toHaveValue('dana'));
      await user.clear(usernameInput());
      await user.type(usernameInput(), 'Dana@Example.com');
      const dana = within(section).getByRole('button', { name: /דנה כהן/ });
      expect(dana).toHaveAttribute('aria-current', 'true');
      expect(dana).toHaveAccessibleName(new RegExp(`\\(${T.accountSelected}\\)$`));
      expect(within(section).getByRole('button', { name: /רון לוי \(ron\)/ })).not.toHaveAttribute('aria-current');

      // An address nobody registered here marks no chip.
      await user.clear(usernameInput());
      await user.type(usernameInput(), 'someone@example.com');
      for (const b of within(section).getAllByRole('button')) expect(b).not.toHaveAttribute('aria-current');
    });

    it('clears a "required" error on the username when an account is chosen', async () => {
      localAccounts([DANA, RON]);
      const { user } = renderPage();
      await screen.findByRole('region', { name: T.registeredAccounts });
      await waitFor(() => expect(usernameInput()).toHaveValue('dana'));
      await user.clear(usernameInput());
      await user.click(screen.getByRole('button', { name: T.login }));
      expect(usernameInput()).toHaveAttribute('aria-invalid', 'true');
      await user.click(screen.getByRole('button', { name: /דנה כהן/ }));
      expect(usernameInput()).not.toHaveAttribute('aria-invalid');
      expect(usernameInput()).toHaveValue('dana');
      expect(passwordInput()).toHaveFocus();
    });

    it('prefills the only registered account when nothing is remembered', async () => {
      localAccounts([RON]);
      renderPage();
      await screen.findByRole('region', { name: T.registeredAccounts });
      await waitFor(() => expect(usernameInput()).toHaveValue('ron'));
      expect(screen.getByRole('button', { name: /רון לוי \(ron\)/ })).toHaveAttribute('aria-current', 'true');
    });

    it('prefills the account the server lists first (the last one that signed in here) when several are registered', async () => {
      localAccounts([{ ...RON, lastLoginAt: '2026-09-20T07:00:00.000Z' }, { ...DANA, lastLoginAt: '2026-09-19T07:00:00.000Z' }]);
      renderPage();
      const section = await screen.findByRole('region', { name: T.registeredAccounts });
      await waitFor(() => expect(usernameInput()).toHaveValue('ron'));
      expect(within(section).getByRole('button', { name: /רון לוי \(ron\)/ })).toHaveAttribute('aria-current', 'true');
      expect(within(section).getByRole('button', { name: /דנה כהן/ })).not.toHaveAttribute('aria-current');
      expect(passwordInput()).toHaveValue('');
    });

    it('prefers the remembered username over the single registered account when it is still registered', async () => {
      window.localStorage.setItem(LAST_USERNAME_KEY, 'Ron');
      localAccounts([RON]);
      renderPage();
      await screen.findByRole('region', { name: T.registeredAccounts });
      expect(usernameInput()).toHaveValue('Ron');
      expect(screen.getByRole('button', { name: /רון לוי \(ron\)/ })).toHaveAttribute('aria-current', 'true');
    });

    it('keeps the remembered username when it is another registered account than the one the server lists first', async () => {
      window.localStorage.setItem(LAST_USERNAME_KEY, 'Dana');
      localAccounts([RON, DANA]);
      renderPage();
      const section = await screen.findByRole('region', { name: T.registeredAccounts });
      expect(usernameInput()).toHaveValue('Dana');
      expect(within(section).getByRole('button', { name: /דנה כהן/ })).toHaveAttribute('aria-current', 'true');
      expect(within(section).getByRole('button', { name: /רון לוי \(ron\)/ })).not.toHaveAttribute('aria-current');
    });

    it('replaces a remembered username that is no longer registered with the single account', async () => {
      window.localStorage.setItem(LAST_USERNAME_KEY, 'deleted-user');
      localAccounts([DANA]);
      renderPage();
      await screen.findByRole('region', { name: T.registeredAccounts });
      await waitFor(() => expect(usernameInput()).toHaveValue('dana'));
    });

    it('replaces a remembered username that is no longer registered with the most recent of several accounts', async () => {
      window.localStorage.setItem(LAST_USERNAME_KEY, 'deleted-user');
      localAccounts([RON, DANA]);
      renderPage();
      await screen.findByRole('region', { name: T.registeredAccounts });
      await waitFor(() => expect(usernameInput()).toHaveValue('ron'));
    });

    it('never overwrites a name the user already typed', async () => {
      let resolveAccounts: (v: { accounts: AccountSummary[] }) => void = () => {};
      vi.mocked(api.server.info).mockResolvedValue(serverInfo(true));
      accountsMock().mockImplementation(() => new Promise((resolve) => (resolveAccounts = resolve)));
      const { user } = renderPage();
      await user.type(usernameInput(), 'someone');
      resolveAccounts({ accounts: [DANA] });
      await screen.findByRole('region', { name: T.registeredAccounts });
      expect(usernameInput()).toHaveValue('someone');
    });

    it('does not ask for the list, and shows nothing, when the request is not local (phone)', async () => {
      vi.mocked(api.server.info).mockResolvedValue(serverInfo(false));
      accountsMock().mockResolvedValue({ accounts: [DANA, RON] });
      renderPage();
      await waitFor(() => expect(api.server.info).toHaveBeenCalled());
      expect(accountsMock()).not.toHaveBeenCalled();
      expect(screen.queryByRole('region', { name: T.registeredAccounts })).not.toBeInTheDocument();
      expect(screen.queryByText(T.registeredAccounts)).not.toBeInTheDocument();
    });

    it('shows no list and no error when the accounts request fails or the server is down', async () => {
      vi.mocked(api.server.info).mockResolvedValue(serverInfo(true));
      accountsMock().mockRejectedValue(new ApiClientError(403, { code: 'FORBIDDEN', message: 'רשימת המשתמשים זמינה רק מהמחשב עצמו' }));
      const { unmount } = renderPage();
      await waitFor(() => expect(accountsMock()).toHaveBeenCalled());
      expect(screen.queryByRole('region', { name: T.registeredAccounts })).not.toBeInTheDocument();
      expect(document.querySelector('.alert--error')).toBeNull();
      expect(screen.getByRole('button', { name: T.login })).toBeInTheDocument();
      unmount();

      vi.mocked(api.server.info).mockRejectedValue(new ApiClientError(0, { code: 'OTHER', message: T.noServer }));
      accountsMock().mockClear();
      renderPage();
      await waitFor(() => expect(api.server.info).toHaveBeenCalledTimes(2));
      expect(accountsMock()).not.toHaveBeenCalled();
      expect(screen.queryByRole('region', { name: T.registeredAccounts })).not.toBeInTheDocument();
      expect(document.querySelector('.alert--error')).toBeNull();
    });

    it('hides the section when the list is empty and ignores malformed entries', async () => {
      localAccounts([]);
      const first = renderPage();
      await waitFor(() => expect(accountsMock()).toHaveBeenCalled());
      expect(screen.queryByRole('region', { name: T.registeredAccounts })).not.toBeInTheDocument();
      first.unmount();

      accountsMock().mockResolvedValue({ accounts: [DANA, { username: '' }, null, 'x'] });
      renderPage();
      const section = await screen.findByRole('region', { name: T.registeredAccounts });
      expect(within(section).getAllByRole('button')).toHaveLength(1);
    });
  });
});
