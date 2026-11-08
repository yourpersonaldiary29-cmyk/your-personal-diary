/**
 * "Account" card (AccountSection) - the account ID row (docs/android-tasks/OWNER-ID.md, narrowed by
 * OWNER-ID-VISIBILITY.md). With the Your Personal Diary server the card shows the signed-in account's
 * ID (read-only, LTR, monospace) with a Copy button and one hint - but only while the server has no
 * valid owner yet (`ServerInfo.ownerConfigured: false`: the would-be owner must be able to read his
 * own id, docs/HOSTED-DEPLOY.he.md step ו) or to the configured owner (`ServerSettings.isMailOwner`).
 * Every other user sees no row, no hint and no error. Both answers are the server's on this visit
 * (the Mail card's shared read, useOwnerAccess) - not the start-up probe in the connection store, which
 * a client opened before the owner was set still holds. A local server renders the card exactly as
 * before: no ID row, no Copy button, and the server is never asked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import type { ServerInfo, ServerSettings, UserProfile } from '@shared/types';
import * as api from '@/api';
import { __resetConnectionForTests, setServerInfo } from '@/api';
import { T } from '@/constants/texts';
import { assertiveRegion, politeRegion, renderWithProviders, sampleUser } from '@/test/render';
import { AccountSection } from './AccountSection';
import { MailSection } from './MailSection';
import { MT } from './mailTexts';
import { ST } from './texts';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

/** A fictional account in the shape the server gives ids ('u_' + 16 hex digits). */
const owner: UserProfile = { ...sampleUser, id: 'u_0123456789abcdef' };

/** A hosted server that does not say whether an owner is configured (an older server). */
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
};
/** The server before its owner variable names an existing account: nobody owns the owner cards yet. */
const bootstrapInfo: ServerInfo = { ...hostedInfo, ownerConfigured: false };
/** The server once the owner is configured. */
const ownedInfo: ServerInfo = { ...hostedInfo, ownerConfigured: true };

const localInfo: ServerInfo = { ...hostedInfo, mode: undefined, publicUrl: undefined, isLocalRequest: true, dataDir: 'C:\\fictional\\data' };

/** GET /api/server/settings as a hosted server answers it: the Mail card belongs to the owner only. */
const settingsOf = (isMailOwner: boolean): ServerSettings => ({ port: 8080, lanEnabled: false, isRemoteOwner: false, isMailOwner, isLanOwner: false });

/**
 * The server as this client sees it: `probed` is what the start-up probe left in the connection store,
 * `now` what GET /api/server/info answers on this visit (the same unless a test says otherwise).
 */
function serverIs(probed: ServerInfo, now: ServerInfo = probed, settings: ServerSettings = settingsOf(false)) {
  setServerInfo({ ...probed });
  vi.mocked(api.server.info).mockResolvedValue({ ...now });
  vi.mocked(api.server.getSettings).mockResolvedValue(settings);
}

const copyButton = () => screen.getByRole('button', { name: ST.copyAccountId });
const toasts = () => screen.queryAllByTestId('toast');

/** The card shows its four profile rows and nothing of the ID: no row, no value, no Copy button, no hint. */
function expectNoAccountIdRow() {
  const list = screen.getByLabelText(ST.account);
  expect(list.querySelectorAll('dt')).toHaveLength(4);
  expect(within(list).queryByText(ST.accountId)).not.toBeInTheDocument();
  expect(screen.queryByTestId('account-id')).not.toBeInTheDocument();
  expect(screen.queryByText('u_0123456789abcdef')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: ST.copyAccountId })).not.toBeInTheDocument();
  expect(screen.queryByText(ST.accountIdHint)).not.toBeInTheDocument();
}

/**
 * Nothing went wrong on screen: no alert besides the always-present (and empty) assertive live region of
 * the announcer, nothing announced there, and no toast.
 */
function expectNoErrorShown() {
  const region = assertiveRegion();
  expect(screen.queryAllByRole('alert').filter((el) => el !== region)).toHaveLength(0);
  expect(region).toBeEmptyDOMElement();
  expect(toasts()).toHaveLength(0);
}

/** Lets every pending answer and the renders after it settle. */
const settle = () => act(async () => new Promise<void>((r) => setTimeout(r, 20)));

