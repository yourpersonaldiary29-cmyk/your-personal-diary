/**
 * The badges of the automatic offline mode (docs/android-tasks/OFFLINE-DESIGN.md section 4.9 "Badges on
 * pages"): "Not uploaded yet" on an entry (card or page) whose change still waits on this device, and
 * "Needs attention" on one with a note. Renders nothing while offline mode is off - the cards and pages
 * stay exactly what they are today.
 */
import { Badge } from '@/components/ui/Badge';
import { isPendingRecord, offline } from '@/offline';
import { tr } from '@/i18n/runtime';
import { useSyncEnabled, useSyncItems } from './hooks';
import { isEntryNote, noteRecordId } from './labels';
import './sync.css';

export interface PendingBadgeProps {
  kind: 'entry' | 'habit';
  /** The id the page shows (negative for a record created on this device). */
  id: number;
  /** The record as the page got it (an optimistic record carries the "pending" marker). */
  record?: unknown;
}

/** Which badge a record gets: 'attention' (a note), 'waiting' (a change not uploaded yet) or null. */
export function usePendingState(kind: 'entry' | 'habit', id: number, record?: unknown): 'attention' | 'waiting' | null {
  const enabled = useSyncEnabled();
  const { notes } = useSyncItems();
  if (!enabled) return null;
  const entryKind = kind === 'entry';
  if (notes.some((n) => isEntryNote(n) === entryKind && noteRecordId(n) === id)) return 'attention';
  if (isPendingRecord(record) || offline.hasPending(kind, id)) return 'waiting';
  return null;
}

export function PendingBadge({ kind, id, record }: PendingBadgeProps) {
  const state = usePendingState(kind, id, record);
  if (state === 'attention') {
    return (
      <Badge kind="danger" className="pending-badge">
        {tr('shell.sync.badgeAttention')}
      </Badge>
    );
  }
  if (state === 'waiting') {
    return (
      <Badge kind="primary" className="pending-badge">
        {tr('shell.sync.badgeWaiting')}
      </Badge>
    );
  }
  return null;
}
