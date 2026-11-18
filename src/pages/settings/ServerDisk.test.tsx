/**
 * "Disk size" in the owner's Server card (ServerDisk.tsx, docs/server-tasks/SERVER-CARD-V2.md B3): the size
 * now, the use, the monthly cost and the changes left; "New size (GB)" - whole numbers from the size now
 * + 1 to the maximum - with the monthly cost of the typed size, "The disk can only grow; it cannot be made
 * smaller again.", the password and Enlarge; then the steps of the change as they happen (read every
 * DISK_POLL_MS while it is open, each new state announced), done or failed with the server's reason and
 * the e-mail line; "Restart the server now" with the password when the server must restart, read on
 * through the failed requests of the restart; when the button is not set up, the reason and the one
 * PowerShell line with Copy; the last changes. Fictional sizes, ids and times only; the API module is a
 * mock (no network).
 */
import { useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import type { ServerDiskChange, ServerDiskInfo, ServerDiskReason, ServerInfo, ServerSettings } from '@shared/types';
import * as api from '@/api';
import { __resetConnectionForTests, ApiClientError, setServerInfo } from '@/api';
import { T } from '@/constants/texts';
import { LockContext } from '@/context/LockContext';
import { trWith } from '@/i18n/runtime';
import { pinLocaleForTests } from '@/i18n/test-utils';
import { serverDiskChangeFixture, serverDiskFixture, serverDownloadsFixture, serverStatusFixture } from '@/test/api-mock';
import { assertiveRegion, politeRegion, renderWithProviders, sampleUser } from '@/test/render';
import { formatTimestamp } from '@/utils/dates';
import * as platform from '@/utils/platform';
import {
  DISK_COPY_SETUP_ID,
  DISK_EMAIL_POLLS,
  DISK_ENLARGE_ID,
  DISK_JOB_ID,
  DISK_PASSWORD_ID,
  DISK_POLL_MS,
  DISK_RESTART_ID,
  DISK_RESTART_PASSWORD_ID,
  DISK_SIZE_ID,
  changeAnnouncement,
  isOpenDiskState,
  newSizeError,
  parseSizeGb,
  stepsOf,
} from './ServerDisk';
import { ServerSection } from './ServerSection';
import { DKT, DLT, DRT, SVT, emailOutcome, formatUsd } from './serverTexts';

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
const PASSWORD = 'Passw0rd!';
const SETUP = 'powershell -NoProfile -ExecutionPolicy Bypass -File "C:\\Users\\AVI\\Projects\\my-personal-diary\\scripts\\hosted\\set-disk-key.ps1"';

const hostedInfo: ServerInfo = {
  version: '1.0.0',
  port: 8080,
  lanEnabled: false,
  lanUrls: [],
  dataDir: '',
  isLocalRequest: false,
  startedAt: '2026-11-18T08:00:00.000Z',
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
const ownerSettings: ServerSettings = { port: 8080, lanEnabled: false, isRemoteOwner: false, isMailOwner: true, isLanOwner: false, isServerOwner: true };

let lockApp: () => void = () => {};
function StatefulLock({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(false);
  lockApp = () => setLocked(true);
  return <LockContext.Provider value={{ locked, restoredLocked: false, lock: () => setLocked(true), unlock: () => setLocked(false) }}>{children}</LockContext.Provider>;
}

function renderCard() {
  return renderWithProviders(
    <StatefulLock>
      <ServerSection />
    </StatefulLock>,
    { auth: 'authenticated', user: sampleUser, locale: 'en' },
  );
}

/** The disk part of the card (its h3 names it), once its state has arrived. */
async function part(): Promise<HTMLElement> {
  const heading = await screen.findByRole('heading', { level: 3, name: DKT.title });
  const section = heading.closest('section') as HTMLElement;
  await waitFor(() => expect(within(section).queryByRole('status')).not.toBeInTheDocument());
  return section;
}
const byId = (id: string) => document.getElementById(id) as HTMLInputElement;
/** The value next to a term of the part's list. */
function valueOf(section: HTMLElement, term: string): string {
  const dt = within(section).getByText(term, { selector: 'dt' });
  return (dt.nextElementSibling as HTMLElement).textContent ?? '';
}
/** GET /api/server/disk while `change` is the job of the server process. */
function withJob(change: ServerDiskChange, overrides: Partial<ServerDiskInfo> = {}): ServerDiskInfo {
  return serverDiskFixture({ job: change, history: [change], changesLeftToday: 2, ...overrides });
}
/** Lets the poll timer run once and its answer arrive. */
async function nextPoll() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(DISK_POLL_MS);
  });
}
/** The texts of the steps list of the change. */
function steps(): string[] {
  const list = byId(DISK_JOB_ID).querySelector('ol');
  return list ? [...list.querySelectorAll('li')].map((li) => li.textContent ?? '') : [];
}