beforeEach(() => {
  __resetConnectionForTests();
  vi.mocked(api.auth.sessions).mockReset().mockResolvedValue([]);
  vi.mocked(api.server.info).mockReset();
  vi.mocked(api.server.getSettings).mockReset();
});

afterEach(() => {
  __resetConnectionForTests();
  vi.restoreAllMocks();
});

describe('Account card - the Your Personal Diary server has no owner yet (bootstrap)', () => {
  it('shows the ID as LTR monospace text in its own row, with a Copy button and one hint, from one read of the server', async () => {
    serverIs(bootstrapInfo);
    renderWithProviders(<AccountSection />, { auth: 'authenticated', user: owner, locale: 'en' });

    const list = screen.getByLabelText(ST.account);
    const term = await within(list).findByText(ST.accountId);
    expect(term.tagName).toBe('DT');
    const row = term.parentElement as HTMLElement;
    const value = within(row).getByTestId('account-id');
    expect(value).toHaveTextContent(/^u_0123456789abcdef$/);
    expect(value).toHaveClass('account-id__value');
    expect(value.closest('dd')).not.toBeNull();
    // A small secondary Copy button, named for what it copies.
    const button = within(row).getByRole('button', { name: ST.copyAccountId });
    expect(button).toHaveTextContent(ST.copy);
    expect(button).toHaveClass('btn--secondary');
    // One short muted hint under the row; the server's variable name is never shown.
    const hint = within(row).getByText(ST.accountIdHint);
    expect(hint).toHaveClass('text-muted');
    expect(ST.accountIdHint).toBe('Only the server owner needs this, to turn on the owner cards.');
    expect(document.body).not.toHaveTextContent('DIARY_OWNER_ID');
    // The other rows are still there, the ID is the last one.
    for (const t of [T.firstName, T.lastName, T.username, T.email]) expect(within(list).getByText(t)).toBeInTheDocument();
    expect(list.querySelectorAll('dt')).toHaveLength(5);
    expect(list.querySelectorAll('dt')[4]).toBe(term);
    // One read: the server's info now, and its settings (the very requests the Mail card makes).
    await settle();
    expect(api.server.info).toHaveBeenCalledTimes(1);
    expect(api.server.getSettings).toHaveBeenCalledTimes(1);
  });

  it('copies the ID: polite announcement, a success toast and the ID on the clipboard', async () => {
    serverIs(bootstrapInfo);
    // userEvent.setup() (inside renderWithProviders) installs a clipboard stub we can read back.
    const { user } = renderWithProviders(<AccountSection />, { auth: 'authenticated', user: owner, locale: 'en' });
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');

    await user.click(await screen.findByRole('button', { name: ST.copyAccountId }));

    expect(writeText).toHaveBeenCalledWith('u_0123456789abcdef');
    expect(await navigator.clipboard.readText()).toBe('u_0123456789abcdef');
    await waitFor(() => expect(politeRegion()).toHaveTextContent(ST.accountIdCopied));
    expect(ST.accountIdCopied).toBe('Account ID copied');
    const [toast] = toasts();
    expect(toast).toHaveTextContent(ST.accountIdCopied);
    expect(toast).toHaveClass('toast--success');
    // Announced once: the toast itself carries no live role.
    expect(toast).not.toHaveAttribute('role');
    expect(copyButton()).toHaveFocus();
  });

  it('a failed copy never throws: an error toast asks to select the ID and copy it by hand', async () => {
    serverIs(bootstrapInfo);
    const { user } = renderWithProviders(<AccountSection />, { auth: 'authenticated', user: owner, locale: 'en' });
    await screen.findByRole('button', { name: ST.copyAccountId });
    // Both ways of copying fail (the Clipboard API rejects, the legacy fallback reports false).
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    const hadExecCommand = Object.prototype.hasOwnProperty.call(document, 'execCommand');
    const original = document.execCommand;
    const execCommand = vi.fn(() => false);
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true, writable: true });
    try {
      await user.click(copyButton());

      expect(writeText).toHaveBeenCalledWith('u_0123456789abcdef');
      await waitFor(() => expect(toasts()).toHaveLength(1));
      const [toast] = toasts();
      expect(toast).toHaveTextContent(ST.accountIdCopyFailed);
      expect(ST.accountIdCopyFailed).toBe('Copying failed. Select the account ID and copy it by hand.');
      expect(toast).toHaveClass('toast--error');
      // Announced by the toast itself (an alert), once.
      expect(toast).toHaveAttribute('role', 'alert');
      expect(politeRegion()).not.toHaveTextContent(ST.accountIdCopied);
      expect(screen.queryByText(ST.accountIdCopied)).not.toBeInTheDocument();
      // The ID stays on screen to be selected by hand; the button can be tried again.
      expect(screen.getByTestId('account-id')).toHaveTextContent('u_0123456789abcdef');
      expect(copyButton()).toBeEnabled();
    } finally {
      if (hadExecCommand) Object.defineProperty(document, 'execCommand', { value: original, configurable: true, writable: true });
      else delete (document as unknown as Record<string, unknown>).execCommand;
    }
  });

  it('reads in Hebrew with the ID kept left to right', async () => {
    serverIs(bootstrapInfo);
    renderWithProviders(<AccountSection />, { auth: 'authenticated', user: owner, locale: 'he' });
    const list = screen.getByLabelText('חשבון');
    expect(await within(list).findByText('מזהה חשבון')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'העתק את מזהה החשבון' })).toHaveTextContent('העתק');
    expect(screen.getByTestId('account-id')).toHaveClass('account-id__value');
    expect(within(list).getByText('רק בעל השרת צריך את זה, כדי להפעיל את כרטיסי הבעלים.')).toBeInTheDocument();
  });

  it('a settings request that fails during bootstrap still shows the row (no owner exists yet) and no error', async () => {
    serverIs(bootstrapInfo);
    vi.mocked(api.server.getSettings).mockRejectedValue(new Error('Unreachable (fictional)'));
    renderWithProviders(<AccountSection />, { auth: 'authenticated', user: owner, locale: 'en' });
    expect(await screen.findByTestId('account-id')).toHaveTextContent('u_0123456789abcdef');
    await settle();
    expectNoErrorShown();
  });
});

