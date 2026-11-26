/**
 * Locks the UI after `minutes` of inactivity (0 = never). Activity is any
 * mouse move, key press, pointer/touch event or scroll. Only runs while a
 * session exists. Hidden tabs may have throttled timers, so the elapsed time
 * is re-checked when the document becomes visible again.
 *
 * `hold` (the "Update needed" screen, src/App.tsx): the idle time keeps counting, but a lock that falls due
 * meanwhile waits - a lock under that screen would hold the uploads of the changes waiting on the device (the
 * server answers 423 until the password is typed on the lock screen, which is not shown). It is done the
 * moment the hold ends, so a device left idle on the screen never shows the diary unlocked afterwards.
 */
import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLock } from '@/context/LockContext';

export const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'pointerdown', 'touchstart', 'scroll', 'wheel'];

/** Do not reset the timer more often than this (mousemove fires constantly). */
const RESET_THROTTLE_MS = 1000;

export interface AutoLockOptions {
  /** While true a lock that falls due waits, and is done as soon as it is false again. */
  hold?: boolean;
}

export function useAutoLock(minutes: number, { hold = false }: AutoLockOptions = {}): void {
  const { status } = useAuth();
  const { lock, locked } = useLock();
  const lockRef = useRef(lock);
  lockRef.current = lock;
  const holdRef = useRef(hold);
  holdRef.current = hold;
  /** A lock fell due while held. */
  const dueRef = useRef(false);

  // The hold ended with a lock due: lock now.
  useEffect(() => {
    if (hold || !dueRef.current) return;
    dueRef.current = false;
    lockRef.current();
  }, [hold]);

  useEffect(() => {
    if (status !== 'authenticated' || locked || !Number.isFinite(minutes) || minutes <= 0) {
      dueRef.current = false;
      return;
    }
    const timeoutMs = minutes * 60_000;
    let timer: number | null = null;
    let lastActivity = Date.now();
    let lastReset = lastActivity;

    const fire = () => {
      timer = null;
      if (holdRef.current) dueRef.current = true;
      else lockRef.current();
    };
    const schedule = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(fire, timeoutMs);
    };
    const onActivity = () => {
      // Activity after the idle time passed does not undo the lock that is due.
      if (dueRef.current) return;
      const now = Date.now();
      lastActivity = now;
      if (now - lastReset < RESET_THROTTLE_MS) return;
      lastReset = now;
      schedule();
    };
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastActivity >= timeoutMs) fire();
      else schedule();
    };

    schedule();
    for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, onActivity, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [minutes, status, locked]);
}
