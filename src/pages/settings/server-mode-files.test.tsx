/**
 * The published Windows app (the Tauri shell, SERVER mode - docs/android-tasks/HOSTED-IMPL.md item 8) and
 * its Backup, Export and Restore cards. The app is a thin client of the Your Personal Diary server, which
 * is not on this computer and refuses a disk path (400 on `destPath` / `srcPath`), so the cards must
 * download the file and let the SHELL save it through the native "save as" dialog (`save_file`), and
 * restore by uploading the file chosen in the file input - exactly as the web UI does.
 *
 * Real API client, no network: `fetch` is a stub that answers like the hosted server, and the Tauri
 * `invoke` is a stub that plays the shell. The local-mode developer build (a server on this computer,
 * paths allowed) is covered by BackupPage.test.tsx.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import type { BackupFileInfo } from '@shared/types';
import { __setApiBaseForTests, apiBaseKind, setToken } from '@/api';
import { DEFAULT_SERVER_URL } from '@/config/server-default';
import { tr } from '@/i18n/runtime';
import { politeRegion, renderWithProviders } from '@/test/render';
import { SAVE_FILE_HEADERS, usesLocalFilePaths } from '@/utils/platform';
import { BackupCreateSection } from './BackupCreateSection';
import { ExportSection } from './ExportSection';
import { RestoreSection } from './RestoreSection';
import { ST } from './texts';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const EXPORT_NAME = 'your-personal-diary-export-2026-10-23.txt';
const BACKUP_NAME = 'your-personal-diary-backup-dana-2026-10-23.mpd';
const EXPORT_TEXT = 'fictional export text';
const BACKUP_BYTES = 'MPDIARY fictional backup bytes';
const validInfo: BackupFileInfo = { valid: true, version: 1, sizeBytes: 3072, description: 'valid backup' };

interface SentRequest {
  url: string;
  method: string;
  body: Record<string, unknown> | null;
}

let sent: SentRequest[] = [];

/** A fetch that answers like the hosted server - and refuses a path the way it does. */
function hostedServerFetch() {
  return vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const body = typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null;
    sent.push({ url, method: init.method ?? 'GET', body });
    const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
    if (body && ('destPath' in body || 'srcPath' in body)) {
      return json(400, { code: 'VALIDATION', field: 'destPath' in body ? 'destPath' : 'srcPath', message: 'only on the computer itself' });
    }
    const path = url.slice(DEFAULT_SERVER_URL.length);
    if (path === '/api/export') {
      return new Response(EXPORT_TEXT, {
        status: 200,
        headers: { 'Content-Disposition': `attachment; filename="${EXPORT_NAME}"`, 'X-Entries-Exported': '5', 'Content-Type': 'text/plain' },
      });
    }
    if (path === '/api/backup/create') {
      return new Response(BACKUP_BYTES, { status: 200, headers: { 'Content-Disposition': `attachment; filename="${BACKUP_NAME}"`, 'Content-Type': 'application/octet-stream' } });
    }
    if (path === '/api/backup/inspect') return json(200, validInfo);
    if (path === '/api/backup/restore') return json(200, { entries: 4, habits: 1, restoredAt: '2026-10-23T10:00:00.000Z' });
    return json(404, { code: 'NOT_FOUND', message: 'not found' });
  });
}

/** The bytes of the file the shell was asked to save, as text. */
function savedText(call: unknown[]): string {
  return new TextDecoder().decode(call[1] as Uint8Array);
}

