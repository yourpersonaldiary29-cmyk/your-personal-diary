import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { ServerInfo, ServerSettings, SessionInfo, UserProfile } from '@shared/types';
import { passwordProblem } from '@shared/constants';
import * as api from '@/api';
import { ApiClientError, TOKEN_KEY } from '@/api';
import { T } from '@/constants/texts';
import { __resetLocaleForTests, setCurrentLocale } from '@/i18n/runtime';
import { assertiveRegion, politeRegion, renderWithProviders, sampleUser } from '@/test/render';
import * as platform from '@/utils/platform';
import SettingsPage from './SettingsPage';
import { MT } from './settings/mailTexts';
import { RT } from './settings/remoteTexts';
import { ST } from './settings/texts';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  const mock = createApiMock(await importOriginal());
  // auth.updateProfile is newer than the shared mock (src/test/api-mock.ts); add it here.
  return { ...mock, auth: { ...mock.auth, updateProfile: vi.fn() } };
});

vi.mock('@/utils/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/platform')>();
  return { ...actual, isTauri: vi.fn(() => false), pickSavePath: vi.fn(), pickOpenPath: vi.fn() };
});

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const sessions: SessionInfo[] = [
  { id: 's1', deviceName: 'מחשב', createdAt: '2026-09-01T08:00:00.000Z', lastSeenAt: '2026-09-23T10:00:00.000Z', rememberMe: true, current: true },
  { id: 's2', deviceName: 'טלפון', createdAt: '2026-09-10T08:00:00.000Z', lastSeenAt: '2026-09-22T10:00:00.000Z', rememberMe: false, current: false },
];

const serverInfo: ServerInfo = {
  version: '0.1.0',
  port: 47321,
  lanEnabled: false,
  lanUrls: [],
  dataDir: 'C:\\Users\\AVI\\AppData\\Roaming\\com.mydiary.app',
  isLocalRequest: true,
  startedAt: '2026-09-23T08:00:00.000Z',
};

const LAN_URL = 'http://192.168.1.10:47321';

/** Live copies patched by the server.updateSettings mock (reset before every test). */
let info: ServerInfo;
let lan: ServerSettings;

/** The account card's <dl> (a <dl> has no implicit ARIA role, so it is found by its label). */
function accountList(): HTMLElement {
  const dl = document.querySelector<HTMLElement>(`dl[aria-label="${ST.account}"]`);
  if (!dl) throw new Error('account definition list not found');
  return dl;
}

/** The <dd> that follows the <dt> `term` in the account list. */
function accountValue(term: string): HTMLElement {
  const dt = within(accountList()).getByText(term, { selector: 'dt' });
  return dt.nextElementSibling as HTMLElement;
}

/** The data card (<section> whose heading is "Data"). */
function dataCard(): HTMLElement {
  return screen.getByRole('heading', { name: ST.data }).closest('section') as HTMLElement;
}

function privacyCard(): HTMLElement {
  return screen.getByRole('heading', { level: 2, name: ST.privacy }).closest('section') as HTMLElement;
}

const editDetailsButton = () => screen.getByRole('button', { name: ST.editDetails });
const profileForm = () => screen.getByRole('form', { name: ST.editDetails });
const labelled = (scope: HTMLElement, label: string) => within(scope).getByLabelText(new RegExp(`^${label}`));

/** Opens the change-password dialog and returns it with its fields. */
async function openChangePassword(user: ReturnType<typeof renderWithProviders>['user']) {
  await user.click(screen.getByRole('button', { name: ST.changePassword }));
  const dialog = screen.getByRole('dialog', { name: ST.changePassword });
  return {
    dialog,
    oldField: labelled(dialog, ST.oldPassword),
    newField: labelled(dialog, ST.newPassword),
    confirmField: labelled(dialog, ST.confirmNewPassword),
    submit: within(dialog).getByRole('button', { name: T.confirm }),
  };
}

