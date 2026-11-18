/**
 * The owner's "Server" card (docs/android-tasks/SERVER-CARD.md item 1): shown only with the hosted
 * server and only to its owner (`isServerOwner === true` - absent on local and older servers, false for
 * everyone else and a guest; a 403 hides it too); the status (version, uptime, accounts, registrations,
 * disk with the low-space warning, how many users the disk is enough for - the server's estimate with
 * grouped numbers of two significant digits, how it is made in the server's own numbers, a gentle note
 * only while the account ceiling is above it -, the account ceiling grouped like the rest, saving,
 * last save, memory, last archive with the 30-day reminder), read on open and with Refresh only;
 * "Prepare server archive" (password + passphrase twice, checked like the server checks them; the
 * server's answers shown at the right field); the archive list with the exact download and check
 * commands and their Copy buttons; English and Hebrew (RTL).
 */
import { useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { SERVER_ARCHIVE_PASSPHRASE_MIN, type ServerCapacity, type ServerInfo, type ServerSettings, type ServerStatus } from '@shared/types';
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
  capacityCount,
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

  it('shows the capacity counts with two significant digits from 100 on - a lower bound rounded down', () => {
    // After "About": the nearest (production's 2,842 -> 2,800; 20 GiB's 2,901 -> 2,900).
    expect([0, 1, 2, 43, 99, 100, 109, 435, 999, 2_842, 2_901, 5_684, 12_345].map((n) => capacityCount(n))).toEqual([
      0, 1, 2, 43, 99, 100, 110, 440, 1_000, 2_800, 2_900, 5_700, 12_000,
    ]);
    // "at least": never above the exact count (284 -> 280, 568 -> 560), so it stays true.
    expect([0, 43, 99, 109, 284, 290, 568, 999, 2_842].map((n) => capacityCount(n, true))).toEqual([0, 43, 99, 100, 280, 290, 560, 990, 2_800]);
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
    expect(valueOf(SVT.accounts)).toBe(SVT.accountsValue('12', '100'));
    expect(valueOf(SVT.accounts)).toBe('12 of at most 100');
    expect(valueOf(SVT.registrations)).toBe('2');
    expect(valueOf(SVT.disk)).toBe(SVT.diskValue('1 GB', '2 GB', '66%'));
    expect(valueOf(SVT.storage)).toContain(SVT.storageOk);
    expect(valueOf(SVT.lastSave)).not.toBe('');
    expect(valueOf(SVT.memory)).toBe(formatServerBytes(120 * 1024 * 1024));
    expect(valueOf(SVT.lastArchive)).toBe(SVT.noArchive);
    // No archive yet: the reminder, and no warnings about the disk or saving.
    expect(within(card()).getByText(SVT.archiveDueNone)).toBeInTheDocument();
    expect(within(card()).queryByText(SVT.storageAlert)).not.toBeInTheDocument();
    expect(within(card()).queryByText(/Enlarge the disk soon/)).not.toBeInTheDocument();
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

  describe('how many users the disk is enough for (capacity)', () => {
    /** The model's answer for a 20 GiB volume (server/test/hosted-capacity.test.ts): 4 diaries of 92 KB on average, each account 6 x 1 MiB. */
    const CAPACITY_20_GIB: ServerCapacity = {
      usableBytes: 18_253_611_008,
      averageDiaryBytes: 92 * 1024,
      diaries: 4,
      perUserTypicalBytes: 6 * 1024 * 1024,
      usersTypical: 2_901,
      usersAtQuota: 290,
      countedDiaryBytes: 1024 * 1024,
      copies: 6,
      keptFreePct: 15,
    };
    /** Production on 2026-11-13: the size its statfs reports (20,545,068 KiB) gives 2,842 and 284. */
    const CAPACITY_PRODUCTION: ServerCapacity = { ...CAPACITY_20_GIB, usableBytes: 17_882_427_187, usersTypical: 2_842, usersAtQuota: 284 };
    /** A 20 GiB server whose account ceiling (2,000) is below the estimate. */
    const volume20 = (overrides: Parameters<typeof serverStatusFixture>[0] = {}) =>
      serverStatusFixture({
        accounts: 4,
        maxAccounts: 2000,
        disk: { totalBytes: 20 * 1024 ** 3, freeBytes: 19 * 1024 ** 3, freePct: 95 },
        capacity: CAPACITY_20_GIB,
        ...overrides,
      });
    /** The parts of the "Enough for" row's value. */
    function capacityRow(term = SVT.capacity) {
      const dd = within(card()).getByText(term, { selector: 'dt' }).nextElementSibling as HTMLElement;
      return {
        value: dd.querySelector('.server-card__capacity')?.textContent ?? null,
        hint: dd.querySelector('.server-card__capacity-hint')?.textContent ?? null,
        note: dd.querySelector('.server-card__capacity-note')?.textContent ?? null,
      };
    }

    it('English: right after the disk, with grouped numbers, the quota and one line on how it is estimated - no note under the ceiling', async () => {
      vi.mocked(api.server.status).mockResolvedValue(volume20());
      renderCard();
      await within(await waitFor(card)).findByText(SVT.capacity, { selector: 'dt' });
      const terms = within(card()).getAllByRole('term').map((dt) => dt.textContent);
      expect(terms.indexOf(SVT.capacity)).toBe(terms.indexOf(SVT.disk) + 1);
      expect(capacityRow()).toEqual({
        value: 'About 2,900 users (writing every day for two to three years); at least 290 even if every diary fills its 10.0 MB quota',
        hint: 'How it is estimated: each account takes about 6 times its diary on the disk (the diary and its safety copy, and both again in each of the two server archives), 15% of the disk stays free, and a diary counts as 1.0 MB. Today the average diary is 92.0 KB.',
        note: null,
      });
      expect(capacityRow().value).toBe(SVT.capacityValue(2900, '2,900', '290', formatServerBytes(10 * 1024 * 1024)));
      // An estimate, not a warning: no alert box of the card says anything about it.
      for (const alert of card().querySelectorAll('.alert')) expect(alert.textContent).not.toContain('2,900');
    });

    it('Hebrew: the same row in Hebrew, the numbers grouped', async () => {
      vi.mocked(api.server.status).mockResolvedValue(volume20());
      renderCard('he');
      const heading = await screen.findByRole('heading', { level: 2, name: he('settings.server.title') });
      await within(heading.closest('section') as HTMLElement).findByText('מספיק עבור', { selector: 'dt' });
      expect(capacityRow('מספיק עבור')).toEqual({
        value: 'בערך 2,900 משתמשים (שכותבים כל יום במשך שנתיים-שלוש); לפחות 290 גם אם כל יומן יתמלא עד המכסה של 10.0 MB',
        hint: 'איך זה מחושב: כל חשבון תופס בדיסק בערך פי 6 מגודל היומן שלו (היומן ועותק הביטחון שלו, ושניהם שוב בכל אחד משני ארכיוני השרת), 15% מהדיסק נשארים פנויים, וכל יומן נספר כ-1.0 MB. גודל יומן ממוצע היום: 92.0 KB.',
        note: null,
      });
    });

    it('production (ceiling 5000 above the 2,842 estimate): rounded counts, the note, and the ceiling grouped the same in both rows', async () => {
      vi.mocked(api.server.status).mockResolvedValue(volume20({ maxAccounts: 5000, capacity: CAPACITY_PRODUCTION }));
      renderCard();
      await within(await waitFor(card)).findByText(SVT.capacity, { selector: 'dt' });
      expect(capacityRow()).toMatchObject({
        // 2,842 to the nearest two digits; the lower bound 284 rounded down, so "at least" stays true.
        value: 'About 2,800 users (writing every day for two to three years); at least 280 even if every diary fills its 10.0 MB quota',
        note: 'The account limit (5,000) is higher than this estimate. Before the number of accounts gets close to the estimate, enlarge the disk ("Disk size", below) or lower DIARY_MAX_ACCOUNTS (see the runbook).',
      });
      expect(valueOf(SVT.accounts)).toBe('4 of at most 5,000');
      // The note is plain text, not a warning box.
      for (const alert of card().querySelectorAll('.alert')) expect(alert.textContent).not.toContain('5,000');
    });

    it('a gentle note only while the account ceiling is above the exact estimate', async () => {
      vi.mocked(api.server.status).mockResolvedValue(volume20({ maxAccounts: 6000 }));
      const { user } = renderCard();
      await within(await waitFor(card)).findByText(SVT.capacity, { selector: 'dt' });
      expect(capacityRow().note).toBe(
        'The account limit (6,000) is higher than this estimate. Before the number of accounts gets close to the estimate, enlarge the disk ("Disk size", below) or lower DIARY_MAX_ACCOUNTS (see the runbook).',
      );
      expect(valueOf(SVT.accounts)).toBe('4 of at most 6,000');
      // More accounts than the quota estimate (290) is nothing alarming either: no extra text for it.
      expect(within(card()).queryByText(/Enlarge the disk soon/)).not.toBeInTheDocument();
      // A ceiling equal to the exact estimate (2,901), below it or no new accounts at all (0): no note.
      const accountsText: Record<number, string> = { 2901: '700 of at most 2,901', 2000: '700 of at most 2,000', 0: '700' };
      for (const maxAccounts of [2901, 2000, 0]) {
        vi.mocked(api.server.status).mockResolvedValueOnce(volume20({ maxAccounts, accounts: 700 }));
        await user.click(within(card()).getByRole('button', { name: SVT.refresh }));
        await waitFor(() => expect(valueOf(SVT.accounts)).toBe(accountsText[maxAccounts]));
        expect({ maxAccounts, note: capacityRow().note }).toEqual({ maxAccounts, note: null });
      }
    });

    it('explains the estimate with the server\'s own numbers, not the app\'s constants', async () => {
      // A server with another model (say 3 archives: 8 copies, 10 % kept free) and diaries of 2 MiB on average.
      const other: ServerCapacity = {
        ...CAPACITY_20_GIB,
        averageDiaryBytes: 2 * 1024 * 1024,
        countedDiaryBytes: 2 * 1024 * 1024,
        copies: 8,
        keptFreePct: 10,
        perUserTypicalBytes: 16 * 1024 * 1024,
        usersTypical: 1_152,
        usersAtQuota: 230,
      };
      vi.mocked(api.server.status).mockResolvedValue(volume20({ capacity: other }));
      renderCard();
      await within(await waitFor(card)).findByText(SVT.capacity, { selector: 'dt' });
      expect(capacityRow()).toMatchObject({
        value: 'About 1,200 users (writing every day for two to three years); at least 230 even if every diary fills its 10.0 MB quota',
        hint: SVT.capacityHint(8, '10%', '2.0 MB', '2.0 MB'),
      });
      expect(capacityRow().hint).toContain('about 8 times its diary');
      expect(capacityRow().hint).toContain('10% of the disk stays free, and a diary counts as 2.0 MB');
    });

    it('without a quota only the typical estimate; without diaries the hint says so', async () => {
      vi.mocked(api.server.status).mockResolvedValue(
        volume20({ maxDiaryBytes: 0, capacity: { ...CAPACITY_20_GIB, usersAtQuota: null, averageDiaryBytes: null, diaries: 0 } }),
      );
      renderCard();
      await within(await waitFor(card)).findByText(SVT.capacity, { selector: 'dt' });
      expect(capacityRow()).toEqual({
        value: 'About 2,900 users (writing every day for two to three years)',
        hint: 'How it is estimated: each account takes about 6 times its diary on the disk (the diary and its safety copy, and both again in each of the two server archives), 15% of the disk stays free, and a diary counts as 1.0 MB. There are no diaries yet.',
        note: null,
      });
    });

    it('no row when the disk could not be measured (capacity null) or the server does not send it (older server)', async () => {
      vi.mocked(api.server.status).mockResolvedValue(serverStatusFixture({ disk: null, capacity: null }));
      const { user } = renderCard();
      await within(await waitFor(card)).findByText(SVT.version, { selector: 'dt' });
      expect(within(card()).queryByText(SVT.capacity, { selector: 'dt' })).not.toBeInTheDocument();
      const { capacity: _left, ...older } = serverStatusFixture({ accounts: 13 });
      vi.mocked(api.server.status).mockResolvedValueOnce(older as ServerStatus);
      await user.click(within(card()).getByRole('button', { name: SVT.refresh }));
      await waitFor(() => expect(valueOf(SVT.accounts)).toBe(SVT.accountsValue('13', '100')));
      expect(within(card()).queryByText(SVT.capacity, { selector: 'dt' })).not.toBeInTheDocument();
      // The default fixture (3 GiB: 435 and 43) has it, below the disk; 435 shows as "About 440", 43 exactly.
      vi.mocked(api.server.status).mockResolvedValueOnce(serverStatusFixture());
      await user.click(within(card()).getByRole('button', { name: SVT.refresh }));
      expect(await within(card()).findByText(SVT.capacity, { selector: 'dt' })).toBeInTheDocument();
      expect(capacityRow().value).toBe('About 440 users (writing every day for two to three years); at least 43 even if every diary fills its 10.0 MB quota');
    });
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
      await waitFor(() => expect(valueOf(SVT.accounts)).toBe(SVT.accountsValue('13', '100')));
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
    const capacityKeys = keys.filter((k) => k.startsWith('settings.server.capacity'));
    expect(capacityKeys).toHaveLength(6);
    for (const code of LOCALE_CODES) {
      for (const key of keys) expect(hasMessage(code, key), `${code} ${key}`).toBe(true);
      if (code !== 'en') {
        expect(getCatalog(code)['settings.server.intro']).toContain('Your Personal Diary');
        expect(getCatalog(code)['settings.server.archive.passphraseWarning']).not.toBe(getCatalog('en')['settings.server.archive.passphraseWarning']);
      }
      // "Enough for": translated, and every number comes from the formatters (none is written into the text).
      for (const key of capacityKeys) {
        if (code !== 'en') expect(getCatalog(code)[key], `${code} ${key}`).not.toBe(getCatalog('en')[key]);
        expect(getCatalog(code)[key], `${code} ${key}`).not.toMatch(/\d/);
      }
    }
  });
});
