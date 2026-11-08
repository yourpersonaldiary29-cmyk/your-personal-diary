/**
 * The read cache (section 4.6): the last answer of each allow-listed GET, per account, encrypted.
 *
 *  - Allow-list only (`classify`): settings, habits, templates, habit progress / status, home,
 *    calendar month / range, entry lists, single entries, days, tags / people / locations. Insights,
 *    stats, search, backup, export, sessions, /api/server/*, due reminders and data-dir are NEVER cached.
 *  - Keys: HMAC(path and query) - URLs contain diary text (`?text=`); the class of a row is an HMAC
 *    tag too (per-class limits without saying what a row is).
 *  - Limits per class (LRU on `lastUsed`): progress 7 dates, status 3, calendar month / range 6 each,
 *    entry lists 12, days 31, single entries: every entry dated in the last 30 days plus 200 others;
 *    25 MB per account in all.
 *  - Storage: IndexedDB on the apps with "Remember me", memory only otherwise (the caller passes the
 *    store: ./store/idb.ts or ./store/memory.ts).
 *  - Write-through: a successful allow-listed GET replaces its row whole; a cached
 *    `GET /api/entries/:id` that now answers 404 deletes its row (the caller calls `delete`).
 */
import { decryptValue, encryptValue, hmacHex, type DerivedKeys } from './crypto';
import type { CacheRow, OfflineStore } from './store/types';

export type CacheClass =
  | 'settings'
  | 'habits'
  | 'templates'
  | 'progress'
  | 'status'
  | 'home'
  | 'calMonth'
  | 'calRange'
  | 'entriesList'
  | 'entry30'
  | 'entry'
  | 'day'
  | 'meta';

export const CLASS_LIMITS: Readonly<Record<CacheClass, number>> = {
  settings: 1,
  habits: 2,
  templates: 1,
  progress: 7,
  status: 3,
  home: 1,
  calMonth: 6,
  calRange: 6,
  entriesList: 12,
  entry30: Number.POSITIVE_INFINITY,
  entry: 200,
  day: 31,
  meta: 3,
};

export const CACHE_MAX_BYTES = 25 * 1024 * 1024;
/** `lastUsed` is written back to the store at most this often per row (reads stay cheap). */
const TOUCH_PERSIST_MS = 60 * 60 * 1000;

/** Splits a request URL (path + query, as `withQuery` builds it) into its path and parameters. */
export function parseUrl(url: string): { path: string; params: URLSearchParams } {
  const q = url.indexOf('?');
  return q < 0 ? { path: url, params: new URLSearchParams() } : { path: url.slice(0, q), params: new URLSearchParams(url.slice(q + 1)) };
}

/** Days between two ISO dates (b - a). */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/**
 * The cache class of a GET url, or null when it must never be cached. `body` decides between a
 * recent entry (dated in the last 30 days, kept) and an older one (LRU 200).
 */
export function classify(url: string, body?: unknown, today?: string): CacheClass | null {
  const { path } = parseUrl(url);
  switch (path) {
    case '/api/settings':
      return 'settings';
    case '/api/habits':
      return 'habits';
    case '/api/habits/templates':
      return 'templates';
    case '/api/habits/progress':
      return 'progress';
    case '/api/habits/status':
      return 'status';
    case '/api/home':
      return 'home';
    case '/api/calendar/month':
      return 'calMonth';
    case '/api/calendar/range':
      return 'calRange';
    case '/api/entries':
      return 'entriesList';
    case '/api/entries/meta/tags':
    case '/api/entries/meta/people':
    case '/api/entries/meta/locations':
      return 'meta';
    default:
      break;
  }
  if (/^\/api\/entries\/day\/\d{4}-\d{2}-\d{2}$/.test(path)) return 'day';
  if (/^\/api\/entries\/[1-9]\d*$/.test(path)) {
    const date = (body as { date?: unknown } | undefined)?.date;
    if (typeof date === 'string' && today && daysBetween(date, today) <= 30) return 'entry30';
    return 'entry';
  }
  return null;
}

export function isCacheable(url: string): boolean {
  return classify(url) !== null;
}

interface IndexItem {
  key: string;
  cls: string;
  cachedAt: number;
  lastUsed: number;
  bytes: number;
  persistedLastUsed: number;
}

export interface CachedValue<T> {
  url: string;
  value: T;
  cachedAt: number;
}

export class ReadCache {
  private index = new Map<string, IndexItem>();
  private keyMemo = new Map<string, string>();
  private classTags = new Map<CacheClass, string>();
  private ready: Promise<void> | null = null;

  constructor(
    readonly store: OfflineStore,
    private readonly keys: DerivedKeys,
    private readonly now: () => number = () => Date.now(),
    private readonly maxBytes: number = CACHE_MAX_BYTES,
  ) {}

  get persistent(): boolean {
    return this.store.persistent;
  }

  private async init(): Promise<void> {
    if (!this.ready) {
      this.ready = this.store
        .tx(['cache'], 'readonly', (t) => t.getAll('cache'))
        .then((rows) => {
          this.index.clear();
          for (const r of rows) this.index.set(r.key, { key: r.key, cls: r.cls, cachedAt: r.cachedAt, lastUsed: r.lastUsed, bytes: r.bytes, persistedLastUsed: r.lastUsed });
        });
    }
    return this.ready;
  }