describe('SettingsPage', () => {
  beforeEach(() => {
    info = { ...serverInfo };
    lan = { port: 47321, lanEnabled: false };
    vi.mocked(platform.isTauri).mockReturnValue(false);
    vi.mocked(api.auth.sessions).mockReset().mockResolvedValue(sessions.map((s) => ({ ...s })));
    vi.mocked(api.auth.revokeSession).mockReset().mockResolvedValue(undefined);
    vi.mocked(api.auth.changePassword).mockReset().mockResolvedValue({ ok: true });
    vi.mocked(api.auth.deleteAccount).mockReset().mockResolvedValue(undefined);
    vi.mocked(api.auth.updateProfile)
      .mockReset()
      .mockImplementation(async (patch) => ({ ...sampleUser, ...patch }));
    vi.mocked(api.settings.seedDemo).mockReset().mockResolvedValue({ entries: 120, habits: 4, habitLogs: 300 });
    vi.mocked(api.server.info).mockReset().mockImplementation(async () => ({ ...info }));
    vi.mocked(api.server.getSettings).mockReset().mockImplementation(async () => ({ ...lan }));
    vi.mocked(api.server.updateSettings)
      .mockReset()
      .mockImplementation(async ({ password: _password, ...patch }: Partial<ServerSettings> & { password?: string }) => {
        lan = { ...lan, ...patch };
        info = { ...info, lanEnabled: lan.lanEnabled, lanUrls: lan.lanEnabled ? [LAN_URL] : [] };
        return { ...lan };
      });
    vi.mocked(api.entries.list).mockReset().mockResolvedValue({ items: [], total: 0 });
    vi.mocked(api.habits.list).mockReset().mockResolvedValue([]);
  });

  describe('anonymous visitor', () => {
    it('shows only the display section plus login / register links', () => {
      renderWithProviders(<SettingsPage />, { auth: 'anonymous' });
      expect(screen.getByRole('heading', { level: 1, name: ST.settingsTitle })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: ST.theme })).toBeInTheDocument();
      // MemoryRouter renders plain paths (the HashRouter in the app adds "#").
      expect(screen.getByRole('link', { name: T.login })).toHaveAttribute('href', '/login');
      expect(screen.getByRole('link', { name: T.register })).toHaveAttribute('href', '/register');
      expect(screen.queryByRole('button', { name: ST.logoutAction })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: ST.changePassword })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: ST.security })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: ST.data })).not.toBeInTheDocument();
      expect(api.auth.sessions).not.toHaveBeenCalled();
    });
  });

  describe('change password dialog', () => {
    it('requires all three fields, announces the error count inside the dialog and focuses the first invalid one', async () => {
      const { user } = renderWithProviders(<SettingsPage />, { auth: 'authenticated' });
      const { dialog, oldField, newField, confirmField, submit } = await openChangePassword(user);
      expect(oldField).toHaveFocus();

      await user.click(submit);
      expect(api.auth.changePassword).not.toHaveBeenCalled();
      expect(oldField).toHaveAttribute('aria-invalid', 'true');
      expect(oldField).toHaveAccessibleDescription(T.fieldRequired(ST.oldPassword));
      expect(newField).toHaveAttribute('aria-invalid', 'true');
      expect(confirmField).toHaveAttribute('aria-invalid', 'true');
      expect(oldField).toHaveFocus();
      // Announced inside the dialog (the global region is inert behind a modal).
      expect(dialog.querySelector('[data-testid="live-region-assertive"]')).toHaveTextContent(T.fixErrors(3));
    });

    it('rejects a weak new password and a mismatched confirmation before calling the server', async () => {
      const { user } = renderWithProviders(<SettingsPage />, { auth: 'authenticated' });
      const { oldField, newField, confirmField, submit } = await openChangePassword(user);
      await user.type(oldField, 'old12345');
      await user.type(newField, 'short');
      await user.type(confirmField, 'short');
      await user.click(submit);
      expect(api.auth.changePassword).not.toHaveBeenCalled();
      expect(oldField).not.toHaveAttribute('aria-invalid');
      expect(newField).toHaveAccessibleDescription(new RegExp(passwordProblem('short') as string));
      expect(newField).toHaveFocus();

      await user.type(newField, 'er12'); // "shorter12" - valid now
      await user.type(confirmField, 'er13');
      await user.click(submit);
      expect(api.auth.changePassword).not.toHaveBeenCalled();
      expect(newField).not.toHaveAttribute('aria-invalid');
      expect(confirmField).toHaveAccessibleDescription(T.passwordsMismatch);
      expect(confirmField).toHaveFocus();
    }, 10_000);

    it('calls the server, shows a toast and closes on success', async () => {
      const { user } = renderWithProviders(<SettingsPage />, { auth: 'authenticated' });
      const { dialog, oldField, newField, confirmField, submit } = await openChangePassword(user);
      await user.type(oldField, 'old12345');
      await user.type(newField, 'newpass123');
      await user.type(confirmField, 'newpass123');
      await user.click(submit);

      await waitFor(() => expect(api.auth.changePassword).toHaveBeenCalledTimes(1));
      expect(api.auth.changePassword).toHaveBeenCalledWith({ oldPassword: 'old12345', newPassword: 'newpass123', confirmPassword: 'newpass123' });
      await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
      await waitFor(() => expect(document.querySelector('.toast--success')).toHaveTextContent(ST.passwordChanged));
      await waitFor(() => expect(politeRegion()).toHaveTextContent(ST.passwordChanged));
      // Focus returns to the opener.
      expect(screen.getByRole('button', { name: ST.changePassword })).toHaveFocus();
    });

    it('shows a wrong old password inline at the old-password field and keeps the dialog open', async () => {
      vi.mocked(api.auth.changePassword).mockRejectedValue(new ApiClientError(401, { code: 'WRONG_PASSWORD', message: 'הסיסמה שגויה' }));
      const { user } = renderWithProviders(<SettingsPage />, { auth: 'authenticated' });
      const { dialog, oldField, newField, confirmField, submit } = await openChangePassword(user);
      await user.type(oldField, 'wrong1234');
      await user.type(newField, 'newpass123');
      await user.type(confirmField, 'newpass123');
      await user.click(submit);

      await waitFor(() => expect(oldField).toHaveAttribute('aria-invalid', 'true'));
      expect(oldField).toHaveAccessibleDescription(ST.wrongOldPassword);
      expect(oldField).toHaveFocus();
      expect(dialog).toHaveAttribute('open');
      expect(document.querySelector('.toast--success')).toBeNull();
    });
  });

  describe('logout', () => {
    it('asks for confirmation and then calls logout', async () => {
      const logout = vi.fn().mockResolvedValue(undefined);
      const { user } = renderWithProviders(<SettingsPage />, { auth: 'authenticated', authOverrides: { logout } });
      await user.click(screen.getByRole('button', { name: ST.logoutAction }));
      const dialog = screen.getByRole('dialog', { name: ST.logoutAction });
      expect(within(dialog).getByText(ST.logoutQuestion)).toBeInTheDocument();
      expect(logout).not.toHaveBeenCalled();

      await user.click(within(dialog).getByRole('button', { name: ST.logoutAction }));
      await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    });

    it('does not log out when the dialog is cancelled', async () => {
      const logout = vi.fn().mockResolvedValue(undefined);
      const { user } = renderWithProviders(<SettingsPage />, { auth: 'authenticated', authOverrides: { logout } });
      await user.click(screen.getByRole('button', { name: ST.logoutAction }));
      const dialog = screen.getByRole('dialog', { name: ST.logoutAction });
      await user.click(within(dialog).getByRole('button', { name: T.cancel }));
      await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
      expect(logout).not.toHaveBeenCalled();
    });
  });

  describe('account details', () => {
    it('shows first name, last name, username and e-mail as separate rows, and the connected devices with a revoke button for other devices only', async () => {
      const { user } = renderWithProviders(<SettingsPage />, { auth: 'authenticated' });
      expect(accountValue(T.firstName)).toHaveTextContent(sampleUser.firstName);
      expect(accountValue(T.lastName)).toHaveTextContent(sampleUser.lastName);
      expect(accountValue(T.username)).toHaveTextContent(sampleUser.username);
      // The e-mail is left-to-right, without "not set" or a "Set" button.
      const email = within(accountList()).getByText(sampleUser.email);
      expect(email).toHaveClass('ltr');
      expect(email.closest('dd')).not.toBeNull();
      expect(within(accountList()).queryByText(T.emailNotSet)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: ST.setEmailTitle })).not.toBeInTheDocument();
      // No "full name" row any more.
      expect(screen.queryByText(`${sampleUser.firstName} ${sampleUser.lastName}`)).not.toBeInTheDocument();

      expect(await screen.findByText('טלפון')).toBeInTheDocument();
      expect(screen.getByText('מחשב')).toBeInTheDocument();
      expect(screen.getByText(ST.currentDevice)).toBeInTheDocument();
      const revokeButtons = screen.getAllByRole('button', { name: new RegExp(`^${ST.revoke}`) });
      expect(revokeButtons).toHaveLength(1);
      expect(revokeButtons[0]).toHaveAccessibleName(ST.revokeName('טלפון'));

      await user.click(revokeButtons[0]);
      await waitFor(() => expect(api.auth.revokeSession).toHaveBeenCalledWith('s2'));
      await waitFor(() => expect(screen.queryByText('טלפון')).not.toBeInTheDocument());
      await waitFor(() => expect(politeRegion()).toHaveTextContent(ST.deviceRevoked('טלפון')));
      expect(screen.getByText('מחשב')).toBeInTheDocument();
      // The focused button is gone with its device: focus lands on the list heading, not on <body>.
      await waitFor(() => expect(screen.getByRole('heading', { name: ST.devices })).toHaveFocus());
    });

    it('after disconnecting a device, focus moves to the "Disconnect" button of the next device', async () => {
      vi.mocked(api.auth.sessions).mockResolvedValue([
        ...sessions.map((s) => ({ ...s })),
        { id: 's3', deviceName: 'דפדפן', createdAt: '2026-09-11T08:00:00.000Z', lastSeenAt: '2026-09-22T11:00:00.000Z', rememberMe: false, current: false },
      ]);
      const { user } = renderWithProviders(<SettingsPage />, { auth: 'authenticated' });
      await screen.findByText('דפדפן');
      await user.click(screen.getByRole('button', { name: ST.revokeName('טלפון') }));
      await waitFor(() => expect(screen.queryByText('טלפון')).not.toBeInTheDocument());
      await waitFor(() => expect(screen.getByRole('button', { name: ST.revokeName('דפדפן') })).toHaveFocus());
    });

    it('shows "not set" plus a "Set" button for a missing e-mail, validates the dialog and saves the address', async () => {
      const refreshUser = vi.fn().mockResolvedValue(undefined);
      const { user } = renderWithProviders(<SettingsPage />, { auth: 'authenticated', user: { ...sampleUser, email: '' }, authOverrides: { refreshUser } });
      const emailCell = accountValue(T.email);
      expect(emailCell).toHaveTextContent(T.emailNotSet);
      const setButton = within(emailCell).getByRole('button', { name: ST.setEmailTitle });
      expect(setButton).toHaveTextContent(ST.setEmail);
      expect(within(accountList()).queryByText(sampleUser.email)).not.toBeInTheDocument();

      await user.click(setButton);
      const dialog = screen.getByRole('dialog', { name: ST.setEmailTitle });
      const field = labelled(dialog, T.email);
      const confirm = within(dialog).getByRole('button', { name: T.confirm });
      expect(field).toHaveFocus();
      expect(within(dialog).getByRole('button', { name: T.cancel })).toBeInTheDocument();

      // Empty -> required; malformed -> invalid; no request either time.
      await user.click(confirm);
      expect(api.auth.updateProfile).not.toHaveBeenCalled();
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(field).toHaveAccessibleDescription(T.fieldRequired(T.email));
      expect(field).toHaveFocus();
      // The address receives the reset links: the account password is required too.
      const password = labelled(dialog, ST.emailPassword);
      expect(password).toHaveAttribute('aria-invalid', 'true');
      expect(password).toHaveAccessibleDescription(new RegExp(T.fieldRequired(ST.emailPassword)));
      expect(dialog.querySelector('[data-testid="live-region-assertive"]')).toHaveTextContent(T.fixErrors(2));
      await user.type(password, 'Passw0rd!');
      await user.type(field, 'nope');
      await user.click(confirm);
      expect(api.auth.updateProfile).not.toHaveBeenCalled();
      expect(field).toHaveAccessibleDescription(T.emailInvalid);
      expect(dialog.querySelector('[data-testid="live-region-assertive"]')).toHaveTextContent(T.emailInvalid);

      await user.clear(field);
      await user.type(field, ' dana@example.com {Enter}');
      await waitFor(() => expect(api.auth.updateProfile).toHaveBeenCalledWith({ email: 'dana@example.com', currentPassword: 'Passw0rd!' }));
      await waitFor(() => expect(refreshUser).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
      await waitFor(() => expect(politeRegion()).toHaveTextContent(ST.emailSaved));
      expect(document.querySelector('.toast--success')).toHaveTextContent(ST.emailSaved);
      expect(editDetailsButton()).toHaveFocus();
    });

    it('replaces the "Set" button with the address once the account is refreshed (real AuthProvider)', async () => {
      window.localStorage.setItem(TOKEN_KEY, 'tok-123');
      let profile: UserProfile = { ...sampleUser, email: '' };
      vi.mocked(api.auth.me).mockImplementation(async () => ({ user: profile, session: { ...sessions[0] } }));
      vi.mocked(api.auth.updateProfile).mockImplementation(async ({ currentPassword, ...patch }) => {
        expect(currentPassword).toBe('Passw0rd!');
        profile = { ...profile, ...patch };
        return profile;
      });
      const { user } = renderWithProviders(<SettingsPage />, { auth: 'real' });
      await user.click(await screen.findByRole('button', { name: ST.setEmailTitle }));
      const dialog = screen.getByRole('dialog', { name: ST.setEmailTitle });
      await user.type(labelled(dialog, ST.emailPassword), 'Passw0rd!');
      await user.type(labelled(dialog, T.email), 'dana@example.com{Enter}');

      expect(await screen.findByText('dana@example.com')).toHaveClass('ltr');
      expect(screen.queryByRole('button', { name: ST.setEmailTitle })).not.toBeInTheDocument();
      expect(within(accountList()).queryByText(T.emailNotSet)).not.toBeInTheDocument();
    });

    it('maps a duplicate e-mail (409) in the dialog to the field and keeps it open', async () => {
      vi.mocked(api.auth.updateProfile).mockRejectedValue(new ApiClientError(409, { code: 'VALIDATION', message: 'taken', field: 'email' }));
      const { user } = renderWithProviders(<SettingsPage />, { auth: 'authenticated', user: { ...sampleUser, email: '' } });
      await user.click(screen.getByRole('button', { name: ST.setEmailTitle }));
      const dialog = screen.getByRole('dialog', { name: ST.setEmailTitle });
      const field = labelled(dialog, T.email);
      await user.type(labelled(dialog, ST.emailPassword), 'Passw0rd!');
      await user.type(field, 'other@example.com{Enter}');
      await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'));
      expect(field).toHaveAccessibleDescription(T.emailTaken);
      expect(field).toHaveFocus();
      expect(dialog).toHaveAttribute('open');
    });

    it('"Edit details" reveals a prefilled form; confirm sends only the changed fields, refreshes the user and announces', async () => {
      const refreshUser = vi.fn().mockResolvedValue(undefined);
      const { user } = renderWithProviders(<SettingsPage />, { auth: 'authenticated', authOverrides: { refreshUser } });
      const button = editDetailsButton();
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('form', { name: ST.editDetails })).not.toBeInTheDocument();

      await user.click(button);
      const form = profileForm();
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(button).toHaveAttribute('aria-controls', form.id);
      const first = labelled(form, T.firstName);
      const last = labelled(form, T.lastName);
      const email = labelled(form, T.email);
      expect(first).toHaveValue(sampleUser.firstName);
      expect(last).toHaveValue(sampleUser.lastName);
      expect(email).toHaveValue(sampleUser.email);
      expect(email).toHaveAttribute('dir', 'ltr');
      expect(first).toHaveFocus();
      expect(within(form).getByRole('button', { name: T.cancel })).toBeInTheDocument();

      await user.clear(last);
      await user.type(last, 'לוי');
      await user.click(within(form).getByRole('button', { name: T.confirm }));
      await waitFor(() => expect(api.auth.updateProfile).toHaveBeenCalledWith({ lastName: 'לוי' }));
      await waitFor(() => expect(refreshUser).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(politeRegion()).toHaveTextContent(ST.profileSaved));
      expect(document.querySelector('.toast--success')).toHaveTextContent(ST.profileSaved);
      await waitFor(() => expect(screen.queryByRole('form', { name: ST.editDetails })).not.toBeInTheDocument());
      expect(editDetailsButton()).toHaveFocus();
      expect(editDetailsButton()).toHaveAttribute('aria-expanded', 'false');
    });

    it('validates the inline form and maps server errors (duplicate e-mail) to their fields', async () => {
      const { user } = renderWithProviders(<SettingsPage />, { auth: 'authenticated' });
      await user.click(editDetailsButton());
      const form = profileForm();
      const first = labelled(form, T.firstName);
      const email = labelled(form, T.email);
      const confirm = within(form).getByRole('button', { name: T.confirm });

      await user.clear(first);
      await user.clear(email);
      await user.click(confirm);
      expect(api.auth.updateProfile).not.toHaveBeenCalled();
      expect(first).toHaveAttribute('aria-invalid', 'true');
      expect(first).toHaveAccessibleDescription(T.fieldRequired(T.firstName));
      // An existing address cannot be cleared (the field also carries the local-use hint).
      expect(email).toHaveAttribute('aria-invalid', 'true');
      expect(email).toHaveAccessibleDescription(new RegExp(T.fieldRequired(T.email)));
      expect(first).toHaveFocus();
      await waitFor(() => expect(assertiveRegion()).toHaveTextContent(T.fixErrors(2)));

      vi.mocked(api.auth.updateProfile).mockRejectedValue(new ApiClientError(409, { code: 'VALIDATION', message: 'taken', field: 'email' }));
      await user.type(first, sampleUser.firstName);
      await user.type(email, 'other@example.com');
      // A different address needs the account password: the field appears, and is required.
      await user.click(confirm);
      expect(api.auth.updateProfile).not.toHaveBeenCalled();
      const password = labelled(form, ST.emailPassword);
      expect(password).toHaveAttribute('aria-invalid', 'true');
      expect(password).toHaveFocus();
      await user.type(password, 'Passw0rd!');
      await user.click(confirm);
      // Only the e-mail differs from the profile, so only it is sent (with the password).
      await waitFor(() => expect(api.auth.updateProfile).toHaveBeenCalledWith({ email: 'other@example.com', currentPassword: 'Passw0rd!' }));
      await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'));
      expect(email).toHaveAccessibleDescription(new RegExp(T.emailTaken));
      expect(email).toHaveFocus();
      expect(profileForm()).toBeInTheDocument();
    });

    it('asks for the account password only when the address changes, and puts a wrong one on that field', async () => {
      const { user } = renderWithProviders(<SettingsPage />, { auth: 'authenticated' });
      await user.click(editDetailsButton());
      const form = profileForm();
      const email = labelled(form, T.email);
      expect(within(form).queryByLabelText(new RegExp(`^${ST.emailPassword}`))).not.toBeInTheDocument();
      // A change of letter case only is the same address.
      await user.clear(email);
      await user.type(email, sampleUser.email.toUpperCase());
      expect(within(form).queryByLabelText(new RegExp(`^${ST.emailPassword}`))).not.toBeInTheDocument();
      await user.clear(email);
      await user.type(email, 'new@example.com');
      const password = labelled(form, ST.emailPassword);
      expect(password).toHaveAccessibleDescription(new RegExp(ST.emailPasswordHint));
      vi.mocked(api.auth.updateProfile).mockRejectedValue(
        new ApiClientError(400, { code: 'WRONG_PASSWORD', message: 'The current password is incorrect.', field: 'currentPassword' }),
      );
      await user.type(password, 'Wrong1pass');
      await user.click(within(form).getByRole('button', { name: T.confirm }));
      await waitFor(() => expect(password).toHaveAttribute('aria-invalid', 'true'));
      expect(password).toHaveAccessibleDescription(new RegExp('The current password is incorrect.'));
      expect(password).toHaveFocus();
      expect(profileForm()).toBeInTheDocument();
    });

    it('cancel closes the form without saving and returns focus to the button; an unchanged form announces "no changes"', async () => {
      const refreshUser = vi.fn().mockResolvedValue(undefined);
      const { user } = renderWithProviders(<SettingsPage />, { auth: 'authenticated', authOverrides: { refreshUser } });
      const button = editDetailsButton();
      await user.click(button);
      await user.click(within(profileForm()).getByRole('button', { name: T.cancel }));
      expect(screen.queryByRole('form', { name: ST.editDetails })).not.toBeInTheDocument();
      expect(button).toHaveFocus();
      expect(api.auth.updateProfile).not.toHaveBeenCalled();

      await user.click(button);
      await user.click(within(profileForm()).getByRole('button', { name: T.confirm }));
      expect(api.auth.updateProfile).not.toHaveBeenCalled();
      expect(refreshUser).not.toHaveBeenCalled();
      await waitFor(() => expect(politeRegion()).toHaveTextContent(ST.noChanges));
      expect(screen.queryByRole('form', { name: ST.editDetails })).not.toBeInTheDocument();
      expect(button).toHaveFocus();
    });
  });

  describe('display (real SettingsProvider, mocked api)', () => {
    it('saves the theme through the settings api and announces it', async () => {
      window.localStorage.setItem(TOKEN_KEY, 'tok-123');
      vi.mocked(api.auth.me).mockResolvedValue({ user: sampleUser, session: { ...sessions[0] } });
      const { user } = renderWithProviders(<SettingsPage />, { auth: 'real' });
      const dark = await screen.findByRole('radio', { name: ST.themeLabel('dark') });
      await user.click(dark);
      await waitFor(() => expect(api.settings.update).toHaveBeenCalledWith({ theme: 'dark' }));
      await waitFor(() => expect(politeRegion()).toHaveTextContent(ST.themeChanged(ST.themeLabel('dark'))));
      await waitFor(() => expect(dark).toBeChecked());
    });

    it('no longer offers the calendar toggles (the calendar-system menu decides what is shown)', () => {
      renderWithProviders(<SettingsPage />, { auth: 'authenticated' });
      const display = screen.getByRole('heading', { name: ST.display }).closest('section') as HTMLElement;
      expect(within(display).getAllByRole('checkbox')).toHaveLength(1); // reduce motion only
      expect(within(display).queryByRole('group', { name: /calendar|לוח שנה/i })).not.toBeInTheDocument();
    });
  });

  describe('language', () => {
    it('renders in English by default and in Hebrew once the language is switched', () => {
      __resetLocaleForTests();
      const english = renderWithProviders(<SettingsPage />, { auth: 'anonymous' });
      expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Dark' })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /^Text size/ })).toHaveDisplayValue('Normal (100%)');
      english.unmount();

      setCurrentLocale('he');
      try {
        renderWithProviders(<SettingsPage />, { auth: 'anonymous' });
        expect(screen.getByRole('heading', { level: 1, name: 'הגדרות' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'חשבון' })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'ערכת נושא' })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'כהה' })).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: /^גודל הטקסט/ })).toHaveDisplayValue('רגיל (100%)');
        expect(screen.queryByRole('heading', { name: 'Settings' })).not.toBeInTheDocument();
      } finally {
        __resetLocaleForTests();
      }
    });

    it('offers the auto-lock delays as localised durations', () => {
      setCurrentLocale('he');
      try {
        renderWithProviders(<SettingsPage />, { auth: 'authenticated', settings: { autoLockMinutes: 45 } });
        const select = screen.getByRole('combobox', { name: new RegExp(`^${ST.autoLock}`) });
        const labels = within(select)
          .getAllByRole('option')
          .map((o) => o.textContent);
        expect(labels).toEqual(['כבוי', 'דקה אחת', '5 דקות', '10 דקות', '15 דקות', '30 דקות', 'שעה', '45 דקות']);
        expect(select).toHaveValue('45');
      } finally {
        __resetLocaleForTests();
      }
    });

    it('shows the account card and the reassurance in Hebrew with the exact wording', () => {
      setCurrentLocale('he');
      try {
        renderWithProviders(<SettingsPage />, { auth: 'authenticated', user: { ...sampleUser, email: '' } });
        expect(accountValue('דואר אלקטרוני')).toHaveTextContent('לא הוגדרה');
        expect(screen.getByRole('button', { name: 'הגדרת כתובת דוא״ל' })).toHaveTextContent('הגדר');
        expect(screen.getByRole('button', { name: 'עריכת פרטים' })).toBeInTheDocument();
        expect(within(privacyCard()).getByText('נתוני היומן שלך נשמרים בחשבון האישי שלך ומוצפנים מקצה לקצה.')).toBeInTheDocument();
      } finally {
        __resetLocaleForTests();
      }
    });
  });

  describe('data', () => {
    it('the privacy card opens with the reassurance sentence and offers only switches (offline mode; no phone access in the browser)', async () => {
      const { user } = renderWithProviders(<SettingsPage />, { auth: 'authenticated' });
      const card = privacyCard();
      const reassurance = within(card).getByText(ST.dataReassurance);
      expect(reassurance.tagName).toBe('P');
      expect(reassurance.previousElementSibling).toBeNull();
      // The card's two links are the privacy policy page and, under it, the Terms of Use page on the diary server
      // (docs/play-tasks/PLAY-LEGAL.md item 4, docs/apple-tasks/TERMS.md), opened outside the app - never the
      // former in-app Privacy page.
      const links = within(card).getAllByRole('link');
      expect(links).toHaveLength(2);
      expect(links[0]).toHaveAccessibleName(ST.privacyPolicyLink);
      expect(links[0].getAttribute('href')).toMatch(/^https:\/\/[^/]+\/privacy\/(?:[a-z]{2}\/)?$/);
      expect(links[0]).toHaveAttribute('target', '_blank');
      expect(links[1]).toHaveAccessibleName(ST.termsLink);
      expect(links[1].getAttribute('href')).toMatch(/^https:\/\/[^/]+\/terms\/(?:[a-z]{2}\/)?$/);
      expect(links[1]).toHaveAttribute('target', '_blank');
      expect(within(card).queryByRole('heading', { name: ST.lanAccess })).not.toBeInTheDocument();
      const offline = within(card).getByRole('checkbox', { name: new RegExp(`^${ST.offlineLabel}`) });
      expect(offline).toBeChecked();
      expect(offline).toHaveAccessibleDescription(ST.offlineHint);
      // Only the Remote access and E-mail cards ask the server whether the page runs on the computer
      // itself (and then whether this account owns them - no phone-access section asks here).
      expect(api.server.info).toHaveBeenCalledTimes(2);
      await waitFor(() => expect(api.server.getSettings).toHaveBeenCalledTimes(2));
      // The data card keeps only demo data (shown while the diary is empty).
      await screen.findByRole('heading', { level: 2, name: ST.data });
      expect(within(dataCard()).queryByText(ST.dataReassurance)).not.toBeInTheDocument();
      expect(within(dataCard()).queryByRole('checkbox')).not.toBeInTheDocument();
      await user.click(offline);
      await waitFor(() => expect(politeRegion()).toHaveTextContent(ST.offlineOff));
    });

    it('on the desktop, turns phone access on from the privacy card, shows the addresses with copy buttons and the instructions', async () => {
      vi.mocked(platform.isTauri).mockReturnValue(true);
      // userEvent.setup() (inside renderWithProviders) installs a clipboard stub we can read back.
      const { user } = renderWithProviders(<SettingsPage />, { auth: 'authenticated' });
      const card = privacyCard();
      expect(within(card).getByRole('heading', { level: 3, name: ST.lanAccess })).toBeInTheDocument();
      const lanBox = await within(card).findByRole('checkbox', { name: new RegExp(`^${ST.lanAccessLabel}`) });
      expect(lanBox).toBeEnabled();
      expect(lanBox).not.toBeChecked();
      expect(lanBox).toHaveAccessibleDescription(ST.lanAccessHint);
      expect(screen.queryByText(LAN_URL)).not.toBeInTheDocument();

      // Turning it on opens the diary to the home network: the account password is asked first.
      await user.click(lanBox);
      const confirm = screen.getByRole('dialog', { name: ST.lanConfirmTitle });
      expect(api.server.updateSettings).not.toHaveBeenCalled();
      vi.mocked(api.server.updateSettings).mockRejectedValueOnce(
        new ApiClientError(400, { code: 'WRONG_PASSWORD', message: 'The current password is incorrect.', field: 'password' }),
      );
      await user.type(within(confirm).getByLabelText(new RegExp(`^${T.password}`)), 'Wrong1pass{Enter}');
      await waitFor(() => expect(confirm.querySelector('[data-testid="live-region-assertive"]')).toHaveTextContent('The current password is incorrect.'));
      expect(confirm).toHaveAttribute('open');
      expect(lanBox).not.toBeChecked();
      await user.clear(within(confirm).getByLabelText(new RegExp(`^${T.password}`)));
      await user.type(within(confirm).getByLabelText(new RegExp(`^${T.password}`)), 'Passw0rd!{Enter}');
      await waitFor(() => expect(api.server.updateSettings).toHaveBeenLastCalledWith({ lanEnabled: true, password: 'Passw0rd!' }));
      await waitFor(() => expect(confirm).not.toHaveAttribute('open'));
      expect(await within(card).findByText(LAN_URL)).toBeInTheDocument();
      await waitFor(() => expect(lanBox).toBeChecked());
      await waitFor(() => expect(politeRegion()).toHaveTextContent(ST.lanEnabledMsg));
      expect(within(card).getByRole('heading', { level: 4, name: ST.lanUrlsTitle })).toBeInTheDocument();
      expect(within(card).getByRole('heading', { level: 4, name: ST.lanInstructionsTitle })).toBeInTheDocument();
      for (const step of ST.lanInstructions) expect(within(card).getByText(step)).toBeInTheDocument();

      await user.click(within(card).getByRole('button', { name: ST.copyName(LAN_URL) }));
      await waitFor(() => expect(politeRegion()).toHaveTextContent(ST.copied(LAN_URL)));
      expect(await navigator.clipboard.readText()).toBe(LAN_URL);

      // The old privacy-page data folder / file / size block is gone.
      expect(screen.queryByText(serverInfo.dataDir)).not.toBeInTheDocument();
      expect(api.settings.dataDir).not.toHaveBeenCalled();

      await user.click(lanBox);
      await waitFor(() => expect(api.server.updateSettings).toHaveBeenCalledWith({ lanEnabled: false }));
      await waitFor(() => expect(screen.queryByText(LAN_URL)).not.toBeInTheDocument());
      await waitFor(() => expect(politeRegion()).toHaveTextContent(ST.lanDisabledMsg));
    });

    it('shows only the state of phone access to an account that does not own the computer', async () => {
      vi.mocked(platform.isTauri).mockReturnValue(true);
      lan = { ...lan, lanEnabled: true, isLanOwner: false };
      info = { ...info, lanEnabled: true, lanUrls: [LAN_URL] };
      renderWithProviders(<SettingsPage />, { auth: 'authenticated' });
      const card = privacyCard();
      expect(await within(card).findByText(ST.lanOwnerOnly)).toBeInTheDocument();
      expect(within(card).getByText(ST.lanStatusOn)).toBeInTheDocument();
      expect(within(card).queryByRole('checkbox', { name: new RegExp(`^${ST.lanAccessLabel}`) })).not.toBeInTheDocument();
      // The addresses stay visible: this account can still use phone access.
      expect(within(card).getByText(LAN_URL)).toBeInTheDocument();
    });

    it('explains instead of offering the switch when the desktop request is not local', async () => {
      vi.mocked(platform.isTauri).mockReturnValue(true);
      info = { ...info, isLocalRequest: false };
      renderWithProviders(<SettingsPage />, { auth: 'authenticated' });
      expect(await within(privacyCard()).findByText(ST.lanOnlyFromComputer)).toBeInTheDocument();
      // Only the offline switch remains; the phone-access switch is replaced by the explanation.
      expect(within(privacyCard()).getAllByRole('checkbox')).toHaveLength(1);
    });

    it('offers demo data only while the diary is empty and announces what was loaded', async () => {
      const { user } = renderWithProviders(<SettingsPage />, { auth: 'authenticated' });
      const seedButton = await screen.findByRole('button', { name: ST.seedDemo });
      await user.click(seedButton);
      const dialog = screen.getByRole('dialog', { name: ST.seedDemoTitle });
      await user.click(within(dialog).getByRole('button', { name: ST.seedDemoConfirm }));

      await waitFor(() => expect(api.settings.seedDemo).toHaveBeenCalledTimes(1));
      const expected = ST.seedDemoDone(120, 4, 300);
      await waitFor(() => expect(politeRegion()).toHaveTextContent(expected));
      expect(document.querySelector('.alert--success')).toHaveTextContent(expected);
      await waitFor(() => expect(screen.queryByRole('button', { name: ST.seedDemo })).not.toBeInTheDocument());
    });

    it('keeps only demo data in the data card - the account is deleted from its own card at the very bottom', async () => {
      renderWithProviders(<SettingsPage />, { auth: 'authenticated' });
      const data = (await screen.findByRole('heading', { level: 2, name: ST.data })).closest('section') as HTMLElement;
      expect(within(data).getByRole('button', { name: ST.seedDemo })).toBeInTheDocument();
      expect(within(data).queryByRole('button', { name: ST.deleteAccountButton })).not.toBeInTheDocument();
      // One way to delete the account: the single "Delete account" button of the last card.
      expect(screen.getAllByRole('button', { name: ST.deleteAccountButton })).toHaveLength(1);
      const cards = [...document.querySelectorAll('.settings-page > section.card')];
      expect(cards.at(-1)).toHaveTextContent(ST.deleteAccountTitle);
    });

    it('hides the data card once the diary has content (nothing else lives there any more)', async () => {
      vi.mocked(api.entries.list).mockResolvedValue({ items: [], total: 3 });
      renderWithProviders(<SettingsPage />, { auth: 'authenticated' });
      await waitFor(() => expect(api.entries.list).toHaveBeenCalled());
      await new Promise((r) => setTimeout(r, 20));
      expect(screen.queryByRole('heading', { name: ST.data })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: ST.deleteAccountButton })).toBeInTheDocument();
    });
  });

  describe('security and reminders', () => {
    it('locks immediately from "lock now"', async () => {
      const lock = vi.fn();
      const { user } = renderWithProviders(<SettingsPage />, { auth: 'authenticated', lock: { lock } });
      await user.click(screen.getByRole('button', { name: ST.lockNow }));
      expect(lock).toHaveBeenCalledTimes(1);
    });

    it('renders the auto-lock select with the current value and the reminders switch', () => {
      renderWithProviders(<SettingsPage />, { auth: 'authenticated', settings: { autoLockMinutes: 5, remindersEnabled: false } });
      expect(screen.getByRole('combobox', { name: new RegExp(`^${ST.autoLock}`) })).toHaveValue('5');
      expect(screen.getByRole('checkbox', { name: new RegExp(`^${ST.remindersEnabled}`) })).not.toBeChecked();
    });
  });

  describe('remote access and e-mail sending (owner only)', () => {
    it('shows both cards to the owner of this computer (the first account)', async () => {
      lan = { ...lan, isRemoteOwner: true, isMailOwner: true };
      renderWithProviders(<SettingsPage />, { auth: 'authenticated' });
      expect(await screen.findByRole('heading', { level: 2, name: RT.title })).toBeInTheDocument();
      expect(await screen.findByRole('heading', { level: 2, name: MT.title })).toBeInTheDocument();
    });

    it('never shows them to another account - not even for a moment, and without asking for their settings', async () => {
      lan = { ...lan, isRemoteOwner: false, isMailOwner: false };
      vi.mocked(api.server.remote.get).mockClear();
      vi.mocked(api.server.mail.get).mockClear();
      renderWithProviders(<SettingsPage />, { auth: 'authenticated' });
      expect(screen.queryByRole('heading', { name: RT.title })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: MT.title })).not.toBeInTheDocument();
      await waitFor(() => expect(api.server.getSettings).toHaveBeenCalledTimes(2));
      await new Promise((r) => setTimeout(r, 20));
      expect(screen.queryByRole('heading', { name: RT.title })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: MT.title })).not.toBeInTheDocument();
      expect(api.server.remote.get).not.toHaveBeenCalled();
      expect(api.server.mail.get).not.toHaveBeenCalled();
      // The rest of the page is there.
      expect(privacyCard()).toBeInTheDocument();
    });
  });

  describe('diagnostics', () => {
    it('is hidden in the browser and shown on the desktop with the server details but without the data folder', async () => {
      const first = renderWithProviders(<SettingsPage />, { auth: 'authenticated' });
      expect(screen.queryByRole('heading', { name: ST.diagnostics })).not.toBeInTheDocument();
      // Only the Remote access and E-mail cards ask for the server info in the browser (is this the computer itself?).
      expect(api.server.info).toHaveBeenCalledTimes(2);
      first.unmount();

      vi.mocked(platform.isTauri).mockReturnValue(true);
      renderWithProviders(<SettingsPage />, { auth: 'authenticated' });
      const card = screen.getByRole('heading', { name: ST.diagnostics }).closest('section') as HTMLElement;
      expect(await within(card).findByText('47321')).toBeInTheDocument();
      expect(within(card).getAllByText('0.1.0')).toHaveLength(2); // UI version and server version
      expect(within(card).getByText(ST.lanOff)).toBeInTheDocument();
      expect(screen.queryByText(serverInfo.dataDir)).not.toBeInTheDocument();
      expect(within(card).getByRole('button', { name: ST.showServerLog })).toBeInTheDocument();
      expect(within(card).getByRole('button', { name: ST.restartServer })).toBeInTheDocument();
    });
  });
});
