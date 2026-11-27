/**
 * WHEN the "Update needed" screen appears (src/pages/UpdateRequiredPage.tsx, rendered by src/App.tsx in place
 * of everything else).
 *
 * The decision is the pure `updateRequirement` (src/utils/appUpdate.ts) on the server's self-description in the
 * connection store - which only the server's own answer in this run can bring an `appUpdate` into (the probe
 * at start, Retry, "Check again", the refresh after a start from the cache; the cache start's snapshot never
 * holds it). So it is normally decided at the start, before any page is shown. When pages are already on
 * screen by then (a slow connection, a start from the cache that reached the server later, the automatic
 * retry when the connection comes back), the screen replaces them too - EXCEPT while text somebody typed
 * could be lost by it. The screen never takes away text that somebody is writing. It waits while:
 *  - a page holds unsaved changes (the unsaved-changes guard is active, `hasActiveLeaveGuard()`);
 *  - a page holds text at risk that its leave guard does not show (`useUpdateScreenHold`): the entry editor
 *    drops its leave guard while a save is in flight, but the text is safe only once the server (or the
 *    device) has kept it - a refused save leaves the editor and its text in place;
 *  - somebody typed into a text field on the current page (`input` events of text fields, not of a password
 *    field, a checkbox, a choice list or a slider). This covers every form and dialog without a guard of its
 *    own (the habit dialog, the settings forms): the screen then waits until the person goes to another page
 *    (the path changes; a page with unsaved changes asks first, as always) - and a typed field that is still
 *    on screen is never torn down. The typing is heard by a capture-phase listener on the document and only
 *    RECORDED there: nothing in it makes React render, or the key being typed is lost (setTypedOnPage says why).
 *    A known limit: when App remounts the pages at the same path (another language, another account - the
 *    keyed fragment in src/App.tsx), the typed text is gone but the record stays, so the screen waits until
 *    the person goes to another page - late, never over typed text.
 * Once shown it stays until the rule no longer applies (a later answer of the server without it: "Check
 * again"); the pages are gone under it, so nothing typed is left to wait for.
 *
 * Nothing else is touched: the session (AuthProvider) and the offline engine go on underneath, so changes
 * waiting on the device keep uploading, and whoever updates the app is in again without signing in.
 */
import { useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import { UNSAFE_LocationContext } from 'react-router-dom';
import { APP_VERSION } from '@shared/constants';
import { useServerInfo } from '@/context/ConnectionContext';
import { currentAppPlatform, updateRequirement, type UpdateRequirement } from '@/utils/appUpdate';
import { hasActiveLeaveGuard, subscribeLeaveGuard } from './useUnsavedChangesGuard';

// ---------------------------------------------------------------------------------------------------------
// What makes the screen wait besides the leave guard: the holds of the pages, and text typed on this page.
// ---------------------------------------------------------------------------------------------------------

let holds = 0;
let typedOnPage = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of [...listeners]) listener();
}

