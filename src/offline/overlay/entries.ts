/**
 * Overlay of entry views (section 4.6, rows "Entry by id" and "EntryPage list"): pure functions over
 * a cached or fresh view plus the effects of acknowledged and pending operations.
 */
import type { Entry, EntryFilter, EntryPage, EntrySummary } from '@shared/types';
import { compareDateTimeId, entryToSummary, type Effects, type EntryEffect } from './effects';

/** Removes leading '#' characters and surrounding whitespace from a tag (as the server does). */
export function normaliseTag(tag: string): string {
  return tag.trim().replace(/^#+/, '').trim();
}

/** The server's list filter (`buildWhere` of entries-repo.ts) applied to one entry. */
export function matchesFilter(entry: Pick<Entry, 'date' | 'tags' | 'emotions' | 'title' | 'body' | 'notes' | 'location' | 'events' | 'people'>, filter: EntryFilter): boolean {
  if (filter.from && entry.date < filter.from) return false;
  if (filter.to && entry.date > filter.to) return false;
  if (typeof filter.tag === 'string' && normaliseTag(filter.tag)) {
    if (!entry.tags.includes(normaliseTag(filter.tag))) return false;
  }
  if (typeof filter.emotion === 'string' && filter.emotion.trim()) {
    if (!entry.emotions.includes(filter.emotion.trim())) return false;
  }
  if (typeof filter.text === 'string' && filter.text.trim()) {
    const needle = filter.text.trim().toLowerCase();
    const hay = [entry.title, entry.body, entry.notes, entry.location, ...entry.events, ...entry.people];
    if (!hay.some((h) => String(h ?? '').toLowerCase().includes(needle))) return false;
  }
  return true;
}

export type EntryOverlay = { kind: 'entry'; entry: Entry; pending: boolean } | { kind: 'notFound' } | { kind: 'unchanged' };

/** `GET /api/entries/:id` with the effects applied: the latest upsert supplies the content, a delete gives NOT_FOUND. */
export function overlayEntry(id: number, fx: Effects): EntryOverlay {
  let out: EntryOverlay = { kind: 'unchanged' };
  for (const e of fx.entries) {
    if (e.type === 'upsert' && e.entry.id === id) out = { kind: 'entry', entry: e.entry, pending: e.pending };
    else if (e.type === 'delete' && e.id === id) out = { kind: 'notFound' };
  }
  return out;
}

/** True when a pending create duplicates a summary the server already lists (its create was applied, the answer lost). */
function sameCreate(a: Pick<EntrySummary, 'date' | 'time' | 'title'>, b: Pick<Entry, 'date' | 'time' | 'title'>): boolean {
  return a.date === b.date && a.time === b.time && a.title === b.title;
}

/**
 * `GET /api/entries?...` with the effects applied: summaries that match the filter are inserted,
 * replaced or removed; `total` follows; the page is sorted by (date, time, id) in the list's direction.
 * The page is not trimmed to `limit`: an inserted entry is shown rather than lost between pages.
 */
export function overlayEntryPage(page: EntryPage, filter: EntryFilter, fx: Effects): EntryPage {
  const items = new Map<number, EntrySummary>(page.items.map((s) => [s.id, s]));
  let total = page.total;
  const onPage = (id: number) => items.has(id);
  const apply = (e: EntryEffect) => {
    if (e.type === 'delete') {
      if (onPage(e.id)) {
        items.delete(e.id);
        total--;
      } else if (e.prev && matchesFilter({ ...e.prev, emotions: [], body: '', notes: '', events: [] }, { from: filter.from, to: filter.to, tag: filter.tag })) {
        total--;
      }
      return;
    }
    const matches = matchesFilter(e.entry, filter);
    const was = onPage(e.entry.id);
    if (e.created && !was && e.pending && [...items.values()].some((s) => s.id > 0 && sameCreate(s, e.entry))) return;
    if (matches) {
      if (!was) {
        // On another page already? Only when the entry existed before and matched then (prev tells for the date / tag part).
        const matchedBefore = !e.created && !!e.prev && matchesFilter({ ...e.prev, emotions: [], body: '', notes: '', events: [] }, { from: filter.from, to: filter.to, tag: filter.tag });
        if (!matchedBefore) total++;
      }
      items.set(e.entry.id, entryToSummary(e.entry));
    } else if (was) {
      items.delete(e.entry.id);
      total--;
    }
  };
  for (const e of fx.entries) apply(e);
  const desc = filter.sortDesc === undefined || filter.sortDesc === null ? true : Boolean(filter.sortDesc);
  const sorted = [...items.values()].sort((a, b) => (desc ? -1 : 1) * compareDateTimeId(a, b));
  return { items: sorted, total: Math.max(total, sorted.length, 0) };
}

/** A list page synthesised from cached full entries (no cached page for this filter): the "partial view" case. */
export function synthesiseEntryPage(entries: Entry[], filter: EntryFilter, fx: Effects): EntryPage {
  const matching = entries.filter((e) => matchesFilter(e, filter));
  const base: EntryPage = { items: matching.map(entryToSummary), total: matching.length };
  const desc = filter.sortDesc === undefined || filter.sortDesc === null ? true : Boolean(filter.sortDesc);
  base.items.sort((a, b) => (desc ? -1 : 1) * compareDateTimeId(a, b));
  return overlayEntryPage(base, filter, fx);
}
