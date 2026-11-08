import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { APP_NAME, backupFileName } from '@shared/constants';
import type { BackupFileInfo } from '@shared/types';
import * as api from '@/api';
import { ApiClientError } from '@/api';
import { T } from '@/constants/texts';
import { politeRegion, renderWithProviders, sampleUser } from '@/test/render';
import { todayIso } from '@/utils/dates';
import * as download from '@/utils/download';
import { formatBytes } from '@/utils/format';
import * as platform from '@/utils/platform';
import BackupPage from './BackupPage';
import { exportFileFilter } from './settings/ExportSection';
import { ST } from './settings/texts';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

// "desktop:" below is the desktop's LOCAL-MODE developer build (VITE_LOCAL_SERVER=1): only there does the
// server run on this computer and take a path (`usesLocalFilePaths`). The published Windows app (server
// mode) downloads and uploads instead - settings/server-mode-files.test.tsx.
vi.mock('@/utils/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/platform')>();
  return { ...actual, isTauri: vi.fn(() => false), usesLocalFilePaths: vi.fn(() => false), pickSavePath: vi.fn(), pickOpenPath: vi.fn() };
});

/** The desktop's local-mode developer build: the Tauri shell with a server on this computer. */
function localDesktop(): void {
  vi.mocked(platform.isTauri).mockReturnValue(true);
  vi.mocked(platform.usesLocalFilePaths).mockReturnValue(true);
}

// jsdom has no URL.createObjectURL; the download helper is verified by its call.
vi.mock('@/utils/download', () => ({ saveBlob: vi.fn(), saveText: vi.fn() }));

const BACKUP_PATH = 'C:\\Backups\\your-personal-diary-backup-dana-2026-09-23.mpd';
const validInfo: BackupFileInfo = { valid: true, version: 1, sizeBytes: 3072, description: 'קובץ גיבוי תקין של היומן (גרסה 1)' };

/** The <section> card whose heading is `title` (backup / restore / export share field labels). */
const card = (title: string) => screen.getByRole('heading', { name: title }).closest('section') as HTMLElement;
const createButton = () => screen.getByRole('button', { name: ST.createBackup });
const exportButton = () => screen.getByRole('button', { name: ST.exportAction });
const restoreButton = () => screen.getByRole('button', { name: ST.restoreAction });

