/**
 * Locks the UI after `minutes` of inactivity (0 = never). Activity is any
 * mouse move, key press, pointer/touch event or scroll. Only runs while a
 * session exists. Hidden tabs may have throttled timers, so the elapsed time
 * is re-checked when the document becomes visible again.
 */
import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLock } from '@/context/LockContext';

export const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'pointerdown', 'touchstart', 'scroll', 'wheel'];

/** Do not reset the timer more often than this (mousemove fires constantly). */
const RESET_THROTTLE_MS = 1000;

export function useAutoLock(minutes: number): void {
  const { status } = useAuth();
  const { lock, locked } = useLock();
  const lockRef = useRef(lock);
  lockRef.current = lock;

  useEffect(() => {
    if (status !== 'authenticated' || locked) return;
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    const timeoutMs = minutes * 60_000;
    let timer: number | null = null;
    let lastActivity = Date.now();
    let lastReset = lastActivity;

    const fire = () => {
      timer = null;
      lockRef.current();
    };
    const schedule = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(fire, timeoutMs);
    };
    const onActivity = () => {
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