beforeEach(() => {
  __resetConnectionForTests();
  setServerInfo({ ...hostedInfo });
  vi.mocked(platform.isTauri).mockReturnValue(false);
  vi.mocked(api.server.info).mockReset().mockResolvedValue({ ...hostedInfo });
  vi.mocked(api.server.getSettings).mockReset().mockResolvedValue({ ...ownerSettings });
  vi.mocked(api.server.status).mockReset().mockResolvedValue(serverStatusFixture());
  vi.mocked(api.server.downloads.list).mockReset().mockResolvedValue(serverDownloadsFixture());
  vi.mocked(api.server.disk.get).mockReset().mockResolvedValue(serverDiskFixture());
  vi.mocked(api.server.disk.extend).mockReset();
  vi.mocked(api.server.disk.restart).mockReset();
  vi.mocked(api.auth.sessions).mockReset().mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
  __resetConnectionForTests();
});

describe('helpers', () => {
  // The helpers word their texts in the current language; render.tsx pins Hebrew before every test.
  pinLocaleForTests('en');

  it('knows the open states, the steps of each state and the whole sizes the server takes', () => {
    expect((['snapshot', 'extending', 'waiting', 'needs-restart', 'restarting'] as const).every(isOpenDiskState)).toBe(true);
    expect(isOpenDiskState('done') || isOpenDiskState('failed')).toBe(false);
    expect(stepsOf('snapshot')).toEqual(['current', 'pending', 'pending']);
    expect(stepsOf('extending')).toEqual(['done', 'current', 'pending']);
    expect(stepsOf('waiting')).toEqual(['done', 'done', 'current']);
    expect(stepsOf('needs-restart')).toEqual(['done', 'done', 'restart']);
    expect(stepsOf('restarting')).toEqual(['done', 'done', 'current']);
    expect(stepsOf('done')).toEqual(['done', 'done', 'done']);
    expect(stepsOf('failed')).toBeNull();
    expect(['60', ' 60 ', '100', '', '60.5', '6e1', '-1', 'abc'].map(parseSizeGb)).toEqual([60, 60, 100, null, null, null, null, null]);
    expect(newSizeError('51', 50, 100)).toBeNull();
    expect(newSizeError('100', 50, 100)).toBeNull();
    for (const text of ['50', '101', '', '60.5']) expect(newSizeError(text, 50, 100), text).toBe(DKT.newSizeInvalid('51', '100'));
    expect(formatUsd(9)).toMatch(/9\.00/);
  });

  it('words a change for the live region: the state, the reason when it failed or waits for a restart, the e-mail', () => {
    expect(changeAnnouncement(serverDiskChangeFixture())).toBe(DKT.state('snapshot', '50', '60'));
    expect(changeAnnouncement(serverDiskChangeFixture({ state: 'done', email: 'sent' }))).toBe(
      'Done: the disk was enlarged from 50 GB to 60 GB, and the server uses the new size. An e-mail about it was sent to your account address.',
    );
    expect(changeAnnouncement(serverDiskChangeFixture({ state: 'failed', errorKey: 'server.disk.error.extendRefused', email: 'no-address' }))).toBe(
      `Enlarging the disk from 50 GB to 60 GB did not succeed. ${en('server.disk.error.extendRefused')} ${emailOutcome('no-address')}`,
    );
    // An error key this app does not know (a newer server) gets the general text, never a raw key.
    expect(DKT.errorText('server.disk.error.somethingNew')).toBe(T.genericError);
    expect(DKT.reason(undefined)).toBe(en('server.disk.unavailable'));
  });
});

