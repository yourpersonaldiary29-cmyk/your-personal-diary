/**
 * The automatic offline mode in the running app (docs/android-tasks/OFFLINE-DESIGN.md sections 4.3, 4.7,
 * 4.8, 4.9; WP-H10c "Tests"). The whole app with its real providers and the REAL api client, pointed at
 * the engine's in-memory diary server (src/offline/test-utils) - each "device" has its own IndexedDB.
 * Fictional data only ("Dana", "Lior", the entry "Morning walk"); nothing touches the network.
 *
 *  - an offline save says "Saved on this device", opens /entry/-1 with "Not uploaded yet", and the
 *    address becomes the server's id once the entry is uploaded;
 *  - an app with "Remember me" that starts without a connection shows the cached diary under the bar,
 *    not the "no connection" page; without a binding that page stays, with the neutral waiting line
 *    when changes wait on the device;
 *  - a 401 keeps the outbox and the login page says how many changes wait;
 *  - the sign-out question: Stay signed in / Review / Delete them and sign out;
 *  - another account on the device: its changes are never sent, a neutral line offers [Delete];
 *  - the review: a note with its actions, "Save as a new entry" queues an ordinary new entry, Discard asks.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import type { EntryInput } from '@shared/types';
import * as api from '@/api';
import { T } from '@/constants/texts';
import { trWith } from '@/i18n/runtime';
import { BINDING_KEY, getSyncStatus, offline } from '@/offline';
import { bootDevice, DANA, LIOR, fakeKeyVault, fakeMirror, installWebCrypto, waitForAsync, wireDevice } from '@/offline/test-utils/env';
import { FakeSyncServer, fakeUser } from '@/offline/test-utils/fake-sync-server';
import { ET } from '@/pages/entries';
import { LogoutButton, renderOfflineApp, resetOfflineApp } from '@/test/offline-app';
import { currentPath, renderWithProviders } from '@/test/render';
import { entryInputOf } from './labels';
import { PendingChangesDialog } from './PendingChangesDialog';

// The reminder poll is not part of these flows (and would ask the desktop shell, which a test has not).
vi.mock('@/hooks/useReminders', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useReminders')>()),
  useReminders: () => undefined,
}));

const en = trWith('en');

const ENTRY: EntryInput = {
  date: '2026-10-23',
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

/** The armed engine (the test fails when there is none). */
function engine() {
  const e = offline.__engineForTests();
  if (!e) throw new Error('no offline engine');
  return e;
}

/** The server cannot be reached; the engine knows at once (the data layer switches at the first failure). */
function goDown(): void {
  server.mode = 'down';
  offline.__engineForTests()?.connectivity.noteFailure();
}

