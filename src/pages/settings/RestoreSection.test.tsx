/**
 * Phone (Android app) branch of the Restore card: the backup is chosen through the phone bridge's
 * own open dialog (not the WebView's file input), and a backup the app was opened with ("Open
 * with Your Personal Diary") is inspected like a picked file - and nothing more: the password
 * field and the confirmation stay, nothing is restored by opening or choosing a file.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { BackupFileInfo } from '@shared/types';
import * as api from '@/api';
import { tr } from '@/i18n/runtime';
import { politeRegion, renderWithProviders } from '@/test/render';
import { setPhoneFiles, type PhoneFiles } from '@/utils/download';
import { RestoreSection } from './RestoreSection';
import { ST } from './texts';

function fakePhoneFiles(overrides: Partial<PhoneFiles> = {}): PhoneFiles {
  return {
    save: vi.fn(),
    share: vi.fn(),
    pick: vi.fn(async () => null),
    takeOpenedFile: () => null,
    onOpenedFile: () => () => undefined,
    ...overrides,
  };
}

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

const validInfo: BackupFileInfo = { valid: true, version: 1, sizeBytes: 3072, description: 'valid backup' };

describe('phone: Restore card with an opened file', () => {
  beforeEach(() => {
    vi.stubGlobal('__MOBILE__', true);
    vi.mocked(api.backup.inspectFile).mockReset().mockResolvedValue(validInfo);
    vi.mocked(api.backup.restoreFromFile).mockReset();
  });
  afterEach(() => {
    setPhoneFiles(null);
    vi.unstubAllGlobals();
  });

  it('inspects the file the app was started with and the ones opened later; never restores by itself', async () => {
    const started = new File(['x'], 'from-whatsapp.mpd');
    let listener: ((file: File) => void) | null = null;
    const phone = fakePhoneFiles({
      takeOpenedFile: vi.fn(() => started),
      onOpenedFile: vi.fn((fn) => {
        listener = fn;
        return () => {
          listener = null;
        };
      }),
    });
    setPhoneFiles(phone);
    renderWithProviders(<RestoreSection />, { auth: 'authenticated' });

    await waitFor(() => expect(api.backup.inspectFile).toHaveBeenCalledWith(started));
    await waitFor(() => expect(screen.getByText('from-whatsapp.mpd')).toBeInTheDocument());
    expect(screen.getByText(tr('mobile.files.openedBackup', { fileName: 'from-whatsapp.mpd' }))).toBeInTheDocument();
    expect(api.backup.restoreFromFile).not.toHaveBeenCalled();

    const later = new File(['y'], 'later.mpd');
    expect(listener).not.toBeNull();
    listener!(later);
    await waitFor(() => expect(api.backup.inspectFile).toHaveBeenCalledWith(later));
    await waitFor(() => expect(screen.getByText('later.mpd')).toBeInTheDocument());
    expect(api.backup.restoreFromFile).not.toHaveBeenCalled();
  });

  it('offers "Choose backup file" through the phone dialog instead of the WebView file input, and inspects the chosen file', async () => {
    const chosen = new File(['z'], 'chosen.mpd');
    const phone = fakePhoneFiles({ pick: vi.fn(async () => chosen) });
    setPhoneFiles(phone);
    const { container, user } = renderWithProviders(<RestoreSection />, { auth: 'authenticated' });
    // The WebView's own chooser would be reported as leaving the app and lock the diary under it.
    expect(container.querySelector('input[type="file"]')).toBeNull();

    await user.click(screen.getByRole('button', { name: ST.pickBackupFile }));
    await waitFor(() => expect(phone.pick).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.backup.inspectFile).toHaveBeenCalledWith(chosen));
    await waitFor(() => expect(screen.getByText('chosen.mpd')).toBeInTheDocument());
    expect(api.backup.restoreFromFile).not.toHaveBeenCalled();
  });

  it('a dismissed dialog is announced as cancelled; a file that cannot be read shows the error at the field', async () => {
    const phone = fakePhoneFiles({ pick: vi.fn(async () => null) });
    setPhoneFiles(phone);
    const { container, user } = renderWithProviders(<RestoreSection />, { auth: 'authenticated' });
    await user.click(screen.getByRole('button', { name: ST.pickBackupFile }));
    await waitFor(() => expect(politeRegion()).toHaveTextContent(ST.cancelled));
    expect(api.backup.inspectFile).not.toHaveBeenCalled();

    vi.mocked(phone.pick).mockRejectedValueOnce(new Error('the file cannot be opened for reading'));
    await user.click(screen.getByRole('button', { name: ST.pickBackupFile }));
    await waitFor(() => expect(container.querySelector('.field__error')).toHaveTextContent('the file cannot be opened for reading'));
    expect(api.backup.inspectFile).not.toHaveBeenCalled();
  });
});
