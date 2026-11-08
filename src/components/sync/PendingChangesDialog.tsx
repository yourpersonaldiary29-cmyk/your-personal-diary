/**
 * The review of the automatic offline mode (docs/android-tasks/OFFLINE-DESIGN.md section 4.9): first the
 * changes still waiting on this device - kind, a short label, the state (waiting, uploading, still trying,
 * could not be sent) - then the notes, one line each with its actions:
 *  - entries: [Show my version] / [Show the other version], [Save as a new entry] (an ordinary new entry
 *    with a new client id), [Copy text], [OK] or [Discard] (always confirmed), [Open and fix] for a
 *    rejected change (the entry form, prefilled);
 *  - habits, logs and settings: one line and [OK].
 * Nothing here deletes a note without the user's action; nothing adds to the diary by itself.
 */
import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Entry } from '@shared/types';
import { entries as entriesApi } from '@/api';
import { Dialog } from '@/components/a11y/Dialog';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PATHS } from '@/constants/routes';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useToast } from '@/context/ToastContext';
import { offline, type PendingItem, type SyncNote } from '@/offline';
import { tr } from '@/i18n/runtime';
import { copyText } from '@/pages/settings/clipboard';
import { errorMessage } from '@/utils/errors';
import { useSyncItems, useSyncStatus } from './hooks';
import { copyTextOf, entryInputOf, kindText, labelText, mineOf, noteActions, noteText, otherOf, type NoteAction } from './labels';
import './sync.css';

/** Router state of "/new" opened from a note ("Open and fix"): the form starts with the user's version. */
export interface EntryPrefillState {
  prefill: ReturnType<typeof entryInputOf>;
  /** The note that is dismissed once the entry is saved. */
  fromNote?: number;
}

export interface PendingChangesDialogProps {
  open: boolean;
  onClose: () => void;
}

function stateText(item: PendingItem): string {
  switch (item.state) {
    case 'uploading':
      return tr('shell.sync.state.uploading');
    case 'stillTrying':
      return tr('shell.sync.state.stillTrying');
    case 'blocked':
      return tr('shell.sync.state.blocked');
    default:
      return tr('shell.sync.state.waiting');
  }
}

const ACTION_KEYS: Record<NoteAction, string> = {
  showMine: 'shell.sync.action.showMine',
  showOther: 'shell.sync.action.showOther',
  saveMineAsNew: 'shell.sync.action.saveAsNew',
  saveOtherAsNew: 'shell.sync.action.saveOtherAsNew',
  copyMine: 'shell.sync.action.copy',
  copyOther: 'shell.sync.action.copy',
  openFix: 'shell.sync.action.openFix',
  ok: 'shell.sync.action.ok',
  discard: 'shell.sync.action.discard',
};

function VersionView({ entry, id }: { entry: Entry; id: string }) {
  return (
    <div className="sync-panel__version user-text" id={id} dir="auto">
      <p className="sync-panel__version-title">
        <bdi>{entry.title.trim() || tr('entries.untitled')}</bdi>
      </p>
      <p className="sync-panel__version-body">{entry.body}</p>
    </div>
  );
}

