/**
 * Overlay of `GET /api/home` (section 4.6, row "HomeSummary"): `todayEntryCount`, `lastEntry`,
 * `totalEntries` and `habitsToday` follow the effects; the week averages, the streak and the insight
 * are kept.
 */
import type { EntrySummary, HomeSummary } from '@shared/types';
import { compareDateTimeId, entryToSummary, type Effects, type OverlayContext } from './effects';
import { overlayProgress } from './habits';

export function overlayHome(home: HomeSummary, fx: Effects, ctx: Pick<OverlayContext, 'today' | 'firstDayOfWeek'>): HomeSummary {
  let todayCount = home.todayEntryCount;
  let total = home.totalEntries;
  let last: EntrySummary | null = home.lastEntry;
  let lastDeleted = false;
  const candidates: EntrySummary[] = [];
  for (const e of fx.entries) {
    if (e.prev?.date === ctx.today) todayCount--;
    if (e.type === 'delete') {
      total--;
      if (last && last.id === e.id) lastDeleted = true;
      continue;
    }
    if (e.created) total++;
    if (e.entry.date === ctx.today) todayCount++;
    candidates.push(entryToSummary(e.entry));
    if (last && last.id === e.entry.id) last = null;
  }
  if (lastDeleted) last = null;
  for (const c of candidates) if (!last || compareDateTimeId(c, last) > 0) last = c;
  return {
    ...home,
    todayEntryCount: Math.max(0, todayCount),
    totalEntries: Math.max(0, total),
    lastEntry: last,
    habitsToday: overlayProgress(home.habitsToday, ctx.today, fx, ctx),
  };
}
