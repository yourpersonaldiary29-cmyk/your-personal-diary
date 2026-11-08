/**
 * The owner's "Server" card (docs/android-tasks/SERVER-CARD.md item 1): shown only with the hosted
 * server and only to its owner (`isServerOwner === true` - absent on local and older servers, false for
 * everyone else and a guest; a 403 hides it too); the status (version, uptime, accounts, registrations,
 * disk with the low-space warning, saving, last save, memory, last archive with the 30-day reminder),
 * read on open and with Refresh only; "Prepare server archive" (password + passphrase twice, checked
 * like the server checks them; the server's answers shown at the right field); the archive list with
 * the exact download and check commands and their Copy buttons; English and Hebrew (RTL).
 */
import { useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { SERVER_ARCHIVE_PASSPHRASE_MIN, type ServerInfo, type ServerSettings } from '@shared/types';
import * as api from '@/api';
import { __resetConnectionForTests, ApiClientError, setServerInfo } from '@/api';
import { T } from '@/constants/texts';
import { LockContext } from '@/context/LockContext';
import { trWith } from '@/i18n/runtime';
import SettingsPage from '@/pages/SettingsPage';
import { serverArchiveFixture, serverStatusFixture } from '@/test/api-mock';
import { assertiveRegion, politeRegion, renderWithProviders, sampleUser } from '@/test/render';
import * as platform from '@/utils/platform';
import {
  SERVER_PASSPHRASE_ID,
  SERVER_PASSPHRASE_REPEAT_ID,
  SERVER_PASSWORD_ID,
  SERVER_PREPARE_BUTTON_ID,
  SERVER_READY_ID,
  ServerSection,
  archiveFormErrors,
  passphraseLength,
} from './ServerSection';
import { SVT, formatServerBytes, formatUptime } from './serverTexts';

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
const he = trWith('he');

const PASSWORD = 'Passw0rd!';
const PASSPHRASE = 'correct horse battery staple';

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
  registration: 'invite',
  guestTour: true,
  ownerConfigured: true,
};

/** GET /api/server/settings of the hosted server's owner. */
const ownerSettings: ServerSettings = { port: 8080, lanEnabled: false, isRemoteOwner: false, isMailOwner: true, isLanOwner: false, isServerOwner: true };