describe('the disk size, set up', () => {
  it('comes after the downloads part and before the deletion helper, with the size now, the use, the cost and the changes left', async () => {
    renderCard();
    const section = await part();
    const card = screen.getByRole('heading', { level: 2, name: SVT.title }).closest('section') as HTMLElement;
    const downloads = await within(card).findByRole('heading', { level: 3, name: DLT.title });
    const deletion = within(card).getByRole('heading', { level: 3, name: DRT.title });
    expect(downloads.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(section.compareDocumentPosition(deletion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(section).getByText(DKT.intro)).toBeInTheDocument();
    expect(section.querySelector('dl')).toHaveAttribute('aria-label', DKT.title);
    expect(valueOf(section, DKT.sizeNow)).toBe('50 GB');
    expect(valueOf(section, DKT.used)).toBe('2 GB of 49 GB (4%)');
    expect(valueOf(section, DKT.costNow)).toBe(formatUsd(7.5));
    expect(valueOf(section, DKT.changesLeft)).toBe('3 of 3');
    // No change yet: no steps, no history.
    expect(byId(DISK_JOB_ID)).toBeNull();
    expect(within(section).queryByRole('heading', { level: 4, name: DKT.historyTitle })).not.toBeInTheDocument();
  });

  it('"New size (GB)": whole numbers from the size now + 1 to the maximum, the monthly cost as it is typed, the sentence that the disk only grows', async () => {
    const { user } = renderCard();
    const section = await part();
    expect(within(section).getByRole('form', { name: DKT.formTitle })).toBeInTheDocument();
    const size = byId(DISK_SIZE_ID);
    expect(size).toHaveAccessibleName(new RegExp(`^${DKT.newSize.replace(/[()]/g, '\\$&')}`));
    expect(size).toHaveAttribute('type', 'number');
    expect(size).toHaveAttribute('min', '51');
    expect(size).toHaveAttribute('max', '100');
    expect(size).toHaveAttribute('step', '1');
    expect(size).toHaveAttribute('inputmode', 'numeric');
    expect(size).toHaveAccessibleDescription(DKT.newSizeHint('51', '100'));
    const cost = section.querySelector('.server-card__cost') as HTMLElement;
    expect(cost).toHaveAttribute('aria-live', 'polite');
    expect(cost).toHaveTextContent('');

    await user.type(size, '6');
    // Not a size the disk can take yet: no cost.
    expect(cost).toHaveTextContent('');
    await user.type(size, '0');
    const text = DKT.cost('60', formatUsd(9));
    expect(text).toBe(`Monthly cost of 60 GB: about ${formatUsd(9)}.`);
    expect(cost).toHaveTextContent(text);
    expect(size).toHaveAccessibleDescription(`${DKT.newSizeHint('51', '100')} ${text}`);
    await user.clear(size);
    await user.type(size, '100');
    expect(cost).toHaveTextContent(DKT.cost('100', formatUsd(15)));
    await user.clear(size);
    await user.type(size, '101');
    expect(cost).toHaveTextContent('');

    const onlyGrow = within(section).getByText('The disk can only grow; it cannot be made smaller again.');
    expect(onlyGrow).toHaveClass('server-card__warning');
    expect(byId(DISK_ENLARGE_ID)).toHaveAccessibleName(DKT.enlarge);
    expect(byId(DISK_ENLARGE_ID)).toHaveAccessibleDescription(DKT.onlyGrow);
    expect(byId(DISK_PASSWORD_ID)).toHaveAccessibleName(new RegExp(`^${SVT.password}`));
    expect(byId(DISK_PASSWORD_ID)).toHaveAttribute('autocomplete', 'current-password');
  });

  it('checks the size and the password before asking the server', async () => {
    const { user } = renderCard();
    const section = await part();
    await user.type(byId(DISK_SIZE_ID), '50');
    await user.click(within(section).getByRole('button', { name: DKT.enlarge }));
    expect(byId(DISK_SIZE_ID)).toHaveAccessibleDescription(new RegExp(DKT.newSizeInvalid('51', '100')));
    expect(byId(DISK_SIZE_ID)).toHaveAttribute('aria-invalid', 'true');
    expect(byId(DISK_SIZE_ID)).toHaveFocus();
    expect(byId(DISK_PASSWORD_ID)).toHaveAccessibleDescription(SVT.passwordMissing);
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(T.fixErrors(2)));
    await user.clear(byId(DISK_SIZE_ID));
    await user.type(byId(DISK_SIZE_ID), '101');
    await user.type(byId(DISK_PASSWORD_ID), PASSWORD);
    await user.click(within(section).getByRole('button', { name: DKT.enlarge }));
    expect(byId(DISK_SIZE_ID)).toHaveAccessibleDescription(new RegExp(DKT.newSizeInvalid('51', '100')));
    expect(api.server.disk.extend).not.toHaveBeenCalled();
  });

  it('Enlarge: sends the size and the password, then shows each step as it happens, announced, until done with the e-mail', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const started = serverDiskChangeFixture();
    vi.mocked(api.server.disk.extend).mockResolvedValue(started);
    const { user } = renderCard();
    const section = await part();
    await user.type(byId(DISK_SIZE_ID), '60');
    await user.type(byId(DISK_PASSWORD_ID), PASSWORD);
    vi.mocked(api.server.disk.get)
      .mockResolvedValueOnce(withJob(serverDiskChangeFixture({ state: 'extending' })))
      .mockResolvedValueOnce(withJob(serverDiskChangeFixture({ state: 'waiting' })))
      .mockResolvedValueOnce(
        withJob(serverDiskChangeFixture({ state: 'done', email: 'sent', finishedAt: '2026-11-18T10:03:00.000Z' }), { sizeGb: 60, totalBytes: 59 * 1024 ** 3 }),
      );
    const reads = vi.mocked(api.server.disk.get).mock.calls.length;
    await user.click(within(section).getByRole('button', { name: DKT.enlarge }));

    await waitFor(() => expect(api.server.disk.extend).toHaveBeenCalledWith({ sizeGb: 60, password: PASSWORD }));
    await waitFor(() => expect(byId(DISK_JOB_ID)).toHaveFocus());
    const job = byId(DISK_JOB_ID);
    expect(job).toHaveAttribute('role', 'group');
    expect(job).toHaveAccessibleName(DKT.changeTitle('50', '60'));
    expect(within(job).getByText(DKT.changeStarted(formatTimestamp(started.startedAt)))).toBeInTheDocument();
    expect(steps()).toEqual([
      expect.stringContaining('Backup copy (snapshot) of the disk: in progress'),
      expect.stringContaining('Enlarging the disk: not yet'),
      expect.stringContaining('The server uses the new size: not yet'),
    ]);
    await waitFor(() => expect(politeRegion()).toHaveTextContent(DKT.state('snapshot', '50', '60')));
    // The form is gone while the change is open, and one change fewer is left today.
    expect(byId(DISK_SIZE_ID)).toBeNull();
    expect(byId(DISK_PASSWORD_ID)).toBeNull();
    expect(valueOf(section, DKT.changesLeft)).toBe('2 of 3');

    await nextPoll();
    await waitFor(() => expect(steps()[1]).toContain('Enlarging the disk: in progress'));
    await waitFor(() => expect(politeRegion()).toHaveTextContent(DKT.state('extending', '50', '60')));
    await nextPoll();
    await waitFor(() => expect(steps()[2]).toContain('The server uses the new size: in progress'));
    await waitFor(() => expect(politeRegion()).toHaveTextContent(DKT.state('waiting', '50', '60')));
    await nextPoll();
    await waitFor(() => expect(within(byId(DISK_JOB_ID)).getByText(DKT.state('done', '50', '60'))).toBeInTheDocument());
    expect(steps().every((step) => step.includes(': done'))).toBe(true);
    expect(within(byId(DISK_JOB_ID)).getByText(emailOutcome('sent'))).toBeInTheDocument();
    await waitFor(() => expect(politeRegion()).toHaveTextContent(changeAnnouncement(serverDiskChangeFixture({ state: 'done', email: 'sent' }))));
    expect(valueOf(section, DKT.sizeNow)).toBe('60 GB');
    // Done: the state is no longer read, and the form is back.
    const after = vi.mocked(api.server.disk.get).mock.calls.length;
    expect(after - reads).toBe(3);
    await nextPoll();
    await nextPoll();
    expect(vi.mocked(api.server.disk.get).mock.calls.length).toBe(after);
    expect(byId(DISK_SIZE_ID)).not.toBeNull();
  });

  it('done before the e-mail about it went out: the card reads on - through a failed read too - until it can say what happened to the e-mail, then stops', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(api.server.disk.extend).mockResolvedValue(serverDiskChangeFixture());
    const { user } = renderCard();
    const section = await part();
    await user.type(byId(DISK_SIZE_ID), '60');
    await user.type(byId(DISK_PASSWORD_ID), PASSWORD);
    const done = (email: ServerDiskChange['email']) => withJob(serverDiskChangeFixture({ state: 'done', email, finishedAt: '2026-11-18T10:03:00.000Z' }), { sizeGb: 60 });
    vi.mocked(api.server.disk.get)
      .mockResolvedValueOnce(done(null))
      .mockRejectedValueOnce(new ApiClientError(0, { code: 'OTHER', message: 'No connection to the diary server.' }))
      .mockResolvedValueOnce(done(null))
      .mockResolvedValueOnce(done('sent'));
    const reads = vi.mocked(api.server.disk.get).mock.calls.length;
    await user.click(within(section).getByRole('button', { name: DKT.enlarge }));
    await waitFor(() => expect(byId(DISK_JOB_ID)).toHaveFocus());

    await nextPoll();
    await waitFor(() => expect(within(byId(DISK_JOB_ID)).getByText(DKT.state('done', '50', '60'))).toBeInTheDocument());
    await waitFor(() => expect(politeRegion()).toHaveTextContent(DKT.state('done', '50', '60')));
    expect(within(byId(DISK_JOB_ID)).queryByText(emailOutcome('sent'))).not.toBeInTheDocument();
    await nextPoll();
    await nextPoll();
    await nextPoll();
    await waitFor(() => expect(within(byId(DISK_JOB_ID)).getByText(emailOutcome('sent'))).toBeInTheDocument());
    await waitFor(() => expect(politeRegion()).toHaveTextContent(emailOutcome('sent')));
    // The change is not open: no "not answering" note for the failed read.
    expect(within(byId(DISK_JOB_ID)).queryByText(DKT.notAnswering)).not.toBeInTheDocument();
    const after = vi.mocked(api.server.disk.get).mock.calls.length;
    expect(after - reads).toBe(4);
    await nextPoll();
    await nextPoll();
    expect(vi.mocked(api.server.disk.get).mock.calls.length).toBe(after);
  });

  it('an e-mail outcome that never comes: the card stops reading after DISK_EMAIL_POLLS more reads', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(api.server.disk.extend).mockResolvedValue(serverDiskChangeFixture());
    const { user } = renderCard();
    const section = await part();
    await user.type(byId(DISK_SIZE_ID), '60');
    await user.type(byId(DISK_PASSWORD_ID), PASSWORD);
    // A new answer object for every read, as the network gives it.
    vi.mocked(api.server.disk.get).mockImplementation(async () => withJob(serverDiskChangeFixture({ state: 'failed', errorKey: 'server.disk.error.snapshotFailed', email: null })));
    const reads = vi.mocked(api.server.disk.get).mock.calls.length;
    await user.click(within(section).getByRole('button', { name: DKT.enlarge }));
    await waitFor(() => expect(byId(DISK_JOB_ID)).toHaveFocus());
    for (let i = 0; i < DISK_EMAIL_POLLS + 4; i += 1) await nextPoll();
    expect(vi.mocked(api.server.disk.get).mock.calls.length - reads).toBe(1 + DISK_EMAIL_POLLS);
    expect(within(byId(DISK_JOB_ID)).getByText(DKT.state('failed', '50', '60'))).toBeInTheDocument();
  });

  it('needs-restart: why the last restart did not do it, "Restart the server now" with the password; while restarting the card reads on through the failed requests', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const waitingForRestart = serverDiskChangeFixture({ state: 'needs-restart', errorKey: 'server.disk.error.restartFailed', email: 'sent' });
    vi.mocked(api.server.disk.get).mockResolvedValue(withJob(waitingForRestart));
    vi.mocked(api.server.disk.restart).mockResolvedValue(serverDiskChangeFixture({ state: 'restarting', email: 'sent' }));
    const { user } = renderCard();
    const section = await part();
    const job = byId(DISK_JOB_ID);
    expect(within(job).getByText(DKT.state('needs-restart', '50', '60'))).toBeInTheDocument();
    expect(within(job).getByText(en('server.disk.error.restartFailed'))).toBeInTheDocument();
    expect(within(job).getByText(emailOutcome('sent'))).toBeInTheDocument();
    expect(steps()[2]).toContain('The server uses the new size: after a restart');
    // No new change may start meanwhile: no Enlarge form.
    expect(byId(DISK_SIZE_ID)).toBeNull();
    const restart = byId(DISK_RESTART_ID);
    expect(restart).toHaveAccessibleName('Restart the server now');
    expect(restart).toHaveAccessibleDescription(DKT.restartHint);
    expect(byId(DISK_RESTART_PASSWORD_ID)).toHaveAccessibleName(new RegExp(`^${SVT.password}`));

    await user.click(restart);
    expect(byId(DISK_RESTART_PASSWORD_ID)).toHaveAccessibleDescription(SVT.passwordMissing);
    expect(byId(DISK_RESTART_PASSWORD_ID)).toHaveFocus();
    expect(api.server.disk.restart).not.toHaveBeenCalled();

    await user.type(byId(DISK_RESTART_PASSWORD_ID), PASSWORD);
    vi.mocked(api.server.disk.get)
      .mockRejectedValueOnce(new ApiClientError(0, { code: 'OTHER', message: 'No connection to the diary server.' }))
      .mockRejectedValueOnce(new ApiClientError(502, { code: 'OTHER', message: 'Bad gateway' }, { fromServer: false }))
      .mockResolvedValueOnce(withJob(serverDiskChangeFixture({ state: 'done', email: 'sent', finishedAt: '2026-11-18T10:06:00.000Z' }), { sizeGb: 60 }));
    await user.click(byId(DISK_RESTART_ID));
    await waitFor(() => expect(api.server.disk.restart).toHaveBeenCalledWith({ password: PASSWORD }));
    await waitFor(() => expect(byId(DISK_JOB_ID)).toHaveFocus());
    expect(within(byId(DISK_JOB_ID)).getByText(DKT.state('restarting', '50', '60'))).toBeInTheDocument();
    await waitFor(() => expect(politeRegion()).toHaveTextContent(DKT.state('restarting', '50', '60')));
    expect(byId(DISK_RESTART_ID)).toBeNull();

    // The server is away: the reads fail, the card says it keeps asking - and does.
    await nextPoll();
    expect(await within(byId(DISK_JOB_ID)).findByText(DKT.notAnswering)).toBeInTheDocument();
    await nextPoll();
    await nextPoll();
    await waitFor(() => expect(within(byId(DISK_JOB_ID)).getByText(DKT.state('done', '50', '60'))).toBeInTheDocument());
    expect(within(byId(DISK_JOB_ID)).queryByText(DKT.notAnswering)).not.toBeInTheDocument();
    await waitFor(() => expect(politeRegion()).toHaveTextContent(DKT.state('done', '50', '60')));
    expect(valueOf(section, DKT.sizeNow)).toBe('60 GB');
  });

  it('a failed change: the server\'s reason and the e-mail line; the history lists the last changes; a new change can be asked for', async () => {
    const failed = serverDiskChangeFixture({ state: 'failed', errorKey: 'server.disk.error.snapshotFailed', email: 'not-configured', finishedAt: '2026-11-18T10:10:00.000Z' });
    const earlier = serverDiskChangeFixture({ id: 'd_aaaaaaaaaaaa', state: 'done', fromGb: 40, toGb: 50, startedAt: '2026-11-10T09:00:00.000Z', email: 'sent' });
    vi.mocked(api.server.disk.get).mockResolvedValue(serverDiskFixture({ job: failed, history: [failed, earlier], changesLeftToday: 2 }));
    renderCard();
    const section = await part();
    const job = byId(DISK_JOB_ID);
    expect(within(job).getByText(DKT.state('failed', '50', '60'))).toBeInTheDocument();
    expect(within(job).getByText(en('server.disk.error.snapshotFailed')).closest('.alert')).toHaveClass('alert--error');
    expect(within(job).getByText(emailOutcome('not-configured'))).toHaveTextContent('sending e-mail is not set up');
    expect(job.querySelector('ol')).toBeNull();
    const history = within(section).getByRole('list', { name: DKT.historyTitle });
    expect(within(history).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      DKT.historyItem('50', '60', 'did not succeed', formatTimestamp(failed.startedAt)),
      DKT.historyItem('40', '50', 'done', formatTimestamp(earlier.startedAt)),
    ]);
    expect(byId(DISK_SIZE_ID)).not.toBeNull();
    expect(valueOf(section, DKT.changesLeft)).toBe('2 of 3');
  });

  it.each([
    ['a wrong password (at the password field, cleared)', new ApiClientError(400, { code: 'WRONG_PASSWORD', field: 'password', message: en('server.disk.wrongPassword') }), DISK_PASSWORD_ID],
    ['a size not larger than Fly reports now (at the size)', new ApiClientError(400, { code: 'VALIDATION', field: 'sizeGb', message: en('server.disk.sizeNotLarger', { current: 60 }) }), DISK_SIZE_ID],
  ])('a refusal - %s', async (_label, error, fieldId) => {
    vi.mocked(api.server.disk.extend).mockRejectedValue(error);
    const { user } = renderCard();
    const section = await part();
    await user.type(byId(DISK_SIZE_ID), '60');
    await user.type(byId(DISK_PASSWORD_ID), 'wrong');
    await user.click(within(section).getByRole('button', { name: DKT.enlarge }));
    await waitFor(() => expect(byId(fieldId)).toHaveAccessibleDescription(new RegExp(error.message.replace(/[.()]/g, '\\$&'))));
    expect(byId(fieldId)).toHaveFocus();
    expect(byId(DISK_PASSWORD_ID)).toHaveValue(fieldId === DISK_PASSWORD_ID ? '' : 'wrong');
  });

  it.each([
    ['a change running', new ApiClientError(409, { code: 'FORBIDDEN', message: en('server.disk.busy') }), true],
    ['the daily limit', new ApiClientError(429, { code: 'FORBIDDEN', message: en('server.disk.dailyLimit', { max: 3, hours: 5 }) }), true],
    ['Fly.io unreachable', new ApiClientError(503, { code: 'OTHER', message: en('server.disk.reason.flyError') }), false],
    ['the confirmation lockout', new ApiClientError(429, { code: 'FORBIDDEN', message: 'Too many wrong passwords.' }), true],
  ])('a refusal - %s: above the form, announced, the state read again when it may have changed', async (_label, error, readAgain) => {
    vi.mocked(api.server.disk.extend).mockRejectedValue(error);
    const { user } = renderCard();
    const section = await part();
    await user.type(byId(DISK_SIZE_ID), '60');
    await user.type(byId(DISK_PASSWORD_ID), PASSWORD);
    const reads = vi.mocked(api.server.disk.get).mock.calls.length;
    await user.click(within(section).getByRole('button', { name: DKT.enlarge }));
    expect(await within(section).findByText(error.message)).toBeInTheDocument();
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(error.message));
    if (readAgain) await waitFor(() => expect(vi.mocked(api.server.disk.get).mock.calls.length).toBe(reads + 1));
    else expect(vi.mocked(api.server.disk.get).mock.calls.length).toBe(reads);
    expect(byId(DISK_PASSWORD_ID)).toHaveValue(PASSWORD);
  });

  it('at the largest size, and with no change left today, says so instead of the form', async () => {
    vi.mocked(api.server.disk.get).mockResolvedValue(serverDiskFixture({ sizeGb: 100 }));
    const first = renderCard();
    let section = await part();
    expect(within(section).getByText(DKT.atMax('100'))).toBeInTheDocument();
    expect(byId(DISK_SIZE_ID)).toBeNull();
    first.unmount();

    const next = '2026-11-19T07:30:00.000Z';
    vi.mocked(api.server.disk.get).mockResolvedValue(serverDiskFixture({ changesLeftToday: 0, nextChangeAt: next }));
    renderCard();
    section = await part();
    expect(within(section).getByText(`${DKT.noChangesLeft(3)} ${DKT.nextChangeAt(formatTimestamp(next))}`)).toBeInTheDocument();
    expect(valueOf(section, DKT.changesLeft)).toBe('0 of 3');
    expect(byId(DISK_SIZE_ID)).toBeNull();
  });

  it('locking the app forgets the passwords', async () => {
    const { user } = renderCard();
    await part();
    await user.type(byId(DISK_PASSWORD_ID), PASSWORD);
    act(() => lockApp());
    await waitFor(() => expect(byId(DISK_PASSWORD_ID)).toHaveValue(''));
  });
});

