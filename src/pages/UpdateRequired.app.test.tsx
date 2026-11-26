/**
 * The "Update needed" screen in the running app (app version 1.1.0; src/App.tsx, src/hooks/useUpdateGate.ts): the
 * whole app with its real providers and the REAL api client, pointed at the offline engine's in-memory diary
 * server (src/offline/test-utils) - each "device" has its own IndexedDB; the desktop shell is the Windows app
 * (`__TAURI_INTERNALS__`). Fictional data only; nothing touches the network.
 *
 *  - when the server's info of this run carries a rule above this app's version, ONE screen replaces the frame,
 *    the routes and the lock screen;
 *  - under it the session and the offline engine go on: a change that waited on the device uploads, the token
 *    stays, nothing is deleted - and once the rule is gone ("Check again") the diary is back without a sign-in;
 *  - it never appears over a page with unsaved changes: it waits until they are saved - also when the editor was
 *    opened with unsaved text by "Open and fix" and nothing was typed (the editor's own hold);
 *  - a start without a connection is never blocked (the rule is not kept on the device), and the web version is
 *    never asked;
 *  - every request of the app carried the mark `X-Diary-Client: 2`;
 *  - in the phone apps the screen keeps the phone setup of the document (the class 'platform-mobile' on <html>,
 *    the phone stylesheet) - also after "Check again" brought the frame back - and the system Back button leaves
 *    the app while it is shown (a dialog above it is closed first) without moving the hidden pages; the desktop
 *    app and the web version never get the class.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLayoutEffect, useState } from 'react';
import { act, screen, waitFor } from '@testing-library/react';
import { APP_VERSION } from '@shared/constants';
import type { EntryInput } from '@shared/types';
import * as api from '@/api';
import { Dialog } from '@/components/a11y/Dialog';
import { MOBILE_STYLE_ID } from '@/components/layout/useMobileDocument';
import type { EntryPrefillState } from '@/components/sync/PendingChangesDialog';
import { PATHS } from '@/constants/routes';
import { T } from '@/constants/texts';
import { trWith } from '@/i18n/runtime';
import { getSyncStatus, offline } from '@/offline';
import { bootDevice, DANA, fakeKeyVault, fakeMirror, installWebCrypto, waitForAsync, wireDevice } from '@/offline/test-utils/env';
import { FakeSyncServer } from '@/offline/test-utils/fake-sync-server';
import { retryConnection } from '@/context/ConnectionContext';
import { ET } from '@/pages/entries';
import { renderOfflineApp, resetOfflineApp } from '@/test/offline-app';
import { currentPath } from '@/test/render';
import { handleBack } from '@/utils/back-handler';
import { MOBILE_UI_CLASS } from '@/utils/mobile-ui';

// The reminder poll is not part of these flows (and would ask the desktop shell, which a test has not).
vi.mock('@/hooks/useReminders', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useReminders')>()),
  useReminders: () => undefined,
}));

const en = trWith('en');

/** A version above this app's own, so the rule applies to it. */
const NEWER = (() => {
  const [a] = APP_VERSION.split('.').map(Number);
  return `${a + 1}.0.0`;
})();

const ENTRY: EntryInput = {
  date: '2026-11-20',
  time: '08:00',
  title: 'Morning walk',
  body: 'Along the river.',
  mood: null,
  emotions: [],
  energy: null,
  stress: null,
  sleepQuality: null,
  sleepHours: null,
  exerciseMinutes: null,
  exerciseType: '',
  events: [],
  people: [],
  location: '',
  notes: '',
  tags: [],
};

let server: FakeSyncServer;

beforeAll(() => installWebCrypto());

beforeEach(() => {
  server = new FakeSyncServer();
});

afterEach(async () => {
  await resetOfflineApp();
});

const updateScreen = () => screen.queryByTestId('update-required-page');

