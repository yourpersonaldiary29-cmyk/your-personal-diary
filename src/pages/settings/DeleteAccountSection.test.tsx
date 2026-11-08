/**
 * "Delete account" card (DeleteAccountSection): the very last card of the
 * Settings page, a dialog that needs the password and "I understand" before
 * its confirm button is enabled, the line about owned remote access / e-mail
 * settings - the local server's wording, and the hosted server's own line for
 * its owner (DIARY_OWNER_ID, whom nobody inherits) - wrong-password handling,
 * and what happens after the deletion (toast + announcement, local session
 * forgotten, login or registration).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import type { ServerInfo, ServerSettings } from '@shared/types';
import * as api from '@/api';
import { __resetConnectionForTests, ApiClientError, getToken, setServerInfo, TOKEN_KEY } from '@/api';
import { T } from '@/constants/texts';
import { LEGACY_RECENT_QUESTIONS_KEY, recentQuestionsKey } from '@/utils/deviceData';
import { readUserLocale, storeUserLocale, trWith } from '@/i18n/runtime';
import { assertiveRegion, currentPath, LocationDisplay, politeRegion, renderWithProviders, sampleUser } from '@/test/render';
import { getLastUsername, setLastUsername } from '@/utils/last-username';
import * as platform from '@/utils/platform';
import SettingsPage from '../SettingsPage';
import { ownerNote, type OwnedSettings } from './DeleteAccountSection';
import { MT } from './mailTexts';
import { RT } from './remoteTexts';
import { ST } from './texts';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  const mock = createApiMock(await importOriginal());
  return { ...mock, auth: { ...mock.auth, updateProfile: vi.fn() } };
});

vi.mock('@/utils/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/platform')>();
  return { ...actual, isTauri: vi.fn(() => false), pickSavePath: vi.fn(), pickOpenPath: vi.fn() };
});

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const serverInfo: ServerInfo = {
  version: '0.1.0',
  port: 47321,
  lanEnabled: false,
  lanUrls: [],
  dataDir: '',
  isLocalRequest: true,
  startedAt: '2026-09-23T08:00:00.000Z',
};

let serverSettings: ServerSettings;

function renderPage(options: Parameters<typeof renderWithProviders>[1] = {}) {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <LocationDisplay />
    </>,
    { route: '/settings', auth: 'authenticated', ...options },
  );
}

/**
 * For cards that appear only after the page's own requests (server info and settings for the
 * owner-only cards, diagnostics): on a busy machine - the full gate runs many files in parallel -
 * they can take longer than the 1 s default of findBy / waitFor.
 */
const PAGE_LOAD = { timeout: 10_000 };

const card = () => screen.getByRole('heading', { level: 2, name: ST.deleteAccountTitle }).closest('section') as HTMLElement;
const openButton = () => within(card()).getByRole('button', { name: ST.deleteAccountButton });

async function openDialog(user: ReturnType<typeof renderWithProviders>['user'], username = sampleUser.username) {
  await user.click(openButton());
  // The dialog opens once the owner flags were read (a request of its own).
  const dialog = await screen.findByRole('dialog', { name: ST.deleteAccountDialogTitle(username) }, PAGE_LOAD);
  return {
    dialog,
    password: within(dialog).getByLabelText(new RegExp(`^${T.password}`)),
    understand: within(dialog).getByRole('checkbox', { name: ST.deleteAccountUnderstand }),
    confirm: within(dialog).getByRole('button', { name: ST.deleteAccountConfirm }),
  };
}