beforeEach(() => {
  sent = [];
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
  __setApiBaseForTests(null);
  vi.stubGlobal('fetch', hostedServerFetch());
  vi.mocked(invoke).mockReset();
  setToken('fictional-session-token', false);
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  __setApiBaseForTests(null);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Windows app (server mode): files', () => {
  it('is the server configuration - no paths - unless the developer build talks to a server on this computer', () => {
    expect(apiBaseKind()).toBe('server');
    expect(usesLocalFilePaths()).toBe(false);
    vi.stubEnv('VITE_LOCAL_SERVER', '1');
    expect(apiBaseKind()).toBe('local-server');
    expect(usesLocalFilePaths()).toBe(true);
    vi.unstubAllEnvs();
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    expect(usesLocalFilePaths()).toBe(false);
  });

  it('Export downloads from the server and the shell saves it - no destPath is sent', async () => {
    vi.mocked(invoke).mockResolvedValue('my-export.txt');
    const { user } = renderWithProviders(<ExportSection />, { auth: 'authenticated' });
    await user.click(screen.getByRole('button', { name: ST.exportAction }));

    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    expect(sent).toEqual([{ url: `${DEFAULT_SERVER_URL}/api/export`, method: 'POST', body: { format: 'txt', includeHabits: true } }]);
    const call = vi.mocked(invoke).mock.calls[0] as unknown[];
    expect(call[0]).toBe('save_file');
    expect(savedText(call)).toBe(EXPORT_TEXT);
    const headers = (call[2] as { headers: Record<string, string> }).headers;
    expect(decodeURIComponent(headers[SAVE_FILE_HEADERS.fileName])).toBe(EXPORT_NAME);
    expect(decodeURIComponent(headers[SAVE_FILE_HEADERS.filterExtensions])).toBe('txt');
    expect(decodeURIComponent(headers[SAVE_FILE_HEADERS.filterName])).toBe(ST.exportFilterName('txt'));
    expect(decodeURIComponent(headers[SAVE_FILE_HEADERS.title])).toBe(tr('shell.dialog.saveFile'));
    // The count comes from the X-Entries-Exported header, the name from the dialog.
    const expected = ST.exportDoneWithFile(5, 'my-export.txt');
    await waitFor(() => expect(document.querySelector('.alert--success')).toHaveTextContent(expected));
    await waitFor(() => expect(politeRegion()).toHaveTextContent(expected));
  });

  it('Export: a cancelled dialog is announced and nothing is reported as saved; a failed write is an error', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(null);
    const { user } = renderWithProviders(<ExportSection />, { auth: 'authenticated' });
    await user.click(screen.getByRole('button', { name: ST.exportAction }));
    await waitFor(() => expect(politeRegion()).toHaveTextContent(ST.cancelled));
    expect(document.querySelector('.alert--success')).toBeNull();

    vi.mocked(invoke).mockRejectedValueOnce('Access is denied. (os error 5)');
    await user.click(screen.getByRole('button', { name: ST.exportAction }));
    await waitFor(() => expect(document.querySelector('.alert--error')).toHaveTextContent(tr('server.export.saveFailed')));
    expect(sent.every((r) => r.body !== null && !('destPath' in r.body))).toBe(true);
  });

  it('Backup downloads from the server and the shell saves it - no destPath is sent', async () => {
    vi.mocked(invoke).mockResolvedValue(BACKUP_NAME);
    const { user } = renderWithProviders(<BackupCreateSection />, { auth: 'authenticated' });
    await user.click(screen.getByRole('button', { name: ST.createBackup }));

    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    expect(sent).toEqual([{ url: `${DEFAULT_SERVER_URL}/api/backup/create`, method: 'POST', body: {} }]);
    const call = vi.mocked(invoke).mock.calls[0] as unknown[];
    expect(call[0]).toBe('save_file');
    expect(savedText(call)).toBe(BACKUP_BYTES);
    const headers = (call[2] as { headers: Record<string, string> }).headers;
    expect(decodeURIComponent(headers[SAVE_FILE_HEADERS.fileName])).toBe(BACKUP_NAME);
    expect(decodeURIComponent(headers[SAVE_FILE_HEADERS.filterExtensions])).toBe('mpd');
    expect(decodeURIComponent(headers[SAVE_FILE_HEADERS.filterName])).toBe(ST.backupFilter);
    const expected = ST.backupCreated(BACKUP_NAME, BACKUP_BYTES.length);
    await waitFor(() => expect(document.querySelector('.alert--success')).toHaveTextContent(expected));
  });

  it('Backup: a failed write shows the localised error', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('disk full'));
    const { user } = renderWithProviders(<BackupCreateSection />, { auth: 'authenticated' });
    await user.click(screen.getByRole('button', { name: ST.createBackup }));
    await waitFor(() => expect(document.querySelector('.alert--error')).toHaveTextContent(tr('server.backup.writeFailed')));
  });

  it('Restore offers the file input, uploads the chosen file for inspection and restore - no srcPath is sent', async () => {
    const { container, user } = renderWithProviders(<RestoreSection />, { auth: 'authenticated' });
    // No native "pick a path" button: the server could not read a path on this computer.
    expect(screen.queryByRole('button', { name: ST.pickBackupFile })).not.toBeInTheDocument();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    const file = new File(['MPDIARY'], 'old-backup.mpd', { type: 'application/octet-stream' });
    await user.upload(input, file);

    await waitFor(() => expect(sent.map((r) => r.url)).toEqual([`${DEFAULT_SERVER_URL}/api/backup/inspect`]));
    expect(sent[0].body).toMatchObject({ fileName: 'old-backup.mpd', fileBase64: expect.any(String) });
    expect(await screen.findByText('old-backup.mpd')).toBeInTheDocument();

    const card = screen.getByRole('heading', { name: ST.restore }).closest('section') as HTMLElement;
    await user.type(within(card).getByLabelText(new RegExp(`^${ST.backupPassword}`)), 'pw123456');
    await user.click(screen.getByRole('button', { name: ST.restoreAction }));
    const dialog = screen.getByRole('dialog', { name: ST.restoreTitle });
    await user.click(within(dialog).getByRole('button', { name: ST.restoreConfirm }));

    await waitFor(() => expect(sent.map((r) => r.url)).toEqual([`${DEFAULT_SERVER_URL}/api/backup/inspect`, `${DEFAULT_SERVER_URL}/api/backup/restore`]));
    expect(sent[1].body).toMatchObject({ fileName: 'old-backup.mpd', password: 'pw123456', fileBase64: expect.any(String) });
    for (const r of sent) expect(r.body && 'srcPath' in r.body).toBe(false);
    await waitFor(() => expect(document.querySelector('.alert--success')).toHaveTextContent(ST.restored(4, 1)));
    expect(invoke).not.toHaveBeenCalled();
  });
});