/** Subscribes to `isUpdateScreenHeld()` changing in a way the screen must hear (for useSyncExternalStore; tests). */
export function subscribeUpdateScreenHeld(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True while a page holds text at risk or somebody typed on the current page: the screen waits. */
export function isUpdateScreenHeld(): boolean {
  return holds > 0 || typedOnPage;
}

/**
 * Records whether somebody typed on the current page. Turning it FALSE (the path changed, the screen is shown)
 * notifies: the screen may appear now. Turning it TRUE records the fact and notifies NOBODY - on purpose:
 *
 * It turns true inside the capture-phase `input` listener on the document (below). In a browser that listener
 * is a callback of its own, and when it returns the microtask checkpoint runs - BEFORE React's own listener at
 * the root container has seen the event. A notification here makes useSyncExternalStore schedule a synchronous
 * render of App, which then runs in that checkpoint: every page under App renders with the state of before
 * the key, React writes the controlled field back to that old value, and when React's handler then looks at
 * the event the field holds the old value - no onChange, the character is gone ("Hello" typed into the title of
 * a new entry left "ello"; a paste or a filled field as the first input was lost whole). Tests in jsdom did not
 * see it (no checkpoint between the listeners of one dispatch) until src/test/browser-event-order.ts.
 *
 * Nobody needs to hear "became true": useUpdateGate reads `isUpdateScreenHeld()` at every render (getSnapshot),
 * so the next render for any reason - the server's rule arriving, a guard going - sees the hold; and becoming
 * held can never make the screen appear or go (it only stops it from appearing, and once shown it is latched).
 * So nothing that runs in that listener may make React render. Do not put the notification back - and not
 * "deferred to be safe" either: a notification put off with queueMicrotask or Promise.then runs in that same
 * checkpoint, before React's handler, and loses the character just the same (the checkpoint runs every microtask
 * queued meanwhile, the ones they queue in turn included). Only a later task (a timer) or a bubble-phase listener
 * would run after React's handler, and neither is wanted here: the hold must be true at once, and the listener
 * must hear an event a handler stopped (src/hooks/useUpdateGate.test.tsx pins both).
 */
function setTypedOnPage(value: boolean): void {
  if (typedOnPage === value) return;
  typedOnPage = value;
  if (!value) notify();
}

/**
 * Holds the "Update needed" screen back while `active` (a page whose text is not safe yet, also while its
 * leave guard is down - the entry editor during a save). Released by `active` false or by leaving the page.
 */
export function useUpdateScreenHold(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    holds += 1;
    notify();
    return () => {
      holds -= 1;
      notify();
    };
  }, [active]);
}

/** Input types whose `input` event is not typed text (losing them loses nothing a person wrote). */
const NOT_TEXT_INPUTS = new Set(['checkbox', 'radio', 'range', 'file', 'color', 'button', 'submit', 'reset', 'image', 'hidden', 'password']);

/** Whether an `input` event came from a field that holds typed text. */
export function isTypedTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) return !NOT_TEXT_INPUTS.has(target.type.toLowerCase());
  return target.isContentEditable === true;
}

/** Test helper: forgets the holds and the typed text (each test starts from a fresh page). */
export function __resetUpdateGateForTests(): void {
  holds = 0;
  typedOnPage = false;
  notify();
}

export interface UpdateGateOptions {
  /** The platform (default: the app this UI runs in, `currentAppPlatform()`); tests pass one. */
  platform?: ReturnType<typeof currentAppPlatform>;
  /** The app's own version (default: `APP_VERSION`); tests pass one. */
  appVersion?: string;
}

/** The update the screen asks for while it is shown, or null while the app may be used (or the screen must still wait). */
export function useUpdateGate({ platform, appVersion = APP_VERSION }: UpdateGateOptions = {}): UpdateRequirement | null {
  const info = useServerInfo();
  const guarded = useSyncExternalStore(subscribeLeaveGuard, hasActiveLeaveGuard, hasActiveLeaveGuard);
  const held = useSyncExternalStore(subscribeUpdateScreenHeld, isUpdateScreenHeld, isUpdateScreenHeld);
  // Read directly, so the hook also works outside a router (as FocusHeading does).
  const pathname = useContext(UNSAFE_LocationContext)?.location.pathname ?? null;
  const required = updateRequirement(platform === undefined ? currentAppPlatform() : platform, appVersion, info);
  // Latched while shown: a guard, a hold or typing can only come from a page, and the pages are gone under the screen.
  const shown = useRef(false);
  if (!required) shown.current = false;
  else if (!guarded && !held) shown.current = true;
  const showing = shown.current;

  // Typed text on this page holds the screen back until the person goes to another page. Capture phase, so an
  // event a handler stops still counts; the listener only records it (setTypedOnPage(true) notifies nobody).
  useEffect(() => {
    const onInput = (event: Event) => {
      if (isTypedTextTarget(event.target)) setTypedOnPage(true);
    };
    document.addEventListener('input', onInput, true);
    return () => document.removeEventListener('input', onInput, true);
  }, []);
  useEffect(() => {
    setTypedOnPage(false);
  }, [pathname]);
  // Under the screen the page that was typed on is gone: nothing typed is left.
  useEffect(() => {
    if (showing) setTypedOnPage(false);
  }, [showing]);

  return showing ? required : null;
}
