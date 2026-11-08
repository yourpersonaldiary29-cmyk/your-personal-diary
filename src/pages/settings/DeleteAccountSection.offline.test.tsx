/**
 * Deleting the account while offline mode runs (docs/android-tasks/OFFLINE-DESIGN.md sections 4.8 and
 * 6.2; WP-H10c): the dialog says that the changes not yet uploaded go too and that changes still waiting
 * on the other devices are lost; after the deletion this device's offline copy is wiped explicitly
 * (`offline.wipeAccount`, never inside `clearSignedOutAccountData` - E16). Without a connection the button
 * is disabled with "This needs a connection to the diary server." as its description.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import * as api from '@/api';
import { T } from '@/constants/texts';
import { trWith } from '@/i18n/runtime';
import { offline, type SyncNote } from '@/offline';
import { __resetSyncStatusForTests, patchSyncStatus } from '@/offline/status';
import { renderWithProviders, sampleUser } from '@/test/render';
import { DeleteAccountSection } from './DeleteAccountSection';
import { ST } from './texts';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

const en = trWith('en');

function armedWith(pending: number, notes: number, phase: 'online' | 'offline' = 'online'): void {
  vi.spyOn(offline, 'isActive').mockReturnValue(true);
  vi.spyOn(offline, 'activeUserId').mockReturnValue(sampleUser.id);
  vi.spyOn(offline.notes, 'list').mockReturnValue(Array.from({ length: notes }, (_, i) => ({ id: i + 1 }) as SyncNote));
  patchSyncStatus({ enabled: true, userId: sampleUser.id, phase, showOffline: phase === 'offline', pending });
}

beforeEach(() => {
  __resetSyncStatusForTests();
  vi.mocked(api.server.getSettings).mockResolvedValue({} as never);
  vi.mocked(api.auth.accounts).mockResolvedValue({ accounts: [{ id: 'u2' }] } as never);
  vi.mocked(api.auth.deleteAccount).mockReset().mockResolvedValue(undefined as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  __resetSyncStatusForTests();
});

describe('account deletion with offline mode', () => {
  it('the dialog names the changes that go too; after the deletion the device copy is wiped', async () => {
    armedWith(2, 1);
    const wipe = vi.spyOn(offline, 'wipeAccount').mockResolvedValue(undefined);
    const endSession = vi.fn();
    const { user } = renderWithProviders(<DeleteAccountSection />, { auth: 'authenticated', locale: 'en', authOverrides: { endSession } });
    await user.click(screen.getByRole('button', { name: ST.deleteAccountButton }));
    const dialog = await screen.findByRole('dialog');
    const line = within(dialog).getByTestId('delete-account-offline');
    expect(line).toHaveTextContent(en('shell.sync.deleteAccount.pending', { count: 3 }));
    expect(line).toHaveTextContent(en('shell.sync.deleteAccount.otherDevices'));
    expect(dialog).toHaveAccessibleDescription(expect.stringContaining(en('shell.sync.deleteAccount.otherDevices')));

    await user.type(within(dialog).getByLabelText(new RegExp(`^${T.password}`)), 'fictional-password');
    await user.click(within(dialog).getByRole('checkbox', { name: ST.deleteAccountUnderstand }));
    await user.click(within(dialog).getByRole('button', { name: ST.deleteAccountConfirm }));
    await waitFor(() => expect(api.auth.deleteAccount).toHaveBeenCalledWith('fictional-password'));
    await waitFor(() => expect(wipe).toHaveBeenCalledWith(sampleUser.id));
    await waitFor(() => expect(endSession).toHaveBeenCalled());
  });

  it('nothing waiting: only the line about the other devices', async () => {
    armedWith(0, 0);
    const { user } = renderWithProviders(<DeleteAccountSection />, { auth: 'authenticated', locale: 'en' });
    await user.click(screen.getByRole('button', { name: ST.deleteAccountButton }));
    const line = within(await screen.findByRole('dialog')).getByTestId('delete-account-offline');
    expect(line).toHaveTextContent(en('shell.sync.deleteAccount.otherDevices'));
    expect(line).not.toHaveTextContent(en('shell.sync.deleteAccount.pending', { count: 0 }));
  });

  it('without a connection the button is disabled and says why', () => {
    armedWith(1, 0, 'offline');
    renderWithProviders(<DeleteAccountSection />, { auth: 'authenticated', locale: 'en' });
    const button = screen.getByRole('button', { name: ST.deleteAccountButton });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(en('shell.sync.needsConnection'));
  });
});