describe('BackupPage', () => {
  beforeEach(() => {
    vi.mocked(platform.isTauri).mockReturnValue(false);
    vi.mocked(platform.usesLocalFilePaths).mockReturnValue(false);
    vi.mocked(platform.pickSavePath).mockReset().mockResolvedValue(BACKUP_PATH);
    vi.mocked(platform.pickOpenPath).mockReset().mockResolvedValue(BACKUP_PATH);
    vi.mocked(download.saveBlob).mockReset();
    vi.mocked(api.backup.createToPath)
      .mockReset()
      .mockResolvedValue({ path: BACKUP_PATH, fileName: 'your-personal-diary-backup-dana-2026-09-23.mpd', sizeBytes: 4096, createdAt: '2026-09-23T10:00:00.000Z' });
    vi.mocked(api.backup.download).mockReset().mockResolvedValue({ blob: new Blob(['abc']), fileName: 'your-personal-diary-backup-dana.mpd', headers: new Headers() });
    vi.mocked(api.backup.inspectPath).mockReset().mockResolvedValue(validInfo);
    vi.mocked(api.backup.inspectFile).mockReset().mockResolvedValue(validInfo);
    vi.mocked(api.backup.restoreFromPath).mockReset().mockResolvedValue({ entries: 10, habits: 2, restoredAt: '2026-09-23T10:00:00.000Z' });
    vi.mocked(api.backup.restoreFromFile).mockReset().mockResolvedValue({ entries: 10, habits: 2, restoredAt: '2026-09-23T10:00:00.000Z' });
    vi.mocked(api.exportApi.toPath)
      .mockReset()
      .mockResolvedValue({ path: 'C:\\Exports\\x.csv', fileName: 'x.csv', entriesExported: 12, sizeBytes: 1000 });
    vi.mocked(api.exportApi.download).mockReset().mockResolvedValue({ blob: new Blob(['{}']), fileName: 'your-personal-diary-export.json', headers: new Headers({ 'X-Entries-Exported': '12' }) });
  });

  describe('backup', () => {
    it('desktop: asks for a save path and writes the backup through createToPath', async () => {
      localDesktop();
      const { user } = renderWithProviders(<BackupPage />, { auth: 'authenticated' });
      await user.click(createButton());

      await waitFor(() => expect(api.backup.createToPath).toHaveBeenCalledTimes(1));
      expect(platform.pickSavePath).toHaveBeenCalledWith(backupFileName(sampleUser.username, todayIso()), [{ name: ST.backupFilter, extensions: ['mpd'] }]);
      expect(api.backup.createToPath).toHaveBeenCalledWith({ destPath: BACKUP_PATH });
      expect(api.backup.download).not.toHaveBeenCalled();
      const expected = ST.backupCreated('your-personal-diary-backup-dana-2026-09-23.mpd', 4096);
      await waitFor(() => expect(document.querySelector('.alert--success')).toHaveTextContent(expected));
      expect(expected).toContain(formatBytes(4096));
      await waitFor(() => expect(politeRegion()).toHaveTextContent(expected));
    });

    it('desktop: sends the separate backup password after validating it', async () => {
      localDesktop();
      const { user } = renderWithProviders(<BackupPage />, { auth: 'authenticated' });
      await user.click(screen.getByRole('checkbox', { name: new RegExp(`^${ST.backupOwnPassword}`) }));
      const backupCard = within(card(ST.backup));
      const password = backupCard.getByLabelText(new RegExp(`^${ST.backupPassword}`));
      const confirm = backupCard.getByLabelText(new RegExp(`^${ST.backupPasswordConfirm}`));

      await user.type(password, 'backup123');
      await user.type(confirm, 'backup124');
      await user.click(createButton());
      expect(api.backup.createToPath).not.toHaveBeenCalled();
      expect(platform.pickSavePath).not.toHaveBeenCalled();
      expect(confirm).toHaveAttribute('aria-invalid', 'true');
      expect(confirm).toHaveAccessibleDescription(T.passwordsMismatch);

      await user.clear(confirm);
      await user.type(confirm, 'backup123');
      await user.click(createButton());
      await waitFor(() => expect(api.backup.createToPath).toHaveBeenCalledWith({ password: 'backup123', destPath: BACKUP_PATH }));
    });

    it('desktop: a cancelled save dialog does nothing', async () => {
      localDesktop();
      vi.mocked(platform.pickSavePath).mockResolvedValue(null);
      const { user } = renderWithProviders(<BackupPage />, { auth: 'authenticated' });
      await user.click(createButton());
      await waitFor(() => expect(politeRegion()).toHaveTextContent(ST.cancelled));
      expect(api.backup.createToPath).not.toHaveBeenCalled();
    });

    it('browser: downloads the file and saves the blob', async () => {
      const { user } = renderWithProviders(<BackupPage />, { auth: 'authenticated' });
      await user.click(createButton());
      await waitFor(() => expect(api.backup.download).toHaveBeenCalledWith({}));
      await waitFor(() => expect(download.saveBlob).toHaveBeenCalledTimes(1));
      expect(vi.mocked(download.saveBlob).mock.calls[0][1]).toBe('your-personal-diary-backup-dana.mpd');
      expect(platform.pickSavePath).not.toHaveBeenCalled();
      expect(api.backup.createToPath).not.toHaveBeenCalled();
      await waitFor(() => expect(politeRegion()).toHaveTextContent(ST.backupCreated('your-personal-diary-backup-dana.mpd', 3)));
    });
  });

  describe('export', () => {
    it('desktop: builds the ExportRequest from the form and writes it through toPath', async () => {
      localDesktop();
      vi.mocked(platform.pickSavePath).mockResolvedValue('C:\\Exports\\x.csv');
      const { user } = renderWithProviders(<BackupPage />, { auth: 'authenticated' });
      await user.click(screen.getByRole('radio', { name: /^CSV/ }));
      fireEvent.change(screen.getByLabelText(new RegExp(`^${ST.exportFrom}`)), { target: { value: '2026-01-01' } });
      fireEvent.change(screen.getByLabelText(new RegExp(`^${ST.exportTo}`)), { target: { value: '2026-01-31' } });
      // The CSV has no habits table: the box is shown off and disabled, with a hint saying so.
      const habits = screen.getByRole('checkbox', { name: new RegExp(`^${ST.includeHabits}`) });
      expect(habits).not.toBeChecked();
      expect(habits).toBeDisabled();
      expect(habits).toHaveAccessibleDescription(ST.includeHabitsCsv);
      await user.click(exportButton());

      await waitFor(() => expect(api.exportApi.toPath).toHaveBeenCalledTimes(1));
      expect(platform.pickSavePath).toHaveBeenCalledWith(`your-personal-diary-export-${todayIso()}.csv`, [exportFileFilter('csv')]);
      expect(exportFileFilter('csv')).toEqual({ name: ST.exportFilterName('csv'), extensions: ['csv'] });
      expect(api.exportApi.toPath).toHaveBeenCalledWith({ format: 'csv', from: '2026-01-01', to: '2026-01-31', includeHabits: false, destPath: 'C:\\Exports\\x.csv' });
      expect(api.exportApi.download).not.toHaveBeenCalled();
      await waitFor(() => expect(politeRegion()).toHaveTextContent(ST.exportDoneWithFile(12, 'x.csv')));
    });

    it('keeps the habits choice when the format moves away from CSV and back', async () => {
      const { user } = renderWithProviders(<BackupPage />, { auth: 'authenticated' });
      const habits = () => screen.getByRole('checkbox', { name: new RegExp(`^${ST.includeHabits}`) });
      expect(habits()).toBeChecked();
      expect(habits()).toBeEnabled();
      expect(screen.queryByText(ST.includeHabitsCsv)).not.toBeInTheDocument();
      await user.click(screen.getByRole('radio', { name: /^CSV/ }));
      expect(habits()).not.toBeChecked();
      expect(screen.getByText(ST.includeHabitsCsv)).toBeInTheDocument();
      await user.click(screen.getByRole('radio', { name: /^PDF/ }));
      expect(habits()).toBeChecked();
      expect(habits()).toBeEnabled();
      await user.click(exportButton());
      await waitFor(() => expect(api.exportApi.download).toHaveBeenCalledWith({ format: 'pdf', includeHabits: true }));
    });

    it('browser: downloads with the chosen format, without dates and without habits', async () => {
      const { user } = renderWithProviders(<BackupPage />, { auth: 'authenticated' });
      await user.click(screen.getByRole('radio', { name: /^JSON/ }));
      await user.click(screen.getByRole('checkbox', { name: new RegExp(`^${ST.includeHabits}`) }));
      await user.click(exportButton());

      await waitFor(() => expect(api.exportApi.download).toHaveBeenCalledWith({ format: 'json', includeHabits: false }));
      await waitFor(() => expect(download.saveBlob).toHaveBeenCalledTimes(1));
      expect(vi.mocked(download.saveBlob).mock.calls[0][1]).toBe('your-personal-diary-export.json');
      expect(api.exportApi.toPath).not.toHaveBeenCalled();
      await waitFor(() => expect(politeRegion()).toHaveTextContent(ST.exportDoneWithFile(12, 'your-personal-diary-export.json')));
    });

    it('rejects a range whose end is before its start', async () => {
      const { user } = renderWithProviders(<BackupPage />, { auth: 'authenticated' });
      const from = screen.getByLabelText(new RegExp(`^${ST.exportFrom}`));
      const to = screen.getByLabelText(new RegExp(`^${ST.exportTo}`));
      fireEvent.change(from, { target: { value: '2026-02-01' } });
      fireEvent.change(to, { target: { value: '2026-01-01' } });
      await user.click(exportButton());
      expect(api.exportApi.download).not.toHaveBeenCalled();
      expect(api.exportApi.toPath).not.toHaveBeenCalled();
      expect(to).toHaveAttribute('aria-invalid', 'true');
      expect(to).toHaveAccessibleDescription(ST.exportRangeError);
      expect(to).toHaveFocus();
    });
  });

  describe('restore', () => {
    it('browser: inspects the chosen file, confirms and restores with the password', async () => {
      const { user } = renderWithProviders(<BackupPage />, { auth: 'authenticated' });
      const file = new File(['MPDIARY'], 'backup.mpd', { type: 'application/octet-stream' });
      const input = screen.getByLabelText(new RegExp(`^${ST.backupFileField}`)) as HTMLInputElement;
      await user.upload(input, file);

      await waitFor(() => expect(api.backup.inspectFile).toHaveBeenCalledWith(file));
      // The description is also announced, so look inside the card only.
      const restoreCard = within(card(ST.restore));
      expect(await restoreCard.findByText(validInfo.description)).toBeInTheDocument();
      expect(restoreCard.getByText('backup.mpd')).toBeInTheDocument();

      await user.click(restoreButton());
      expect(api.backup.restoreFromFile).not.toHaveBeenCalled();
      const password = within(card(ST.restore)).getByLabelText(new RegExp(`^${ST.backupPassword}`));
      expect(password).toHaveAttribute('aria-invalid', 'true');
      expect(password).toHaveFocus();

      await user.type(password, 'pw123456');
      await user.click(restoreButton());
      const dialog = screen.getByRole('dialog', { name: ST.restoreTitle });
      expect(within(dialog).getByText(ST.restoreWarning)).toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: ST.restoreConfirm }));

      await waitFor(() => expect(api.backup.restoreFromFile).toHaveBeenCalledWith(file, 'pw123456'));
      const expected = ST.restored(10, 2);
      await waitFor(() => expect(politeRegion()).toHaveTextContent(expected));
      expect(document.querySelector('.alert--success')).toHaveTextContent(expected);
      await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
    });

    it('desktop: picks a path, inspects it and shows a wrong backup password at the password field', async () => {
      localDesktop();
      vi.mocked(api.backup.restoreFromPath).mockRejectedValue(
        new ApiClientError(400, { code: 'WRONG_PASSWORD', message: 'הסיסמה שגויה או שהקובץ פגום.', field: 'password' }),
      );
      const { user } = renderWithProviders(<BackupPage />, { auth: 'authenticated' });
      await user.click(screen.getByRole('button', { name: ST.pickBackupFile }));
      await waitFor(() => expect(api.backup.inspectPath).toHaveBeenCalledWith(BACKUP_PATH));
      expect(await within(card(ST.restore)).findByText(validInfo.description)).toBeInTheDocument();

      const password = within(card(ST.restore)).getByLabelText(new RegExp(`^${ST.backupPassword}`));
      await user.type(password, 'wrong1234');
      await user.click(restoreButton());
      const dialog = screen.getByRole('dialog', { name: ST.restoreTitle });
      await user.click(within(dialog).getByRole('button', { name: ST.restoreConfirm }));

      await waitFor(() => expect(api.backup.restoreFromPath).toHaveBeenCalledWith(BACKUP_PATH, 'wrong1234'));
      await waitFor(() => expect(password).toHaveAttribute('aria-invalid', 'true'));
      expect(password).toHaveAccessibleDescription('הסיסמה שגויה או שהקובץ פגום.');
      await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
      // Focus lands on the field with the error, not back on the dialog's opener.
      await waitFor(() => expect(password).toHaveFocus());
      // The file-info box is a success Alert; the restore itself must not be reported as done.
      expect(screen.queryByText(ST.restored(10, 2))).not.toBeInTheDocument();
      expect(document.querySelector('.toast--success')).toBeNull();
    });

    it('refuses to restore an invalid file', async () => {
      vi.mocked(api.backup.inspectFile).mockResolvedValue({ valid: false, version: null, sizeBytes: 10, description: `הקובץ אינו קובץ גיבוי של "${APP_NAME}".` });
      const { user } = renderWithProviders(<BackupPage />, { auth: 'authenticated' });
      const input = screen.getByLabelText(new RegExp(`^${ST.backupFileField}`)) as HTMLInputElement;
      await user.upload(input, new File(['nope'], 'notes.mpd'));
      expect(await within(card(ST.restore)).findByText(`הקובץ אינו קובץ גיבוי של "${APP_NAME}".`)).toBeInTheDocument();
      await user.type(within(card(ST.restore)).getByLabelText(new RegExp(`^${ST.backupPassword}`)), 'pw123456');
      await user.click(restoreButton());
      expect(screen.queryByRole('dialog', { name: ST.restoreTitle })).not.toBeInTheDocument();
      expect(api.backup.restoreFromFile).not.toHaveBeenCalled();
      expect(input).toHaveAccessibleDescription(new RegExp(ST.invalidBackupFile));
    });
  });
});