describe('Account card - the owner of the Your Personal Diary server is configured', () => {
  it('a regular user: no row, no hint and no error - before and after the server settings answer', async () => {
    serverIs(ownedInfo);
    let answer!: (s: ServerSettings) => void;
    vi.mocked(api.server.getSettings).mockReturnValue(new Promise<ServerSettings>((resolve) => (answer = resolve)));
    renderWithProviders(<AccountSection />, { auth: 'authenticated', user: owner, locale: 'en' });

    // One request for the flag; nothing of the ID flashes while it is pending.
    await waitFor(() => expect(api.server.getSettings).toHaveBeenCalledTimes(1));
    expectNoAccountIdRow();
    await act(async () => answer(settingsOf(false)));
    await settle();
    expectNoAccountIdRow();
    expectNoErrorShown();
    // The rest of the card is untouched.
    for (const t of [T.firstName, T.lastName, T.username, T.email]) expect(screen.getByText(t)).toBeInTheDocument();
  });

  it('the owner (isMailOwner): the row with the ID, the Copy button and the hint', async () => {
    serverIs(ownedInfo, ownedInfo, settingsOf(true));
    renderWithProviders(<AccountSection />, { auth: 'authenticated', user: owner, locale: 'en' });

    const list = screen.getByLabelText(ST.account);
    expect(await within(list).findByTestId('account-id')).toHaveTextContent(/^u_0123456789abcdef$/);
    const term = within(list).getByText(ST.accountId);
    expect(term.tagName).toBe('DT');
    expect(list.querySelectorAll('dt')).toHaveLength(5);
    expect(list.querySelectorAll('dt')[4]).toBe(term);
    expect(within(list).getByRole('button', { name: ST.copyAccountId })).toHaveTextContent(ST.copy);
    expect(within(list).getByText(ST.accountIdHint)).toHaveClass('text-muted');
    expect(api.server.getSettings).toHaveBeenCalledTimes(1);
  });

  it('a refused or failed settings request keeps the row hidden and shows no error in the card', async () => {
    serverIs(ownedInfo);
    let fail!: (e: unknown) => void;
    vi.mocked(api.server.getSettings).mockReturnValue(new Promise<ServerSettings>((_resolve, reject) => (fail = reject)));
    renderWithProviders(<AccountSection />, { auth: 'authenticated', user: owner, locale: 'en' });

    await waitFor(() => expect(api.server.getSettings).toHaveBeenCalledTimes(1));
    await act(async () => fail(new Error('Forbidden (fictional 403)')));
    await settle();
    expectNoAccountIdRow();
    expectNoErrorShown();
    expect(document.body).not.toHaveTextContent('Forbidden');
  });

  it('a failed server info request keeps the row hidden, asks nothing else and shows no error', async () => {
    serverIs(ownedInfo, ownedInfo, settingsOf(true));
    vi.mocked(api.server.info).mockRejectedValue(new Error('Unreachable (fictional)'));
    renderWithProviders(<AccountSection />, { auth: 'authenticated', user: owner, locale: 'en' });
    await waitFor(() => expect(api.server.info).toHaveBeenCalledTimes(1));
    await settle();
    expectNoAccountIdRow();
    expectNoErrorShown();
    expect(api.server.getSettings).not.toHaveBeenCalled();
  });

  it('an older hosted server that does not say whether an owner is configured: a regular user sees no row', async () => {
    serverIs(hostedInfo, hostedInfo, settingsOf(false));
    renderWithProviders(<AccountSection />, { auth: 'authenticated', user: owner, locale: 'en' });

    await waitFor(() => expect(api.server.getSettings).toHaveBeenCalledTimes(1));
    await settle();
    expectNoAccountIdRow();
    expectNoErrorShown();
  });

  it('an older hosted server that does not say whether an owner is configured: the owner sees the row', async () => {
    serverIs(hostedInfo, hostedInfo, settingsOf(true));
    expect(hostedInfo).not.toHaveProperty('ownerConfigured');
    renderWithProviders(<AccountSection />, { auth: 'authenticated', user: owner, locale: 'en' });

    const list = screen.getByLabelText(ST.account);
    expect(await within(list).findByTestId('account-id')).toHaveTextContent(/^u_0123456789abcdef$/);
    expect(within(list).getByText(ST.accountId).tagName).toBe('DT');
    expect(within(list).getByRole('button', { name: ST.copyAccountId })).toBeInTheDocument();
    expect(within(list).getByText(ST.accountIdHint)).toBeInTheDocument();
    expect(api.server.getSettings).toHaveBeenCalledTimes(1);
  });
});

