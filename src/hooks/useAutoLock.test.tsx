import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Providers, type ProviderOptions } from '@/test/render';
import { useAutoLock } from './useAutoLock';

const MINUTE = 60_000;

function wrapperFor(options: ProviderOptions) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <Providers options={options}>{children}</Providers>;
  };
}

describe('useAutoLock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('locks after the configured minutes of inactivity', () => {
    const lock = vi.fn();
    renderHook(() => useAutoLock(2), { wrapper: wrapperFor({ auth: 'authenticated', lock: { lock } }) });
    act(() => vi.advanceTimersByTime(2 * MINUTE - 1000));
    expect(lock).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1000));
    expect(lock).toHaveBeenCalledTimes(1);
  });

  it('activity (mousemove / keydown) restarts the countdown', () => {
    const lock = vi.fn();
    renderHook(() => useAutoLock(1), { wrapper: wrapperFor({ auth: 'authenticated', lock: { lock } }) });
    act(() => vi.advanceTimersByTime(40_000));
    act(() => {
      fireEvent.mouseMove(window);
    });
    act(() => vi.advanceTimersByTime(40_000));
    expect(lock).not.toHaveBeenCalled(); // only 40s since the last activity
    act(() => {
      fireEvent.keyDown(window, { key: 'a' });
    });
    act(() => vi.advanceTimersByTime(59_000));
    expect(lock).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1000));
    expect(lock).toHaveBeenCalledTimes(1);
  });

  it('does nothing when disabled (0 minutes) or when anonymous', () => {
    const lock = vi.fn();
    renderHook(() => useAutoLock(0), { wrapper: wrapperFor({ auth: 'authenticated', lock: { lock } }) });
    act(() => vi.advanceTimersByTime(60 * MINUTE));
    expect(lock).not.toHaveBeenCalled();

    const lock2 = vi.fn();
    renderHook(() => useAutoLock(1), { wrapper: wrapperFor({ auth: 'anonymous', lock: { lock: lock2 } }) });
    act(() => vi.advanceTimersByTime(5 * MINUTE));
    expect(lock2).not.toHaveBeenCalled();
  });

  it('held (the "Update needed" screen): the idle time keeps counting, the lock waits and is done the moment the hold ends', () => {
    const lock = vi.fn();
    const { rerender } = renderHook(({ hold }) => useAutoLock(1, { hold }), {
      wrapper: wrapperFor({ auth: 'authenticated', lock: { lock } }),
      initialProps: { hold: true },
    });
    act(() => vi.advanceTimersByTime(5 * MINUTE));
    expect(lock).not.toHaveBeenCalled();
    // Pressing a button on the screen after the idle time passed does not undo the lock that is due.
    act(() => {
      fireEvent.keyDown(window, { key: 'Enter' });
    });
    rerender({ hold: false });
    expect(lock).toHaveBeenCalledTimes(1);
  });

  it('held, but the hold ends before the idle time passed: no lock, the countdown goes on', () => {
    const lock = vi.fn();
    const { rerender } = renderHook(({ hold }) => useAutoLock(1, { hold }), {
      wrapper: wrapperFor({ auth: 'authenticated', lock: { lock } }),
      initialProps: { hold: true },
    });
    act(() => vi.advanceTimersByTime(30_000));
    rerender({ hold: false });
    expect(lock).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(30_000));
    expect(lock).toHaveBeenCalledTimes(1);
  });

  it('stops the timer on unmount', () => {
    const lock = vi.fn();
    const { unmount } = renderHook(() => useAutoLock(1), { wrapper: wrapperFor({ auth: 'authenticated', lock: { lock } }) });
    unmount();
    act(() => vi.advanceTimersByTime(5 * MINUTE));
    expect(lock).not.toHaveBeenCalled();
  });
});