describe('DeleteAccountSection', () => {
  beforeEach(() => {
    serverSettings = { port: 47321, lanEnabled: false };
    vi.mocked(platform.isTauri).mockReturnValue(false);
    vi.mocked(api.auth.sessions).mockReset().mockResolvedValue([]);
    vi.mocked(api.auth.deleteAccount).mockReset().mockResolvedValue(undefined);
    vi.mocked(api.auth.accounts).mockReset().mockResolvedValue({ accounts: [] });
    vi.mocked(api.server.info).mockReset().mockImplementation(async () => ({ ...serverInfo }));
    vi.mocked(api.server.getSettings).mockReset().mockImplementation(async () => ({ ...serverSettings }));
    vi.mocked(api.entries.list).mockReset().mockResolvedValue({ items: [], total: 0 });
    vi.mocked(api.habits.list).mockReset().mockResolvedValue([]);
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  describe('the card', () => {
    it('is the last card of the page - after the owner-only cards and diagnostics - with an h2, the warning and one danger button', async () => {
      vi.mocked(platform.isTauri).mockReturnValue(true);
      serverSettings = { ...serverSettings, isRemoteOwner: true, isMailOwner: true };
      renderPage();
      await screen.findByRole('heading', { level: 2, name: RT.title }, PAGE_LOAD);
      await screen.findByRole('heading', { level: 2, name: MT.title }, PAGE_LOAD);
      await screen.findByRole('heading', { level: 2, name: ST.diagnostics }, PAGE_LOAD);
      await screen.findByRole('heading', { level: 2, name: ST.data }, PAGE_LOAD);

      const headings = screen.getAllByRole('heading', { level: 2 });
      expect(headings.at(-1)).toHaveTextContent(ST.deleteAccountTitle);
      const cards = [...document.querySelectorAll('.settings-page > section.card')];
      expect(cards.at(-1)).toBe(card());
      expect(within(card()).getByText(ST.deleteAccountWarning)).toBeInTheDocument();
      expect(openButton()).toHaveClass('btn--danger');
      expect(openButton()).toHaveAttribute('aria-haspopup', 'dialog');
    });

    it('is not shown to anonymous visitors', () => {
      renderPage({ auth: 'anonymous' });
      expect(screen.queryByRole('heading', { name: ST.deleteAccountTitle })).not.toBeInTheDocument();
    });

    it('speaks Hebrew with the owner wording and isolates the Latin username in the RTL dialog title', async () => {
      const { user } = renderPage({ locale: 'he' });
      expect(ST.deleteAccountTitle).toBe('מחיקת חשבון');
      expect(ST.deleteAccountButton).toBe('מחיקת חשבון');
      const { dialog } = await openDialog(user);
      const title = within(dialog).getByRole('heading', { level: 2 });
      expect(title).toHaveTextContent('למחוק את החשבון "dana"?');
      expect(title.querySelector('bdi')).toHaveTextContent('dana');
    });
  });

  describe('the dialog', () => {
    it('moves focus into the dialog, repeats the warning, and enables the confirm button only with the password AND the checkbox', async () => {
      const { user } = renderPage({ locale: 'en' });
      // The owner flags are read only when the dialog opens (the page itself asks twice, for its two owner-only cards).
      await waitFor(() => expect(api.server.getSettings).toHaveBeenCalledTimes(2), PAGE_LOAD);
      const { dialog, password, understand, confirm } = await openDialog(user);
      expect(api.server.getSettings).toHaveBeenCalledTimes(3);
      expect(password).toHaveFocus();
      expect(within(dialog).getByText(ST.deleteAccountWarning)).toBeInTheDocument();
      expect(dialog).toHaveAccessibleDescription(ST.deleteAccountWarning);
      expect(password).toHaveAccessibleDescription(ST.deleteAccountPasswordHint);
      expect(password).toHaveAttribute('autocomplete', 'current-password');
      expect(confirm).toBeDisabled();

      await user.type(password, 'Secret123');
      expect(confirm).toBeDisabled();
      // Enter in the password field does not delete while the box is unchecked.
      await user.type(password, '{Enter}');
      expect(api.auth.deleteAccount).not.toHaveBeenCalled();

      await user.click(understand);
      expect(understand).toBeChecked();
      expect(confirm).toBeEnabled();

      await user.clear(password);
      expect(confirm).toBeDisabled();
      await user.type(password, 'Secret123');
      // Keyboard only: Space toggles the box.
      understand.focus();
      await user.keyboard(' ');
      expect(confirm).toBeDisabled();
      await user.keyboard(' ');
      expect(confirm).toBeEnabled();
      expect(api.auth.deleteAccount).not.toHaveBeenCalled();
    });

    it('cancel closes without deleting and returns focus to the "Delete account" button; the next opening starts empty', async () => {
      const { user } = renderPage();
      const first = await openDialog(user);
      await user.type(first.password, 'Secret123');
      await user.click(first.understand);
      await user.click(within(first.dialog).getByRole('button', { name: T.cancel }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(openButton()).toHaveFocus();
      expect(api.auth.deleteAccount).not.toHaveBeenCalled();

      const second = await openDialog(user);
      expect(second.password).toHaveValue('');
      expect(second.understand).not.toBeChecked();
      expect(second.confirm).toBeDisabled();
    });

    it.each([
      ['remote access and e-mail', { isRemoteOwner: true, isMailOwner: true }, () => ST.deleteAccountOwnerBoth],
      ['remote access', { isRemoteOwner: true, isMailOwner: false }, () => ST.deleteAccountOwnerRemote],
      ['e-mail sending', { isRemoteOwner: false, isMailOwner: true }, () => ST.deleteAccountOwnerMail],
    ])('tells the owner of %s what happens to those settings', async (_label, flags, expected) => {
      serverSettings = { ...serverSettings, ...flags };
      const { user } = renderPage({ locale: 'en' });
      const { dialog } = await openDialog(user);
      expect(within(dialog).getByText(expected())).toBeInTheDocument();
      expect(dialog).toHaveAccessibleDescription(`${ST.deleteAccountWarning} ${expected()}`);
      const others = [ST.deleteAccountOwnerBoth, ST.deleteAccountOwnerRemote, ST.deleteAccountOwnerMail, ST.deleteAccountOwnerHosted];
      for (const other of others.filter((t) => t !== expected())) {
        expect(within(dialog).queryByText(other)).not.toBeInTheDocument();
      }
    });

    it('shows no owner line to other accounts, or when the server cannot say', async () => {
      serverSettings = { ...serverSettings, isRemoteOwner: false, isMailOwner: false };
      const { user } = renderPage({ locale: 'en' });
      const { dialog } = await openDialog(user);
      for (const line of [ST.deleteAccountOwnerBoth, ST.deleteAccountOwnerRemote, ST.deleteAccountOwnerMail, ST.deleteAccountOwnerHosted]) {
        expect(within(dialog).queryByText(line)).not.toBeInTheDocument();
      }
      await user.click(within(dialog).getByRole('button', { name: T.cancel }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

      vi.mocked(api.server.getSettings).mockRejectedValue(new ApiClientError(500, { code: 'OTHER', message: 'boom' }));
      const again = await openDialog(user);
      expect(within(again.dialog).queryByText(ST.deleteAccountOwnerBoth)).not.toBeInTheDocument();
    });

    it('keeps the dialog open with the error at the password field for a wrong password', async () => {
      vi.mocked(api.auth.deleteAccount).mockRejectedValue(
        new ApiClientError(400, { code: 'WRONG_PASSWORD', message: 'The current password is incorrect.', field: 'password' }),
      );
      const endSession = vi.fn();
      const { user } = renderPage({ authOverrides: { endSession } });
      const { dialog, password, understand, confirm } = await openDialog(user);
      await user.type(password, 'Nope12345');
      await user.click(understand);
      await user.click(confirm);

      await waitFor(() => expect(password).toHaveAttribute('aria-invalid', 'true'));
      expect(password).toHaveAccessibleDescription(`${ST.deleteAccountPasswordHint} ${ST.deleteAccountWrongPassword}`);
      expect(password).toHaveFocus();
      await waitFor(() => expect(within(dialog).getByTestId('live-region-assertive')).toHaveTextContent(ST.deleteAccountWrongPassword));
      expect(dialog).toHaveAttribute('open');
      expect(api.auth.deleteAccount).toHaveBeenCalledWith('Nope12345');
      expect(endSession).not.toHaveBeenCalled();
      expect(currentPath()).toBe('/settings');
    });

    it('shows other failures (too many attempts) inside the dialog and deletes nothing locally', async () => {
      vi.mocked(api.auth.deleteAccount).mockRejectedValue(new ApiClientError(429, { code: 'FORBIDDEN', message: 'Too many attempts.' }));
      const endSession = vi.fn();
      const { user } = renderPage({ authOverrides: { endSession } });
      const { dialog, password, understand, confirm } = await openDialog(user);
      await user.type(password, 'Secret123');
      await user.click(understand);
      await user.click(confirm);
      // Announced once: by the error Alert (the dialog's own live region stays empty).
      const spoken = () => within(dialog).getAllByRole('alert').filter((el) => el.textContent?.trim());
      await waitFor(() => expect(spoken()).toHaveLength(1));
      expect(spoken()[0]).toHaveTextContent('Too many attempts.');
      expect(spoken()[0]).toHaveClass('alert--error');
      expect(dialog).toHaveAttribute('open');
      expect(endSession).not.toHaveBeenCalled();
    });
  });

  describe('ownerNote: which owner line, local server or Your Personal Diary server', () => {
    const owns = (o: Partial<OwnedSettings>): OwnedSettings => ({ remote: false, mail: false, server: false, hostedAnswer: false, ...o });

    it('local server: the local wording for each owned feature, nothing for other accounts', () => {
      expect(ownerNote(owns({ remote: true, mail: true }))).toBe(ST.deleteAccountOwnerBoth);
      expect(ownerNote(owns({ remote: true }))).toBe(ST.deleteAccountOwnerRemote);
      expect(ownerNote(owns({ mail: true }))).toBe(ST.deleteAccountOwnerMail);
      expect(ownerNote(owns({}))).toBeNull();
    });

    it('hosted server - known from the UI or from the hosted-only isServerOwner of the answer: the hosted line for its owner, never the local wording', () => {
      const cases: Array<[boolean, Partial<OwnedSettings>]> = [
        [true, {}],
        [false, { hostedAnswer: true }],
        [true, { hostedAnswer: true }],
      ];
      for (const [hosted, extra] of cases) {
        expect(ownerNote(owns({ ...extra, mail: true, server: true }), hosted)).toBe(ST.deleteAccountOwnerHosted);
        expect(ownerNote(owns({ ...extra, mail: true }), hosted)).toBe(ST.deleteAccountOwnerHosted);
        expect(ownerNote(owns({ ...extra, server: true }), hosted)).toBe(ST.deleteAccountOwnerHosted);
        expect(ownerNote(owns({ ...extra, remote: true, mail: true }), hosted)).toBe(ST.deleteAccountOwnerHosted);
        // Another account (the hosted server reports isRemoteOwner: false to everyone anyway): no line.
        expect(ownerNote(owns({ ...extra }), hosted)).toBeNull();
        expect(ownerNote(owns({ ...extra, remote: true }), hosted)).toBeNull();
      }
    });
  });

  describe('the owner line on the Your Personal Diary server (hosted mode)', () => {
    /** GET /api/server/info of the hosted server (fictional address), as in hosted.test.tsx. */
    const hostedInfo: ServerInfo = {
      version: '0.1.0',
      port: 8080,
      lanEnabled: false,
      lanUrls: [],
      dataDir: '',
      isLocalRequest: false,
      startedAt: '2026-10-20T08:00:00.000Z',
      remoteEnabled: false,
      remoteUrl: 'https://diary.example.org',
      secure: true,
      passwordResetAvailable: true,
      mode: 'hosted',
      publicUrl: 'https://diary.example.org',
      storageOk: true,
      registration: 'open',
      guestTour: true,
      ownerConfigured: true,
    };
    /** GET /api/server/settings as the hosted server answers its configured owner (server/src/routes/server.ts). */
    const ownerSettings: ServerSettings = {
      port: 8080,
      lanEnabled: false,
      isRemoteOwner: false,
      isMailOwner: true,
      isLanOwner: false,
      isServerOwner: true,
    };
    const localLines = () => [ST.deleteAccountOwnerBoth, ST.deleteAccountOwnerRemote, ST.deleteAccountOwnerMail];

    beforeEach(() => {
      __resetConnectionForTests();
      setServerInfo({ ...hostedInfo });
      vi.mocked(api.server.info).mockImplementation(async () => ({ ...hostedInfo }));
    });

    afterEach(() => {
      __resetConnectionForTests();
    });

    it('tells the owner what deleting does on the server - the e-mail settings go, nobody inherits, DIARY_OWNER_ID again - without the local wording', async () => {
      serverSettings = { ...ownerSettings };
      const { user } = renderPage({ locale: 'en' });
      const { dialog } = await openDialog(user);
      const line = within(dialog).getByText(ST.deleteAccountOwnerHosted);
      expect(dialog.getAttribute('aria-describedby')?.split(' ')).toContain(line.id);
      for (const local of localLines()) expect(within(dialog).queryByText(local)).not.toBeInTheDocument();
      // The English source: nothing about "this computer" or a next-oldest owner; the Server card and the variable.
      expect(ST.deleteAccountOwnerHosted).not.toMatch(/computer|oldest/i);
      expect(ST.deleteAccountOwnerHosted).toContain('"Server"');
      expect(ST.deleteAccountOwnerHosted).toContain('DIARY_OWNER_ID');
    });

    it('speaks Hebrew there too: the hosted line, not "on this computer" and not the next-oldest account', async () => {
      serverSettings = { ...ownerSettings };
      const { user } = renderPage({ locale: 'he' });
      const { dialog } = await openDialog(user);
      const line = within(dialog).getByText(ST.deleteAccountOwnerHosted);
      expect(line.textContent).not.toBe(trWith('en')('settings.deleteAccount.ownerHosted'));
      expect(line).toHaveTextContent('כרטיס "שרת"');
      expect(line).toHaveTextContent('DIARY_OWNER_ID');
      expect(line.textContent).not.toContain('במחשב הזה');
      expect(line.textContent).not.toContain('הוותיק');
    });

    it('a regular account of the hosted server gets no owner line', async () => {
      serverSettings = { ...ownerSettings, isMailOwner: false, isServerOwner: false };
      const { user } = renderPage({ locale: 'en' });
      const { dialog } = await openDialog(user);
      for (const line of [...localLines(), ST.deleteAccountOwnerHosted]) expect(within(dialog).queryByText(line)).not.toBeInTheDocument();
    });
  });

  describe('after the deletion', () => {
    it('announces it, forgets the session on this device and opens registration when no account is left', async () => {
      setLastUsername('Dana');
      window.localStorage.setItem(recentQuestionsKey(sampleUser.id), JSON.stringify(['how did I sleep?']));
      window.localStorage.setItem(LEGACY_RECENT_QUESTIONS_KEY, JSON.stringify(['old list']));
      storeUserLocale(sampleUser.id, 'he');
      const endSession = vi.fn();
      const { user } = renderPage({ locale: 'en', authOverrides: { endSession } });
      const { password, understand, confirm } = await openDialog(user);
      await user.type(password, 'Secret123');
      await user.click(understand);
      await user.click(confirm);

      await waitFor(() => expect(api.auth.deleteAccount).toHaveBeenCalledWith('Secret123'));
      await waitFor(() => expect(currentPath()).toBe('/register'));
      expect(endSession).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(document.querySelector('.toast--success')).toHaveTextContent(ST.deleteAccountDone));
      await waitFor(() => expect(politeRegion()).toHaveTextContent(ST.deleteAccountDone));
      expect(getLastUsername()).toBeNull();
      expect(window.localStorage.getItem(recentQuestionsKey(sampleUser.id))).toBeNull();
      expect(window.localStorage.getItem(LEGACY_RECENT_QUESTIONS_KEY)).toBeNull();
      expect(readUserLocale(sampleUser.id)).toBeNull();
    });

    it('opens the login page while other accounts remain, and keeps another account remembered on this device', async () => {
      vi.mocked(api.auth.accounts).mockResolvedValue({
        accounts: [{ username: 'ron', firstName: 'Ron', lastName: 'Test', email: 'ron@example.com' }],
      } as Awaited<ReturnType<typeof api.auth.accounts>>);
      setLastUsername('ron');
      const { user } = renderPage();
      const { password, understand, confirm } = await openDialog(user);
      await user.type(password, 'Secret123');
      await user.click(understand);
      await user.click(confirm);
      await waitFor(() => expect(currentPath()).toBe('/login'));
      expect(getLastUsername()).toBe('ron');
    });

    it('opens the login page where the account list is not available (phone)', async () => {
      vi.mocked(api.auth.accounts).mockRejectedValue(new ApiClientError(403, { code: 'FORBIDDEN', message: 'computer only' }));
      const { user } = renderPage();
      const { password, understand, confirm } = await openDialog(user);
      await user.type(password, 'Secret123');
      await user.click(understand);
      await user.click(confirm);
      await waitFor(() => expect(currentPath()).toBe('/login'));
    });

    it('with the real AuthProvider: the token is cleared and the page becomes anonymous', async () => {
      window.localStorage.setItem(TOKEN_KEY, 'tok-123');
      vi.mocked(api.auth.me).mockResolvedValue({
        user: sampleUser,
        session: { id: 's1', deviceName: 'PC', createdAt: '', lastSeenAt: '', rememberMe: true, current: true },
      });
      const { user } = renderPage({ auth: 'real' });
      await screen.findByRole('heading', { level: 2, name: ST.deleteAccountTitle }, PAGE_LOAD);
      const { password, understand, confirm } = await openDialog(user);
      await user.type(password, 'Secret123');
      await user.click(understand);
      await user.click(confirm);
      await waitFor(() => expect(currentPath()).toBe('/register'));
      expect(getToken()).toBeNull();
      expect(api.auth.logout).not.toHaveBeenCalled();
      // No "session expired" / "logged out" error on the way.
      expect(assertiveRegion()).toHaveTextContent('');
    });
  });
});
