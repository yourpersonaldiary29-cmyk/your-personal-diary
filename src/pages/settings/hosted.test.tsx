/**
 * The Settings page and the welcome page with the Your Personal Diary server (docs/android-tasks/
 * HOSTED-IMPL.md item 8): what a hosted server does not offer is not shown, where the diary is kept is
 * said with the server's address as read-only text, and the owner's mail card is reachable there.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import type { ServerInfo } from '@shared/types';
import * as api from '@/api';
import { __resetConnectionForTests, setServerInfo } from '@/api';
import { T } from '@/constants/texts';
import { trWith } from '@/i18n/runtime';
import SettingsPage from '@/pages/SettingsPage';
import WelcomePage from '@/pages/WelcomePage';
import { renderWithProviders, sampleUser } from '@/test/render';
import * as platform from '@/utils/platform';
import { MT } from './mailTexts';
import { ST } from './texts';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});
vi.mock('@/utils/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/platform')>();
  return { ...actual, isTauri: vi.fn(() => false), pickSavePath: vi.fn(), pickOpenPath: vi.fn() };
});
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const en = trWith('en');

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
  // The production state once DIARY_OWNER_ID is set; the tests of the bootstrap state override it.
  ownerConfigured: true,
};

const privacyCard = () => screen.getByRole('heading', { level: 2, name: ST.privacy }).closest('section') as HTMLElement;
const accountCard = () => screen.getByRole('heading', { level: 2, name: ST.account }).closest('section') as HTMLElement;

/** Lets every pending answer and the renders after it settle. */
const settle = () => act(async () => new Promise<void>((r) => setTimeout(r, 20)));

/** The Account card shows nothing of the ID (no row, no Copy button, no hint) and no error. */
function expectNoAccountIdRow() {
  const account = accountCard();
  expect(within(account).queryByText(ST.accountId)).not.toBeInTheDocument();
  expect(within(account).queryByTestId('account-id')).not.toBeInTheDocument();
  expect(within(account).queryByRole('button', { name: ST.copyAccountId })).not.toBeInTheDocument();
  expect(within(account).queryByText(ST.accountIdHint)).not.toBeInTheDocument();
  expect(within(account).queryByRole('alert')).not.toBeInTheDocument();
}

beforeEach(() => {
  __resetConnectionForTests();
  vi.mocked(platform.isTauri).mockReturnValue(true);
  vi.mocked(api.server.info).mockReset().mockResolvedValue({ ...hostedInfo });
  vi.mocked(api.server.getSettings).mockReset().mockResolvedValue({ port: 8080, lanEnabled: false, isRemoteOwner: false, isMailOwner: false, isLanOwner: false });
  vi.mocked(api.auth.sessions).mockReset().mockResolvedValue([]);
  vi.mocked(api.entries.list).mockReset().mockResolvedValue({ items: [], total: 3 } as never);
  vi.mocked(api.habits.list).mockReset().mockResolvedValue([]);
});

afterEach(() => {
  __resetConnectionForTests();
});