describe('the screen replaces everything, and everything goes on underneath', () => {
  it('a change waiting on the device uploads under the screen; the token stays; "Check again" brings the diary back without a sign-in', async () => {
    // Dana (the Windows app, "Remember me") writes an entry without a connection and closes the app.
    const keyVault = fakeKeyVault('dpapi');
    const mirror = fakeMirror();
    const first = await bootDevice({ server, rememberMe: true, app: true, keyVault, mirror });
    server.mode = 'down';
    offline.__engineForTests()?.connectivity.noteFailure();
    await api.entries.create(ENTRY);
    expect(getSyncStatus().pending).toBe(1);
    await offline.__resetForTests();

    // The owner turned the rule of Windows on meanwhile; the app opens with a connection.
    wireDevice({ server, rememberMe: true, app: true, keyVault, mirror, idb: first.idb, token: first.account.token });
    api.setServerInfo(null);
    server.mode = 'online';
    server.infoOverrides = { appUpdate: { windows: { minVersion: NEWER } } };
    const { user } = renderOfflineApp('/');

    const page = await screen.findByTestId('update-required-page', {}, { timeout: 15000 });
    expect(page).toHaveAttribute('data-platform', 'windows');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(en('shell.update.title'));
    expect(screen.getByRole('link', { name: en('shell.update.openDownloads') })).toBeInTheDocument();
    // The frame is gone: no menu, no skip link, no app root.
    expect(document.getElementById('app-root')).toBeNull();
    // The desktop app gets nothing of the phone setup.
    expect(document.documentElement).not.toHaveClass(MOBILE_UI_CLASS);

    // Underneath, the session check ran and the engine uploaded the waiting change; nothing was signed out.
    await waitFor(() => expect(server.diary(DANA).entries.size).toBe(1), { timeout: 15000 });
    await waitFor(() => expect(getSyncStatus().pending).toBe(0), { timeout: 10000 });
    expect(offline.isActive()).toBe(true);
    expect(api.getToken()).toBe(first.account.token);
    expect(updateScreen()).toBeInTheDocument();

    // The owner turns the rule off; "Check again" takes the screen away and the diary is there - no sign-in.
    server.infoOverrides = {};
    await user.click(screen.getByRole('button', { name: en('shell.update.retry') }));
    await waitFor(() => expect(updateScreen()).not.toBeInTheDocument());
    expect(document.getElementById('app-root')).not.toBeNull();
    // The focused button went with the screen: the focus is in the restored diary, not on the document body.
    await waitFor(() => expect(document.activeElement).not.toBe(document.body));
    expect(['page-title', 'main']).toContain(document.activeElement?.id);
    expect(currentPath()).toBe('/');
    expect(screen.queryByRole('heading', { level: 1, name: T.loginTitle })).not.toBeInTheDocument();

    // Every request of this app carried the mark of 1.1.0.
    expect(server.requests.length).toBeGreaterThan(3);
    expect(server.requests.filter((r) => r.clientMark !== '2')).toEqual([]);
  }, 60000);

  it('stands above the lock screen: a locked session shows the update screen, not the password dialog', async () => {
    const { account } = wireDevice({ server, rememberMe: true, app: true });
    server.lockedTokens.add(account.token);
    api.setServerInfo(null);
    server.infoOverrides = { appUpdate: { windows: { minVersion: NEWER } } };
    renderOfflineApp('/');
    expect(await screen.findByTestId('update-required-page', {}, { timeout: 15000 })).toBeInTheDocument();
    await waitFor(() => expect(server.calls('/api/auth/me').length).toBeGreaterThan(0));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(updateScreen()).toBeInTheDocument();
  }, 30000);

  it('a rule of ANOTHER platform changes nothing for this app', async () => {
    wireDevice({ server, app: true });
    api.setServerInfo(null);
    server.infoOverrides = { appUpdate: { android: { minVersion: NEWER }, ios: { minVersion: NEWER }, mac: { minVersion: NEWER } } };
    renderOfflineApp('/');
    await waitFor(() => expect(api.getServerInfo()?.appUpdate?.android).toBeDefined());
    await waitFor(() => expect(offline.isActive()).toBe(true));
    expect(updateScreen()).not.toBeInTheDocument();
    expect(document.getElementById('app-root')).not.toBeNull();
  }, 30000);
});

