/**
 * "Deletion request by e-mail" in the owner's Server card (DeletionRequest.tsx, docs/android-tasks/
 * ADMIN-TOOL.md item 3): the owner types the requester's address and gets the two ready commands of the
 * operator tool for his own PowerShell - find, then delete with --confirm <username> - each with a Copy
 * button, plus the line "check that the request came from the address registered in the account". It
 * makes no server call, and nothing in the app's code addresses the admin API. English and Hebrew (RTL),
 * all 20 languages. Fictional addresses only.
 */
import { useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import type { ServerInfo, ServerSettings, ServerStatus } from '@shared/types';
import * as api from '@/api';
import { __resetConnectionForTests, ApiClientError, setServerInfo } from '@/api';
import { T } from '@/constants/texts';
import { LockContext } from '@/context/LockContext';
import { trWith } from '@/i18n/runtime';
import { serverStatusFixture } from '@/test/api-mock';
import { politeRegion, renderWithProviders, sampleUser } from '@/test/render';
import * as platform from '@/utils/platform';
import { deleteCommand, findCommand } from './adminCommands';
import { DELETION_COPY_DELETE_ID, DELETION_COPY_FIND_ID, DELETION_EMAIL_ID, DELETION_USERNAME_ID } from './DeletionRequest';
import { ServerSection } from './ServerSection';
import { DRT, SVT } from './serverTexts';

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

const FLYCTL = 'C:\\Users\\AVI\\.fly\\bin\\flyctl.exe';

const hostedInfo: ServerInfo = {
  version: '0.1.0',
  port: 8080,
  lanEnabled: false,
  lanUrls: [],
  dataDir: '',
  isLocalRequest: false,
  startedAt: '2026-10-20T08:00:00.000Z',
  remoteEnabled: false,
  remoteUrl: 'https://yourpersonaldiary.fly.dev',
  secure: true,
  passwordResetAvailable: true,
  mode: 'hosted',
  publicUrl: 'https://yourpersonaldiary.fly.dev',
  storageOk: true,
  registration: 'open',
  guestTour: true,
  ownerConfigured: true,
};

/** GET /api/server/settings of the hosted server's owner. */
const ownerSettings: ServerSettings = { port: 8080, lanEnabled: false, isRemoteOwner: false, isMailOwner: true, isLanOwner: false, isServerOwner: true };

let lockApp: () => void = () => {};
function StatefulLock({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(false);
  lockApp = () => setLocked(true);
  return <LockContext.Provider value={{ locked, restoredLocked: false, lock: () => setLocked(true), unlock: () => setLocked(false) }}>{children}</LockContext.Provider>;
}

function renderCard(locale: 'en' | 'he' = 'en', info: ServerInfo = hostedInfo) {
  setServerInfo({ ...info });
  vi.mocked(api.server.info).mockResolvedValue({ ...info });
  return renderWithProviders(
    <StatefulLock>
      <ServerSection />
    </StatefulLock>,
    { auth: 'authenticated', user: sampleUser, locale },
  );
}

const byId = (id: string) => document.getElementById(id) as HTMLInputElement | null;
/** The helper's own section (its h3 names it). */
async function helper(name = DRT.title): Promise<HTMLElement> {
  const heading = await screen.findByRole('heading', { level: 3, name });
  return heading.closest('section') as HTMLElement;
}
const settle = () => act(async () => new Promise<void>((r) => setTimeout(r, 20)));

/** Every call made through the API module (all endpoint groups are vi.fn()s here). */
function apiCalls(): number {
  const groups: unknown[] = [api.auth, api.settings, api.habits, api.entries, api.calendar, api.insights, api.stats, api.search, api.backup, api.exportApi, api.server, api.server.remote, api.server.mail];
  let total = 0;
  for (const group of groups) {
    for (const value of Object.values(group as Record<string, unknown>)) {
      if (typeof value === 'function' && 'mock' in value) total += (value as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    }
  }
  return total;
}

beforeEach(() => {
  __resetConnectionForTests();
  vi.mocked(platform.isTauri).mockReturnValue(false);
  vi.mocked(api.server.info).mockReset().mockResolvedValue({ ...hostedInfo });
  vi.mocked(api.server.getSettings).mockReset().mockResolvedValue({ ...ownerSettings });
  vi.mocked(api.server.status).mockReset().mockResolvedValue(serverStatusFixture());
  vi.mocked(api.server.archive).mockReset();
  vi.mocked(api.auth.sessions).mockReset().mockResolvedValue([]);
});

afterEach(() => {
  __resetConnectionForTests();
  vi.restoreAllMocks();
});

describe('the deletion helper of the Server card', () => {
  it('is the last part of the owner\'s card: title, the check line, the address field, and no command before a complete address', async () => {
    renderCard();
    const section = await helper();
    const card = screen.getByRole('heading', { level: 2, name: SVT.title }).closest('section') as HTMLElement;
    expect(card).toContainElement(section);
    // After the archive part (which appears once the status has arrived; the helper is there before).
    const archive = await within(card).findByRole('heading', { level: 3, name: SVT.archiveTitle });
    expect(archive.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(section).getByText(DRT.intro)).toBeInTheDocument();
    const check = within(section).getByText(en('settings.server.deletion.check'));
    expect(check).toHaveTextContent('Check that the request came from the address registered in the account.');
    expect(check).toHaveClass('server-card__warning');
    const field = within(section).getByLabelText(DRT.email);
    expect(field).toHaveAttribute('id', DELETION_EMAIL_ID);
    expect(field).toHaveAttribute('dir', 'ltr');
    expect(field).toHaveAttribute('autocomplete', 'off');
    expect(within(section).getByText(DRT.waiting)).toBeInTheDocument();
    expect(section.querySelector('pre')).toBeNull();
    expect(within(section).queryByRole('button')).not.toBeInTheDocument();
    expect(byId(DELETION_USERNAME_ID)).toBeNull();
  });

  it('builds the exact find and delete lines with Copy buttons - and asks the server nothing', async () => {
    const fetchSpy = typeof globalThis.fetch === 'function' ? vi.spyOn(globalThis, 'fetch') : null;
    const { user } = renderCard();
    const section = await helper();
    await waitFor(() => expect(api.server.status).toHaveBeenCalledTimes(1));
    await settle();
    const before = apiCalls();

    await user.type(byId(DELETION_EMAIL_ID)!, 'dana@example');
    // Not a complete address yet: still no command.
    expect(section.querySelector('pre')).toBeNull();
    await user.type(byId(DELETION_EMAIL_ID)!, '.com');
    const find = `${FLYCTL} ssh console -a yourpersonaldiary -C 'node /app/admin.cjs find dana@example.com'`;
    expect(within(section).getByText(find)).toBeInTheDocument();
    expect(find).toBe(findCommand('yourpersonaldiary', 'dana@example.com'));
    expect(within(section).queryByText(DRT.waiting)).not.toBeInTheDocument();
    expect(within(section).queryByText(DRT.encoded)).not.toBeInTheDocument();
    const findGroup = within(section).getByRole('group', { name: DRT.find });
    expect(findGroup).toHaveAccessibleDescription(DRT.findHint);
    expect(within(findGroup).getByText(find).closest('pre')).toHaveAttribute('dir', 'ltr');

    // Copy puts exactly the command on the clipboard and says so.
    await user.click(within(section).getByRole('button', { name: DRT.copyFind }));
    expect(await navigator.clipboard.readText()).toBe(find);
    await waitFor(() => expect(politeRegion()).toHaveTextContent(SVT.copied));
    expect(byId(DELETION_COPY_FIND_ID)).toHaveTextContent(DRT.copyFind);

    // The delete command waits for the username the find command printed.
    expect(within(section).queryByRole('button', { name: DRT.copyDelete })).not.toBeInTheDocument();
    const username = within(section).getByLabelText(DRT.username);
    expect(username).toHaveAccessibleDescription(DRT.usernameHint);
    expect(username).toHaveAttribute('dir', 'auto');
    await user.type(username, 'dana');
    const del = `${FLYCTL} ssh console -a yourpersonaldiary -C 'node /app/admin.cjs delete --email dana@example.com --confirm dana'`;
    expect(within(section).getByText(del)).toBeInTheDocument();
    expect(del).toBe(deleteCommand('yourpersonaldiary', 'dana@example.com', 'dana'));
    expect(within(section).getByRole('group', { name: DRT.delete })).toHaveAccessibleDescription(DRT.deleteHint);
    await user.click(within(section).getByRole('button', { name: DRT.copyDelete }));
    expect(await navigator.clipboard.readText()).toBe(del);
    expect(byId(DELETION_COPY_DELETE_ID)).toHaveTextContent(DRT.copyDelete);

    // Typing and copying asked the server nothing.
    expect(apiCalls()).toBe(before);
    if (fetchSpy) expect(fetchSpy).not.toHaveBeenCalled();
    // And there is never a link or a button that would act on the account from here.
    expect(within(section).queryByRole('link')).not.toBeInTheDocument();
    expect(within(section).getAllByRole('button').map((b) => b.textContent)).toEqual([DRT.copyFind, DRT.copyDelete]);
  });

  it('trims what was typed and keeps upper case as typed (the tool matches upper / lower case alike)', async () => {
    const { user } = renderCard();
    const section = await helper();
    await user.type(byId(DELETION_EMAIL_ID)!, '  Dana.Cohen+diary@Example.org ');
    expect(within(section).getByText(findCommand('yourpersonaldiary', 'Dana.Cohen+diary@Example.org'))).toBeInTheDocument();
    await user.type(byId(DELETION_USERNAME_ID)!, ' Dana_C ');
    expect(within(section).getByText(deleteCommand('yourpersonaldiary', 'Dana.Cohen+diary@Example.org', 'Dana_C'))).toBeInTheDocument();
  });

  it('an address PowerShell would change goes as b64: with a note; the staging server names its own app', async () => {
    const { user } = renderCard('en', { ...hostedInfo, publicUrl: 'https://yourpersonaldiary-staging.fly.dev' });
    const section = await helper();
    await user.type(byId(DELETION_EMAIL_ID)!, "o'brien@example.com");
    const find = `${FLYCTL} ssh console -a yourpersonaldiary-staging -C 'node /app/admin.cjs find b64:bydicmllbkBleGFtcGxlLmNvbQ'`;
    expect(within(section).getByText(find)).toBeInTheDocument();
    expect(within(section).getByText(DRT.encoded)).toBeInTheDocument();
    await user.type(byId(DELETION_USERNAME_ID)!, 'obrien');
    expect(
      within(section).getByText(`${FLYCTL} ssh console -a yourpersonaldiary-staging -C 'node /app/admin.cjs delete --email b64:bydicmllbkBleGFtcGxlLmNvbQ --confirm obrien'`),
    ).toBeInTheDocument();
  });

  it('shows what is wrong after leaving a field, and never a command for it', async () => {
    const { user } = renderCard();
    const section = await helper();
    const email = byId(DELETION_EMAIL_ID)!;
    await user.type(email, 'dana@');
    // No error while still typing.
    expect(email).not.toHaveAttribute('aria-invalid');
    await user.tab();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription(T.emailInvalid);
    expect(within(section).getByText(DRT.waiting)).toBeInTheDocument();
    expect(section.querySelector('pre')).toBeNull();

    await user.type(email, 'example.com');
    expect(email).not.toHaveAttribute('aria-invalid');
    const username = byId(DELETION_USERNAME_ID)!;
    await user.type(username, 'dana cohen');
    await user.tab();
    expect(username).toHaveAttribute('aria-invalid', 'true');
    expect(username).toHaveAccessibleDescription(new RegExp(DRT.usernameInvalid.replace(/[.()]/g, '\\$&')));
    expect(within(section).queryByRole('group', { name: DRT.delete })).not.toBeInTheDocument();
    expect(section.querySelectorAll('pre')).toHaveLength(1);
  });

  it('a new address forgets the username (it belongs to the find of the old one); locking the app forgets both', async () => {
    const { user } = renderCard();
    const section = await helper();
    await user.type(byId(DELETION_EMAIL_ID)!, 'dana@example.com');
    await user.type(byId(DELETION_USERNAME_ID)!, 'dana');
    expect(within(section).getByRole('group', { name: DRT.delete })).toBeInTheDocument();
    await user.clear(byId(DELETION_EMAIL_ID)!);
    await user.type(byId(DELETION_EMAIL_ID)!, 'noa@example.com');
    expect(byId(DELETION_USERNAME_ID)!.value).toBe('');
    expect(within(section).queryByRole('group', { name: DRT.delete })).not.toBeInTheDocument();
    expect(within(section).getByText(findCommand('yourpersonaldiary', 'noa@example.com'))).toBeInTheDocument();

    await user.type(byId(DELETION_USERNAME_ID)!, 'noa');
    act(() => lockApp());
    await waitFor(() => expect(byId(DELETION_EMAIL_ID)!.value).toBe(''));
    expect(byId(DELETION_USERNAME_ID)).toBeNull();
    expect(section.querySelector('pre')).toBeNull();
  });

  it('is there while the status loads and when it failed, and keeps what was typed when the status arrives', async () => {
    let answer: (status: ServerStatus) => void = () => {};
    vi.mocked(api.server.status).mockImplementation(() => new Promise<ServerStatus>((resolve) => (answer = resolve)));
    const { user } = renderCard();
    const section = await helper();
    await user.type(byId(DELETION_EMAIL_ID)!, 'dana@example.com');
    await act(async () => answer(serverStatusFixture()));
    expect(await screen.findByText(SVT.version, { selector: 'dt' })).toBeInTheDocument();
    expect(byId(DELETION_EMAIL_ID)!.value).toBe('dana@example.com');
    expect(within(await helper()).getByText(findCommand('yourpersonaldiary', 'dana@example.com'))).toBeInTheDocument();
    expect(section).toBeTruthy();
  });

  it('a status that failed to load leaves the helper usable', async () => {
    vi.mocked(api.server.status).mockRejectedValue(new ApiClientError(0, { code: 'OTHER', message: 'No connection to the diary server.' }));
    const { user } = renderCard();
    expect(await screen.findByText('No connection to the diary server.')).toBeInTheDocument();
    const section = await helper();
    await user.type(byId(DELETION_EMAIL_ID)!, 'dana@example.com');
    expect(within(section).getByText(findCommand('yourpersonaldiary', 'dana@example.com'))).toBeInTheDocument();
  });

  it('a 403 of the status hides the whole card, the helper with it', async () => {
    vi.mocked(api.server.status).mockRejectedValue(new ApiClientError(403, { code: 'FORBIDDEN', message: 'This action is not allowed' }));
    renderCard();
    await waitFor(() => expect(api.server.status).toHaveBeenCalled());
    await settle();
    expect(screen.queryByRole('heading', { level: 3, name: DRT.title })).not.toBeInTheDocument();
  });
});

describe('languages', () => {
  it('Hebrew: the helper in Hebrew in a right-to-left page; the address field and the commands left-to-right', async () => {
    const { user } = renderCard('he');
    const section = await helper(he('settings.server.deletion.title'));
    expect(within(section).getByRole('heading', { level: 3 })).toHaveTextContent('בקשת מחיקה במייל');
    expect(within(section).getByText(he('settings.server.deletion.check'))).toBeInTheDocument();
    const email = within(section).getByLabelText(he('settings.server.deletion.email'));
    expect(email).toHaveAttribute('dir', 'ltr');
    await user.type(email, 'dana@example.com');
    const pre = section.querySelector('pre') as HTMLElement;
    expect(pre).toHaveAttribute('dir', 'ltr');
    expect(pre.textContent).toBe(findCommand('yourpersonaldiary', 'dana@example.com'));
    expect(within(section).getByRole('button', { name: he('settings.server.deletion.copyFind') })).toBeInTheDocument();
    // A Hebrew username goes into the command as it is.
    await user.type(within(section).getByLabelText(he('settings.server.deletion.username')), 'דנה_1');
    expect(within(section).getByText(deleteCommand('yourpersonaldiary', 'dana@example.com', 'דנה_1'))).toBeInTheDocument();
  });

  it('every text of the helper is translated in all 20 languages (no English fallback)', async () => {
    const { LOCALE_CODES, hasMessage, getCatalog } = await import('@shared/i18n');
    const keys = Object.keys(getCatalog('en')).filter((k) => k.startsWith('settings.server.deletion.'));
    expect(keys).toHaveLength(15);
    for (const code of LOCALE_CODES) {
      for (const key of keys) {
        expect(hasMessage(code, key), `${code} ${key}`).toBe(true);
        if (code !== 'en') expect(getCatalog(code)[key], `${code} ${key}`).not.toBe(getCatalog('en')[key]);
      }
      // The tool's own words stay as they are in every language.
      expect(getCatalog(code)['settings.server.deletion.encoded'], code).toContain('b64:');
      expect(getCatalog(code)['settings.server.deletion.intro'], code).toContain('PowerShell');
      expect(getCatalog(code)['settings.server.deletion.intro'], code).toContain('Fly');
    }
  });
});

describe('nothing in the app addresses the admin API', () => {
  it('no source file of the app (src/, outside tests) names /api/admin', async () => {
    const load = (specifier: string) => import(/* @vite-ignore */ specifier);
    const fs = (await load('node:fs')) as { readdirSync(p: string, o: { withFileTypes: true }): Array<{ name: string; isDirectory(): boolean }>; readFileSync(p: string, e: 'utf8'): string };
    const pathMod = (await load('node:path')) as { join(...p: string[]): string; dirname(p: string): string };
    const { fileURLToPath } = (await load('node:url')) as { fileURLToPath(url: string): string };
    // This file lives in src/pages/settings/: src is two levels up.
    const src = pathMod.dirname(pathMod.dirname(pathMod.dirname(fileURLToPath(import.meta.url))));
    const offenders: string[] = [];
    let scanned = 0;
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = pathMod.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) && !full.includes(`${pathMod.join('src', 'test')}`)) {
          scanned++;
          if (fs.readFileSync(full, 'utf8').includes('/api/admin')) offenders.push(full);
        }
      }
    };
    walk(src);
    expect(scanned).toBeGreaterThan(100);
    expect(offenders).toEqual([]);
  });
});
