/**
 * "Required update" in the owner's Server card (src/pages/settings/ServerAppUpdate.tsx, app version 1.1.0): one row
 * per platform with its state, the oldest version that may still be used (this app's own version as a
 * suggestion while there is no rule) and Save / Turn off; the warning above the rows; the newest version of the
 * Downloads page as a hint; the account password for every change; the form checked as the server checks it;
 * the server's own message when it refuses. The api is a mock (src/test/api-mock.ts); fictional data only.
 */
import { type ReactNode, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { APP_VERSION } from '@shared/constants';
import { getCatalog, LOCALE_CODES, t } from '@shared/i18n';
import type { ServerInfo, ServerSettings } from '@shared/types';
import * as api from '@/api';
import { __resetConnectionForTests, ApiClientError, setServerInfo } from '@/api';
import { LockContext } from '@/context/LockContext';
import { trWith } from '@/i18n/runtime';
import { serverAppUpdateFixture, serverDiskFixture, serverDownloadsFixture, serverStatusFixture } from '@/test/api-mock';
import { assertiveRegion, renderWithProviders, sampleUser } from '@/test/render';
import { ServerSection } from './ServerSection';
import { checkMinVersion, UPDATE_PASSWORD_ID, UPDATE_RESULT_ID, updateVersionId } from './ServerAppUpdate';
import { UPT } from './serverTexts';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const en = trWith('en');
const he = trWith('he');
const PASSWORD = 'Passw0rd!';

const hostedInfo: ServerInfo = {
  version: '1.1.0',
  port: 8080,
  lanEnabled: false,
  lanUrls: [],
  dataDir: '',
  isLocalRequest: false,
  startedAt: '2026-11-25T08:00:00.000Z',
  mode: 'hosted',
  publicUrl: 'https://diary.example.org',
  storageOk: true,
  ownerConfigured: true,
};
const ownerSettings: ServerSettings = { port: 8080, lanEnabled: false, isRemoteOwner: false, isMailOwner: true, isLanOwner: false, isServerOwner: true };

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

/** The required-update part of the card (its h3 names it), once the rules are read. */
async function part(title = en('settings.server.update.title')): Promise<HTMLElement> {
  const heading = await screen.findByRole('heading', { level: 3, name: title });
  const section = heading.closest('section') as HTMLElement;
  await within(section).findByRole('group', { name: 'Android' });
  return section;
}
const byId = (id: string) => document.getElementById(id) as HTMLInputElement;

beforeEach(() => {
  __resetConnectionForTests();
  setServerInfo({ ...hostedInfo });
  vi.mocked(api.server.info).mockReset().mockResolvedValue({ ...hostedInfo });
  vi.mocked(api.server.getSettings).mockReset().mockResolvedValue({ ...ownerSettings });
  vi.mocked(api.server.status).mockReset().mockResolvedValue(serverStatusFixture());
  vi.mocked(api.server.downloads.list).mockReset().mockResolvedValue(serverDownloadsFixture());
  vi.mocked(api.server.disk.get).mockReset().mockResolvedValue(serverDiskFixture());
  vi.mocked(api.server.appUpdate.get).mockReset().mockResolvedValue(serverAppUpdateFixture());
  vi.mocked(api.server.appUpdate.set).mockReset();
});

afterEach(() => {
  __resetConnectionForTests();
});

describe('checkMinVersion - the server\'s rule, checked before the request', () => {
  it('empty turns the rule off; a.b.c up to the server\'s own version is sent; anything else is said', () => {
    expect(checkMinVersion('', '1.1.0')).toEqual({ minVersion: null });
    expect(checkMinVersion('   ', '1.1.0')).toEqual({ minVersion: null });
    expect(checkMinVersion(' 1.1.0 ', '1.1.0')).toEqual({ minVersion: '1.1.0' });
    expect(checkMinVersion('1.0.1', '1.1.0')).toEqual({ minVersion: '1.0.1' });
    expect(checkMinVersion('1.1', '1.1.0')).toEqual({ error: UPT.invalidVersion });
    expect(checkMinVersion('v1.1.0', '1.1.0')).toEqual({ error: UPT.invalidVersion });
    expect(checkMinVersion('1.2.0', '1.1.0')).toEqual({ error: UPT.tooNew('1.1.0') });
  });
});

describe('the section', () => {
  it('the warning above the rows, one row per platform with its state, the suggestion and the Downloads hint', async () => {
    vi.mocked(api.server.appUpdate.get).mockResolvedValue(serverAppUpdateFixture({ rules: { android: '1.0.1', ios: null, windows: null, mac: null } }));
    renderCard();
    const section = await part();
    expect(within(section).getByText(en('settings.server.update.intro'))).toBeInTheDocument();
    const warning = within(section).getByText(en('settings.server.update.warning'));
    expect(warning).toHaveClass('server-card__warning');
    expect(within(section).getByText(en('settings.server.update.offline'))).toBeInTheDocument();
    const groups = within(section).getAllByRole('group');
    expect(groups.map((g) => g.querySelector('legend')?.textContent)).toEqual(['Android', 'iPhone', 'Windows', 'Mac']);
    // The warning comes before the rows.
    expect(warning.compareDocumentPosition(groups[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const android = within(section).getByRole('group', { name: 'Android' });
    expect(within(android).getByText('Versions older than 1.0.1 must update')).toBeInTheDocument();
    expect(byId(updateVersionId('android'))).toHaveValue('1.0.1');
    expect(within(android).getByRole('button', { name: 'Turn off the rule for Android' })).toBeInTheDocument();
    const ios = within(section).getByRole('group', { name: 'iPhone' });
    expect(within(ios).getByText('No update is required')).toBeInTheDocument();
    // No rule: this app's own version as the suggestion, and no "Turn off".
    expect(byId(updateVersionId('ios'))).toHaveValue(APP_VERSION);
    expect(within(ios).queryByRole('button', { name: /Turn off/ })).not.toBeInTheDocument();
    // The newest file of the Downloads page as a hint where the server knows one (none for the iPhone).
    expect(byId(updateVersionId('windows'))).toHaveAccessibleDescription(expect.stringContaining('Newest file on the Downloads page: 1.0.1'));
    expect(byId(updateVersionId('ios'))).toHaveAccessibleDescription('For example 1.1.0. Empty: no update is required.');
    expect(within(ios).queryByText(/Newest file/)).not.toBeInTheDocument();
    expect(within(android).getByText(/For example 1\.1\.0\. Empty: no update is required\. Newest file on the Downloads page: 1\.0\.1/)).toBeInTheDocument();
  });

  it('Save sends the platform, the version and the password; the answer is shown, the password forgotten', async () => {
    vi.mocked(api.server.appUpdate.set).mockResolvedValue(serverAppUpdateFixture({ rules: { android: '1.1.0', ios: null, windows: null, mac: null } }));
    const { user } = renderCard();
    const section = await part();
    await user.clear(byId(updateVersionId('android')));
    await user.type(byId(updateVersionId('android')), '1.1.0');
    await user.type(byId(UPDATE_PASSWORD_ID), PASSWORD);
    await user.click(within(section).getByRole('button', { name: 'Save the rule for Android' }));
    expect(api.server.appUpdate.set).toHaveBeenCalledWith({ platform: 'android', minVersion: '1.1.0', password: PASSWORD });
    expect(await within(section).findByText('Versions older than 1.1.0 must update')).toBeInTheDocument();
    await waitFor(() => expect(byId(UPDATE_RESULT_ID)).toHaveFocus());
    expect(byId(UPDATE_RESULT_ID)).toHaveTextContent('Android: Saved.');
    expect(byId(UPDATE_PASSWORD_ID)).toHaveValue('');
  });

  it('Turn off sends null; the row says no update is required and offers this app\'s version again', async () => {
    vi.mocked(api.server.appUpdate.get).mockResolvedValue(serverAppUpdateFixture({ rules: { android: null, ios: null, windows: '1.0.1', mac: null } }));
    vi.mocked(api.server.appUpdate.set).mockResolvedValue(serverAppUpdateFixture());
    const { user } = renderCard();
    const section = await part();
    await user.type(byId(UPDATE_PASSWORD_ID), PASSWORD);
    await user.click(within(section).getByRole('button', { name: 'Turn off the rule for Windows' }));
    expect(api.server.appUpdate.set).toHaveBeenCalledWith({ platform: 'windows', minVersion: null, password: PASSWORD });
    await waitFor(() => expect(byId(UPDATE_RESULT_ID)).toHaveTextContent('Windows: Turned off.'));
    const windows = within(section).getByRole('group', { name: 'Windows' });
    expect(within(windows).getByText('No update is required')).toBeInTheDocument();
    expect(byId(updateVersionId('windows'))).toHaveValue(APP_VERSION);
  });

  it('a version that is not a.b.c or is above the server\'s own is said at the field; nothing is sent', async () => {
    const { user } = renderCard();
    const section = await part();
    await user.type(byId(UPDATE_PASSWORD_ID), PASSWORD);
    await user.clear(byId(updateVersionId('mac')));
    await user.type(byId(updateVersionId('mac')), '1.1');
    await user.click(within(section).getByRole('button', { name: 'Save the rule for Mac' }));
    await waitFor(() => expect(byId(updateVersionId('mac'))).toHaveAccessibleDescription(expect.stringContaining('Write a version such as 1.1.0.')));
    expect(byId(updateVersionId('mac'))).toHaveFocus();
    await user.clear(byId(updateVersionId('mac')));
    await user.type(byId(updateVersionId('mac')), '2.0.0');
    await user.click(within(section).getByRole('button', { name: 'Save the rule for Mac' }));
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent("This version is newer than the server's own (1.1.0). Nobody has it yet."));
    expect(api.server.appUpdate.set).not.toHaveBeenCalled();
  });

  it('without the password nothing is sent; a wrong one is the server\'s message at the password field', async () => {
    vi.mocked(api.server.appUpdate.set).mockRejectedValue(new ApiClientError(400, { code: 'WRONG_PASSWORD', field: 'password', message: 'The password is not correct.' }));
    const { user } = renderCard();
    const section = await part();
    await user.click(within(section).getByRole('button', { name: 'Save the rule for Android' }));
    expect(api.server.appUpdate.set).not.toHaveBeenCalled();
    await waitFor(() => expect(byId(UPDATE_PASSWORD_ID)).toHaveFocus());
    await user.type(byId(UPDATE_PASSWORD_ID), 'wrong');
    await user.click(within(section).getByRole('button', { name: 'Save the rule for Android' }));
    await waitFor(() => expect(byId(UPDATE_PASSWORD_ID)).toHaveAccessibleDescription(expect.stringContaining('The password is not correct.')));
    expect(byId(UPDATE_PASSWORD_ID)).toHaveValue('');
  });

  it('the server\'s own refusal: at the version field (field minVersion), or above the rows', async () => {
    vi.mocked(api.server.appUpdate.set)
      .mockRejectedValueOnce(new ApiClientError(400, { code: 'VALIDATION', field: 'minVersion', message: "This version is newer than the server's own (1.0.9). Nobody has it yet." }))
      .mockRejectedValueOnce(new ApiClientError(429, { code: 'OTHER', message: 'Too many attempts. Wait a few minutes.' }));
    const { user } = renderCard();
    const section = await part();
    await user.type(byId(UPDATE_PASSWORD_ID), PASSWORD);
    await user.click(within(section).getByRole('button', { name: 'Save the rule for iPhone' }));
    await waitFor(() => expect(byId(updateVersionId('ios'))).toHaveAccessibleDescription(expect.stringContaining('(1.0.9)')));
    await user.type(byId(UPDATE_PASSWORD_ID), PASSWORD);
    await user.click(within(section).getByRole('button', { name: 'Save the rule for iPhone' }));
    expect(await within(section).findByText('Too many attempts. Wait a few minutes.')).toBeInTheDocument();
  });

  it('says beforehand when no e-mail would be sent about a change', async () => {
    vi.mocked(api.server.appUpdate.get).mockResolvedValue(serverAppUpdateFixture({ email: 'noAddress' }));
    renderCard();
    const section = await part();
    expect(within(section).getByText(en('settings.server.update.emailNoAddress'))).toBeInTheDocument();
  });

  it('locking the app forgets the password', async () => {
    const { user } = renderCard();
    await part();
    await user.type(byId(UPDATE_PASSWORD_ID), PASSWORD);
    lockApp();
    await waitFor(() => expect(byId(UPDATE_PASSWORD_ID)).toHaveValue(''));
  });

  it('a server without the routes (404) shows nothing of it; one that refuses them (403) shows its sentence', async () => {
    vi.mocked(api.server.appUpdate.get).mockRejectedValue(new ApiClientError(404, { code: 'NOT_FOUND', message: 'Not found.' }));
    const { unmount } = renderCard();
    await screen.findByRole('heading', { level: 3, name: en('settings.server.downloads.title') });
    await waitFor(() => expect(api.server.appUpdate.get).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('server-app-update')).not.toBeInTheDocument());
    unmount();
    vi.mocked(api.server.appUpdate.get).mockRejectedValue(new ApiClientError(403, { code: 'FORBIDDEN', message: 'Required updates are not available on this server.' }));
    renderCard();
    expect(await screen.findByText('Required updates are not available on this server.')).toBeInTheDocument();
  });

  it('Hebrew: the owner\'s words, the platform names in Latin letters', async () => {
    vi.mocked(api.server.appUpdate.get).mockResolvedValue(serverAppUpdateFixture({ rules: { android: '1.0.1', ios: null, windows: null, mac: null } }));
    renderCard('he');
    const section = await part(he('settings.server.update.title'));
    expect(within(section).getByRole('heading', { level: 3 })).toHaveTextContent('עדכון חובה');
    expect(within(section).getByText('מדליקים את זה רק אחרי שהחנות כבר מציעה את הגרסה החדשה לכולם. אם מדליקים קודם, מי שיש לו גרסה ישנה נחסם ואין לו מה להתקין.')).toBeInTheDocument();
    expect(within(section).getByText('גרסאות ישנות מ-1.0.1 חייבות לעדכן')).toBeInTheDocument();
    expect(within(section).getAllByText('אין עדכון חובה')).toHaveLength(3);
    expect(UPT.platformName('ios')).toBe('iPhone');
    expect(byId(updateVersionId('android'))).toHaveAttribute('dir', 'ltr');
  });
});

describe('the buttons of a row: the accessible name contains the visible label (WCAG 2.5.3, Label in Name)', () => {
  it('in every language, "Save" and "Turn off" of the row are inside their names with the platform', () => {
    for (const code of LOCALE_CODES) {
      for (const [visibleKey, nameKey] of [
        ['settings.server.update.save', 'settings.server.update.saveFor'],
        ['settings.server.update.turnOff', 'settings.server.update.turnOffFor'],
      ] as const) {
        const visible = t(code, visibleKey).toLocaleLowerCase(code);
        const name = t(code, nameKey, { platform: 'Android' }).toLocaleLowerCase(code);
        expect(name, `${code} ${nameKey}`).toContain(visible);
        expect(name, `${code} ${nameKey}`).toContain('android');
      }
    }
  });
});

describe('French typography of the required-update texts (the rule of the fr catalogue header)', () => {
  it('a no-break space, never an ordinary one, before : ; ? ! and inside « »', () => {
    const keys = Object.keys(getCatalog('fr')).filter(
      (key) => key.startsWith('shell.update.') || key.startsWith('settings.server.update.'),
    );
    expect(keys.length).toBeGreaterThan(20);
    for (const key of keys) {
      const text = t('fr', key, { version: '1.1.0', platform: 'Android' });
      expect(text, key).not.toMatch(/ [:;?!»]|« /);
    }
  });
});