describe('writing without a connection', () => {
  it('an offline save says "Saved on this device", opens /entry/-1 with its badge, then the server id replaces it', async () => {
    wireDevice({ server });
    const { user } = renderOfflineApp('/new');
    await waitFor(() => expect(offline.isActive()).toBe(true));
    goDown();

    await user.type(await screen.findByRole('textbox', { name: ET.title }), 'Morning walk');
    await user.click(screen.getByRole('button', { name: ET.save }));
    expect(await screen.findByText(en('shell.sync.savedOnDevice'))).toBeInTheDocument();
    await waitFor(() => expect(currentPath()).toBe('/entry/-1'));
    expect(await screen.findByText(en('shell.sync.badgeWaiting'))).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Morning walk');
    expect(server.diary(DANA).entries.size).toBe(0);

    // The connection returns: the entry is uploaded once, and the address becomes the server's id.
    server.mode = 'online';
    await act(async () => {
      await offline.tryNow();
      await offline.drain();
    });
    expect(server.diary(DANA).entries.size).toBe(1);
    await waitFor(() => expect(currentPath()).toBe('/entry/1'));
    await waitFor(() => expect(screen.queryByText(en('shell.sync.badgeWaiting'))).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Morning walk');
  }, 30000);
});

describe('starting without a connection (section 4.7)', () => {
  it('an app with "Remember me": the cached home under the bar, not the "no connection" page', async () => {
    server.seedEntry(DANA, { title: 'Yesterday', date: '2026-10-22' });
    const keyVault = fakeKeyVault('dpapi');
    const mirror = fakeMirror();
    const first = await bootDevice({ server, rememberMe: true, app: true, keyVault, mirror });
    await waitForAsync(async () => (await first.engine.cache.get('/api/home')) !== null, 10000);
    // The app is closed (the database, the wrapped key and the binding stay) and opened again offline.
    await offline.__resetForTests();
    wireDevice({ server, rememberMe: true, app: true, keyVault, mirror, idb: first.idb, token: first.account.token });
    server.mode = 'down';

    renderOfflineApp('/');
    expect(await screen.findByText(en('insights.home.totalEntries', { count: 1 }), {}, { timeout: 15000 })).toBeInTheDocument();
    expect(screen.queryByTestId('no-connection-page')).not.toBeInTheDocument();
    expect(await screen.findByTestId('sync-status-bar')).toHaveAttribute('data-state', 'offline');
    expect(screen.queryByTestId('connection-banner')).not.toBeInTheDocument();
    expect(offline.isActive()).toBe(true);
  }, 40000);

  it('the cache start never puts the "no connection" page on screen first: the session spinner, then the cached diary', async () => {
    server.seedEntry(DANA, { title: 'Yesterday', date: '2026-10-22' });
    const keyVault = fakeKeyVault('dpapi');
    const mirror = fakeMirror();
    const first = await bootDevice({ server, rememberMe: true, app: true, keyVault, mirror });
    await waitForAsync(async () => (await first.engine.cache.get('/api/home')) !== null, 10000);
    await offline.__resetForTests();
    wireDevice({ server, rememberMe: true, app: true, keyVault, mirror, idb: first.idb, token: first.account.token });
    server.mode = 'down';

    // Every DOM change until the cached home is up is inspected: the page - whose heading takes the focus -
    // must not appear for a single frame (on a real device the key unwrap is a DPAPI / Keystore round trip,
    // so the flash would be long enough to see and for a screen reader to announce). The session spinner is
    // what the user sees meanwhile.
    const seen = { page: 0, focusOnPage: 0, spinner: 0 };
    const inspect = () => {
      const page = document.querySelector('[data-testid="no-connection-page"]');
      if (page) {
        seen.page += 1;
        if (document.activeElement && page.contains(document.activeElement)) seen.focusOnPage += 1;
      }
      if (document.body.textContent?.includes(T.loadingSession)) seen.spinner += 1;
    };
    const observer = new MutationObserver(inspect);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
    try {
      renderOfflineApp('/');
      inspect();
      // The store flips at the first failed request, before the offline start begins: still no page.
      await waitFor(() => expect(api.getConnectionState().offline).toBe(true));
      inspect();
      expect(screen.queryByTestId('no-connection-page')).not.toBeInTheDocument();
      expect(await screen.findByText(en('insights.home.totalEntries', { count: 1 }), {}, { timeout: 15000 })).toBeInTheDocument();
    } finally {
      observer.disconnect();
    }
    expect(seen).toMatchObject({ page: 0, focusOnPage: 0 });
    expect(seen.spinner).toBeGreaterThan(0);
    expect(screen.queryByTestId('no-connection-page')).not.toBeInTheDocument();
    expect(await screen.findByTestId('sync-status-bar')).toHaveAttribute('data-state', 'offline');
    expect(offline.isActive()).toBe(true);
  }, 40000);

  it('no binding (the web, or no "Remember me"): the "no connection" page, plus the neutral line when changes wait', async () => {
    const first = await bootDevice({ server });
    goDown();
    await api.entries.create(ENTRY);
    expect(getSyncStatus().pending).toBe(1);
    await offline.__resetForTests();
    wireDevice({ server, idb: first.idb, token: first.account.token });
    server.mode = 'down';

    renderOfflineApp('/');
    expect(await screen.findByTestId('no-connection-page')).toBeInTheDocument();
    const line = await screen.findByTestId('no-connection-waiting');
    expect(line).toHaveTextContent(en('shell.sync.noConnection.waiting'));
    // No account is named.
    expect(line.textContent).not.toMatch(/dana|Dana|u_0/);
  }, 30000);

  it('no changes on the device: the "no connection" page as today, without the line', async () => {
    wireDevice({ server });
    server.mode = 'down';
    renderOfflineApp('/');
    expect(await screen.findByTestId('no-connection-page')).toBeInTheDocument();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });
    expect(screen.queryByTestId('no-connection-waiting')).not.toBeInTheDocument();
  }, 30000);
});

