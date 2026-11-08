/**
 * Known leftover: a wrong 6-digit code used to be checked against every live reset of the account
 * (up to 3), so one guess tested up to three codes. Only the newest live reset's code counts now;
 * the links of older live resets keep working for their own reset.
 */
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { RESET_MAX_CODE_FAILURES, ResetStore } from '../src/security/resets';
import { cleanupTempDirs, tempDataDir } from './helpers';

afterAll(cleanupTempDirs);

describe('ResetStore.takeByCode', () => {
  it("accepts only the newest live reset's code; older links still work", () => {
    let t = Date.parse('2026-09-30T10:00:00.000Z');
    const store = new ResetStore(path.join(tempDataDir(), 'resets.json'), { now: () => new Date(t) });
    const first = store.create('u_a');
    t += 60_000;
    const second = store.create('u_a');
    // The older code is refused (it is not the newest reset's)...
    if (first.code !== second.code) expect(store.takeByCode('u_a', first.code)).toBeNull();
    // ...the newest one works...
    expect(store.takeByCode('u_a', second.code)?.id).toBeTruthy();
    // ...and the older reset's link still resets.
    expect(store.takeByToken(first.token)?.userId).toBe('u_a');
  });

  it('a wrong code counts against the newest reset only', () => {
    let t = Date.parse('2026-09-30T10:00:00.000Z');
    const store = new ResetStore(path.join(tempDataDir(), 'resets.json'), { now: () => new Date(t) });
    const older = store.create('u_b');
    t += 1000;
    const newest = store.create('u_b');
    const wrong = newest.code === '000000' ? '111111' : '000000';
    for (let i = 0; i < RESET_MAX_CODE_FAILURES; i++) expect(store.takeByCode('u_b', wrong)).toBeNull();
    // The newest reset died of wrong codes; the older one is untouched and its link works.
    expect(store.takeByToken(newest.token)).toBeNull();
    expect(store.takeByToken(older.token)?.userId).toBe('u_b');
  });
});
