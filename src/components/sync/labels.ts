/**
 * Texts of the review list and the notes (docs/android-tasks/OFFLINE-DESIGN.md section 4.9): the kind of a
 * change, its short label ("Entry 'Morning walk', 23 Oct"; "Habit Water, 23 Oct: 3 glasses"; "Setting:
 * theme"), the note's one line and the actions each note offers. Plain functions over the engine's
 * public types - the components only render what these return.
 */
import type { Entry, EntryInput } from '@shared/types';
import type { SyncOpKind } from '@shared/sync';
import type { OpLabel, SyncNote } from '@/offline';
import { tr } from '@/i18n/runtime';
import { formatShortDate } from '@/utils/dates';
import { formatNumber } from '@/utils/format';

const KIND_KEYS: Record<SyncOpKind, string> = {
  'entry.create': 'shell.sync.kind.entryCreate',
  'entry.update': 'shell.sync.kind.entryUpdate',
  'entry.delete': 'shell.sync.kind.entryDelete',
  'habit.create': 'shell.sync.kind.habitCreate',
  'habit.update': 'shell.sync.kind.habitUpdate',
  'habit.archive': 'shell.sync.kind.habitArchive',
  'log.set': 'shell.sync.kind.logSet',
  'log.delete': 'shell.sync.kind.logDelete',
  'settings.patch': 'shell.sync.kind.settings',
};

/** "New entry", "Habit log"... */
export function kindText(kind: SyncOpKind): string {
  return tr(KIND_KEYS[kind] ?? 'shell.sync.kind.settings');
}

function titleOf(title: string | undefined): string {
  const t = (title ?? '').trim();
  return t || tr('entries.untitled');
}

function dateOf(date: string | undefined): string {
  return date ? formatShortDate(date) : '';
}

/** The short label of a change. */
export function labelText(label: OpLabel): string {
  switch (label.kind) {
    case 'entry.create':
    case 'entry.update':
    case 'entry.delete':
      return tr('shell.sync.label.entry', { title: titleOf(label.title), date: dateOf(label.date) });
    case 'habit.create':
    case 'habit.update':
    case 'habit.archive':
      return tr('shell.sync.label.habit', { name: label.habitName ?? '' });
    case 'log.set':
      if (typeof label.value === 'number') {
        const value = label.unit ? `${formatNumber(label.value)} ${label.unit}` : formatNumber(label.value);
        return tr('shell.sync.label.logValue', { name: label.habitName ?? '', date: dateOf(label.date), value });
      }
      return tr('shell.sync.label.log', { name: label.habitName ?? '', date: dateOf(label.date) });
    case 'log.delete':
      return tr('shell.sync.label.log', { name: label.habitName ?? '', date: dateOf(label.date) });
    case 'settings.patch':
      return tr('shell.sync.label.setting', { keys: (label.settingKeys ?? []).join(', ') });
    default:
      return '';
  }
}

/** True for a note about an entry (create / update / delete). */
export function isEntryNote(note: SyncNote): boolean {
  return note.op.kind === 'entry.create' || note.op.kind === 'entry.update' || note.op.kind === 'entry.delete';
}

/** The note's one line (section 4.9 table). */
export function noteText(note: SyncNote): string {
  const title = titleOf(note.label.title);
  const entry = isEntryNote(note);
  switch (note.reason) {
    case 'lost':
      return tr('shell.sync.reason.lost', { title });
    case 'won':
      return tr('shell.sync.reason.won', { title });
    case 'gone':
      return entry ? tr('shell.sync.reason.gone', { title }) : tr('shell.sync.reason.otherLost', { label: labelText(note.label) });
    case 'deleteLost':
      return tr('shell.sync.reason.deleteLost', { title });
    case 'deleteWon':
      return tr('shell.sync.reason.deleteWon', { title });
    case 'stale':
      return tr('shell.sync.reason.stale');
    case 'otherLost':
      return tr('shell.sync.reason.otherLost', { label: labelText(note.label) });
    case 'otherWon':
      return tr('shell.sync.reason.otherWon', { label: labelText(note.label) });
    case 'rejected':
      return tr('shell.sync.reason.rejected', { message: note.message ?? '' });
    case 'tooLarge':
      return tr('shell.sync.reason.tooLarge');
    case 'blocked':
      return tr('shell.sync.reason.blocked');
    default:
      return '';
  }
}

