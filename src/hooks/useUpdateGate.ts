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
 *    on screen is never torn down.
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

function subscribeHeld(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True while a page holds text at risk or somebody typed on the current page: the screen waits. */
export function isUpdateScreenHeld(): boolean {
  return holds > 0 || typedOnPage;
}

function setTypedOnPage(value: boolean): void {
  if (typedOnPage === value) return;
  typedOnPage = value;
  notify();
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
  const held = useSyncExternalStore(subscribeHeld, isUpdateScreenHeld, isUpdateScreenHeld);
  // Read directly, so the hook also works outside a router (as FocusHeading does).
  const pathname = useContext(UNSAFE_LocationContext)?.location.pathname ?? null;
  const required = updateRequirement(platform === undefined ? currentAppPlatform() : platform, appVersion, info);
  // Latched while shown: a guard, a hold or typing can only come from a page, and the pages are gone under the screen.
  const shown = useRef(false);
  if (!required) shown.current = false;
  else if (!guarded && !held) shown.current = true;
  const showing = shown.current;

  // Typed text on this page holds the screen back until the person goes to another page.
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
