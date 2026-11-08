/**
 * The status bar of the automatic offline mode (docs/android-tasks/OFFLINE-DESIGN.md section 6.1). It takes
 * the connection banner's slot for a signed-in account (not the guest) while offline mode runs:
 *
 *   offline, nothing waiting   "No connection – what you write will be saved ..."       [Try now]
 *   offline, n waiting         the same + the chip "n changes waiting"                  [Try now] [Review]
 *   uploading                  "Uploading n changes…"
 *   drained                    "All changes are saved on the server." (2.5 s)
 *   attention > 0 (stays)      "n changes need your attention"                          [Review]
 *
 * Timing is the engine's (src/offline/connectivity.ts): "offline" only after 1.5 s of failure or a failed
 * probe, so a short drop never shows; "uploading" for at least 1 s. One announcement per state change
 * through the announcer (only "needs your attention" is assertive); the bar itself is a status region that
 * does not speak on its own (no double reading). One line on a phone (sync.css).
 *
 * A separate line under the bar names outboxes of OTHER accounts on this device (section 4.8 "Another
 * account signs in"): never their content or name, only [Delete] with a confirmation. It is not part of
 * the one-line bar, so it shows on a phone too.
 */
import { useContext, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { cx } from '@/components/ui/cx';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { AuthContext } from '@/context/AuthContext';
import { useSync } from '@/context/SyncContext';
import { offline, type SyncStatus } from '@/offline';
import { tr } from '@/i18n/runtime';
import { useSyncEnabled, useSyncStatus } from './hooks';
import './sync.css';

export type SyncBarState = 'unreadable' | 'offline' | 'uploading' | 'drained' | 'attention' | null;

/** What the bar shows for a status (null: nothing). */
export function syncBarState(s: SyncStatus): SyncBarState {
  if (!s.enabled) return null;
  if (s.halted === 'unreadable') return 'unreadable';
  if (s.phase === 'offline' && s.showOffline) return 'offline';
  if (s.phase === 'syncing') return 'uploading';
  if (s.showDrained) return 'drained';
  if (s.attention > 0) return 'attention';
  return null;
}

/** The bar's main line for a state. */
export function syncBarText(state: Exclude<SyncBarState, null>, s: Pick<SyncStatus, 'pending' | 'attention'>): string {
  switch (state) {
    case 'unreadable':
      return tr('shell.sync.reason.unreadable');
    case 'offline':
      return tr('shell.sync.offline');
    case 'uploading':
      return tr('shell.sync.uploading', { count: Math.max(1, s.pending) });
    case 'drained':
      return tr('shell.sync.allSaved');
    case 'attention':
      return tr('shell.sync.attention', { count: s.attention });
  }
}

export function SyncStatusBar() {
  const enabled = useSyncEnabled();
  const status = useSyncStatus();
  const auth = useContext(AuthContext);
  const userId = auth?.user?.id ?? null;
  const { openReview } = useSync();
  const { announce } = useAnnouncer();
  const [trying, setTrying] = useState(false);
  const [others, setOthers] = useState<{ userId: string; count: number }[]>([]);
  const [confirmOthers, setConfirmOthers] = useState(false);
  const [deletingOthers, setDeletingOthers] = useState(false);
  const state = enabled ? syncBarState(status) : null;

  // One announcement per state change.
  const lastState = useRef<SyncBarState>(null);
  useEffect(() => {
    if (state === lastState.current) return;
    lastState.current = state;
    if (!state) return;
    announce(syncBarText(state, status), state === 'attention' ? 'assertive' : 'polite');
    // The counts inside the text do not make a new state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, announce]);

  // Outboxes of other accounts on this device (their ids and counts only; never decrypted).
  useEffect(() => {
    if (!enabled || !userId) {
      setOthers([]);
      return;
    }
    let cancelled = false;
    offline
      .otherAccountsWithPending(userId)
      .then((list) => {
        if (!cancelled) setOthers(list);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled, userId]);

  if (!enabled || (!state && others.length === 0)) return null;

  const onTryNow = async () => {
    if (trying) return;
    setTrying(true);
    try {
      const ok = await offline.tryNow();
      if (!ok) announce(tr('shell.connection.failed'), 'assertive');
    } finally {
      setTrying(false);
    }
  };

  const onDeleteOthers = async () => {
    if (deletingOthers) return;
    setDeletingOthers(true);
    try {
      for (const o of others) await offline.wipeAccount(o.userId);
      setOthers([]);
    } finally {
      setDeletingOthers(false);
      setConfirmOthers(false);
    }
  };

  const canReview = status.pending > 0 || status.attention > 0;

  return (
    <>
      {state && (
        <div className={cx('sync-bar', `sync-bar--${state}`)} role="status" aria-live="off" data-testid="sync-status-bar" data-state={state}>
          <p className="sync-bar__text">{syncBarText(state, status)}</p>
          {state === 'offline' && (status.pending > 0 || status.attention > 0) && (
            <span className="sync-bar__chips">
              {status.pending > 0 && <Badge kind="primary">{tr('shell.sync.waiting', { count: status.pending })}</Badge>}
              {status.attention > 0 && <Badge kind="danger">{tr('shell.sync.attention', { count: status.attention })}</Badge>}
            </span>
          )}
          {(state === 'offline' || state === 'attention' || state === 'unreadable') && (
            <span className="sync-bar__actions">
              {state === 'offline' && (
                <Button variant="secondary" size="sm" loading={trying} onClick={() => void onTryNow()}>
                  {tr('shell.sync.tryNow')}
                </Button>
              )}
              {canReview && (
                <Button variant="secondary" size="sm" aria-haspopup="dialog" onClick={openReview}>
                  {tr('shell.sync.review')}
                </Button>
              )}
            </span>
          )}
        </div>
      )}
      {/* Its own line under the bar (the bar stays one line on a phone; this one shows there too). */}
      {others.length > 0 && (
        <div className="sync-other" data-testid="sync-other-account">
          <p className="sync-other__text">{tr('shell.sync.otherAccount.text')}</p>
          <Button variant="secondary" size="sm" aria-haspopup="dialog" onClick={() => setConfirmOthers(true)}>
            {tr('shell.sync.otherAccount.delete')}
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={confirmOthers}
        title={tr('shell.sync.otherAccount.delete')}
        message={tr('shell.sync.otherAccount.confirm')}
        confirmLabel={tr('shell.sync.otherAccount.delete')}
        danger
        loading={deletingOthers}
        onConfirm={() => void onDeleteOthers()}
        onCancel={() => setConfirmOthers(false)}
      />
    </>
  );
}
