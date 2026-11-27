/**
 * The first character typed on a page stays (app version 1.1.0, before its release): the whole app with its real
 * providers and the REAL api client against the offline engine's in-memory diary server (as
 * src/pages/UpdateRequired.app.test.tsx), with the browser's order of an event's listeners
 * (src/test/browser-event-order.ts).
 *
 * In a browser the microtask checkpoint after a listener on the document runs BEFORE React's own listener at the
 * root container. When such a listener makes React render (src/hooks/useUpdateGate.ts notified its store on the
 * first text input of a page), React writes the controlled field back to its old value and then sees no change:
 * "Hello" typed into the title of a new entry left "ello", and a first input that arrives as one event (a paste,
 * a filled field) was lost whole. jsdom alone has no checkpoint there, so these tests run with the helper on.
 *
 * Every case arrives on a page (or goes there in the app) and types into the FIRST field it uses there. The
 * password of the lock screen is not "typed text" for the gate (it never holds the update screen), but it must
 * not lose a character either - it guards against a later listener of any kind. Fictional data only.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import * as api from '@/api';
import { PATHS } from '@/constants/routes';
import { T } from '@/constants/texts';
import { trWith } from '@/i18n/runtime';
import { offline } from '@/offline';
import { DANA, installWebCrypto, wireDevice } from '@/offline/test-utils/env';
import { FakeSyncServer } from '@/offline/test-utils/fake-sync-server';
import { ET } from '@/pages/entries';
import { withBrowserEventOrder } from '@/test/browser-event-order';
import { renderOfflineApp, resetOfflineApp } from '@/test/offline-app';

// The reminder poll is not part of these flows (and would ask the desktop shell, which a test has not).
vi.mock('@/hooks/useReminders', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useReminders')>()),
  useReminders: () => undefined,
}));

const en = trWith('en');

let server: FakeSyncServer;

beforeAll(() => installWebCrypto());

beforeEach(() => {
  server = new FakeSyncServer();
});

afterEach(async () => {
  await resetOfflineApp();
});

/** Until the engine runs for the signed-in account (the pages read from it). */
async function engineActive(): Promise<void> {
  await waitFor(() => expect(offline.isActive()).toBe(true));
}

interface TypingCase {
  /** What is typed into, in words. */
  name: string;
  /** Wires the device, renders the app and returns the field (nothing typed into anything before). */
  open: (user: () => UserEvent) => Promise<HTMLInputElement | HTMLTextAreaElement>;
}

const CASES: TypingCase[] = [
  {
    name: 'the title of a new entry (the page opened at /new)',
    open: async () => {
      wireDevice({ server, app: true });
      return start('/new', async () => {
        await engineActive();
        return screen.findByRole('textbox', { name: ET.title });
      });
    },
  },
  {
    name: 'the text of a new entry, as the first field typed into',
    open: async () => {
      wireDevice({ server, app: true });
      return start('/new', async () => {
        await engineActive();
        return screen.findByRole('textbox', { name: new RegExp(`^${ET.body}`) });
      });
    },
  },
  {
    name: 'the title of an entry being edited (filled in already; the page opened at /entry/:id/edit)',
    open: async () => {
      wireDevice({ server, app: true });
      const entry = server.seedEntry(DANA, { title: 'Morning walk', date: '2026-11-20' });
      return start(PATHS.editEntry(entry.id), async () => {
        await engineActive();
        const field = await screen.findByRole('textbox', { name: ET.title }, { timeout: 15000 });
        await waitFor(() => expect(field).toHaveValue('Morning walk'), { timeout: 15000 });
        return field;
      });
    },
  },
  {
    name: 'the title of a new entry after going there in the app (Home, then "New entry")',
    open: async (user) => {
      wireDevice({ server, app: true });
      return start('/', async () => {
        await engineActive();
        await user().click((await screen.findAllByRole('link', { name: en('shell.nav.newEntry') }))[0]);
        return screen.findByRole('textbox', { name: ET.title });
      });
    },
  },
  {
    name: 'the search box after going there in the app (Home, then "Search")',
    open: async (user) => {
      wireDevice({ server, app: true });
      return start('/', async () => {
        await engineActive();
        await user().click((await screen.findAllByRole('link', { name: en('shell.nav.search') }))[0]);
        return screen.findByRole('searchbox', { name: new RegExp(`^${en('search.label')}`) });
      });
    },
  },
  {
    name: 'the user name on the sign-in page',
    open: async () => {
      wireDevice({ server });
      api.clearToken();
      return start('/login', async () => screen.findByLabelText(new RegExp(T.usernameOrEmail)));
    },
  },
  {
    name: 'the first name on the registration page',
    open: async () => {
      wireDevice({ server });
      api.clearToken();
      return start(PATHS.register, async () => screen.findByRole('textbox', { name: new RegExp(`^${T.firstName}`) }));
    },
  },
  {
    name: 'the name in the habit dialog',
    open: async (user) => {
      wireDevice({ server, app: true });
      return start('/habits', async () => {
        await engineActive();
        await user().click((await screen.findAllByRole('button', { name: en('habits.form.newTitle') }))[0]);
        return within(await screen.findByRole('dialog')).findByRole('textbox', { name: new RegExp(`^${en('habits.form.name')}`) });
      });
    },
  },
  {
    name: 'the first name in the settings ("Edit details")',
    open: async (user) => {
      wireDevice({ server, app: true });
      return start('/settings', async () => {
        await engineActive();
        await user().click(await screen.findByRole('button', { name: en('settings.account.editDetails') }));
        return screen.findByRole('textbox', { name: new RegExp(`^${T.firstName}`) });
      });
    },
  },
  {
    name: 'the password on the lock screen (a locked session)',
    open: async () => {
      const { account } = wireDevice({ server, rememberMe: true, app: true });
      server.lockedTokens.add(account.token);
      return start('/', async () => within(await screen.findByRole('dialog', {}, { timeout: 15000 })).getByLabelText(new RegExp(`^${T.password}`)));
    },
  },
];

let current: UserEvent | null = null;

/** Renders the whole app at `route` and finds the field with `find` (which may move around the app first). */
async function start(route: string, find: () => Promise<HTMLElement>): Promise<HTMLInputElement | HTMLTextAreaElement> {
  current = renderOfflineApp(route).user;
  const field = await find();
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) throw new Error('not a text field');
  return field;
}

describe('the first character typed on a page stays (in the browser\'s order of events)', () => {
  withBrowserEventOrder();

  it.each(CASES)('$name', async ({ open }) => {
    current = null;
    const field = await open(() => {
      if (!current) throw new Error('the app is not rendered yet');
      return current;
    });
    const before = field.value;
    await current!.type(field, 'Hello');
    expect(field.value).toBe(`${before}Hello`);
  }, 40000);
});
