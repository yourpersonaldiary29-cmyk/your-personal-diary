/**
 * Every native listener of the app that could hear a person typing, listed by hand with why it is safe
 * (app version 1.1.0 before its release lost the first character of every page to one of them,
 * src/hooks/useUpdateGate.ts).
 *
 * A listener on the window or the document runs BEFORE React's own handler of an event (capture phase), and in a
 * browser the microtask checkpoint after it runs too: whatever it makes React render - at once, or put off with
 * queueMicrotask or Promise.then - renders with the state of before the key, and React writes the typed field
 * back to its old value. src/test/browser-event-order.ts shows that in jsdom only for work React has already
 * scheduled synchronously; this list catches a NEW listener whatever its timing. It reads only the calls, not
 * what a listener does: a change INSIDE a listed listener is not seen here, so whoever changes one checks it
 * against this paragraph again (the gate's own listener has a test of its own that counts the renders,
 * src/hooks/useUpdateGate.test.tsx). A listener directly on an element runs before React's handler at the root
 * container too, so a typing event on any element counts.
 *
 * Read from the source: `<receiver>.addEventListener(<first argument>, ...)` in src/** and mobile/** outside the
 * tests. Listed: every call on the window or the document (`document.body`, `document.documentElement`), whatever
 * the event - a name held in a variable cannot be checked here - and every call with a typing event spelled out,
 * whatever the receiver. When this test fails, check the new listener against the paragraph above before adding
 * it below.
 */
import { describe, expect, it } from 'vitest';
import { TYPING_EVENTS } from './browser-event-order';

const SOURCES = {
  ...import.meta.glob<string>(['/src/**/*.{ts,tsx}', '/mobile/**/*.{ts,tsx}', '!**/*.test.{ts,tsx}', '!/src/test/**', '!**/test-utils/**'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
};

/** `file: receiver.addEventListener(first argument)`, with why it cannot spoil a typed character. */
const KNOWN: Record<string, string> = {
  "/mobile/platform/ui.ts: sources.darkQuery.addEventListener('change')":
    "The phone's dark-mode media query (a MediaQueryList, not a field): a task of its own, never inside a typing event; it styles the system bars and renders nothing.",
  "/src/context/AuthContext.tsx: window.addEventListener(UNAUTHORIZED_EVENT)":
    "The app's own event for a refused session (two listeners); dispatched by the api client after an answer, never inside a typing event.",
  "/src/context/ConnectionContext.tsx: window.addEventListener('online')": 'Not a typing event, never dispatched inside one.',
  "/src/context/LockContext.tsx: window.addEventListener(LOCKED_EVENT)":
    "The app's own event for a locked session; dispatched after a server answer, never inside a typing event.",
  "/src/context/LockContext.tsx: window.addEventListener('keydown')":
    'Bubble phase, after React; saves the activity time asynchronously, sets no React state; keydown comes before the field changes.',
  "/src/context/LockContext.tsx: window.addEventListener('pointerdown')": 'Not a typing event; the same activity time as its keydown.',
  "/src/hooks/useMediaQuery.ts: mql.addEventListener('change')":
    "A media query's change (a MediaQueryList, not a field): reported in the browser's rendering step, a task of its own, never inside a typing event.",
  "/src/hooks/useAutoLock.ts: window.addEventListener(ev)":
    'ACTIVITY_EVENTS (keydown among them), passive bubble phase: restarts the idle timer only; the lock comes from the timer.',
  "/src/hooks/useAutoLock.ts: document.addEventListener('visibilitychange')": 'Not a typing event, never dispatched inside one.',
  "/src/hooks/useKeyboardShortcuts.ts: window.addEventListener('keydown')":
    'Bubble phase, after React; a shortcut calls preventDefault, so no text is inserted and no input event follows.',
  "/src/hooks/useUnsavedChangesGuard.ts: window.addEventListener('beforeunload')": 'Not a typing event.',
  "/src/hooks/useUpdateGate.ts: document.addEventListener('input')":
    'Capture phase, on purpose; it only RECORDS the typing - setTypedOnPage(true) notifies nobody (the fault of 1.1.0 when it did).',
  "/src/offline/index.ts: window.addEventListener(UNAUTHORIZED_EVENT)": "The app's own event for a refused session, never inside a typing event.",
  "/src/offline/index.ts: window.addEventListener(LOCKED_EVENT)": "The app's own event for a locked session, never inside a typing event.",
  "/src/pages/entries/EntryForm.tsx: window.addEventListener('keydown')":
    'Bubble phase, after React; Ctrl/Cmd+S only, with preventDefault (no text is inserted).',
  "/src/pages/habits/PhoneRemindersNotice.tsx: document.addEventListener('visibilitychange')": 'Not a typing event, never dispatched inside one.',
};

const WINDOW_OR_DOCUMENT = /^(window|document|document\.body|document\.documentElement|globalThis)$/;
const TYPING = new Set<string>(TYPING_EVENTS);

/** The listed calls in `sources` (file name to text), spelled as the keys of KNOWN. */
function listenersIn(sources: Record<string, string>): string[] {
  const found: string[] = [];
  // `a.b.addEventListener(` and the optional chains `a?.b?.addEventListener?.(`.
  const call = /([A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*)\s*\??\.addEventListener(?:\?\.)?\(\s*([^,)]+)/g;
  for (const [file, text] of Object.entries(sources)) {
    for (const match of text.matchAll(call)) {
      const receiver = match[1].replace(/\?/g, '');
      const first = match[2].trim();
      const literal = /^(['"`])(.*)\1$/.exec(first)?.[2];
      if (WINDOW_OR_DOCUMENT.test(receiver) || (literal !== undefined && TYPING.has(literal))) {
        found.push(`${file}: ${receiver}.addEventListener(${first.replace(/"/g, "'")})`);
      }
    }
  }
  return [...new Set(found)].sort();
}

describe('the native listeners that could hear typing', () => {
  it('reads the sources (src/** and mobile/**, without the tests)', () => {
    expect(Object.keys(SOURCES)).toContain('/src/hooks/useUpdateGate.ts');
    expect(Object.keys(SOURCES).some((file) => file.startsWith('/mobile/'))).toBe(true);
    expect(Object.keys(SOURCES).some((file) => /\.test\.tsx?$/.test(file))).toBe(false);
  });

  it('are exactly the listed ones, each with why it is safe (a new one must be checked first)', () => {
    expect(listenersIn(SOURCES)).toEqual(Object.keys(KNOWN).sort());
  });

  it('would catch a new typing listener on the document or on an element', () => {
    // The same reading on a made-up source, so the pattern itself is pinned.
    const text = "document.addEventListener('beforeinput', a, true);\nfield.addEventListener(\"paste\", b);\nsignal.addEventListener('abort', c);\nsources.query?.addEventListener?.('change', d);";
    expect(listenersIn({ '/src/made-up.ts': text })).toEqual([
      "/src/made-up.ts: document.addEventListener('beforeinput')",
      "/src/made-up.ts: field.addEventListener('paste')",
      "/src/made-up.ts: sources.query.addEventListener('change')",
    ]);
  });
});