describe('when it may appear', () => {
  it('never over a page with unsaved changes: it waits until the entry is saved, then replaces the page', async () => {
    wireDevice({ server, app: true });
    const { user } = renderOfflineApp('/new');
    await waitFor(() => expect(offline.isActive()).toBe(true));
    await user.type(await screen.findByRole('textbox', { name: ET.title }), 'Half a thought');

    // The rule arrives while the text is unsaved (a later answer of the server in this run).
    server.infoOverrides = { appUpdate: { windows: { minVersion: NEWER } } };
    await act(async () => {
      await retryConnection();
    });
    expect(api.getServerInfo()?.appUpdate?.windows?.minVersion).toBe(NEWER);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });
    expect(updateScreen()).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: ET.title })).toHaveValue('Half a thought');

    // Saved: the guard is released and the screen takes over; the entry is on the server.
    await user.click(screen.getByRole('button', { name: ET.save }));
    expect(await screen.findByTestId('update-required-page', {}, { timeout: 10000 })).toBeInTheDocument();
    await waitFor(() => expect([...server.diary(DANA).entries.values()].map((e) => e.title)).toEqual(['Half a thought']), { timeout: 10000 });
  }, 40000);

  it('a save the server refuses keeps the editor and its text: the screen waits until the page is left', async () => {
    wireDevice({ server, app: true });
    const { user } = renderOfflineApp('/new');
    await waitFor(() => expect(offline.isActive()).toBe(true));
    await user.type(await screen.findByRole('textbox', { name: ET.title }), 'Half a thought');

    server.infoOverrides = { appUpdate: { windows: { minVersion: NEWER } } };
    await act(async () => {
      await retryConnection();
    });
    expect(api.getServerInfo()?.appUpdate?.windows?.minVersion).toBe(NEWER);

    // The save is in flight (the leave guard is down meanwhile) and the server refuses it.
    server.failNext({ status: 400, body: { code: 'VALIDATION', message: 'Refused for this test.' }, pathPrefix: '/api/sync/op' });
    await user.click(screen.getByRole('button', { name: ET.save }));
    await waitFor(() => expect(server.calls('/api/sync/op', 'POST').length).toBeGreaterThan(0), { timeout: 10000 });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });
    expect(updateScreen()).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: ET.title })).toHaveValue('Half a thought');
    expect(server.diary(DANA).entries.size).toBe(0);

    // The person leaves the page on purpose ("Leave without saving"): only now the screen takes over.
    await user.click(screen.getAllByRole('link', { name: en('shell.nav.home') })[0]);
    await user.click(await screen.findByRole('button', { name: en('shell.unsaved.leave') }));
    expect(await screen.findByTestId('update-required-page', {}, { timeout: 10000 })).toBeInTheDocument();
  }, 40000);

  it('"Open and fix" opens the editor with unsaved text and nothing typed: a refused save keeps it, the screen does not appear', async () => {
    // A rejected edit: the entry as the server has it is the baseline, the user's version is on top, unsaved (router
    // state `prefill`, as src/components/sync/PendingChangesDialog.tsx passes it). Nothing is typed on this page, so
    // only the editor's own hold (useUpdateScreenHold(form.dirty)) keeps the screen back while the save is in flight.
    const entry = server.seedEntry(DANA, { title: 'Morning walk', date: '2026-11-20' });
    wireDevice({ server, app: true });
    const state: EntryPrefillState = { prefill: { ...ENTRY, title: 'My own version' } };
    const { user } = renderOfflineApp({ pathname: PATHS.editEntry(entry.id), state });
    await waitFor(() => expect(offline.isActive()).toBe(true));
    await waitFor(() => expect(screen.getByRole('textbox', { name: ET.title })).toHaveValue('My own version'), { timeout: 10000 });

    server.infoOverrides = { appUpdate: { windows: { minVersion: NEWER } } };
    await act(async () => {
      await retryConnection();
    });
    expect(api.getServerInfo()?.appUpdate?.windows?.minVersion).toBe(NEWER);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });
    expect(updateScreen()).not.toBeInTheDocument();

    // Save without typing; the server refuses it.
    server.failNext({ status: 400, body: { code: 'VALIDATION', message: 'Refused for this test.' }, pathPrefix: '/api/sync/op' });
    await user.click(screen.getByRole('button', { name: ET.save }));
    await waitFor(() => expect(server.calls('/api/sync/op', 'POST').length).toBeGreaterThan(0), { timeout: 10000 });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });
    expect(updateScreen()).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: ET.title })).toHaveValue('My own version');
    expect(server.diary(DANA).entries.get(entry.id)?.title).toBe('Morning walk');
  }, 40000);

  it('text typed into a dialog without a leave guard survives: the habit description stays until the person goes to another page', async () => {
    wireDevice({ server, app: true });
    const { user } = renderOfflineApp('/habits');
    await waitFor(() => expect(offline.isActive()).toBe(true));
    await user.click((await screen.findAllByRole('button', { name: en('habits.form.newTitle') }))[0]);
    const description = await screen.findByRole('textbox', { name: en('habits.form.description') });
    await user.type(description, 'Ten minutes before breakfast');

    server.infoOverrides = { appUpdate: { windows: { minVersion: NEWER } } };
    await act(async () => {
      await retryConnection();
    });
    expect(api.getServerInfo()?.appUpdate?.windows?.minVersion).toBe(NEWER);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });
    expect(updateScreen()).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: en('habits.form.description') })).toHaveValue('Ten minutes before breakfast');

    // Closed and gone to another page: the screen appears.
    await user.click(screen.getByRole('button', { name: T.cancel }));
    await waitFor(() => expect(screen.queryByRole('textbox', { name: en('habits.form.description') })).not.toBeInTheDocument());
    await user.click(screen.getAllByRole('link', { name: en('shell.nav.home') })[0]);
    expect(await screen.findByTestId('update-required-page', {}, { timeout: 10000 })).toBeInTheDocument();
  }, 40000);

  it('a start without a connection is never blocked: the cached diary opens (the rule is not kept on the device)', async () => {
    server.seedEntry(DANA, { title: 'Yesterday', date: '2026-10-22' });
    const keyVault = fakeKeyVault('dpapi');
    const mirror = fakeMirror();
    // The rule was on during the last run with a connection.
    server.infoOverrides = { appUpdate: { windows: { minVersion: NEWER } } };
    const first = await bootDevice({ server, rememberMe: true, app: true, keyVault, mirror });
    await waitForAsync(async () => (await first.engine.cache.get('/api/home')) !== null, 10000);
    await offline.__resetForTests();
    wireDevice({ server, rememberMe: true, app: true, keyVault, mirror, idb: first.idb, token: first.account.token });
    api.setServerInfo(null);
    server.mode = 'down';

    renderOfflineApp('/');
    expect(await screen.findByText(en('insights.home.totalEntries', { count: 1 }), {}, { timeout: 15000 })).toBeInTheDocument();
    expect(updateScreen()).not.toBeInTheDocument();
    expect(api.getServerInfo()?.appUpdate).toBeUndefined();
  }, 40000);

  it('the web version is never asked, whatever the rules say', async () => {
    wireDevice({ server });
    api.setServerInfo(null);
    server.infoOverrides = { appUpdate: { android: { minVersion: NEWER }, ios: { minVersion: NEWER }, windows: { minVersion: NEWER }, mac: { minVersion: NEWER } } };
    renderOfflineApp('/');
    await waitFor(() => expect(api.getServerInfo()?.appUpdate?.windows).toBeDefined());
    await waitFor(() => expect(offline.isActive()).toBe(true));
    expect(updateScreen()).not.toBeInTheDocument();
    expect(document.documentElement).not.toHaveClass(MOBILE_UI_CLASS);
  }, 30000);
});