/** An action a note offers (section 4.9 "Actions"). */
export type NoteAction = 'showMine' | 'showOther' | 'saveMineAsNew' | 'saveOtherAsNew' | 'copyMine' | 'copyOther' | 'openFix' | 'ok' | 'discard';

function isEntryVersion(x: unknown): x is Entry {
  return !!x && typeof x === 'object' && 'body' in x && 'title' in x && 'date' in x;
}

/** The user's version of an entry note (null for habits, logs, settings). */
export function mineOf(note: SyncNote): Entry | null {
  return isEntryVersion(note.mine) ? note.mine : null;
}

/** The other device's version of an entry note (what the server kept, or what this change overwrote). */
export function otherOf(note: SyncNote): Entry | null {
  return isEntryVersion(note.other) ? note.other : null;
}

/** The actions of a note, in the order they are shown. */
export function noteActions(note: SyncNote): NoteAction[] {
  const mine = mineOf(note);
  const other = otherOf(note);
  if (!isEntryNote(note)) {
    if (note.reason === 'rejected' || note.reason === 'tooLarge' || note.reason === 'blocked') return ['discard'];
    return ['ok'];
  }
  const out: NoteAction[] = [];
  switch (note.reason) {
    case 'lost':
      if (mine) out.push('showMine', 'saveMineAsNew', 'copyMine');
      out.push('ok');
      break;
    case 'won':
      if (other) out.push('showOther', 'saveOtherAsNew', 'copyOther');
      out.push('ok');
      break;
    case 'gone':
    case 'stale':
      if (mine) out.push('saveMineAsNew', 'copyMine');
      out.push('discard');
      break;
    case 'deleteLost':
      out.push('ok');
      break;
    case 'deleteWon':
      if (other) out.push('showOther', 'saveOtherAsNew', 'copyOther');
      out.push('ok');
      break;
    case 'rejected':
      if (mine) out.push('openFix', 'copyMine');
      out.push('discard');
      break;
    case 'tooLarge':
      if (mine) out.push('copyMine');
      out.push('discard');
      break;
    case 'blocked':
      out.push('discard');
      break;
    default:
      out.push('ok');
  }
  return out;
}

/** The entry fields of a version, for "Save as a new entry" (a new record: no id, no times). */
export function entryInputOf(entry: Entry): EntryInput {
  return {
    date: entry.date,
    time: entry.time,
    title: entry.title,
    body: entry.body,
    mood: entry.mood,
    emotions: entry.emotions,
    energy: entry.energy,
    stress: entry.stress,
    sleepQuality: entry.sleepQuality,
    sleepHours: entry.sleepHours,
    exerciseMinutes: entry.exerciseMinutes,
    exerciseType: entry.exerciseType,
    events: entry.events,
    people: entry.people,
    location: entry.location,
    notes: entry.notes,
    tags: entry.tags,
  };
}

/** The text "Copy text" puts on the clipboard: the title, then the body (and the entry's notes). */
export function copyTextOf(entry: Pick<Entry, 'title' | 'body' | 'notes'>): string {
  return [entry.title.trim(), entry.body.trim(), (entry.notes ?? '').trim()].filter(Boolean).join('\n\n');
}

/** The id of the record a note is about (negative for a record created on this device), or null. */
export function noteRecordId(note: SyncNote): number | null {
  const op = note.op as { target?: { id?: number } };
  if (op.target && typeof op.target.id === 'number') return op.target.id;
  if (mineOf(note)) return mineOf(note)!.id;
  return null;
}