export function PendingChangesDialog({ open, onClose }: PendingChangesDialogProps) {
  const base = useId();
  const status = useSyncStatus();
  const { pending, notes } = useSyncItems();
  const navigate = useNavigate();
  const toast = useToast();
  const { announce } = useAnnouncer();
  const [shown, setShown] = useState<Record<number, 'mine' | 'other' | undefined>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [discard, setDiscard] = useState<SyncNote | null>(null);
  const [trying, setTrying] = useState(false);

  const dismiss = async (note: SyncNote) => {
    await offline.notes.dismiss(note.id);
    setShown((s) => ({ ...s, [note.id]: undefined }));
  };

  const run = async (note: SyncNote, action: NoteAction) => {
    if (busy !== null) return;
    const mine = mineOf(note);
    const other = otherOf(note);
    switch (action) {
      case 'showMine':
      case 'showOther': {
        const which = action === 'showMine' ? 'mine' : 'other';
        setShown((s) => ({ ...s, [note.id]: s[note.id] === which ? undefined : which }));
        return;
      }
      case 'copyMine':
      case 'copyOther': {
        const version = action === 'copyMine' ? mine : other;
        if (!version) return;
        const ok = await copyText(copyTextOf(version));
        toast.show(tr(ok ? 'shell.sync.action.copied' : 'shell.sync.action.copyFailed'), { kind: ok ? 'success' : 'error' });
        return;
      }
      case 'saveMineAsNew':
      case 'saveOtherAsNew': {
        const version = action === 'saveMineAsNew' ? mine : other;
        if (!version) return;
        setBusy(note.id);
        try {
          await entriesApi.create(entryInputOf(version));
          await dismiss(note);
          const message = tr('shell.sync.action.savedAsNew');
          announce(message, 'polite');
          toast.success(message, { announced: true });
        } catch (e) {
          toast.error(errorMessage(e));
        } finally {
          setBusy(null);
        }
        return;
      }
      case 'openFix': {
        if (!mine) return;
        const state: EntryPrefillState = { prefill: entryInputOf(mine), fromNote: note.id };
        onClose();
        // A rejected edit of an entry the server has: its edit page (the user's version on top of the
        // server's); a rejected new entry (or one the server never got): a new entry.
        const serverId = note.op.kind === 'entry.update' ? offline.serverIdOf(mine.id) : null;
        navigate(serverId !== null && serverId > 0 ? PATHS.editEntry(serverId) : PATHS.newEntry, { state });
        return;
      }
      case 'ok':
        setBusy(note.id);
        try {
          await dismiss(note);
        } finally {
          setBusy(null);
        }
        return;
      case 'discard':
        setDiscard(note);
        return;
    }
  };

  const tryNow = async () => {
    if (trying) return;
    setTrying(true);
    try {
      await offline.tryNow();
    } finally {
      setTrying(false);
    }
  };

  const empty = pending.length === 0 && notes.length === 0;

  return (
    <>
      <Dialog open={open} onClose={onClose} title={tr('shell.sync.panelTitle')} size="md" className="sync-panel">
        {status.halted === 'unreadable' && <Alert kind="warning">{tr('shell.sync.reason.unreadable')}</Alert>}
        {status.storageWarning && <Alert kind="warning">{tr('shell.sync.storageWarning')}</Alert>}
        {empty && <p data-testid="sync-panel-empty">{tr('shell.sync.panelEmpty')}</p>}

        {pending.length > 0 && (
          <section className="sync-panel__section" aria-labelledby={`${base}-waiting`}>
            <h3 id={`${base}-waiting`}>{tr('shell.sync.panelWaiting')}</h3>
            <ul className="sync-panel__list">
              {pending.map((item) => (
                <li key={item.seq} className="sync-panel__item" data-testid="sync-pending-item">
                  <p className="sync-panel__line">
                    <span className="sync-panel__kind">{kindText(item.label.kind)}</span>
                    {' · '}
                    <bdi>{labelText(item.label)}</bdi>
                    {' · '}
                    <span>{stateText(item)}</span>
                  </p>
                  {item.state === 'stillTrying' && item.message && (
                    <p className="sync-panel__line text-muted">{tr('shell.sync.reason.stillTrying', { message: item.message })}</p>
                  )}
                  {item.state === 'blocked' && <p className="sync-panel__line text-muted">{tr('shell.sync.reason.cannotSend')}</p>}
                  {(item.state === 'stillTrying' || item.state === 'blocked') && (
                    <div className="sync-panel__actions">
                      <Button variant="secondary" size="sm" loading={trying} onClick={() => void tryNow()}>
                        {tr('shell.sync.tryNow')}
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {notes.length > 0 && (
          <section className="sync-panel__section" aria-labelledby={`${base}-notes`}>
            <h3 id={`${base}-notes`}>{tr('shell.sync.panelNotes')}</h3>
            <ul className="sync-panel__list">
              {notes.map((note) => {
                const versionId = `${base}-note-${note.id}-version`;
                const which = shown[note.id];
                const version = which === 'mine' ? mineOf(note) : which === 'other' ? otherOf(note) : null;
                return (
                  <li key={note.id} className="sync-panel__item" data-testid="sync-note">
                    <p className="sync-panel__line">
                      <span className="sync-panel__kind">{kindText(note.label.kind)}</span>
                      {' · '}
                      <bdi>{noteText(note)}</bdi>
                    </p>
                    {version && <VersionView entry={version} id={versionId} />}
                    <div className="sync-panel__actions">
                      {noteActions(note).map((action) => {
                        const toggle = action === 'showMine' || action === 'showOther';
                        const pressed = toggle && ((action === 'showMine' && which === 'mine') || (action === 'showOther' && which === 'other'));
                        return (
                          <Button
                            key={action}
                            size="sm"
                            variant={action === 'discard' ? 'danger' : action === 'ok' ? 'primary' : 'secondary'}
                            loading={busy === note.id && (action === 'saveMineAsNew' || action === 'saveOtherAsNew' || action === 'ok')}
                            aria-expanded={toggle ? pressed : undefined}
                            aria-controls={toggle && pressed ? versionId : undefined}
                            onClick={() => void run(note, action)}
                          >
                            {toggle && pressed ? tr('shell.sync.action.hideVersion') : tr(ACTION_KEYS[action])}
                          </Button>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </Dialog>
      <ConfirmDialog
        open={discard !== null}
        title={tr('shell.sync.action.discard')}
        message={tr('shell.sync.action.discardConfirm')}
        confirmLabel={tr('shell.sync.action.discard')}
        danger
        onConfirm={async () => {
          const note = discard;
          setDiscard(null);
          if (note) await dismiss(note);
        }}
        onCancel={() => setDiscard(null)}
      />
    </>
  );
}