describe('Settings with the Your Personal Diary server', () => {
  it('hides the Diagnostics card and phone access even in the Windows app, and says where the diary is kept', async () => {
    setServerInfo({ ...hostedInfo });
    renderWithProviders(<SettingsPage />, { auth: 'authenticated', user: sampleUser, locale: 'en' });

    const card = privacyCard();
    expect(within(card).getByText(en('settings.hosted.reassurance'))).toBeInTheDocument();
    expect(within(card).queryByText(ST.dataReassurance)).not.toBeInTheDocument();
    // The address: read-only text (no input, no copy button), the host only.
    const address = within(card).getByTestId('server-address');
    expect(address).toHaveTextContent(ST.serverAddress('diary.example.org'));
    expect(within(card).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: /copy/i })).not.toBeInTheDocument();
    // The offline switch stays, with the hint that names the diary server.
    const offline = within(card).getByRole('checkbox', { name: new RegExp(`^${ST.offlineLabel}`) });
    expect(offline).toHaveAccessibleDescription(en('settings.hosted.offlineHint'));
    expect(within(card).queryByRole('heading', { level: 3, name: ST.lanAccess })).not.toBeInTheDocument();
    expect(within(card).queryByText(ST.lanOnlyFromComputer)).not.toBeInTheDocument();

    // No local server to inspect or restart.
    await screen.findByRole('heading', { level: 2, name: ST.reminders });
    expect(screen.queryByRole('heading', { level: 2, name: ST.diagnostics })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: ST.restartServer })).not.toBeInTheDocument();
    // Remote access does not exist on the hosted server (the server flags say so); the mail card is for its owner only.
    await waitFor(() => expect(api.server.getSettings).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { level: 2, name: en('settings.remote.title') })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: en('settings.mail.title') })).not.toBeInTheDocument();
    expect(api.server.remote.get).not.toHaveBeenCalled();
    expect(api.server.mail.get).not.toHaveBeenCalled();
    // The rest of the page is there: account, security, delete account.
    expect(screen.getByRole('heading', { level: 2, name: ST.account })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: ST.security })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: en('settings.deleteAccount.title') })).toBeInTheDocument();
    // The owner is configured and this account is not the owner: no account ID row, no hint
    // (docs/android-tasks/OWNER-ID-VISIBILITY.md) - also once the settings answer has been applied.
    await settle();
    expectNoAccountIdRow();
    // The row rides on the Mail card's read: the page asks no more than the two owner cards always did
    // (one GET /api/server/info and one GET /api/server/settings each).
    expect(api.server.info).toHaveBeenCalledTimes(2);
    expect(api.server.getSettings).toHaveBeenCalledTimes(2);
  });

  it('an app opened while no owner was configured hides the row from a regular user once the owner is set (the start-up probe is stale)', async () => {
    // The start-up probe ran during bootstrap; the owner set DIARY_OWNER_ID and the machine restarted
    // since, while this app stayed open (a remembered session survives the restart).
    setServerInfo({ ...hostedInfo, ownerConfigured: false });
    vi.mocked(api.server.info).mockResolvedValue({ ...hostedInfo, ownerConfigured: true });
    renderWithProviders(<SettingsPage />, { auth: 'authenticated', user: sampleUser, locale: 'en' });
    await screen.findByRole('heading', { level: 2, name: ST.reminders });
    await waitFor(() => expect(api.server.getSettings).toHaveBeenCalledTimes(2));
    await settle();
    expectNoAccountIdRow();
    expect(api.server.info).toHaveBeenCalledTimes(2);
  });

  it('while no owner is configured yet, every signed-in account sees the account ID row (the would-be owner reads his id there)', async () => {
    setServerInfo({ ...hostedInfo, ownerConfigured: false });
    vi.mocked(api.server.info).mockResolvedValue({ ...hostedInfo, ownerConfigured: false });
    renderWithProviders(<SettingsPage />, { auth: 'authenticated', user: sampleUser, locale: 'en' });
    const account = accountCard();
    expect(await within(account).findByText(ST.accountId)).toBeInTheDocument();
    expect(within(account).getByTestId('account-id')).toHaveTextContent(sampleUser.id);
    expect(within(account).getByRole('button', { name: ST.copyAccountId })).toBeInTheDocument();
    // The owner cards themselves stay off for everyone until the variable names the owner.
    await screen.findByRole('heading', { level: 2, name: ST.reminders });
    await waitFor(() => expect(api.server.getSettings).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { level: 2, name: en('settings.mail.title') })).not.toBeInTheDocument();
  });

  it('the configured owner gets the e-mail card from anywhere (no loopback on a hosted server)', async () => {
    setServerInfo({ ...hostedInfo });
    vi.mocked(api.server.getSettings).mockResolvedValue({ port: 8080, lanEnabled: false, isRemoteOwner: false, isMailOwner: true, isLanOwner: false });
    renderWithProviders(<SettingsPage />, { auth: 'authenticated', user: sampleUser, locale: 'en' });
    expect(await screen.findByRole('heading', { level: 2, name: MT.title })).toBeInTheDocument();
    await waitFor(() => expect(api.server.mail.get).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { level: 2, name: en('settings.remote.title') })).not.toBeInTheDocument();
    expect(api.server.remote.get).not.toHaveBeenCalled();
    // ...and the account ID row: the owner reads and copies his id here.
    expect(await within(accountCard()).findByTestId('account-id')).toHaveTextContent(sampleUser.id);
    expect(within(accountCard()).getByRole('button', { name: ST.copyAccountId })).toBeInTheDocument();
  });

  it('control: a local server on the desktop keeps the Diagnostics card, phone access and the local wording', async () => {
    setServerInfo({ ...hostedInfo, mode: undefined, publicUrl: undefined, isLocalRequest: true, dataDir: 'C:\\fictional\\data' });
    vi.mocked(api.server.info).mockResolvedValue({ ...hostedInfo, mode: undefined, publicUrl: undefined, isLocalRequest: true });
    renderWithProviders(<SettingsPage />, { auth: 'authenticated', user: sampleUser, locale: 'en' });
    const card = privacyCard();
    expect(within(card).getByText(ST.dataReassurance)).toBeInTheDocument();
    expect(within(card).queryByTestId('server-address')).not.toBeInTheDocument();
    expect(within(card).getByRole('heading', { level: 3, name: ST.lanAccess })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: ST.diagnostics })).toBeInTheDocument();
    // No account ID row with a local server.
    expect(within(accountCard()).queryByText(ST.accountId)).not.toBeInTheDocument();
    expect(within(accountCard()).queryByTestId('account-id')).not.toBeInTheDocument();
  });

  it('a guest of the hosted tour gets the tour card, not the account cards - on the desktop too', async () => {
    setServerInfo({ ...hostedInfo });
    const guest = { ...sampleUser, id: 'g_1', username: '_guest_1', firstName: '', lastName: '', email: '', guest: true };
    renderWithProviders(<SettingsPage />, { auth: 'authenticated', user: guest, locale: 'en' });
    expect(screen.getByRole('heading', { level: 2, name: en('mobile.guest.settingsTitle') })).toBeInTheDocument();
    await screen.findByRole('heading', { level: 2, name: ST.reminders });
    for (const title of [ST.account, ST.security, en('settings.deleteAccount.title'), en('settings.mail.title')]) {
      expect(screen.queryByRole('heading', { level: 2, name: title })).not.toBeInTheDocument();
    }
  });
});

describe('the welcome page with the Your Personal Diary server', () => {
  it('names the server in the encryption line instead of "your computer"', () => {
    setServerInfo({ ...hostedInfo });
    renderWithProviders(<WelcomePage />, { auth: 'anonymous', locale: 'en' });
    expect(screen.getByText(en('shell.welcome.feature.encryptionServer'))).toBeInTheDocument();
    expect(screen.queryByText(en('shell.welcome.feature.encryption'))).not.toBeInTheDocument();
    expect(T.welcomeFeaturesFor(true)).toHaveLength(5);
  });

  it('keeps the local wording while the server is a local one', () => {
    renderWithProviders(<WelcomePage />, { auth: 'anonymous', locale: 'en' });
    expect(screen.getByText(en('shell.welcome.feature.encryption'))).toBeInTheDocument();
    expect(T.welcomeFeatures).toEqual(T.welcomeFeaturesFor(false));
  });
});
