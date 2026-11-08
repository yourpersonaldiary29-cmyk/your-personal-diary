import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiClientError } from '@/api';
import { useApi } from './useApi';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useApi', () => {
  it('loads data and exposes loading / data / error', async () => {
    const fn = vi.fn(async (_signal: AbortSignal) => ({ ok: true }));
    const { result } = renderHook(() => useApi(fn, []));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ ok: true });
    expect(result.current.error).toBeNull();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
  });

  it('turns an ApiClientError into its Hebrew message', async () => {
    const fn = vi.fn(async () => {
      throw new ApiClientError(404, { code: 'NOT_FOUND', message: 'הרשומה לא נמצאה' });
    });
    const { result } = renderHook(() => useApi(fn, []));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('הרשומה לא נמצאה');
    expect(result.current.data).toBeNull();
  });

  it('re-runs when deps change and aborts the previous request', async () => {
    const signals: AbortSignal[] = [];
    const first = deferred<string>();
    const fn = vi.fn((signal: AbortSignal) => {
      signals.push(signal);
      return signals.length === 1 ? first.promise : Promise.resolve('second');
    });
    const { result, rerender } = renderHook(({ id }: { id: number }) => useApi((signal) => fn(signal), [id]), {
      initialProps: { id: 1 },
    });
    rerender({ id: 2 });
    expect(signals[0].aborted).toBe(true);
    await waitFor(() => expect(result.current.data).toBe('second'));
    // A late answer from the aborted call is ignored.
    await act(async () => {
      first.resolve('first');
      await Promise.resolve();
    });
    expect(result.current.data).toBe('second');
  });

  it('reload runs the call again and setData patches the cache', async () => {
    let n = 0;
    const fn = vi.fn(async () => ++n);
    const { result } = renderHook(() => useApi(fn, []));
    await waitFor(() => expect(result.current.data).toBe(1));
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.data).toBe(2);
    act(() => result.current.setData(42));
    expect(result.current.data).toBe(42);
  });

  it('enabled: false skips the call', async () => {
    const fn = vi.fn(async () => 'x');
    const { result } = renderHook(() => useApi(fn, [], { enabled: false }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fn).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it('aborts on unmount and ignores the result', async () => {
    const pending = deferred<string>();
    let seen: AbortSignal | null = null;
    const fn = vi.fn((signal: AbortSignal) => {
      seen = signal;
      return pending.promise;
    });
    const { unmount } = renderHook(() => useApi(fn, []));
    unmount();
    expect(seen!.aborted).toBe(true);
    pending.resolve('late');
    await Promise.resolve();
  });
});
