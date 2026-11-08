/**
 * Phone (Android app) branch of the Backup and Export cards: "Save to device" and "Share" hand the
 * file the core produced to the phone bridge; a dismissed dialog is announced as cancelled. The
 * desktop / browser behaviour (one "Create backup" button, a download) is covered by BackupPage.test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import * as api from '@/api';
import { tr } from '@/i18n/runtime';
import { politeRegion, renderWithProviders } from '@/test/render';
import { setPhoneFiles, type PhoneFiles } from '@/utils/download';
import { BackupCreateSection } from './BackupCreateSection';
import { ExportSection } from './ExportSection';
import { ST } from './texts';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

function fakePhoneFiles(overrides: Partial<PhoneFiles> = {}): PhoneFiles {
  return {
    save: vi.fn(async () => 'saved' as const),
    share: vi.fn(async () => 'shared' as const),
    pick: vi.fn(async () => null),
    takeOpenedFile: () => null,
    onOpenedFile: () => () => undefined,
    ...overrides,
  };
}

describe('phone: Backup and Export cards', () => {
  beforeEach(() => {
    vi.stubGlobal('__MOBILE__', true);
    vi.mocked(api.backup.download).mockReset().mockResolvedValue({ blob: new Blob(['abc']), fileName: 'diary-backup.mpd', headers: new Headers() });
    vi.mocked(api.exportApi.download).mockReset().mockResolvedValue({ blob: new Blob(['{}']), fileName: 'export.json', headers: new Headers({ 'X-Entries-Exported': '3' }) });
  });
  afterEach(() => {
    setPhoneFiles(null);
    vi.unstubAllGlobals();
  });

  it('shows "Save to device" and "Share" instead of "Create backup" and saves through the bridge', async () => {
    const phone = fakePhoneFiles();
    setPhoneFiles(phone);
    const { user } = renderWithProviders(<BackupCreateSection />, { auth: 'authenticated' });
    expect(screen.queryByRole('button', { name: ST.createBackup })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: tr('mobile.files.saveToDevice') }));
    await waitFor(() => expect(phone.save).toHaveBeenCalledTimes(1));
    expect(api.backup.download).toHaveBeenCalledWith({});
    expect(vi.mocked(phone.save).mock.calls[0][1]).toBe('diary-backup.mpd');
    await waitFor(() => expect(document.querySelector('.alert--success')).toHaveTextContent(tr('mobile.files.saved', { fileName: 'diary-backup.mpd' })));
  });

  it('"Share" hands the file to the share sheet; a dismissed sheet is announced as cancelled', async () => {
    const phone = fakePhoneFiles({ share: vi.fn(async () => 'cancelled' as const) });
    setPhoneFiles(phone);
    const { user } = renderWithProviders(<BackupCreateSection />, { auth: 'authenticated' });
    await user.click(screen.getByRole('button', { name: tr('mobile.files.share') }));
    await waitFor(() => expect(phone.share).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(politeRegion()).toHaveTextContent(ST.cancelled));
    expect(document.querySelector('.alert--success')).toBeNull();
  });

  it('the Export card offers the same two buttons and reports the shared file', async () => {
    const phone = fakePhoneFiles();
    setPhoneFiles(phone);
    const { user } = renderWithProviders(<ExportSection />, { auth: 'authenticated' });
    expect(screen.queryByRole('button', { name: ST.exportAction })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: tr('mobile.files.share') }));
    await waitFor(() => expect(phone.share).toHaveBeenCalledTimes(1));
    expect(api.exportApi.download).toHaveBeenCalledWith({ format: 'txt', includeHabits: true });
    await waitFor(() => expect(document.querySelector('.alert--success')).toHaveTextContent(tr('mobile.files.shared', { fileName: 'export.json' })));
  });

  it('without the bridge (a browser) the cards keep their single button', () => {
    renderWithProviders(<BackupCreateSection />, { auth: 'authenticated' });
    expect(screen.getByRole('button', { name: ST.createBackup })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: tr('mobile.files.saveToDevice') })).not.toBeInTheDocument();
  });
});