  async keyOf(url: string): Promise<string> {
    let k = this.keyMemo.get(url);
    if (!k) {
      k = await hmacHex(this.keys, `cache|${url}`);
      this.keyMemo.set(url, k);
    }
    return k;
  }

  async classTag(cls: CacheClass): Promise<string> {
    let tag = this.classTags.get(cls);
    if (!tag) {
      tag = (await hmacHex(this.keys, `class|${cls}`)).slice(0, 16);
      this.classTags.set(cls, tag);
    }
    return tag;
  }

  async get<T>(url: string): Promise<CachedValue<T> | null> {
    await this.init();
    const key = await this.keyOf(url);
    const row = await this.store.tx(['cache'], 'readonly', (t) => t.get('cache', key));
    if (!row) return null;
    let stored: { url: string; value: T };
    try {
      stored = await decryptValue<{ url: string; value: T }>(this.keys, 'cache', key, row.ct);
    } catch {
      return null;
    }
    if (stored.url !== url) return null;
    this.touch(row);
    return { url, value: stored.value, cachedAt: row.cachedAt };
  }

  /** Marks a row as used; written back at most hourly. */
  private touch(row: CacheRow): void {
    const now = this.now();
    const item = this.index.get(row.key);
    if (item) item.lastUsed = now;
    if (!item || now - item.persistedLastUsed < TOUCH_PERSIST_MS) return;
    item.persistedLastUsed = now;
    void this.store
      .tx(['cache'], 'readwrite', async (t) => {
        const cur = await t.get('cache', row.key);
        if (cur) await t.put('cache', { ...cur, lastUsed: now });
      })
      .catch(() => undefined);
  }

  /** Write-through: replaces the row of `url` with `value`. A url outside the allow-list is ignored. */
  async put(url: string, value: unknown, today?: string): Promise<void> {
    const cls = classify(url, value, today);
    if (!cls) return;
    await this.init();
    const key = await this.keyOf(url);
    const clsTag = await this.classTag(cls);
    const ct = await encryptValue(this.keys, 'cache', key, { url, value });
    const now = this.now();
    const row: CacheRow = { key, cls: clsTag, cachedAt: now, lastUsed: now, bytes: ct.byteLength, ct };
    if (row.bytes > this.maxBytes) return;
    const evict = this.planEviction(row, CLASS_LIMITS[cls]);
    await this.store.tx(['cache'], 'readwrite', async (t) => {
      await t.put('cache', row);
      for (const k of evict) await t.delete('cache', k);
    });
    for (const k of evict) this.index.delete(k);
    this.index.set(key, { key, cls: clsTag, cachedAt: now, lastUsed: now, bytes: row.bytes, persistedLastUsed: now });
  }

  /** Keys to delete so that `row` fits its class limit and the size limit (oldest `lastUsed` first). */
  private planEviction(row: CacheRow, classLimit: number): string[] {
    const others = [...this.index.values()].filter((i) => i.key !== row.key);
    const evict = new Set<string>();
    const sameClass = others.filter((i) => i.cls === row.cls).sort((a, b) => a.lastUsed - b.lastUsed);
    const overClass = sameClass.length + 1 - classLimit;
    for (let i = 0; i < overClass; i++) evict.add(sameClass[i].key);
    let total = row.bytes + others.filter((i) => !evict.has(i.key)).reduce((s, i) => s + i.bytes, 0);
    const byAge = others.filter((i) => !evict.has(i.key)).sort((a, b) => a.lastUsed - b.lastUsed);
    for (const i of byAge) {
      if (total <= this.maxBytes) break;
      evict.add(i.key);
      total -= i.bytes;
    }
    return [...evict];
  }

  async delete(url: string): Promise<void> {
    await this.init();
    const key = await this.keyOf(url);
    await this.store.tx(['cache'], 'readwrite', (t) => t.delete('cache', key));
    this.index.delete(key);
  }

  async clear(): Promise<void> {
    await this.store.tx(['cache'], 'readwrite', (t) => t.clear('cache'));
    this.index.clear();
  }

  /** Every cached value of a class (missing views are synthesised from them). */
  async allOf<T>(cls: CacheClass): Promise<CachedValue<T>[]> {
    await this.init();
    const tag = await this.classTag(cls);
    const keys = [...this.index.values()].filter((i) => i.cls === tag).map((i) => i.key);
    if (!keys.length) return [];
    const rows = await this.store.tx(['cache'], 'readonly', async (t) => {
      const out: CacheRow[] = [];
      for (const k of keys) {
        const r = await t.get('cache', k);
        if (r) out.push(r);
      }
      return out;
    });
    const values: CachedValue<T>[] = [];
    for (const r of rows) {
      try {
        const stored = await decryptValue<{ url: string; value: T }>(this.keys, 'cache', r.key, r.ct);
        values.push({ url: stored.url, value: stored.value, cachedAt: r.cachedAt });
      } catch {
        /* unreadable row: skipped */
      }
    }
    return values;
  }

  /** Total bytes held (the storage warning). */
  get bytes(): number {
    let n = 0;
    for (const i of this.index.values()) n += i.bytes;
    return n;
  }

  close(): void {
    this.store.close();
  }
}