describe('Account card - a client that started before the owner was configured (stale start-up probe)', () => {
  it('a regular user sees no row once the server has its owner, although the store still says bootstrap - nothing flashes meanwhile', async () => {
    // The start-up probe ran during bootstrap; the owner set DIARY_OWNER_ID and the machine restarted
    // since, while this app (a remembered session) stayed open.
    serverIs(bootstrapInfo, ownedInfo, settingsOf(false));
    let infoNow!: (i: ServerInfo) => void;
    vi.mocked(api.server.info).mockReturnValue(new Promise<ServerInfo>((resolve) => (infoNow = resolve)));
    renderWithProviders(<AccountSection />, { auth: 'authenticated', user: owner, locale: 'en' });

    // While the server has not answered on this visit, the stale "no owner yet" shows nothing.
    await waitFor(() => expect(api.server.info).toHaveBeenCalledTimes(1));
    expectNoAccountIdRow();
    await act(async () => infoNow({ ...ownedInfo }));
    await settle();
    expectNoAccountIdRow();
    expectNoErrorShown();
    expect(api.server.getSettings).toHaveBeenCalledTimes(1);
  });

  it('the configured owner still sees his row in the same situation', async () => {
    serverIs(bootstrapInfo, ownedInfo, settingsOf(true));
    renderWithProviders(<AccountSection />, { auth: 'authenticated', user: owner, locale: 'en' });
    expect(await screen.findByTestId('account-id')).toHaveTextContent('u_0123456789abcdef');
  });

  it('the other way round: a store that still says "owned" does not hide the row once the server is back to no owner', async () => {
    // e.g. the owner's account was deleted, or the variable unset: the would-be owner must read his id again.
    serverIs(ownedInfo, bootstrapInfo, settingsOf(false));
    renderWithProviders(<AccountSection />, { auth: 'authenticated', user: owner, locale: 'en' });
    expect(await screen.findByTestId('account-id')).toHaveTextContent('u_0123456789abcdef');
  });

  it('asks the server again on the next visit of the card (the answer is not kept after it unmounts)', async () => {
    serverIs(bootstrapInfo);
    const first = renderWithProviders(<AccountSection />, { auth: 'authenticated', user: owner, locale: 'en' });
    expect(await screen.findByTestId('account-id')).toBeInTheDocument();
    first.unmount();

    // Meanwhile the owner was configured; the store is still the start-up probe's.
    vi.mocked(api.server.info).mockResolvedValue({ ...ownedInfo });
    renderWithProviders(<AccountSection />, { auth: 'authenticated', user: owner, locale: 'en' });
    await waitFor(() => expect(api.server.info).toHaveBeenCalledTimes(2));
    await settle();
    expectNoAccountIdRow();
    expect(api.server.getSettings).toHaveBeenCalledTimes(2);
  });
});

