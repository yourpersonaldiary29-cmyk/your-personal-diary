/**
 * Test helper: gives jsdom the browser's order of work at one point of an event's dispatch.
 *
 * In a browser every event listener is a callback of its own: when one returns, the microtask checkpoint
 * runs before the next listener is called. So whatever a listener on `window` / `document` makes React
 * schedule synchronously (a store React reads with useSyncExternalStore that notifies, a setState) is
 * RENDERED before React's own listener at the root container sees the event - for a typed character that
 * means React writes the controlled field back to its old value first, and then finds no change: the
 * character is lost (the fault of app version 1.1.0 before its release, src/hooks/useUpdateGate.ts).
 *
 * jsdom dispatches a test's event from script: there is no checkpoint between the listeners of one
 * dispatch, React's handler runs first and the test sees nothing wrong. This helper puts the checkpoint
 * back where it matters: a capture-phase listener on `document.body` - it runs after the capture listeners
 * of `window` and `document` and before React's listeners at the root container (testing-library renders
 * into a container under <body>) - that flushes React's pending synchronous work with `flushSync`, as the
 * browser's checkpoint does. Inside testing-library's `act` the work is queued, not run; `flushSync` runs it
 * anyway (it renders every root with pending synchronous work), so the order is the browser's there too.
 *
 * What it does NOT see: work that has not reached React yet when this listener runs. A document listener that
 * puts its notification off with queueMicrotask or Promise.then loses the character in a browser just the same
 * (the checkpoint runs every microtask queued meanwhile), but here the notification runs only after the whole
 * dispatch, React's handler included, so typing tests pass. A synchronous listener cannot drain jsdom's
 * microtask queue, so that case is caught another way, and only as far as this:
 *  - the gate's own listener (src/hooks/useUpdateGate.test.tsx): one typed character is exactly one render of
 *    the page, and no subscriber of its store is called within a whole task after the input - a render or a
 *    notification put off inside that listener fails there;
 *  - a NEW listener: src/test/typing-listeners.test.ts lists every listener of the window and the document and
 *    every listener for a typing event, so a new one fails the suite whatever its timing.
 * A render put off inside ANOTHER listener that is already on that list is caught by nothing here: whoever
 * changes one of them checks it against the list's header, and the picture script types into the real app in a
 * real browser before every release (scripts/play/render-screenshots.mjs, writeOffline). Only a later task (a
 * timer) or a bubble-phase listener on the window or the document really runs after React's handler.
 *
 * Use `installBrowserEventOrder()` / its returned uninstall, or `withBrowserEventOrder()` inside a describe
 * (or at the top of a file) for before / after each test.
 */
import { flushSync } from 'react-dom';
import { afterEach, beforeEach } from 'vitest';

/** The events a person's typing, pasting or dropping makes a page dispatch (those a listener could spoil). */
export const TYPING_EVENTS = [
  'beforeinput',
  'input',
  'change',
  'keydown',
  'keypress',
  'keyup',
  'paste',
  'cut',
  'drop',
  'compositionstart',
  'compositionupdate',
  'compositionend',
] as const;

/** Flushes what React has scheduled synchronously - the browser's microtask checkpoint between two listeners. */
function checkpoint(): void {
  flushSync(() => undefined);
}

/** How many installs each element has: a second install (a file's own on top of setup.ts's) adds nothing, and its uninstall leaves the first. */
const installs = new WeakMap<HTMLElement, number>();

/** Installs the checkpoint on `document.body` (capture phase) for the typing events; returns the uninstall. */
export function installBrowserEventOrder(target: HTMLElement = document.body): () => void {
  const count = installs.get(target) ?? 0;
  if (count === 0) for (const type of TYPING_EVENTS) target.addEventListener(type, checkpoint, true);
  installs.set(target, count + 1);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    const left = (installs.get(target) ?? 1) - 1;
    installs.set(target, left);
    if (left === 0) for (const type of TYPING_EVENTS) target.removeEventListener(type, checkpoint, true);
  };
}

/** Installs the checkpoint before each test of the surrounding describe (or file) and removes it after it. */
export function withBrowserEventOrder(): void {
  let uninstall: (() => void) | null = null;
  beforeEach(() => {
    uninstall = installBrowserEventOrder();
  });
  afterEach(() => {
    uninstall?.();
    uninstall = null;
  });
}
