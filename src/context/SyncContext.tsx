/**
 * The automatic offline mode in the app (docs/android-tasks/OFFLINE-DESIGN.md sections 4.3, 4.8, 4.9, 6;
 * WP-H10c). The engine itself lives in src/offline/** and is started by the AuthProvider; this provider
 * adds what needs React:
 *
 *  - the review dialog of the changes on this device and their notes (`useSync().openReview()`, opened
 *    by the status bar, the sign-out question and the badges' pages);
 *  - the sign-out question "{n} changes on this device have not been uploaded yet" (it installs the
 *    confirmer the AuthProvider's `logout` asks, src/components/sync/syncGate.ts);
 *  - the toasts: "Saved on this device..." when a change goes to the outbox while the server cannot be
 *    reached (one per save: a page that noticed the optimistic record first wins), and "Recovered {n}
 *    changes saved on this device" after the native mirror refilled an evicted database.
 *
 * The dialogs render after the children, outside the app root (#app-root), so they stay usable while
 * the lock screen makes the app inert. Without this provider (page tests) nothing of it exists: the
 * sign-out goes ahead as today and `openReview` does nothing.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LogoutPendingDialog, type LogoutDialogChoice } from '@/components/sync/LogoutPendingDialog';
import { PendingChangesDialog } from '@/components/sync/PendingChangesDialog';
import { useSyncEnabled, useSyncStatus } from '@/components/sync/hooks';
import { setLogoutConfirmer, showSavedOnDevice, type LogoutChoice, type LogoutPrompt } from '@/components/sync/syncGate';
import { tr } from '@/i18n/runtime';
import { AuthContext } from './AuthContext';
import { useToast } from './ToastContext';

export { useOfflineNow, useSyncEnabled, useSyncItems, useSyncStatus } from '@/components/sync/hooks';

export interface SyncContextValue {
  /** Opens the review of the changes on this device. */
  openReview: () => void;
}

const NOOP: SyncContextValue = { openReview: () => undefined };

export const SyncContext = createContext<SyncContextValue>(NOOP);

/** The offline-mode actions; safe outside the provider (they do nothing there). */
export function useSync(): SyncContextValue {
  return useContext(SyncContext);
}

type OpenPrompt = LogoutPrompt & { resolve: (choice: LogoutChoice) => void };

export function SyncProvider({ children }: { children: ReactNode }) {
  const status = useSyncStatus();
  const enabled = useSyncEnabled();
  const auth = useContext(AuthContext);
  const userId = auth?.user?.id ?? null;
  const toast = useToast();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [prompt, setPrompt] = useState<OpenPrompt | null>(null);
  const promptRef = useRef<OpenPrompt | null>(null);
  promptRef.current = prompt;

  // The sign-out question (the AuthProvider's logout asks it before it signs out).
  useEffect(() => {
    setLogoutConfirmer(
      (p) =>
        new Promise<LogoutChoice>((resolve) => {
          // A second sign-out while the question is open: the first one stays signed in.
          promptRef.current?.resolve('stay');
          const next = { ...p, resolve };
          promptRef.current = next;
          setPrompt(next);
        }),
    );
    return () => setLogoutConfirmer(null);
  }, []);

  const onLogoutChoice = useCallback((choice: LogoutDialogChoice) => {
    const current = promptRef.current;
    promptRef.current = null;
    setPrompt(null);
    current?.resolve(choice === 'delete' ? 'delete' : 'stay');
    if (choice === 'review') setReviewOpen(true);
  }, []);

  // Another account (or none): the review of the previous one closes.
  useEffect(() => {
    setReviewOpen(false);
  }, [userId]);

  // "Saved on this device": the outbox grew while the server could not be reached.
  const prev = useRef({ pending: status.pending, userId: status.userId });
  useEffect(() => {
    const grew = status.enabled && status.userId !== null && status.userId === prev.current.userId && status.pending > prev.current.pending;
    prev.current = { pending: status.pending, userId: status.userId };
    if (grew && (status.phase === 'offline' || status.phase === 'suspect')) showSavedOnDevice((message) => toast.info(message));
  }, [status.pending, status.userId, status.enabled, status.phase, toast]);

  // "Recovered {n} changes saved on this device" (the mirror refilled an evicted database), once per account.
  const recoveredFor = useRef<string | null>(null);
  useEffect(() => {
    if (!status.enabled || !status.userId || !status.recovered || status.recovered <= 0) return;
    if (recoveredFor.current === status.userId) return;
    recoveredFor.current = status.userId;
    toast.info(tr('shell.sync.recovered', { count: status.recovered }));
  }, [status.enabled, status.userId, status.recovered, toast]);

  const openReview = useCallback(() => setReviewOpen(true), []);
  const value = useMemo<SyncContextValue>(() => ({ openReview }), [openReview]);

  return (
    <SyncContext.Provider value={value}>
      {children}
      <PendingChangesDialog open={reviewOpen && enabled} onClose={() => setReviewOpen(false)} />
      <LogoutPendingDialog prompt={prompt} onChoose={onLogoutChoice} />
    </SyncContext.Provider>
  );
}
