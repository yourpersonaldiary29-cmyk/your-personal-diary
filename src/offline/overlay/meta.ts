/**
 * Overlay of `GET /api/entries/meta/{tags,people,locations}` (section 4.6, row "tags, people,
 * locations"): counts move with the entry effects (`prev` says what an edited entry had before).
 */
import type { TagCount } from '@shared/types';
import type { Effects } from './effects';

export type CountField = 'tags' | 'people' | 'location';

function valuesOf(x: { tags: string[]; people: string[]; location: string }, field: CountField): string[] {
  if (field === 'location') return x.location ? [x.location] : [];
  return x[field].filter((v) => v !== '');
}

export function overlayCounts(list: readonly TagCount[], field: CountField, fx: Effects): TagCount[] {
  const counts = new Map<string, number>(list.map((t) => [t.name, t.count]));
  const bump = (name: string, by: number) => counts.set(name, (counts.get(name) ?? 0) + by);
  for (const e of fx.entries) {
    if (e.prev) for (const v of valuesOf(e.prev, field)) bump(v, -1);
    if (e.type === 'upsert') for (const v of valuesOf(e.entry, field)) bump(v, 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n > 0)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