describe('the safe paths (section 4.8)', () => {
  it('a 401 keeps the outbox; the login page says how many changes wait', async () => {
    const { account } = wireDevice({ server });
    // A page that needs the session: losing it leads to the login page.
    renderOfflineApp('/diary');
    await waitFor(() => expect(offline.isActive()).toBe(true));
    goDown();
    await act(async () => {
      await api.entries.create(ENTRY);
    });
    expect(getSyncStatus().pending).toBe(1);

    // The session ends elsewhere (a password change on another device): the next upload gets 401.
    server.revoke(account.token);
    server.mode = 'online';
    await act(async () => {
      await offline.tryNow();
    });
    expect(await screen.findByTestId('login-waiting')).toHaveTextContent(en('shell.sync.login.waiting', { count: 1 }));
    await waitFor(() => expect(currentPath()).toBe('/login'));
    expect(offline.isActive()).toBe(false);
    // The change is still on the device (ciphertext), nothing reached the server.
    expect(await offline.otherAccountsWithPending(null)).toEqual([{ userId: DANA, count: 1 }]);
    expect(server.diary(DANA).entries.size).toBe(0);
  }, 30000);

  it('a session revoked while the app was closed (the first me() of the run answers 401): the login page still says how many changes wait', async () => {
    // Dana (the app, "Remember me") writes an entry without a connection and closes the app.
    const keyVault = fakeKeyVault('dpapi');
    const mirror = fakeMirror();
    const dana = await bootDevice({ server, rememberMe: true, app: true, keyVault, mirror });
    goDown();
    await api.entries.create(ENTRY);
    expect(getSyncStatus().pending).toBe(1);
    await offline.__resetForTests();
    expect(localStorage.getItem(BINDING_KEY)).not.toBeNull();

    // Her password is changed on another device meanwhile, so this device's token is revoked; the app
    // opens WITH a connection and its very first request, me(), answers 401 - no session was ever in memory.
    wireDevice({ server, rememberMe: true, app: true, keyVault, mirror, idb: dana.idb, token: dana.account.token });
    server.revoke(dana.account.token);
    server.mode = 'online';
    renderOfflineApp('/login');

    expect(await screen.findByTestId('login-waiting', {}, { timeout: 15000 })).toHaveTextContent(en('shell.sync.login.waiting', { count: 1 }));
    expect(currentPath()).toBe('/login');
    expect(screen.getByRole('heading', { level: 1, name: T.loginTitle })).toBeInTheDocument();
    expect(server.calls('/api/auth/me').length).toBeGreaterThan(0);
    expect(api.getToken()).toBeNull();
    // The engine's own 401 handling ran as well: the binding is gone and no engine runs - while the change
    // is still on the device (ciphertext) and nothing of it reached the server.
    await waitFor(() => expect(localStorage.getItem(BINDING_KEY)).toBeNull());
    expect(offline.isActive()).toBe(false);
    expect(await offline.otherAccountsWithPending(null)).toEqual([{ userId: DANA, count: 1 }]);
    expect(server.diary(DANA).entries.size).toBe(0);
  }, 30000);

  it('sign-out with changes on the device: Stay signed in, Review, then Delete them and sign out', async () => {
    wireDevice({ server });
    const { user } = renderOfflineApp('/', <LogoutButton />);
    await waitFor(() => expect(offline.isActive()).toBe(true));
    goDown();
    await act(async () => {
      await api.entries.create(ENTRY);
    });
    const title = en('shell.sync.logout.title');

    // [Stay signed in]: nothing changes.
    await user.click(screen.getByTestId('test-logout'));
    let question = await screen.findByRole('dialog', { name: title });
    expect(question).toHaveTextContent(en('shell.sync.logout.text', { count: 1 }));
    expect(en('shell.sync.logout.text', { count: 1 })).toContain('1 change on this device has not been uploaded yet');
    await user.click(within(question).getByRole('button', { name: en('shell.sync.logout.stay') }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: title })).not.toBeInTheDocument());
    expect(offline.isActive()).toBe(true);
    expect(getSyncStatus().pending).toBe(1);

    // [Review]: the review of the changes opens; still signed in.
    await user.click(screen.getByTestId('test-logout'));
    question = await screen.findByRole('dialog', { name: title });
    await user.click(within(question).getByRole('button', { name: en('shell.sync.review') }));
    const review = await screen.findByRole('dialog', { name: en('shell.sync.panelTitle') });
    const items = within(review).getAllByTestId('sync-pending-item');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent(en('shell.sync.kind.entryCreate'));
    expect(items[0]).toHaveTextContent("Entry 'Morning walk'");
    await user.click(within(review).getByRole('button', { name: T.close }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: en('shell.sync.panelTitle') })).not.toBeInTheDocument());
    expect(offline.isActive()).toBe(true);

    // [Delete them and sign out]: signed out, and the device's copy is gone.
    await user.click(screen.getByTestId('test-logout'));
    question = await screen.findByRole('dialog', { name: title });
    await user.click(within(question).getByRole('button', { name: en('shell.sync.logout.delete') }));
    await waitFor(() => expect(offline.isActive()).toBe(false));
    await waitFor(async () => expect(await offline.otherAccountsWithPending(null)).toEqual([]));
    await waitFor(() => expect(currentPath()).toBe('/'));
    expect(server.diary(DANA).entries.size).toBe(0);
  }, 40000);

  it('another account on this device: its changes are never sent; a neutral line offers [Delete] with a confirmation', async () => {
    // Dana leaves a change on the device and the app is closed.
    const dana = await bootDevice({ server });
    goDown();
    await api.entries.create(ENTRY);
    await offline.__resetForTests();

    // Lior signs in on the same device.
    server.mode = 'online';
    const lior = wireDevice({ server, userId: LIOR, idb: dana.idb });
    const sinceLior = server.requests.length;
    const { user } = renderOfflineApp('/');
    const line = await screen.findByTestId('sync-other-account', {}, { timeout: 15000 });
    expect(line).toHaveTextContent(en('shell.sync.otherAccount.text'));
    expect(line.textContent).not.toMatch(/dana|Dana|Morning walk|u_0/);
    // The line can be on screen a moment before the engine is armed for Lior: `openEngine` publishes
    // the enabled status (which shows the bar) before `offline.start` has finished arming the engine.
    await waitFor(() => expect(offline.activeUserId()).toBe(LIOR));
    // Nothing of Dana's was sent, with any token.
    expect(server.calls('/api/sync/op').filter((r) => (r.body as { account?: string })?.account === DANA)).toEqual([]);
    expect(server.diary(DANA).entries.size).toBe(0);
    const syncCalls = server.requests.slice(sinceLior).filter((r) => r.path.startsWith('/api/sync/'));
    expect(syncCalls.length).toBeGreaterThan(0);
    expect(syncCalls.every((r) => r.token === lior.account.token)).toBe(true);

    await user.click(within(line).getByRole('button', { name: en('shell.sync.otherAccount.delete') }));
    const confirm = await screen.findByRole('dialog', { name: en('shell.sync.otherAccount.delete') });
    expect(confirm).toHaveTextContent(en('shell.sync.otherAccount.confirm'));
    await user.click(within(confirm).getByRole('button', { name: en('shell.sync.otherAccount.delete') }));
    await waitFor(() => expect(screen.queryByTestId('sync-other-account')).not.toBeInTheDocument());
    expect(await offline.otherAccountsWithPending(LIOR)).toEqual([]);
    expect(offline.activeUserId()).toBe(LIOR);
  }, 40000);
});