describe('Account card next to the Mail card - one shared read of the server', () => {
  it('the owner: the row and the Mail card from ONE GET /api/server/info and ONE GET /api/server/settings', async () => {
    serverIs(ownedInfo, ownedInfo, settingsOf(true));
    renderWithProviders(
      <>
        <AccountSection />
        <MailSection />
      </>,
      { auth: 'authenticated', user: owner, locale: 'en' },
    );
    expect(await screen.findByTestId('account-id')).toHaveTextContent('u_0123456789abcdef');
    expect(await screen.findByRole('heading', { level: 2, name: MT.title })).toBeInTheDocument();
    await settle();
    expect(api.server.info).toHaveBeenCalledTimes(1);
    expect(api.server.getSettings).toHaveBeenCalledTimes(1);
  });

  it('a regular user: no row, no Mail card, no error - and still one request of each', async () => {
    serverIs(ownedInfo, ownedInfo, settingsOf(false));
    renderWithProviders(
      <>
        <AccountSection />
        <MailSection />
      </>,
      { auth: 'authenticated', user: owner, locale: 'en' },
    );
    await waitFor(() => expect(api.server.getSettings).toHaveBeenCalledTimes(1));
    await settle();
    expectNoAccountIdRow();
    expect(screen.queryByRole('heading', { name: MT.title })).not.toBeInTheDocument();
    expectNoErrorShown();
    expect(api.server.info).toHaveBeenCalledTimes(1);
    expect(api.server.getSettings).toHaveBeenCalledTimes(1);
  });

  it('a settings request refused for a regular user hides the row but lets the Mail card try (its own 403 decides), as before', async () => {
    serverIs(ownedInfo);
    vi.mocked(api.server.getSettings).mockRejectedValue(new Error('Forbidden (fictional 403)'));
    vi.mocked(api.server.mail.get).mockClear();
    renderWithProviders(
      <>
        <AccountSection />
        <MailSection />
      </>,
      { auth: 'authenticated', user: owner, locale: 'en' },
    );
    await waitFor(() => expect(api.server.mail.get).toHaveBeenCalledTimes(1));
    await settle();
    expectNoAccountIdRow();
    expect(api.server.getSettings).toHaveBeenCalledTimes(1);
  });
});

describe('Account card - a local server', () => {
  it('shows no account ID row and no Copy button (the card is unchanged), and never asks the server', async () => {
    serverIs(localInfo, localInfo, settingsOf(true));
    renderWithProviders(<AccountSection />, { auth: 'authenticated', user: owner, locale: 'en' });
    expectNoAccountIdRow();
    await settle();
    expectNoAccountIdRow();
    expect(api.server.info).not.toHaveBeenCalled();
    expect(api.server.getSettings).not.toHaveBeenCalled();
  });

  it('shows no account ID row while the server has not described itself yet', async () => {
    renderWithProviders(<AccountSection />, { auth: 'authenticated', user: owner, locale: 'en' });
    expect(screen.getByLabelText(ST.account).querySelectorAll('dt')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: ST.copyAccountId })).not.toBeInTheDocument();
    await settle();
    expect(api.server.info).not.toHaveBeenCalled();
    expect(api.server.getSettings).not.toHaveBeenCalled();
  });
});