/** A dialog that lives outside App (as the dialogs of the sync provider do), opened by a button of its own. */
function DialogOutsideApp() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        test: open a dialog
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Above the screen">
        <p>test: dialog content</p>
      </Dialog>
    </>
  );
}

describe('the phone apps (Android) under the screen', () => {
  beforeEach(() => {
    vi.stubGlobal('__MOBILE__', true);
    vi.stubGlobal('Capacitor', { isNativePlatform: () => true, getPlatform: () => 'android' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '#/');
  });

  it('keeps the phone setup of the document while shown and after the frame is back; Back leaves the app and moves nothing', async () => {
    wireDevice({ server });
    api.setServerInfo(null);
    server.infoOverrides = { appUpdate: { android: { minVersion: NEWER } } };
    // A browser history with pages behind this one: the default way of Back (without the phone frame's
    // navigator) would go back in it.
    window.history.replaceState({ idx: 2 }, '', '#/diary');
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    const { user } = renderOfflineApp('/diary', <DialogOutsideApp />);

    const page = await screen.findByTestId('update-required-page', {}, { timeout: 15000 });
    expect(page).toHaveAttribute('data-platform', 'android');
    expect(document.getElementById('app-root')).toBeNull();
    // The phone setup is there, exactly as under the frame.
    expect(document.documentElement).toHaveClass(MOBILE_UI_CLASS, 'platform-android');
    expect(document.querySelectorAll(`style#${MOBILE_STYLE_ID}`)).toHaveLength(1);

    // Back: the app is left, the hidden page stays where it was.
    let result = '';
    act(() => {
      result = handleBack();
    });
    expect(result).toBe('exit');
    expect(historyBack).not.toHaveBeenCalled();
    expect(currentPath()).toBe('/diary');

    // A dialog above the screen is closed first; the next press leaves the app.
    await user.click(screen.getByRole('button', { name: 'test: open a dialog' }));
    expect(await screen.findByRole('dialog', { name: 'Above the screen' })).toBeInTheDocument();
    act(() => {
      result = handleBack();
    });
    expect(result).toBe('closed-dialog');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Above the screen' })).not.toBeInTheDocument());
    act(() => {
      result = handleBack();
    });
    expect(result).toBe('exit');
    expect(historyBack).not.toHaveBeenCalled();
    expect(currentPath()).toBe('/diary');
    expect(updateScreen()).toBeInTheDocument();

    // The rule is gone: the frame is back on the same page, with the phone setup still on <html>.
    server.infoOverrides = {};
    await user.click(screen.getByRole('button', { name: en('shell.update.retry') }));
    await waitFor(() => expect(updateScreen()).not.toBeInTheDocument());
    expect(document.getElementById('app-root')).not.toBeNull();
    expect(document.documentElement).toHaveClass(MOBILE_UI_CLASS, 'platform-android');
    expect(currentPath()).toBe('/diary');

    // Back works as before: through the frame's router, from this page with nothing behind it to Home.
    window.history.replaceState(null, '', '#/diary');
    act(() => {
      result = handleBack();
    });
    expect(result).toBe('navigated');
    await waitFor(() => expect(currentPath()).toBe('/'));
    expect(historyBack).not.toHaveBeenCalled();
    historyBack.mockRestore();
  }, 60000);

  it('the screen as the very first thing the app shows: the phone setup is on <html> before its first paint', async () => {
    wireDevice({ server });
    // The rule is already known when the app mounts, so its first commit is the screen.
    server.infoOverrides = { appUpdate: { android: { minVersion: NEWER } } };
    api.setServerInfo({
      version: '1.2.0', port: 8080, lanEnabled: false, lanUrls: [], dataDir: '', isLocalRequest: false, startedAt: '', mode: 'hosted',
      appUpdate: { android: { minVersion: NEWER } },
    });
    // Rendered after App: its layout effect runs in App's first commit, after App's own layout effects and
    // before the browser paints (and before any passive effect). It records what that first paint would show.
    const firstPaint: Array<{ screen: boolean; mobile: boolean; android: boolean; styles: number }> = [];
    function FirstPaintProbe() {
      useLayoutEffect(() => {
        const root = document.documentElement;
        firstPaint.push({
          screen: document.querySelector('[data-testid="update-required-page"]') !== null,
          mobile: root.classList.contains(MOBILE_UI_CLASS),
          android: root.classList.contains('platform-android'),
          styles: document.querySelectorAll(`style#${MOBILE_STYLE_ID}`).length,
        });
      }, []);
      return null;
    }
    renderOfflineApp('/diary', <FirstPaintProbe />);

    expect(firstPaint).toEqual([{ screen: true, mobile: true, android: true, styles: 1 }]);
    expect(await screen.findByTestId('update-required-page', {}, { timeout: 15000 })).toHaveAttribute('data-platform', 'android');
    expect(document.documentElement).toHaveClass(MOBILE_UI_CLASS, 'platform-android');
    let result = '';
    act(() => {
      result = handleBack();
    });
    expect(result).toBe('exit');
  }, 60000);
});