describe('the review and its notes (section 4.9)', () => {
  it('a conflict note with its actions; "Save as a new entry" queues a new entry; Discard asks first', async () => {
    const lost = server.seedEntry(DANA, { title: 'Morning walk', body: 'Server text.', date: '2026-10-20' });
    const gone = server.seedEntry(DANA, { title: 'Evening run', body: 'Run text.', date: '2026-10-21' });
    await bootDevice({ server });
    // The device shows both entries (their versions are the base of the edits), then edits them offline.
    await api.entries.get(lost.id);
    await api.entries.get(gone.id);
    goDown();
    await api.entries.update(lost.id, { ...entryInputOf(lost), body: 'My version.' });
    await api.entries.update(gone.id, { ...entryInputOf(gone), body: 'My run.' });
    // Another device: edits the first one LATER - later than this device's edits as the server will see them:
    // their `editedAt` carries the clock offset the engine learned at start (about +25 ms against the in-process
    // fake server), so a fixed short wait made the newer-wins race a coin toss - and deletes the second one.
    const editedAt = Math.max(...engine().outbox.rows.map((r) => Date.parse(r.q.op.editedAt)));
    while (Date.now() <= editedAt) await new Promise((r) => setTimeout(r, 5));
    server.editEntry(DANA, lost.id, { body: 'The other device.' });
    server.deleteEntry(DANA, gone.id);
    server.mode = 'online';
    await offline.tryNow();
    await offline.drain();
    expect(offline.notes.list().map((n) => n.reason).sort()).toEqual(['gone', 'lost']);

    const { user } = renderWithProviders(<PendingChangesDialog open onClose={vi.fn()} />, { auth: 'authenticated', user: fakeUser(DANA), locale: 'en' });
    const notes = await screen.findAllByTestId('sync-note');
    expect(notes).toHaveLength(2);
    const lostNote = notes.find((n) => n.textContent?.includes(en('shell.sync.reason.lost', { title: 'Morning walk' }))) as HTMLElement;
    const goneNote = notes.find((n) => n.textContent?.includes(en('shell.sync.reason.gone', { title: 'Evening run' }))) as HTMLElement;
    expect(lostNote).toBeDefined();
    expect(goneNote).toBeDefined();
    const names = (el: HTMLElement) => within(el).getAllByRole('button').map((b) => b.textContent);
    expect(names(lostNote)).toEqual([en('shell.sync.action.showMine'), en('shell.sync.action.saveAsNew'), en('shell.sync.action.copy'), en('shell.sync.action.ok')]);
    expect(names(goneNote)).toEqual([en('shell.sync.action.saveAsNew'), en('shell.sync.action.copy'), en('shell.sync.action.discard')]);

    // [Show my version] toggles the user's text.
    await user.click(within(lostNote).getByRole('button', { name: en('shell.sync.action.showMine') }));
    expect(within(lostNote).getByText('My version.')).toBeInTheDocument();
    expect(within(lostNote).getByRole('button', { name: en('shell.sync.action.hideVersion') })).toHaveAttribute('aria-expanded', 'true');

    // [Save as a new entry] (offline): an ordinary new entry with the user's version is queued; the note goes.
    goDown();
    await user.click(within(lostNote).getByRole('button', { name: en('shell.sync.action.saveAsNew') }));
    expect(await screen.findByText(en('shell.sync.action.savedAsNew'))).toBeInTheDocument();
    await waitFor(() => expect(offline.notes.list().map((n) => n.reason)).toEqual(['gone']));
    const queued = engine().outbox.rows.map((r) => r.q.op);
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ kind: 'entry.create', payload: { title: 'Morning walk', body: 'My version.' } });

    // [Discard] asks first; Cancel keeps the note, confirming removes it.
    const goneNow = (await screen.findAllByTestId('sync-note'))[0];
    await user.click(within(goneNow).getByRole('button', { name: en('shell.sync.action.discard') }));
    let ask = await screen.findByRole('dialog', { name: en('shell.sync.action.discard') });
    expect(ask).toHaveTextContent(en('shell.sync.action.discardConfirm'));
    await user.click(within(ask).getByRole('button', { name: T.cancel }));
    expect(offline.notes.list()).toHaveLength(1);
    await user.click(within(screen.getAllByTestId('sync-note')[0]).getByRole('button', { name: en('shell.sync.action.discard') }));
    ask = await screen.findByRole('dialog', { name: en('shell.sync.action.discard') });
    await user.click(within(ask).getByRole('button', { name: en('shell.sync.action.discard') }));
    await waitFor(() => expect(offline.notes.list()).toHaveLength(0));
    await waitFor(() => expect(screen.queryByTestId('sync-note')).not.toBeInTheDocument());
  }, 40000);
});