describe('the disk size, not set up', () => {
  it.each(['no-token', 'bad-token', 'unauthorized'] as ServerDiskReason[])('%s: the reason and the one PowerShell line with Copy; no form', async (reason) => {
    vi.mocked(api.server.disk.get).mockResolvedValue(serverDiskFixture({ available: false, reason, sizeGb: null, changesLeftToday: 3, setupCommand: SETUP }));
    const { user } = renderCard();
    const section = await part();
    expect(within(section).getByText(DKT.reason(reason))).toBeInTheDocument();
    const line = within(section).getByRole('group', { name: DKT.setupCommand });
    expect(line).toHaveAccessibleDescription(DKT.setupHint);
    expect(within(line).getByText(SETUP).closest('pre')).toHaveAttribute('dir', 'ltr');
    await user.click(byId(DISK_COPY_SETUP_ID));
    expect(await navigator.clipboard.readText()).toBe(SETUP);
    await waitFor(() => expect(politeRegion()).toHaveTextContent(SVT.copied));
    expect(byId(DISK_SIZE_ID)).toBeNull();
    expect(within(section).queryByRole('button', { name: DKT.enlarge })).not.toBeInTheDocument();
    // What the server knows without Fly.io is still shown; the size is not.
    expect(valueOf(section, DKT.used)).toBe('2 GB of 49 GB (4%)');
    expect(within(section).queryByText(DKT.sizeNow, { selector: 'dt' })).not.toBeInTheDocument();
    expect(within(section).queryByText(DKT.changesLeft, { selector: 'dt' })).not.toBeInTheDocument();
  });

  it.each([
    ['not-fly', 'server.disk.reason.notFly'],
    ['no-volume', 'server.disk.reason.noVolume'],
    ['fly-error', 'server.disk.reason.flyError'],
  ] as Array<[ServerDiskReason, string]>)('%s: only the reason, no line and no form', async (reason, key) => {
    vi.mocked(api.server.disk.get).mockResolvedValue(serverDiskFixture({ available: false, reason, sizeGb: null }));
    renderCard();
    const section = await part();
    expect(within(section).getByText(en(key))).toBeInTheDocument();
    expect(section.querySelector('pre')).toBeNull();
    expect(byId(DISK_SIZE_ID)).toBeNull();
    expect(within(section).queryByRole('button')).not.toBeInTheDocument();
  });

  it('a server from before this part shows nothing of it (404); one built without it shows its sentence (403)', async () => {
    vi.mocked(api.server.disk.get).mockRejectedValue(new ApiClientError(404, { code: 'NOT_FOUND', message: 'Not found' }));
    const first = renderCard();
    await screen.findByRole('heading', { level: 3, name: DLT.title });
    await waitFor(() => expect(api.server.disk.get).toHaveBeenCalled());
    await act(async () => new Promise<void>((r) => setTimeout(r, 20)));
    expect(screen.queryByRole('heading', { level: 3, name: DKT.title })).not.toBeInTheDocument();
    first.unmount();

    vi.mocked(api.server.disk.get).mockRejectedValue(new ApiClientError(403, { code: 'FORBIDDEN', message: en('server.disk.unavailable') }));
    renderCard();
    const heading = await screen.findByRole('heading', { level: 3, name: DKT.title });
    const section = heading.closest('section') as HTMLElement;
    expect(await within(section).findByText(en('server.disk.unavailable'))).toBeInTheDocument();
    expect(within(section).queryByRole('button')).not.toBeInTheDocument();
  });
});
