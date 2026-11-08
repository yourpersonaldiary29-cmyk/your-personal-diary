/**
 * Runs an async API call tied to the component's lifetime.
 *
 *   const { data, loading, error, reload, setData } = useApi(
 *     (signal) => api.entries.get(id, signal), [id]);
 *
 * - A new run aborts the previous one (AbortController) and an unmount aborts
 *   the last one; aborted results are ignored.
 * - `error` is a localised message (errorMessage), null when fine.
 * - `setData` lets the page patch the cached value after a mutation.
 * - `enabled: false` skips the call (e.g. until an id is known).
 * - `offline: true` (the pages whose reads the automatic offline mode serves, OFFLINE-DESIGN.md section
 *   4.6 "Pages re-run"): the call runs again, quietly - no spinner, the data stays until the new answer -
 *   whenever the offline engine's data version moves (an upload was acknowledged, a change was queued, a
 *   view was refreshed, another tab wrote). While offline mode is off the version never moves: the hook
 *   behaves exactly as without the option.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type DependencyList, type Dispatch, type SetStateAction } from 'react';
import { getSyncStatus, subscribeSyncStatus } from '@/offline/status';
import { errorMessage, isAbortError } from '@/utils/errors';

const dataVersionOf = () => getSyncStatus().dataVersion;
const NO_VERSION = () => 0;
const noSubscription = () => () => undefined;

export interface UseApiOptions<T> {
  /** Default true. When false no request is made and `loading` is false. */
  enabled?: boolean;
  /** Re-run quietly when the offline engine's data version moves (see the module comment). */
  offline?: boolean;
  /** Value returned before the first response. */
  initialData?: T | null;
  /** Called with the data after every successful load. */
  onSuccess?: (data: T) => void;
  /** Called with the original error (not for aborts). */
  onError?: (error: unknown) => void;
}

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  /** Localised error message or null. */
  error: string | null;
  /** Re-runs the call (aborting any run in flight). */
  reload: () => Promise<void>;
  setData: Dispatch<SetStateAction<T | null>>;
}

export function useApi<T>(fn: (signal: AbortSignal) => Promise<T>, deps: DependencyList, options: UseApiOptions<T> = {}): UseApiResult<T> {
  const { enabled = true, initialData = null } = options;
  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const hasDataRef = useRef(initialData !== null);

  const execute = useCallback(async (quiet: boolean) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    if (!quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      const result = await fnRef.current(controller.signal);
      if (controller.signal.aborted) return;
      hasDataRef.current = true;
      setData(result);
      setLoading(false);
      if (quiet) setError(null);
      optionsRef.current.onSuccess?.(result);
    } catch (e) {
      if (controller.signal.aborted || isAbortError(e)) return;
      // A quiet re-run that fails keeps what is on screen.
      if (quiet && hasDataRef.current) {
        setLoading(false);
        return;
      }
      setError(errorMessage(e));
      setLoading(false);
      optionsRef.current.onError?.(e);
    }
  }, []);

  const run = useCallback(() => execute(false), [execute]);

  useEffect(() => {
    if (!enabled) {
      controllerRef.current?.abort();
      setLoading(false);
      return;
    }
    void run();
    return () => {
      controllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, ...deps]);

  // Offline mode: the engine's data version moved - read again, quietly.
  const watch = options.offline === true;
  const dataVersion = useSyncExternalStore(watch ? subscribeSyncStatus : noSubscription, watch ? dataVersionOf : NO_VERSION, watch ? dataVersionOf : NO_VERSION);
  const seenVersion = useRef(dataVersion);
  useEffect(() => {
    if (!watch || dataVersion === seenVersion.current) return;
    seenVersion.current = dataVersion;
    if (enabled) void execute(true);
  }, [watch, dataVersion, enabled, execute]);

  return { data, loading, error, reload: run, setData };
}
