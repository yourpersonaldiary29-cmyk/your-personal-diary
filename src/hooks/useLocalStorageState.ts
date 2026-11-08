/**
 * `useState` persisted in localStorage as JSON (per-device UI preferences such
 * as the last selected period or a collapsed section). Storage failures are
 * swallowed: the hook then behaves like plain `useState`.
 *
 * The key may change (per-account keys): the value is then read from the new
 * key in the same render, and a value is only ever written back under the key
 * it was read from - never one account's list under another account's key.
 */
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

function read<T>(key: string, fallback: T, validate?: (v: unknown) => v is T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (validate && !validate(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function useLocalStorageState<T>(
  key: string,
  initialValue: T | (() => T),
  /** Optional type guard applied to the stored value (ignores corrupt data). */
  validate?: (v: unknown) => v is T,
): [T, Dispatch<SetStateAction<T>>] {
  const fallback = () => (typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue);
  const [state, setState] = useState<{ key: string; value: T; dirty: boolean }>(() => ({ key, value: read(key, fallback(), validate), dirty: false }));

  // The key changed: read the new key now (derived state, set during render).
  let current = state;
  if (state.key !== key) {
    current = { key, value: read(key, fallback(), validate), dirty: false };
    setState(current);
  }

  useEffect(() => {
    if (!state.dirty) return;
    try {
      window.localStorage.setItem(state.key, JSON.stringify(state.value));
    } catch {
      /* storage unavailable (private mode, quota) */
    }
  }, [state]);

  const set = useCallback<Dispatch<SetStateAction<T>>>(
    (next) =>
      setState((prev) => ({
        key: prev.key,
        value: typeof next === 'function' ? (next as (p: T) => T)(prev.value) : next,
        dirty: true,
      })),
    [],
  );
  return [current.value, set];
}
