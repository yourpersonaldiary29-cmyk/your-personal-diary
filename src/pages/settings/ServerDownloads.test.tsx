/**
 * "Files on the Downloads page" in the owner's Server card (ServerDownloads.tsx, docs/server-tasks/
 * SERVER-CARD-V2.md A4): the files of each system with version, size, date and where each came from,
 * each with Remove (a dialog with the password); "Publish a new version" - the system, the version
 * filled in with the app's own, a file input accepting the system's extension, "Remove the older
 * versions" ticked, the password - checked as the server checks it, then the intent and the upload with
 * a progress bar, its percentage announced in steps, Cancel, "Checking the file..." and the result with
 * the e-mail line; every refusal at its field or above the form, the password asked again after a
 * refused upload; the e-mail warning beforehand; nothing on a server without the routes. Fictional
 * names and sizes only; the API module is a mock (no network).
 */
import { useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { APP_VERSION } from '@shared/constants';
import type { ServerDownloadResult, ServerDownloadUploadTicket, ServerInfo, ServerSettings } from '@shared/types';
import * as api from '@/api';
import { __resetConnectionForTests, ApiClientError, setServerInfo, type RawUploadOptions } from '@/api';
import { T } from '@/constants/texts';
import { LockContext } from '@/context/LockContext';
import { trWith } from '@/i18n/runtime';
import { pinLocaleForTests } from '@/i18n/test-utils';
import { serverDiskFixture, serverDownloadRowFixture, serverDownloadsFixture, serverStatusFixture } from '@/test/api-mock';
import { assertiveRegion, politeRegion, renderWithProviders, sampleUser } from '@/test/render';
import { formatLongDate } from '@/utils/dates';
import * as platform from '@/utils/platform';
import { ServerSection } from './ServerSection';
import {
  DOWNLOADS_CANCEL_ID,
  DOWNLOADS_FILE_ID,
  DOWNLOADS_PASSWORD_ID,
  DOWNLOADS_PLATFORM_ID,
  DOWNLOADS_PROGRESS_ID,
  DOWNLOADS_REMOVE_OLDER_ID,
  DOWNLOADS_RESULT_ID,
  DOWNLOADS_VERSION_ID,
  extensionOf,
  publishErrors,
  publishedText,
} from './ServerDownloads';
import { DLT, DRT, SVT, emailOutcome, formatServerBytes } from './serverTexts';
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
const MIB = 1024 * 1024;
const PASSWORD = 'Passw0rd!';

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

/** The downloads part of the card (its h3 names it). */
async function part(): Promise<HTMLElement> {
  const heading = await screen.findByRole('heading', { level: 3, name: DLT.title });
  const section = heading.closest('section') as HTMLElement;
  await within(section).findByRole('heading', { level: 4, name: DLT.publishTitle });
  return section;
}
const byId = (id: string) => document.getElementById(id) as HTMLInputElement;
/** A fictional installer: zero bytes of the given size. */
function installer(name: string, bytes = 2 * MIB): File {
  return new File([new Uint8Array(bytes)], name, { type: 'application/octet-stream' });
}
/** Puts a file of another kind into the file input, as a picker that ignores `accept` would (user.upload applies it). */
function choose(file: File) {
  fireEvent.change(byId(DOWNLOADS_FILE_ID), { target: { files: [file] } });
}
/** The table of one system (labelled by its heading). */
function table(name: string): HTMLElement {
  return screen.getByRole('table', { name });
}

const ticket: ServerDownloadUploadTicket = {
  token: 'T'.repeat(43),
  expiresAt: '2026-11-18T10:15:00.000Z',
  uploadPath: `/api/server/downloads/upload/${'T'.repeat(43)}`,
  platform: 'windows',
  version: '1.1.0',
  file: 'YourPersonalDiary-1.1.0-windows-x64-setup.exe',
  removeOlder: true,
  maxBytes: 300 * MIB,
  minBytes: MIB,
};

/** The answer of a publication of 1.1.0 for Windows that removed 1.0.0. */
function published(email: ServerDownloadResult['email'] = 'sent'): ServerDownloadResult {
  const row = serverDownloadRowFixture({ version: '1.1.0', date: '2026-11-18', source: 'uploaded', bytes: 90 * MIB });
  const base = serverDownloadsFixture();
  return {
    action: 'published',
    row,
    removedOlder: [serverDownloadRowFixture()],
    email,
    downloads: { ...base, platforms: { ...base.platforms, windows: [row] }, limits: { ...base.limits, usedToday: 1 } },
  };
}

/** Controls the mocked upload: the test sends progress, the end of the sending, and the answer. */
interface UploadControl {
  options: RawUploadOptions;
  resolve: (result: ServerDownloadResult) => void;
  reject: (error: unknown) => void;
}
let upload: UploadControl | null = null;

beforeEach(() => {
  __resetConnectionForTests();
  setServerInfo({ ...hostedInfo });
  upload = null;
  vi.mocked(platform.isTauri).mockReturnValue(false);
  vi.mocked(api.server.info).mockReset().mockResolvedValue({ ...hostedInfo });
  vi.mocked(api.server.getSettings).mockReset().mockResolvedValue({ ...ownerSettings });
  vi.mocked(api.server.status).mockReset().mockResolvedValue(serverStatusFixture());
  vi.mocked(api.server.downloads.list).mockReset().mockResolvedValue(serverDownloadsFixture());
  vi.mocked(api.server.downloads.intent).mockReset().mockResolvedValue(ticket);
  vi.mocked(api.server.downloads.upload)
    .mockReset()
    .mockImplementation(
      (_token, _file, options) =>
        new Promise<ServerDownloadResult>((resolve, reject) => {
          upload = { options: options ?? {}, resolve, reject };
          options?.signal?.addEventListener('abort', () => {
            const e = new Error('The upload was aborted.');
            e.name = 'AbortError';
            reject(e);
          });
        }),
    );
  vi.mocked(api.server.downloads.remove).mockReset();
  vi.mocked(api.server.disk.get).mockReset().mockResolvedValue(serverDiskFixture());
  vi.mocked(api.auth.sessions).mockReset().mockResolvedValue([]);
});

afterEach(() => {
  __resetConnectionForTests();
});

/** Fills the form for 1.1.0 for Windows with a 2 MB file and the password. */
async function fillForm(user: ReturnType<typeof renderCard>['user'], version = '1.1.0') {
  await user.clear(byId(DOWNLOADS_VERSION_ID));
  await user.type(byId(DOWNLOADS_VERSION_ID), version);
  await user.upload(byId(DOWNLOADS_FILE_ID), installer('YourPersonalDiary-1.1.0-windows-x64-setup.exe'));
  await user.type(byId(DOWNLOADS_PASSWORD_ID), PASSWORD);
}

describe('helpers', () => {
  // The helpers word their texts in the current language; render.tsx pins Hebrew before every test.
  pinLocaleForTests('en');

  it('checks the form as the server does: version x.y.z not listed yet, the file of the system within the limits, the password', () => {
    const list = serverDownloadsFixture();
    const exe = installer('a.exe');
    expect(publishErrors({ platform: 'windows', version: '1.1.0', file: exe, password: PASSWORD, list })).toEqual({});
    expect(publishErrors({ platform: 'windows', version: '1.0.0', file: exe, password: PASSWORD, list })).toEqual({
      version: en('server.downloads.exists', { platform: 'Windows', version: '1.0.0' }),
    });
    for (const version of ['1.1', '01.1.0', '1.1.0.0', '1.10000.0', 'v1.1.0', '']) {
      expect(publishErrors({ platform: 'windows', version, file: exe, password: PASSWORD, list }).version, version).toBe(en('server.downloads.versionInvalid'));
    }
    expect(publishErrors({ platform: 'android', version: '1.1.0', file: exe, password: '', list })).toEqual({
      file: DLT.fileWrongType('.apk', 'Android'),
      password: SVT.passwordMissing,
    });
    expect(publishErrors({ platform: 'mac', version: '1.1.0', file: null, password: PASSWORD, list })).toEqual({ file: DLT.fileMissing });
    // A name without an extension (a phone may hand one over) is left to the server's signature check.
    expect(publishErrors({ platform: 'mac', version: '1.1.0', file: installer('picked'), password: PASSWORD, list })).toEqual({});
    expect(publishErrors({ platform: 'windows', version: '1.1.0', file: installer('a.EXE', 1000), password: PASSWORD, list })).toEqual({
      file: en('server.downloads.tooSmall', { minMb: 1 }),
    });
    const big = installer('a.exe', 1);
    Object.defineProperty(big, 'size', { value: 301 * MIB });
    expect(publishErrors({ platform: 'windows', version: '1.1.0', file: big, password: PASSWORD, list })).toEqual({
      file: en('server.downloads.tooLarge', { maxMb: 300 }),
    });
    expect(extensionOf('YourPersonalDiary-1.0.0-android.APK')).toBe('.apk');
    expect(extensionOf('.hidden')).toBe('');
  });

  it('words the result of a publication with the older versions removed and the e-mail', () => {
    expect(publishedText('windows', published())).toBe(
      'Version 1.1.0 for Windows is now on the Downloads page. Removed from the page at the same time: 1.0.0. An e-mail about it was sent to your account address.',
    );
    expect(publishedText('mac', { ...published('notConfigured'), removedOlder: [] })).toBe(
      `Version 1.1.0 for Mac is now on the Downloads page. ${emailOutcome('notConfigured')}`,
    );
    expect(emailOutcome('noAddress')).toBe(emailOutcome('no-address'));
    expect(emailOutcome('failed')).toBe('The e-mail about it could not be sent.');
  });
});

describe('the files of the Downloads page', () => {
  it('comes after the archive and before the deletion helper, and lists each system\'s files with version, size, date and where it came from', async () => {
    const uploaded = serverDownloadRowFixture({ version: '1.1.0', date: '2026-11-17', source: 'uploaded', bytes: 90 * MIB });
    const base = serverDownloadsFixture();
    vi.mocked(api.server.downloads.list).mockResolvedValue({ ...base, platforms: { ...base.platforms, windows: [uploaded, serverDownloadRowFixture()], mac: [] } });
    renderCard();
    const section = await part();
    const card = screen.getByRole('heading', { level: 2, name: SVT.title }).closest('section') as HTMLElement;
    const archive = within(card).getByRole('heading', { level: 3, name: SVT.archiveTitle });
    const deletion = within(card).getByRole('heading', { level: 3, name: DRT.title });
    expect(archive.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(section.compareDocumentPosition(deletion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(section).getByText(DLT.intro)).toBeInTheDocument();

    const windows = table('Windows');
    expect(within(windows).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([DLT.version, DLT.size, DLT.date, DLT.source, DLT.remove]);
    const rows = within(windows).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getByRole('rowheader').textContent)).toEqual(['1.1.0', '1.0.0']);
    expect(rows[0]).toHaveTextContent(formatServerBytes(90 * MIB));
    expect(rows[0]).toHaveTextContent(formatLongDate('2026-11-17'));
    expect(rows[0]).toHaveTextContent('Uploaded');
    expect(rows[1]).toHaveTextContent('Came with a server update');
    expect(within(rows[1]).getByRole('button', { name: 'Remove version 1.0.0 for Windows' })).toHaveAttribute('aria-haspopup', 'dialog');
    expect(within(table('Android')).getByRole('button', { name: DLT.removeName('1.0.0', 'Android') })).toBeInTheDocument();
    // A system without a file says so, and has no table.
    expect(screen.queryByRole('table', { name: 'Mac' })).not.toBeInTheDocument();
    const mac = within(section).getByRole('heading', { level: 4, name: 'Mac' }).parentElement as HTMLElement;
    expect(within(mac).getByText(DLT.empty)).toBeInTheDocument();
    // Nothing here is a download link: the files are managed, not fetched, from the card.
    expect(within(section).queryByRole('link')).not.toBeInTheDocument();
  });

  it('warns before an action when no e-mail would be sent about it', async () => {
    vi.mocked(api.server.downloads.list).mockResolvedValue(serverDownloadsFixture({ email: 'notConfigured' }));
    renderCard();
    const section = await part();
    expect(within(section).getByText(DLT.emailWarning('notConfigured'))).toHaveTextContent('sending e-mail is not set up');
    vi.mocked(api.server.downloads.list).mockResolvedValue(serverDownloadsFixture({ email: 'noAddress' }));
    await act(async () => {
      screen.getByRole('button', { name: SVT.refresh }).click();
    });
    expect(await within(section).findByText(DLT.emailWarning('noAddress'))).toHaveTextContent('your account has no e-mail address');
  });

  it('a server from before this part shows nothing of it (404); one built without it shows its sentence (403)', async () => {
    vi.mocked(api.server.downloads.list).mockRejectedValue(new ApiClientError(404, { code: 'NOT_FOUND', message: 'Not found' }));
    const first = renderCard();
    await screen.findByRole('heading', { level: 3, name: SVT.archiveTitle });
    await waitFor(() => expect(api.server.downloads.list).toHaveBeenCalled());
    await act(async () => new Promise<void>((r) => setTimeout(r, 20)));
    expect(screen.queryByRole('heading', { level: 3, name: DLT.title })).not.toBeInTheDocument();
    first.unmount();

    vi.mocked(api.server.downloads.list).mockRejectedValue(new ApiClientError(403, { code: 'FORBIDDEN', message: en('server.downloads.unavailable') }));
    renderCard();
    const heading = await screen.findByRole('heading', { level: 3, name: DLT.title });
    const section = heading.closest('section') as HTMLElement;
    expect(await within(section).findByText(en('server.downloads.unavailable'))).toBeInTheDocument();
    expect(within(section).queryByRole('button')).not.toBeInTheDocument();
    // The card itself stays (only a 403 of the status hides it).
    expect(screen.getByRole('heading', { level: 2, name: SVT.title })).toBeInTheDocument();
  });
});

describe('publishing a new version', () => {
  it('has labelled controls: the system, the version filled in with this app\'s, the file accepting the system\'s kind, "Remove the older versions" ticked, the password; and the limits', async () => {
    const { user } = renderCard();
    const section = await part();
    const select = within(section).getByLabelText(new RegExp(`^${DLT.platform}`));
    expect(select).toHaveAttribute('id', DOWNLOADS_PLATFORM_ID);
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Windows', 'Android', 'Mac']);
    const version = byId(DOWNLOADS_VERSION_ID);
    expect(version).toHaveValue(APP_VERSION);
    expect(version).toHaveAccessibleName(new RegExp(`^${DLT.version}`));
    expect(version).toHaveAccessibleDescription(DLT.versionHint(APP_VERSION));
    expect(version).toHaveAttribute('dir', 'ltr');
    const fileInput = byId(DOWNLOADS_FILE_ID);
    expect(fileInput).toHaveAttribute('type', 'file');
    expect(fileInput).toHaveAttribute('accept', '.exe');
    expect(fileInput).toHaveAccessibleName(new RegExp(`^${DLT.file}`));
    expect(fileInput).toHaveAccessibleDescription(DLT.fileHint('.exe'));
    const removeOlder = byId(DOWNLOADS_REMOVE_OLDER_ID);
    expect(removeOlder).toBeChecked();
    expect(removeOlder).toHaveAccessibleName(DLT.removeOlder);
    expect(removeOlder).toHaveAccessibleDescription(DLT.removeOlderHint);
    expect(byId(DOWNLOADS_PASSWORD_ID)).toHaveAccessibleName(new RegExp(`^${SVT.password}`));
    expect(byId(DOWNLOADS_PASSWORD_ID)).toHaveAttribute('autocomplete', 'current-password');
    expect(within(section).getByText('At least 1 MB and at most 300 MB per file. Uploads in the last 24 hours: 0 of 10.')).toBeInTheDocument();
    expect(within(section).getByRole('form', { name: DLT.publishTitle })).toBeInTheDocument();

    // The file input follows the system; a file of the old system's kind is dropped.
    await user.upload(byId(DOWNLOADS_FILE_ID), installer('YourPersonalDiary-1.1.0-windows-x64-setup.exe'));
    expect(byId(DOWNLOADS_FILE_ID).files).toHaveLength(1);
    await user.selectOptions(select, 'android');
    expect(byId(DOWNLOADS_FILE_ID).files).toHaveLength(0);
    expect(byId(DOWNLOADS_FILE_ID)).toHaveAttribute('accept', '.apk');
    expect(byId(DOWNLOADS_FILE_ID)).toHaveAccessibleDescription(DLT.fileHint('.apk'));
    await user.selectOptions(select, 'mac');
    expect(byId(DOWNLOADS_FILE_ID)).toHaveAttribute('accept', '.dmg');
    await user.type(byId(DOWNLOADS_PASSWORD_ID), PASSWORD);
    await user.clear(byId(DOWNLOADS_VERSION_ID));
    await user.type(byId(DOWNLOADS_VERSION_ID), '1.1.0');
    await user.click(within(section).getByRole('button', { name: DLT.upload }));
    expect(byId(DOWNLOADS_FILE_ID)).toHaveAccessibleDescription(new RegExp(DLT.fileMissing));
    expect(api.server.downloads.intent).not.toHaveBeenCalled();
  });

  it('checks the form before asking the server: the version already listed, the file, the password - at their fields, the first one focused', async () => {
    const { user } = renderCard();
    const section = await part();
    // 1.0.0 (this app's version) is on the page already.
    await user.click(within(section).getByRole('button', { name: DLT.upload }));
    expect(byId(DOWNLOADS_VERSION_ID)).toHaveAccessibleDescription(new RegExp(en('server.downloads.exists', { platform: 'Windows', version: '1.0.0' })));
    expect(byId(DOWNLOADS_VERSION_ID)).toHaveAttribute('aria-invalid', 'true');
    expect(byId(DOWNLOADS_VERSION_ID)).toHaveFocus();
    expect(byId(DOWNLOADS_FILE_ID)).toHaveAccessibleDescription(new RegExp(DLT.fileMissing));
    expect(byId(DOWNLOADS_PASSWORD_ID)).toHaveAccessibleDescription(SVT.passwordMissing);
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(T.fixErrors(3)));

    await user.clear(byId(DOWNLOADS_VERSION_ID));
    await user.type(byId(DOWNLOADS_VERSION_ID), '1.1');
    choose(installer('YourPersonalDiary-1.1.0-android.apk'));
    await user.type(byId(DOWNLOADS_PASSWORD_ID), PASSWORD);
    await user.click(within(section).getByRole('button', { name: DLT.upload }));
    expect(byId(DOWNLOADS_VERSION_ID)).toHaveAccessibleDescription(new RegExp(en('server.downloads.versionInvalid').replace(/\./g, '\\.')));
    expect(byId(DOWNLOADS_FILE_ID)).toHaveAccessibleDescription(new RegExp(DLT.fileWrongType('.exe', 'Windows').replace(/\./g, '\\.')));
    expect(api.server.downloads.intent).not.toHaveBeenCalled();
  });

  it('uploads: the intent, then the file with a progress bar announced in steps, Cancel while sending, "Checking the file..." and the result', async () => {
    const { user } = renderCard();
    const section = await part();
    await fillForm(user);
    const chosen = byId(DOWNLOADS_FILE_ID).files?.[0] as File;
    await user.click(within(section).getByRole('button', { name: DLT.upload }));

    await waitFor(() => expect(upload).not.toBeNull());
    expect(api.server.downloads.intent).toHaveBeenCalledWith({ platform: 'windows', version: '1.1.0', password: PASSWORD, removeOlder: true, bytes: chosen.size });
    expect(api.server.downloads.upload).toHaveBeenCalledWith(ticket.token, chosen, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    // The token is single-use: the password is gone from the form as soon as it was used.
    expect(byId(DOWNLOADS_PASSWORD_ID)).toHaveValue('');
    await waitFor(() => expect(byId(DOWNLOADS_CANCEL_ID)).toHaveFocus());
    expect(byId(DOWNLOADS_CANCEL_ID)).toHaveAccessibleName(DLT.cancel);
    // The form waits while the file goes out.
    expect(byId(DOWNLOADS_VERSION_ID)).toBeDisabled();
    expect(byId(DOWNLOADS_FILE_ID)).toBeDisabled();

    act(() => upload?.options.onProgress?.(45 * 1000, 100 * 1000));
    const bar = within(section).getByRole('progressbar', { name: DLT.progress });
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-valuenow', '45');
    expect(bar).toHaveAttribute('aria-valuetext', 'Uploading… 45%');
    expect(within(section).getByText('Uploading… 45%')).toBeInTheDocument();
    // Announced in steps of 10 %: 40 % here, not every byte.
    await waitFor(() => expect(politeRegion()).toHaveTextContent('Uploading… 40%'));
    act(() => upload?.options.onProgress?.(47 * 1000, 100 * 1000));

    act(() => upload?.options.onSent?.());
    await waitFor(() => expect(within(section).getByRole('progressbar', { name: DLT.progress })).toHaveAttribute('aria-valuetext', DLT.checking));
    // Nothing is left to cancel while the server checks the file; focus moved to the progress.
    expect(byId(DOWNLOADS_CANCEL_ID)).toBeNull();
    await waitFor(() => expect(byId(DOWNLOADS_PROGRESS_ID)).toHaveFocus());
    await waitFor(() => expect(politeRegion()).toHaveTextContent(DLT.checking));

    act(() => upload?.resolve(published()));
    const text = publishedText('windows', published());
    await waitFor(() => expect(byId(DOWNLOADS_RESULT_ID)).toHaveFocus());
    expect(byId(DOWNLOADS_RESULT_ID)).toHaveTextContent(text);
    await waitFor(() => expect(politeRegion()).toHaveTextContent(text));
    // The list is the one of the answer: 1.1.0 uploaded, 1.0.0 gone; one upload counted.
    expect(within(table('Windows')).getAllByRole('rowheader').map((th) => th.textContent)).toEqual(['1.1.0']);
    expect(within(section).getByText(/Uploads in the last 24 hours: 1 of 10\./)).toBeInTheDocument();
    expect(byId(DOWNLOADS_FILE_ID).files).toHaveLength(0);
    expect(byId(DOWNLOADS_FILE_ID)).toBeEnabled();
    expect(within(section).queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('Cancel stops the upload: nothing was published, the password is asked again, the list is read again', async () => {
    const { user } = renderCard();
    const section = await part();
    await fillForm(user);
    await user.click(within(section).getByRole('button', { name: DLT.upload }));
    await waitFor(() => expect(byId(DOWNLOADS_CANCEL_ID)).toHaveFocus());
    act(() => upload?.options.onProgress?.(10, 100));
    await user.click(byId(DOWNLOADS_CANCEL_ID));
    const text = `${DLT.cancelled} ${DLT.passwordAgain}`;
    expect(await within(section).findByText(text)).toBeInTheDocument();
    await waitFor(() => expect(byId(DOWNLOADS_PASSWORD_ID)).toHaveFocus());
    await waitFor(() => expect(politeRegion()).toHaveTextContent(DLT.cancelled));
    expect(within(section).queryByRole('progressbar')).not.toBeInTheDocument();
    await waitFor(() => expect(api.server.downloads.list).toHaveBeenCalledTimes(2));
    // The chosen file stays for the next try.
    expect(byId(DOWNLOADS_FILE_ID).files).toHaveLength(1);
  });

  it.each([
    ['a file of the wrong kind (at the file)', new ApiClientError(400, { code: 'VALIDATION', field: 'file', message: en('server.downloads.notWindows') }), en('server.downloads.notWindows'), true],
    ['an interrupted connection', new ApiClientError(0, { code: 'OTHER', message: 'No connection to the diary server.' }), DLT.interrupted, false],
    ['a used token', new ApiClientError(403, { code: 'FORBIDDEN', message: en('server.downloads.tokenInvalid', { minutes: 15 }) }), en('server.downloads.tokenInvalid', { minutes: 15 }), false],
  ])('a refused upload - %s: said above the form and announced, with the password asked again', async (_label, error, message, atFile) => {
    const { user } = renderCard();
    const section = await part();
    await fillForm(user);
    await user.click(within(section).getByRole('button', { name: DLT.upload }));
    await waitFor(() => expect(upload).not.toBeNull());
    act(() => upload?.reject(error));
    const text = `${message} ${DLT.passwordAgain}`;
    expect(await within(section).findByText(text)).toBeInTheDocument();
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(message));
    if (atFile) {
      expect(byId(DOWNLOADS_FILE_ID)).toHaveAccessibleDescription(new RegExp(message.replace(/[.()]/g, '\\$&')));
      await waitFor(() => expect(byId(DOWNLOADS_FILE_ID)).toHaveFocus());
    } else {
      await waitFor(() => expect(byId(DOWNLOADS_PASSWORD_ID)).toHaveFocus());
    }
    expect(byId(DOWNLOADS_PASSWORD_ID)).toHaveValue('');
  });

  it.each([
    ['a wrong password (at the password field, cleared)', new ApiClientError(400, { code: 'WRONG_PASSWORD', field: 'password', message: en('server.downloads.wrongPassword') }), DOWNLOADS_PASSWORD_ID],
    ['a version listed meanwhile (at the version)', new ApiClientError(409, { code: 'VALIDATION', field: 'version', message: en('server.downloads.exists', { platform: 'Windows', version: '1.1.0' }) }), DOWNLOADS_VERSION_ID],
    ['a file too large for the disk (at the file)', new ApiClientError(413, { code: 'VALIDATION', field: 'file', message: en('server.downloads.tooLarge', { maxMb: 300 }) }), DOWNLOADS_FILE_ID],
  ])('a refused intent - %s', async (_label, error, fieldId) => {
    vi.mocked(api.server.downloads.intent).mockRejectedValue(error);
    const { user } = renderCard();
    const section = await part();
    await fillForm(user);
    await user.click(within(section).getByRole('button', { name: DLT.upload }));
    await waitFor(() => expect(byId(fieldId)).toHaveAccessibleDescription(new RegExp(error.message.replace(/[.()]/g, '\\$&'))));
    expect(byId(fieldId)).toHaveFocus();
    expect(api.server.downloads.upload).not.toHaveBeenCalled();
    expect(byId(DOWNLOADS_PASSWORD_ID)).toHaveValue(fieldId === DOWNLOADS_PASSWORD_ID ? '' : PASSWORD);
  });

  it.each([
    ['another upload running', new ApiClientError(429, { code: 'FORBIDDEN', message: en('server.downloads.busy') })],
    ['the daily limit', new ApiClientError(429, { code: 'FORBIDDEN', message: en('server.downloads.tooMany', { max: 10 }) })],
    ['no space on the disk', new ApiClientError(507, { code: 'IO', message: en('server.downloads.noSpace', { needMb: 400, freeMb: 300 }) })],
    ['the confirmation lockout', new ApiClientError(429, { code: 'FORBIDDEN', message: 'Too many wrong passwords.' })],
  ])('a refused intent - %s: above the form, announced, the form kept', async (_label, error) => {
    vi.mocked(api.server.downloads.intent).mockRejectedValue(error);
    const { user } = renderCard();
    const section = await part();
    await fillForm(user);
    await user.click(within(section).getByRole('button', { name: DLT.upload }));
    expect(await within(section).findByText(error.message)).toBeInTheDocument();
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(error.message));
    expect(byId(DOWNLOADS_PASSWORD_ID)).toHaveValue(PASSWORD);
    expect(byId(DOWNLOADS_FILE_ID).files).toHaveLength(1);
    expect(api.server.downloads.upload).not.toHaveBeenCalled();
  });

  it('says when another upload is running, and locking the app forgets the password', async () => {
    vi.mocked(api.server.downloads.list).mockResolvedValue(serverDownloadsFixture({ busy: true }));
    const { user } = renderCard();
    const section = await part();
    expect(within(section).getByText(DLT.busy)).toBeInTheDocument();
    await user.type(byId(DOWNLOADS_PASSWORD_ID), PASSWORD);
    act(() => lockApp());
    await waitFor(() => expect(byId(DOWNLOADS_PASSWORD_ID)).toHaveValue(''));
  });
});

describe('removing a file', () => {
  it('asks for the password in a dialog that says what removing does; a wrong password stays there; then the row goes and the result takes the focus', async () => {
    const base = serverDownloadsFixture();
    vi.mocked(api.server.downloads.remove)
      .mockRejectedValueOnce(new ApiClientError(400, { code: 'WRONG_PASSWORD', field: 'password', message: en('server.downloads.wrongPassword') }))
      .mockResolvedValueOnce({
        action: 'removed',
        row: serverDownloadRowFixture(),
        removedOlder: [],
        email: 'sent',
        downloads: { ...base, platforms: { ...base.platforms, windows: [] } },
      });
    const { user } = renderCard();
    const section = await part();
    await user.click(within(table('Windows')).getByRole('button', { name: DLT.removeName('1.0.0', 'Windows') }));
    const dialog = await screen.findByRole('dialog', { name: DLT.removeTitle('1.0.0', 'Windows') });
    expect(dialog).toHaveTextContent(DLT.removeImage('YourPersonalDiary-1.0.0-windows-x64-setup.exe'));
    // The only file for Windows: the dialog says that the Downloads page then offers none.
    expect(dialog).toHaveTextContent(DLT.removeLast('Windows'));
    expect(dialog).toHaveTextContent(DLT.removeAgain);
    const confirm = within(dialog).getByRole('button', { name: DLT.remove });
    const passwordField = within(dialog).getByLabelText(new RegExp(`^${T.password}`));

    // No password: nothing is asked; the dialog says so at the field and announces it.
    await user.click(confirm);
    await waitFor(() => expect(passwordField).toHaveAccessibleDescription(SVT.passwordMissing));
    await waitFor(() => expect(within(dialog).getByTestId('live-region-assertive')).toHaveTextContent(SVT.passwordMissing));
    expect(api.server.downloads.remove).not.toHaveBeenCalled();

    await user.type(passwordField, 'wrong');
    await user.click(confirm);
    await waitFor(() => expect(passwordField).toHaveAccessibleDescription(en('server.downloads.wrongPassword')));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.clear(passwordField);
    await user.type(passwordField, PASSWORD);
    await user.click(confirm);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.server.downloads.remove).toHaveBeenLastCalledWith({ platform: 'windows', version: '1.0.0', password: PASSWORD });
    const text = `${DLT.removed('1.0.0', 'Windows')} ${DLT.removedLast('Windows')} ${emailOutcome('sent')}`;
    await waitFor(() => expect(byId(DOWNLOADS_RESULT_ID)).toHaveFocus());
    expect(byId(DOWNLOADS_RESULT_ID)).toHaveTextContent(text);
    await waitFor(() => expect(politeRegion()).toHaveTextContent(text));
    expect(screen.queryByRole('table', { name: 'Windows' })).not.toBeInTheDocument();
    const windows = within(section).getByRole('heading', { level: 4, name: 'Windows' }).parentElement as HTMLElement;
    expect(within(windows).getByText(DLT.empty)).toBeInTheDocument();
  });

  it('an uploaded file is deleted from the server (the dialog says so); Cancel removes nothing and gives the focus back', async () => {
    const base = serverDownloadsFixture();
    const uploaded = serverDownloadRowFixture({ version: '1.1.0', file: 'YourPersonalDiary-1.1.0-android.apk', source: 'uploaded' });
    vi.mocked(api.server.downloads.list).mockResolvedValue({ ...base, platforms: { ...base.platforms, android: [uploaded] }, email: 'noAddress' });
    const { user } = renderCard();
    await part();
    const button = within(table('Android')).getByRole('button', { name: DLT.removeName('1.1.0', 'Android') });
    await user.click(button);
    const dialog = await screen.findByRole('dialog', { name: DLT.removeTitle('1.1.0', 'Android') });
    expect(dialog).toHaveTextContent(DLT.removeUploaded('YourPersonalDiary-1.1.0-android.apk'));
    expect(dialog).toHaveTextContent(DLT.removeLast('Android'));
    // The e-mail would not be sent: the dialog says so before the action.
    expect(dialog).toHaveTextContent(DLT.emailWarning('noAddress'));
    expect(within(dialog).getByText('YourPersonalDiary-1.1.0-android.apk')).toHaveAttribute('dir', 'ltr');
    await user.click(within(dialog).getByRole('button', { name: T.cancel }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
    await waitFor(() => expect(politeRegion()).toHaveTextContent(ST.cancelled));
    expect(api.server.downloads.remove).not.toHaveBeenCalled();
  });

  it('a system that keeps another file: neither the dialog nor the result says that the page offers none', async () => {
    const base = serverDownloadsFixture();
    const older = serverDownloadRowFixture({ version: '0.9.0', file: 'YourPersonalDiary-0.9.0-windows-x64-setup.exe' });
    const windows = [serverDownloadRowFixture(), older];
    vi.mocked(api.server.downloads.list).mockResolvedValue({ ...base, platforms: { ...base.platforms, windows } });
    vi.mocked(api.server.downloads.remove).mockResolvedValueOnce({
      action: 'removed',
      row: serverDownloadRowFixture(),
      removedOlder: [],
      email: 'sent',
      downloads: { ...base, platforms: { ...base.platforms, windows: [older] } },
    });
    const { user } = renderCard();
    await part();
    await user.click(within(table('Windows')).getByRole('button', { name: DLT.removeName('1.0.0', 'Windows') }));
    const dialog = await screen.findByRole('dialog', { name: DLT.removeTitle('1.0.0', 'Windows') });
    expect(dialog).not.toHaveTextContent(DLT.removeLast('Windows'));
    await user.type(within(dialog).getByLabelText(new RegExp(`^${T.password}`)), PASSWORD);
    await user.click(within(dialog).getByRole('button', { name: DLT.remove }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const text = `${DLT.removed('1.0.0', 'Windows')} ${emailOutcome('sent')}`;
    await waitFor(() => expect(byId(DOWNLOADS_RESULT_ID)).toHaveTextContent(text));
    expect(byId(DOWNLOADS_RESULT_ID)).not.toHaveTextContent(DLT.removedLast('Windows'));
  });

  it('another device removed the file first (404, the list is read again): the open dialog does not call it the only file', async () => {
    const base = serverDownloadsFixture();
    const older = serverDownloadRowFixture({ version: '0.9.0', file: 'YourPersonalDiary-0.9.0-windows-x64-setup.exe' });
    vi.mocked(api.server.downloads.list)
      .mockResolvedValueOnce({ ...base, platforms: { ...base.platforms, windows: [serverDownloadRowFixture(), older] } })
      .mockResolvedValue({ ...base, platforms: { ...base.platforms, windows: [older] } });
    vi.mocked(api.server.downloads.remove).mockRejectedValueOnce(new ApiClientError(404, { code: 'NOT_FOUND', message: 'Windows 1.0.0 is not on the Downloads page.' }));
    const { user } = renderCard();
    await part();
    await user.click(within(table('Windows')).getByRole('button', { name: DLT.removeName('1.0.0', 'Windows') }));
    const dialog = await screen.findByRole('dialog', { name: DLT.removeTitle('1.0.0', 'Windows') });
    expect(dialog).not.toHaveTextContent(DLT.removeLast('Windows'));
    await user.type(within(dialog).getByLabelText(new RegExp(`^${T.password}`)), PASSWORD);
    await user.click(within(dialog).getByRole('button', { name: DLT.remove }));
    // The reload shows only 0.9.0 for Windows; the dialog of 1.0.0 stays open with the server's message.
    await waitFor(() => expect(within(table('Windows')).queryByText('1.0.0')).not.toBeInTheDocument());
    const still = screen.getByRole('dialog', { name: DLT.removeTitle('1.0.0', 'Windows') });
    expect(still).not.toHaveTextContent(DLT.removeLast('Windows'));
  });
});

describe('languages', () => {
  it('every text of the two new parts exists in all 20 languages with the English placeholders (English until translated)', async () => {
    const { LOCALE_CODES, hasMessage, getCatalog } = await import('@shared/i18n');
    const keys = Object.keys(getCatalog('en')).filter((k) => /^settings\.server\.(downloads|diskSize|email)\./.test(k));
    expect(keys.length).toBeGreaterThan(90);
    for (const code of LOCALE_CODES) {
      for (const key of keys) expect(hasMessage(code, key), `${code} ${key}`).toBe(true);
    }
    // The server's own words the card shows for its checks and the disk exist too.
    for (const key of ['server.downloads.versionInvalid', 'server.downloads.exists', 'server.downloads.tooLarge', 'server.downloads.tooSmall', 'server.disk.unavailable']) {
      for (const code of LOCALE_CODES) expect(hasMessage(code, key), `${code} ${key}`).toBe(true);
    }
  });
});
