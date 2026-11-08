/**
 * Screen-reader announcements. Renders two live regions (polite + assertive)
 * at the end of <body> and exposes `announce(text, politeness)`.
 *
 * The same text can be announced twice in a row: the region is cleared first
 * and re-filled on the next tick so assistive technology sees a change.
 *
 * A message that is still waiting for that tick is not dropped when another
 * one arrives (e.g. "The entry was saved" followed at once by the route
 * announcement of the page it opens): the two are read together. A region is
 * emptied again a few seconds after it spoke, so an old message is not found
 * later on another page. `clear()` empties both regions at once (a language
 * change: a message left in the old language must not be found in the new one).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { LiveRegion } from '@/components/a11y/LiveRegion';

export type Politeness = 'polite' | 'assertive';

export interface AnnouncerContextValue {
  /** Queue a message for screen readers. Empty strings are ignored. */
  announce: (text: string, politeness?: Politeness) => void;
  /** Empties both regions and drops messages still waiting to be spoken. */
  clear: () => void;
}

const noop: AnnouncerContextValue = { announce: () => undefined, clear: () => undefined };

export const AnnouncerContext = createContext<AnnouncerContextValue>(noop);

/** How long a spoken message stays in its live region before the region is emptied. */
export const ANNOUNCEMENT_TTL_MS = 10_000;

/** Joins a still-pending message with a new one ("Saved" + "Entry" -> "Saved. Entry"). */
export function joinAnnouncements(first: string, next: string): string {
  if (first === next) return first;
  return /[.!?…。！？؟।]$/.test(first) ? `${first} ${next}` : `${first}. ${next}`;
}

type Slots = { polite: number | null; assertive: number | null };

export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState('');
  const [assertive, setAssertive] = useState('');
  const timers = useRef<Slots>({ polite: null, assertive: null });
  const expiry = useRef<Slots>({ polite: null, assertive: null });
  const pending = useRef<{ polite: string | null; assertive: string | null }>({ polite: null, assertive: null });

  const announce = useCallback((text: string, politeness: Politeness = 'polite') => {
    const msg = text.trim();
    if (!msg) return;
    const setter = politeness === 'assertive' ? setAssertive : setPolite;
    // Clear then set so identical consecutive messages are announced again.
    setter('');
    const prev = timers.current[politeness];
    if (prev !== null) window.clearTimeout(prev);
    const stale = expiry.current[politeness];
    if (stale !== null) window.clearTimeout(stale);
    expiry.current[politeness] = null;
    // A message still waiting for its tick is read together with the new one.
    const queued = pending.current[politeness];
    const combined = queued ? joinAnnouncements(queued, msg) : msg;
    pending.current[politeness] = combined;
    timers.current[politeness] = window.setTimeout(() => {
      setter(combined);
      timers.current[politeness] = null;
      pending.current[politeness] = null;
      expiry.current[politeness] = window.setTimeout(() => {
        setter('');
        expiry.current[politeness] = null;
      }, ANNOUNCEMENT_TTL_MS);
    }, 50);
  }, []);

  const clear = useCallback(() => {
    for (const politeness of ['polite', 'assertive'] as const) {
      for (const slots of [timers.current, expiry.current]) {
        const id = slots[politeness];
        if (id !== null) window.clearTimeout(id);
        slots[politeness] = null;
      }
      pending.current[politeness] = null;
    }
    setPolite('');
    setAssertive('');
  }, []);

  useEffect(() => {
    const t = timers.current;
    const e = expiry.current;
    return () => {
      for (const slots of [t, e]) {
        if (slots.polite !== null) window.clearTimeout(slots.polite);
        if (slots.assertive !== null) window.clearTimeout(slots.assertive);
      }
    };
  }, []);

  const value = useMemo(() => ({ announce, clear }), [announce, clear]);

  return (
    <AnnouncerContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div data-testid="announcer">
            <LiveRegion politeness="polite" message={polite} />
            <LiveRegion politeness="assertive" message={assertive} />
          </div>,
          document.body,
        )}
    </AnnouncerContext.Provider>
  );
}

/**
 * Returns `{ announce, clear }`. Safe to call outside a provider (no-op), so shared
 * components can announce when available without requiring the provider in tests.
 */
export function useAnnouncer(): AnnouncerContextValue {
  return useContext(AnnouncerContext);
}
