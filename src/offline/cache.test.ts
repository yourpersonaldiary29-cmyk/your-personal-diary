import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { classify, isCacheable, ReadCache } from './cache';
import { openAccountStore } from './store/idb';
import { MemoryStore } from './store/memory';
import { DANA, freshIndexedDb, installWebCrypto, testKeys } from './test-utils/env';

beforeAll(() => installWebCrypto());

describe('read cache allow-list (section 4.6)', () => {
  it('classifies the allow-listed GETs and refuses everything else', () => {
    expect(classify('/api/settings')).toBe('settings');
    expect(classify('/api/habits?includeArchived=true')).toBe('habits');
    expect(classify('/api/habits/templates')).toBe('templates');
    expect(classify('/api/habits/progress?date=2026-10-23')).toBe('progress');
    expect(classify('/api/habits/status?from=a&to=b')).toBe('status');
    expect(classify('/api/home')).toBe('home');
    expect(classify('/api/calendar/month?year=2026&month=10')).toBe('calMonth');
    expect(classify('/api/calendar/range?from=a&to=b')).toBe('calRange');
    expect(classify('/api/entries?limit=20')).toBe('entriesList');
    expect(classify('/api/entries/day/2026-10-23')).toBe('day');
    expect(classify('/api/entries/meta/tags')).toBe('meta');
    expect(classify('/api/entries/12', { date: '2026-10-22' }, '2026-10-23')).toBe('entry30');
    expect(classify('/api/entries/12', { date: '2026-01-01' }, '2026-10-23')).toBe('entry');
    for (const url of ['/api/insights?period=30d', '/api/stats?period=7d', '/api/search', '/api/backup/create', '/api/export', '/api/auth/sessions', '/api/server/info', '/api/habits/reminders/due?now=x', '/api/settings/data-dir', '/api/auth/me']) {
      expect(isCacheable(url), url).toBe(false);
    }
  });

  it('never stores an insights answer, even when asked', async () => {
    const cache = new ReadCache(new MemoryStore(), await testKeys());
    await cache.put('/api/insights?period=30d', { insights: ['secret'] });
    expect(await cache.get('/api/insights?period=30d')).toBeNull();
    expect(cache.bytes).toBe(0);
  });
});

describe('read cache storage', () => {
  beforeEach(() => {
    freshIndexedDb();
  });

  it('writes through and replaces a row whole; a delete removes it; memory stays memory', async () => {
    const keys = await testKeys();
    const memory = new ReadCache(new MemoryStore(), keys);
    expect(memory.persistent).toBe(false);
    await memory.put('/api/settings', { theme: 'dark' });
    expect((await memory.get<{ theme: string }>('/api/settings'))?.value).toEqual({ theme: 'dark' });
    await memory.put('/api/settings', { theme: 'light' });
    expect((await memory.get<{ theme: string }>('/api/settings'))?.value).toEqual({ theme: 'light' });
    await memory.delete('/api/settings');
    expect(await memory.get('/api/settings')).toBeNull();
  });

  it('persists in IndexedDB for a remembered app session and survives a reopen', async () => {
    const keys = await testKeys();
    const { store } = await openAccountStore(DANA);
    const cache = new ReadCache(store, keys);
    expect(cache.persistent).toBe(true);
    await cache.put('/api/home', { totalEntries: 3 });
    store.close();
    const { store: again } = await openAccountStore(DANA);
    const reopened = new ReadCache(again, keys);
    expect((await reopened.get<{ totalEntries: number }>('/api/home'))?.value).toEqual({ totalEntries: 3 });
    // The rows are ciphertext keyed by HMAC: the URL is nowhere in plaintext.
    const rows = await again.tx(['cache'], 'readonly', (t) => t.getAll('cache'));
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify({ ...rows[0], ct: undefined })).not.toContain('/api/home');
    again.close();
  });

  it('keeps the per-class LRU limits (progress: the last 7 dates)', async () => {
    let now = 1000;
    const cache = new ReadCache(new MemoryStore(), await testKeys(), () => now++);
    for (let d = 1; d <= 9; d++) await cache.put(`/api/habits/progress?date=2026-10-${String(d).padStart(2, '0')}`, [d]);
    expect(await cache.get('/api/habits/progress?date=2026-10-01')).toBeNull();
    expect(await cache.get('/api/habits/progress?date=2026-10-02')).toBeNull();
    expect((await cache.get<number[]>('/api/habits/progress?date=2026-10-03'))?.value).toEqual([3]);
    expect((await cache.get<number[]>('/api/habits/progress?date=2026-10-09'))?.value).toEqual([9]);
  });

  it('evicts the least recently used rows when the size limit is reached', async () => {
    let now = 1000;
    const cache = new ReadCache(new MemoryStore(), await testKeys(), () => now++, 6000);
    const big = 'x'.repeat(2000);
    await cache.put('/api/entries/1', { id: 1, body: big });
    await cache.put('/api/entries/2', { id: 2, body: big });
    await cache.get('/api/entries/1'); // 1 is now more recent than 2
    await cache.put('/api/entries/3', { id: 3, body: big });
    expect(await cache.get('/api/entries/2')).toBeNull();
    expect(await cache.get('/api/entries/1')).not.toBeNull();
    expect(await cache.get('/api/entries/3')).not.toBeNull();
    expect(cache.bytes).toBeLessThanOrEqual(6000);
  });

  it('lists every value of a class (missing views are synthesised from them)', async () => {
    const cache = new ReadCache(new MemoryStore(), await testKeys());
    await cache.put('/api/entries/5', { id: 5, date: '2026-10-23' }, '2026-10-23');
    await cache.put('/api/entries/6', { id: 6, date: '2026-10-22' }, '2026-10-23');
    await cache.put('/api/settings', { theme: 'dark' });
    const recent = await cache.allOf<{ id: number }>('entry30');
    expect(recent.map((c) => c.value.id).sort()).toEqual([5, 6]);
    expect(await cache.allOf('entry')).toEqual([]);
  });
});