/** Lock provider with real state, so a test can lock the app (Ctrl+L) while the form is open. */
let lockApp: () => void = () => {};
function StatefulLock({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(false);
  lockApp = () => setLocked(true);
  return <LockContext.Provider value={{ locked, restoredLocked: false, lock: () => setLocked(true), unlock: () => setLocked(false) }}>{children}</LockContext.Provider>;
}

function renderCard(locale: 'en' | 'he' = 'en') {
  return renderWithProviders(
    <StatefulLock>
      <ServerSection />
    </StatefulLock>,
    { auth: 'authenticated', user: sampleUser, locale },
  );
}

const card = () => screen.getByRole('heading', { level: 2, name: SVT.title }).closest('section') as HTMLElement;
const byId = (id: string) => document.getElementById(id) as HTMLInputElement;
/** Lets every pending answer and the renders after it settle. */
const settle = () => act(async () => new Promise<void>((r) => setTimeout(r, 20)));
/** The value next to a term of the status list. */
function valueOf(term: string): string {
  const dt = within(card()).getAllByText(term, { selector: 'dt' })[0];
  return (dt.nextElementSibling as HTMLElement).textContent ?? '';
}

beforeEach(() => {
  __resetConnectionForTests();
  setServerInfo({ ...hostedInfo });
  vi.mocked(platform.isTauri).mockReturnValue(false);
  vi.mocked(api.server.info).mockReset().mockResolvedValue({ ...hostedInfo });
  vi.mocked(api.server.getSettings).mockReset().mockResolvedValue({ ...ownerSettings });
  vi.mocked(api.server.status).mockReset().mockResolvedValue(serverStatusFixture());
  vi.mocked(api.server.archive).mockReset();
  vi.mocked(api.auth.sessions).mockReset().mockResolvedValue([]);
});

afterEach(() => {
  __resetConnectionForTests();
});

describe('helpers', () => {
  it('counts a passphrase as the server does (NFKC, code points) and checks the form like the server', () => {
    expect(passphraseLength('abc')).toBe(3);
    expect(passphraseLength('😀😀')).toBe(2);
    // NFKC: the ligature "ﬁ" is two characters for the server.
    expect(passphraseLength('ﬁ')).toBe(2);
    const twelve = 'a'.repeat(SERVER_ARCHIVE_PASSPHRASE_MIN);
    expect(archiveFormErrors('', twelve, twelve)).toEqual({ password: SVT.passwordMissing });
    expect(archiveFormErrors(PASSWORD, twelve.slice(1), twelve.slice(1))).toEqual({ passphrase: SVT.passphraseShort(12) });
    expect(archiveFormErrors(PASSWORD, 'b'.repeat(1025), 'b'.repeat(1025))).toEqual({ passphrase: SVT.passphraseLong(1024) });
    expect(archiveFormErrors(PASSWORD, twelve, `${twelve}x`)).toEqual({ repeat: SVT.passphraseMismatch });
    expect(archiveFormErrors(PASSWORD, twelve, twelve)).toEqual({});
  });

  it('formats uptime and sizes in the current language', () => {
    expect(en('settings.server.gigabytes', { value: '2.5' })).toBe('2.5 GB');
    expect(formatServerBytes(2.5 * 1024 ** 3)).toMatch(/2[.,]5/);
    expect(formatServerBytes(5 * 1024 * 1024)).toMatch(/^5 MB$|5/);
    expect(formatUptime(45 * 60)).toMatch(/45/);
    expect(formatUptime(3 * 86_400 + 7200)).toMatch(/3/);
  });
});

describe('who sees the Server card', () => {
  it('the hosted server\'s owner gets it on the Settings page, with one status read and no extra owner read', async () => {
    renderWithProviders(<SettingsPage />, { auth: 'authenticated', user: sampleUser, locale: 'en' });
    expect(await screen.findByRole('heading', { level: 2, name: SVT.title })).toBeInTheDocument();
    await waitFor(() => expect(api.server.status).toHaveBeenCalledTimes(1));
    await settle();
    // The card rides on the Mail card's read of the owner flags (the Remote card asks its own, as before).
    expect(api.server.info).toHaveBeenCalledTimes(2);
    expect(api.server.getSettings).toHaveBeenCalledTimes(2);
    expect(api.server.archive).not.toHaveBeenCalled();
  });

  it.each([
    ['another account of the hosted server', { ...ownerSettings, isMailOwner: false, isServerOwner: false }, hostedInfo],
    ['an older hosted server that does not send the flag', { ...ownerSettings, isServerOwner: undefined }, hostedInfo],
    ['a local server (even with the flag)', { ...ownerSettings }, { ...hostedInfo, mode: undefined, publicUrl: undefined, isLocalRequest: true }],
  ])('%s: no card, and the status is never asked', async (_label, settings, info) => {
    if (info.mode !== 'hosted') setServerInfo({ ...info });
    vi.mocked(api.server.info).mockResolvedValue({ ...info });
    vi.mocked(api.server.getSettings).mockResolvedValue(settings);
    renderWithProviders(<SettingsPage />, { auth: 'authenticated', user: sampleUser, locale: 'en' });
    await screen.findByRole('heading', { level: 2, name: en('settings.reminders.title') });
    await settle();
    expect(screen.queryByRole('heading', { level: 2, name: SVT.title })).not.toBeInTheDocument();
    expect(api.server.status).not.toHaveBeenCalled();
  });

  it('a guest of the tour never gets it', async () => {
    const guest = { ...sampleUser, id: 'g_1', username: '_guest_1', firstName: '', lastName: '', email: '', guest: true };
    renderWithProviders(<SettingsPage />, { auth: 'authenticated', user: guest, locale: 'en' });
    await screen.findByRole('heading', { level: 2, name: en('settings.reminders.title') });
    await settle();
    expect(screen.queryByRole('heading', { level: 2, name: SVT.title })).not.toBeInTheDocument();
    expect(api.server.status).not.toHaveBeenCalled();
  });

  it('a 403 from the status route hides the card (the owner changed meanwhile)', async () => {
    vi.mocked(api.server.status).mockRejectedValue(new ApiClientError(403, { code: 'FORBIDDEN', message: 'This action is not allowed' }));
    renderCard();
    await waitFor(() => expect(api.server.status).toHaveBeenCalled());
    await settle();
    expect(screen.queryByRole('heading', { level: 2, name: SVT.title })).not.toBeInTheDocument();
  });

  it('a lost connection shows the error in the card with Refresh', async () => {
    const lost = 'No connection to the diary server.';
    vi.mocked(api.server.status).mockRejectedValueOnce(new ApiClientError(0, { code: 'OTHER', message: lost }));
    const { user } = renderCard();
    expect(await within(await waitFor(card)).findByText(lost)).toBeInTheDocument();
    await user.click(within(card()).getByRole('button', { name: SVT.refresh }));
    expect(await within(card()).findByText(SVT.version, { selector: 'dt' })).toBeInTheDocument();
  });
});

describe('the status', () => {
  it('shows version, uptime, accounts, registrations, disk, saving, last save, memory and last archive', async () => {
    renderCard();
    await within(await screen.findByRole('heading', { level: 2, name: SVT.title }).then(() => card())).findByText(SVT.version, { selector: 'dt' });
    expect(valueOf(SVT.version)).toBe('0.1.0');
    expect(valueOf(SVT.uptime)).toBe(formatUptime(3 * 86_400 + 2 * 3600));
    expect(valueOf(SVT.accounts)).toBe(SVT.accountsValue(12, 100));
    expect(valueOf(SVT.registrations)).toBe('2');
    expect(valueOf(SVT.disk)).toBe(SVT.diskValue('1 GB', '2 GB', '66%'));
    expect(valueOf(SVT.storage)).toContain(SVT.storageOk);
    expect(valueOf(SVT.lastSave)).not.toBe('');
    expect(valueOf(SVT.memory)).toBe(formatServerBytes(120 * 1024 * 1024));
    expect(valueOf(SVT.lastArchive)).toBe(SVT.noArchive);
    // No archive yet: the reminder, and no warnings about the disk or saving.
    expect(within(card()).getByText(SVT.archiveDueNone)).toBeInTheDocument();
    expect(within(card()).queryByText(SVT.storageAlert)).not.toBeInTheDocument();
    expect(within(card()).queryByText(/fly volumes extend/)).not.toBeInTheDocument();
    // The passphrase warning is always next to the archive button.
    expect(within(card()).getByText(SVT.passphraseWarning)).toBeInTheDocument();
    expect(within(card()).getByRole('button', { name: SVT.prepare })).toBeInTheDocument();
  });

  it('warns clearly under 15% free disk, when saving fails, and when the last archive is older than 30 days', async () => {
    vi.mocked(api.server.status).mockResolvedValue(
      serverStatusFixture({
        disk: { totalBytes: 3 * 1024 ** 3, freeBytes: 300 * 1024 * 1024, freePct: 9 },
        diskLow: true,
        storageOk: false,
        lastPersistErrorAt: '2026-10-23T08:00:00.000Z',
        archives: [serverArchiveFixture()],
        lastArchiveAt: '2026-10-01T09:30:00.000Z',
        archiveDue: true,
      }),
    );
    renderCard();
    expect(await within(await waitFor(card)).findByText(SVT.diskLow('9%'))).toBeInTheDocument();
    expect(within(card()).getByText(SVT.storageAlert)).toBeInTheDocument();
    expect(valueOf(SVT.storage)).toContain(SVT.storageFailed);
    expect(within(card()).getByText(SVT.archiveDueOld(30))).toBeInTheDocument();
    expect(SVT.archiveDueOld(30)).toContain('30');
  });

  it('reads the status on open and with Refresh only (no polling), and announces the refresh', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { user } = renderCard();
      await within(await waitFor(card)).findByText(SVT.version, { selector: 'dt' });
      expect(api.server.status).toHaveBeenCalledTimes(1);
      await act(async () => {
        vi.advanceTimersByTime(10 * 60_000);
      });
      expect(api.server.status).toHaveBeenCalledTimes(1);
      vi.mocked(api.server.status).mockResolvedValueOnce(serverStatusFixture({ accounts: 13 }));
      await user.click(within(card()).getByRole('button', { name: SVT.refresh }));
      await waitFor(() => expect(valueOf(SVT.accounts)).toBe(SVT.accountsValue(13, 100)));
      expect(api.server.status).toHaveBeenCalledTimes(2);
      await waitFor(() => expect(politeRegion()).toHaveTextContent(SVT.refreshed));
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('preparing a server archive', () => {
  async function openForm() {
    const rendered = renderCard();
    const button = await within(await waitFor(card)).findByRole('button', { name: SVT.prepare });
    await rendered.user.click(button);
    await waitFor(() => expect(byId(SERVER_PASSWORD_ID)).toHaveFocus());
    return rendered;
  }

  it('checks the form before asking the server: password, passphrase length, the second passphrase', async () => {
    const { user } = await openForm();
    await user.click(within(card()).getByRole('button', { name: SVT.submit }));
    expect(byId(SERVER_PASSWORD_ID)).toHaveAccessibleDescription(SVT.passwordMissing);
    expect(byId(SERVER_PASSWORD_ID)).toHaveFocus();
    expect(byId(SERVER_PASSPHRASE_ID)).toHaveAccessibleDescription(new RegExp(SVT.passphraseShort(12).replace('.', '\\.')));
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(T.fixErrors(2)));

    await user.type(byId(SERVER_PASSWORD_ID), PASSWORD);
    await user.type(byId(SERVER_PASSPHRASE_ID), PASSPHRASE);
    await user.type(byId(SERVER_PASSPHRASE_REPEAT_ID), `${PASSPHRASE}!`);
    await user.click(within(card()).getByRole('button', { name: SVT.submit }));
    expect(byId(SERVER_PASSPHRASE_REPEAT_ID)).toHaveAccessibleDescription(SVT.passphraseMismatch);
    expect(byId(SERVER_PASSPHRASE_REPEAT_ID)).toHaveFocus();
    expect(api.server.archive).not.toHaveBeenCalled();
    // The hint states the minimum, and nothing typed is offered to a password manager as this site's password.
    expect(byId(SERVER_PASSPHRASE_ID)).toHaveAccessibleDescription(new RegExp(SVT.passphraseHint(12).replace(/[.()]/g, '\\$&')));
    expect(byId(SERVER_PASSPHRASE_ID)).toHaveAttribute('autocomplete', 'off');
    expect(byId(SERVER_PASSPHRASE_REPEAT_ID)).toHaveAttribute('autocomplete', 'off');
  });

  it('prepares the archive and shows the exact download and check commands with Copy buttons', async () => {
    const made = serverArchiveFixture({
      fileName: 'your-personal-diary-server-2026-10-27T12-00-00Z.mpda',
      createdAt: '2026-10-27T12:00:00.000Z',
      sha256: 'cd'.repeat(32),
      sizeBytes: 6 * 1024 * 1024,
    });
    vi.mocked(api.server.archive).mockResolvedValue({ ...made, files: 7, dataBytes: 40 * 1024 * 1024, removed: [] });
    const { user } = await openForm();
    await user.type(byId(SERVER_PASSWORD_ID), PASSWORD);
    await user.type(byId(SERVER_PASSPHRASE_ID), PASSPHRASE);
    await user.type(byId(SERVER_PASSPHRASE_REPEAT_ID), PASSPHRASE);
    await user.click(within(card()).getByRole('button', { name: SVT.submit }));

    await waitFor(() => expect(api.server.archive).toHaveBeenCalledWith({ password: PASSWORD, passphrase: PASSPHRASE }));
    const ready = await within(card()).findByText(SVT.ready(made.fileName, formatServerBytes(6 * 1024 * 1024)));
    await waitFor(() => expect(byId(SERVER_READY_ID)).toHaveFocus());
    expect(ready).toBeInTheDocument();
    await waitFor(() => expect(politeRegion()).toHaveTextContent(SVT.ready(made.fileName, formatServerBytes(6 * 1024 * 1024))));
    // The form is gone with what was typed; the list shows the new archive with its commands.
    expect(byId(SERVER_PASSWORD_ID)).toBeNull();
    const command = `C:\\Users\\AVI\\.fly\\bin\\flyctl.exe ssh sftp get /data/archive/${made.fileName} .\\${made.fileName} -a yourpersonaldiary`;
    const check = `(Get-FileHash .\\${made.fileName} -Algorithm SHA256).Hash -eq '${'cd'.repeat(32)}'`;
    expect(within(card()).getByText(command)).toBeInTheDocument();
    expect(within(card()).getByText(check)).toBeInTheDocument();
    expect(within(card()).getByText(command).closest('pre')).toHaveAttribute('dir', 'ltr');
    // Each command is a named group: its label, the command and its Copy button.
    expect(within(card()).getByRole('group', { name: SVT.downloadCommand })).toContainElement(within(card()).getByText(command));
    expect(within(card()).getByRole('group', { name: SVT.checkCommand })).toContainElement(within(card()).getByRole('button', { name: SVT.copyCheck }));
    expect(within(card()).getByText('cd'.repeat(32))).toBeInTheDocument();
    expect(valueOf(SVT.lastArchive)).not.toBe(SVT.noArchive);
    expect(within(card()).queryByText(SVT.archiveDueNone)).not.toBeInTheDocument();
    // The next one is accepted in 10 minutes: the time is shown (no countdown, no polling).
    expect(within(card()).getByText(/^The next archive can be prepared from /)).toBeInTheDocument();
    expect(within(card()).getAllByRole('listitem').length).toBeGreaterThan(0);

    // Copy puts the exact command on the clipboard.
    await user.click(within(card()).getByRole('button', { name: SVT.copyDownload }));
    expect(await navigator.clipboard.readText()).toBe(command);
    await waitFor(() => expect(politeRegion()).toHaveTextContent(SVT.copied));
    await user.click(within(card()).getByRole('button', { name: SVT.copyCheck }));
    expect(await navigator.clipboard.readText()).toBe(check);
    // There is never a way to download the archive itself here.
    expect(within(card()).queryByRole('link')).not.toBeInTheDocument();
  });

  it('lists the archives on the server (at most 2), the newest first, with the download steps', async () => {
    const newer = serverArchiveFixture({ fileName: 'your-personal-diary-server-2026-10-20T10-00-00Z.mpda', createdAt: '2026-10-20T10:00:00.000Z' });
    const older = serverArchiveFixture({ sha256: null });
    vi.mocked(api.server.status).mockResolvedValue(serverStatusFixture({ archives: [newer, older], lastArchiveAt: newer.createdAt, archiveDue: false }));
    renderCard();
    const list = await within(await waitFor(card)).findByRole('list', { name: SVT.listTitle });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(newer.fileName);
    expect(items[1]).toHaveTextContent(older.fileName);
    // Without a checksum there is no check command for that archive (and the hash shows "not reported").
    expect(within(items[1]).queryByRole('button', { name: SVT.copyCheck })).not.toBeInTheDocument();
    expect(within(items[0]).getByRole('button', { name: SVT.copyCheck })).toBeInTheDocument();
    const steps = within(card()).getByRole('list', { name: SVT.stepsTitle });
    expect(within(steps).getAllByRole('listitem').map((li) => li.textContent)).toEqual(SVT.steps());
    expect(within(card()).queryByText(SVT.archiveDueNone)).not.toBeInTheDocument();
  });

  it('a wrong password is shown at the password field (the session stays) and nothing else is lost', async () => {
    vi.mocked(api.server.archive).mockRejectedValue(
      new ApiClientError(400, { code: 'WRONG_PASSWORD', field: 'password', message: en('server.archive.wrongPassword') }),
    );
    const { user } = await openForm();
    await user.type(byId(SERVER_PASSWORD_ID), 'wrong');
    await user.type(byId(SERVER_PASSPHRASE_ID), PASSPHRASE);
    await user.type(byId(SERVER_PASSPHRASE_REPEAT_ID), PASSPHRASE);
    await user.click(within(card()).getByRole('button', { name: SVT.submit }));
    await waitFor(() => expect(byId(SERVER_PASSWORD_ID)).toHaveAccessibleDescription(en('server.archive.wrongPassword')));
    expect(byId(SERVER_PASSWORD_ID)).toHaveFocus();
    expect(byId(SERVER_PASSWORD_ID).value).toBe('');
    expect(byId(SERVER_PASSPHRASE_ID).value).toBe(PASSPHRASE);
  });

  it.each([
    ['too soon (429, Retry-After)', new ApiClientError(429, { code: 'FORBIDDEN', message: 'A server archive can be prepared once every 10 minutes.' }, { retryAfterSec: 300 })],
    ['no space (507)', new ApiClientError(507, { code: 'IO', message: 'There is not enough free space on the server for an archive.' })],
    ['the confirmation lockout (429)', new ApiClientError(429, { code: 'FORBIDDEN', message: 'Too many wrong passwords.' })],
  ])('%s: the server\'s message above the form, announced, the form kept', async (_label, error) => {
    vi.mocked(api.server.archive).mockRejectedValue(error);
    const { user } = await openForm();
    await user.type(byId(SERVER_PASSWORD_ID), PASSWORD);
    await user.type(byId(SERVER_PASSPHRASE_ID), PASSPHRASE);
    await user.type(byId(SERVER_PASSPHRASE_REPEAT_ID), PASSPHRASE);
    await user.click(within(card()).getByRole('button', { name: SVT.submit }));
    expect(await within(card()).findByText(error.message)).toBeInTheDocument();
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(error.message));
    expect(byId(SERVER_PASSWORD_ID)).not.toBeNull();
    // Still on the card (a 429 or 507 never hides it, unlike a 403 of the status read).
    expect(within(card()).getByRole('heading', { level: 3, name: SVT.archiveTitle })).toBeInTheDocument();
    if (error.retryAfterSec) expect(within(card()).getByText(/^The next archive can be prepared from /)).toBeInTheDocument();
  });

  it('Cancel and locking the app close the form and forget what was typed', async () => {
    const { user } = await openForm();
    await user.type(byId(SERVER_PASSWORD_ID), PASSWORD);
    await user.click(within(card()).getByRole('button', { name: T.cancel }));
    expect(byId(SERVER_PASSWORD_ID)).toBeNull();
    await waitFor(() => expect(byId(SERVER_PREPARE_BUTTON_ID)).toHaveFocus());
    await user.click(byId(SERVER_PREPARE_BUTTON_ID));
    expect(byId(SERVER_PASSWORD_ID).value).toBe('');
    await user.type(byId(SERVER_PASSPHRASE_ID), PASSPHRASE);
    act(() => lockApp());
    await waitFor(() => expect(byId(SERVER_PASSPHRASE_ID)).toBeNull());
  });
});

describe('languages', () => {
  it('Hebrew: the card in Hebrew, the commands left-to-right inside the right-to-left page', async () => {
    vi.mocked(api.server.status).mockResolvedValue(serverStatusFixture({ archives: [serverArchiveFixture()], archiveDue: false }));
    renderCard('he');
    const heading = await screen.findByRole('heading', { level: 2, name: he('settings.server.title') });
    expect(heading).toHaveTextContent('שרת');
    const section = heading.closest('section') as HTMLElement;
    expect(await within(section).findByText(he('settings.server.archive.passphraseWarning'))).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: he('settings.server.archive.prepare') })).toBeInTheDocument();
    const pre = section.querySelector('pre') as HTMLElement;
    expect(pre).toHaveAttribute('dir', 'ltr');
    expect(pre.textContent).toContain('flyctl.exe ssh sftp get /data/archive/');
    expect(section.querySelector('.server-card__file')).toHaveAttribute('dir', 'ltr');
  });

  it('every text of the card is translated in all 20 languages (no English fallback, the brand kept)', async () => {
    const { LOCALE_CODES, hasMessage, getCatalog } = await import('@shared/i18n');
    const keys = Object.keys(getCatalog('en')).filter((k) => k.startsWith('settings.server.'));
    expect(keys.length).toBeGreaterThan(50);
    for (const code of LOCALE_CODES) {
      for (const key of keys) expect(hasMessage(code, key), `${code} ${key}`).toBe(true);
      if (code !== 'en') {
        expect(getCatalog(code)['settings.server.intro']).toContain('Your Personal Diary');
        expect(getCatalog(code)['settings.server.archive.passphraseWarning']).not.toBe(getCatalog('en')['settings.server.archive.passphraseWarning']);
      }
    }
  });
});
