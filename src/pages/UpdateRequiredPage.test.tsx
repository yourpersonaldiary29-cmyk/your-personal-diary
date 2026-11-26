/**
 * The "Update needed" screen (src/pages/UpdateRequiredPage.tsx, app version 1.1.0), per platform:
 *  - Android: "Open Google Play" with the server's store link, else "Open the Downloads page" (the site's page in
 *    the app's language); iPhone: "Open the App Store" with the link, else only "Update the app in the App Store.";
 *    Windows and Mac: "Open the Downloads page", opened by the shell (`open_external_url`) - and when that fails the
 *    address as text;
 *  - the app's name, ONE h1 that takes the focus, the installed version in the first sentence, the second sentence;
 *  - "Check again": the rule still applies -> "This version still needs an update." under the button and
 *    announced; no connection -> "Still no connection to the diary server."; the rule is gone -> nothing to say.
 * Store links are put together from parts (scripts/check-no-network.mjs scans src/).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { t } from '@shared/i18n';
import type { AppUpdateInfo, ServerInfo } from '@shared/types';
import * as api from '@/api';
import { ApiClientError } from '@/api';
import { __resetConnectionForTests, setServerInfo } from '@/api/connection';
import { DEFAULT_SERVER_URL } from '@/config/server-default';
import { __resetConnectionContextForTests } from '@/context/ConnectionContext';
import { assertiveRegion, politeRegion, renderWithProviders } from '@/test/render';
import type { UpdateRequirement } from '@/utils/appUpdate';
import UpdateRequiredPage from './UpdateRequiredPage';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const en = (key: string, params?: Record<string, string>) => t('en', key, params);
const PLAY = ['https:', '', 'play.google.com', 'store', 'apps', 'details?id=app.example'].join('/');
const APPLE = ['https:', '', 'apps.apple.com', 'app', 'id000000000'].join('/');

function need(platform: UpdateRequirement['platform'], storeUrl: string | null = null): UpdateRequirement {
  return { platform, installed: '1.1.0', minVersion: '1.2.0', storeUrl };
}

function info(appUpdate?: AppUpdateInfo): ServerInfo {
  return { version: '1.2.0', port: 8080, lanEnabled: false, lanUrls: [], dataDir: '', isLocalRequest: false, startedAt: '', mode: 'hosted', ...(appUpdate ? { appUpdate } : {}) };
}

beforeEach(() => {
  __resetConnectionForTests();
  __resetConnectionContextForTests();
});

afterEach(() => {
  vi.mocked(invoke).mockReset();
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  __resetConnectionForTests();
});

describe('what the screen shows', () => {
  it('the app name, one h1 with the focus, the installed version and the two sentences', () => {
    renderWithProviders(<UpdateRequiredPage requirement={need('android', PLAY)} />, { locale: 'en' });
    expect(screen.getByText('Your Personal Diary')).toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('Update needed');
    expect(headings[0]).toHaveFocus();
    expect(document.title).toContain('Update needed');
    expect(screen.getByText(en('shell.update.body', { version: '1.1.0' }))).toBeInTheDocument();
    expect(screen.getByText('This version of Your Personal Diary (1.1.0) can no longer be used. Install the new version to go on using your diary.')).toBeInTheDocument();
    expect(screen.getByText('Your diary is safe: it is kept in your account, and the update deletes nothing.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument();
  });

  it('Android with the store link: a real link "Open Google Play" to that address, opened by the WebView itself', () => {
    renderWithProviders(<UpdateRequiredPage requirement={need('android', PLAY)} />, { locale: 'en' });
    const link = screen.getByRole('link', { name: 'Open Google Play' });
    expect(link).toHaveAttribute('href', PLAY);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveClass('btn');
  });

  it('Android without a store link: "Open the Downloads page" of the site in the app\'s language', () => {
    renderWithProviders(<UpdateRequiredPage requirement={need('android')} />, { locale: 'he' });
    const link = screen.getByRole('link', { name: 'פתיחת דף ההורדות' });
    expect(link).toHaveAttribute('href', `${DEFAULT_SERVER_URL}/about/he/downloads/`);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('צריך לעדכן את האפליקציה');
    expect(screen.getByRole('button', { name: 'בדיקה חוזרת' })).toBeInTheDocument();
  });

  it('iPhone with the link: "Open the App Store"; without it only the sentence, no button that leads nowhere', () => {
    const { unmount } = renderWithProviders(<UpdateRequiredPage requirement={need('ios', APPLE)} />, { locale: 'en' });
    expect(screen.getByRole('link', { name: 'Open the App Store' })).toHaveAttribute('href', APPLE);
    unmount();
    renderWithProviders(<UpdateRequiredPage requirement={need('ios')} />, { locale: 'en' });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Update the app in the App Store.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument();
  });

  it('Windows and Mac: "Open the Downloads page", handed to the shell; when it cannot open it, the address as text', async () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    vi.mocked(invoke).mockResolvedValueOnce(undefined).mockRejectedValueOnce('refused');
    const { user } = renderWithProviders(<UpdateRequiredPage requirement={need('windows')} />, { locale: 'en' });
    const link = screen.getByRole('link', { name: 'Open the Downloads page' });
    const url = `${DEFAULT_SERVER_URL}/about/downloads/`;
    expect(link).toHaveAttribute('href', url);
    await user.click(link);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('open_external_url', { url }));
    expect(screen.queryByTestId('update-required-address')).not.toBeInTheDocument();
    // The second time the shell refuses (an older shell, no browser): the address to open by hand.
    await user.click(link);
    expect(await screen.findByTestId('update-required-address')).toHaveTextContent(en('shell.legal.openInBrowser', { url }));
  });

  it('the Mac app opens the Downloads page in the app\'s language', async () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    vi.mocked(invoke).mockResolvedValue(undefined);
    const { user } = renderWithProviders(<UpdateRequiredPage requirement={need('mac')} />, { locale: 'de' });
    await user.click(screen.getByRole('link', { name: 'Downloads-Seite öffnen' }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('open_external_url', { url: `${DEFAULT_SERVER_URL}/about/de/downloads/` }));
  });

  it('the buttons are real controls with the touch-target class, in a right-to-left page as well', () => {
    renderWithProviders(<UpdateRequiredPage requirement={need('android', PLAY)} />, { locale: 'ar' });
    expect(screen.getByRole('link', { name: 'فتح Google Play' })).toHaveClass('btn', 'btn--lg');
    expect(screen.getByRole('button', { name: 'التحقق مرة أخرى' })).toHaveClass('btn', 'btn--lg');
  });
});

describe('"Check again"', () => {
  it('the rule still applies: "This version still needs an update." under the button, announced', async () => {
    const rules = { android: { minVersion: '1.2.0' } };
    setServerInfo(info(rules));
    vi.mocked(api.server.info).mockResolvedValue(info(rules));
    const { user } = renderWithProviders(<UpdateRequiredPage requirement={need('android')} />, { locale: 'en' });
    await user.click(screen.getByRole('button', { name: 'Check again' }));
    expect(api.server.info).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId('update-required-status')).toHaveTextContent('This version still needs an update.'));
    // Said once: politely through the announcer, and the visible line is not a second live region.
    expect(screen.getByTestId('update-required-status')).not.toHaveAttribute('role');
    expect(screen.getByTestId('update-required-status').closest('[role=status],[aria-live]')).toBeNull();
    await waitFor(() => expect(politeRegion()).toHaveTextContent('This version still needs an update.'));
    expect(assertiveRegion()).not.toHaveTextContent('This version still needs an update.');
  });

  it('the server cannot be reached: "Still no connection to the diary server."', async () => {
    vi.mocked(api.server.info).mockRejectedValue(new ApiClientError(0, { code: 'OTHER', message: 'offline' }));
    const { user } = renderWithProviders(<UpdateRequiredPage requirement={need('windows')} />, { locale: 'en' });
    await user.click(screen.getByRole('button', { name: 'Check again' }));
    await waitFor(() => expect(screen.getByTestId('update-required-status')).toHaveTextContent(en('shell.connection.failed')));
    await waitFor(() => expect(politeRegion()).toHaveTextContent(en('shell.connection.failed')));
    expect(assertiveRegion()).not.toHaveTextContent(en('shell.connection.failed'));
  });

  it('the rule is gone: the new self-description is in the store (the app takes the screen away), nothing is said', async () => {
    setServerInfo(info({ android: { minVersion: '1.2.0' } }));
    vi.mocked(api.server.info).mockResolvedValue(info());
    const { user } = renderWithProviders(<UpdateRequiredPage requirement={need('android')} />, { locale: 'en' });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Check again' }));
    });
    await waitFor(() => expect(api.getServerInfo()?.appUpdate).toBeUndefined());
    expect(screen.getByTestId('update-required-status')).toHaveTextContent('');
  });
});
