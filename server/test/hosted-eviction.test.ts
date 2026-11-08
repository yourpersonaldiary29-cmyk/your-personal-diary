/**
 * WP-H3 (docs/HOSTED-PLAN.md 3.7): idle-vault eviction. On a long-running public server every
 * account that signed in with "remember me" would otherwise keep its diary open in memory for up to
 * 90 days; with `vaultIdleMs` a diary nobody touched for that long is flushed and closed when every
 * attached session can reopen it (remember-me sessions carry the wrapped key). The next request
 * reopens it exactly as after a restart. Off by default (local mode). Fake clock, fictional users.
 */
import fs from 'node:fs';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { createAuthService, type DiaryAuthService } from '../src/security/auth-service';
import { cleanupTempDirs, testConfig } from './helpers';

const PASSWORD = 'Passw0rd!';
const FAST = { N: 1024, r: 8, p: 1 };
const services: DiaryAuthService[] = [];

afterEach(async () => {
  for (const s of services.splice(0)) await s.shutdown();
});
afterAll(cleanupTempDirs);

async function service(vaultIdleMs: number | undefined, clock: { now: number }) {
  const auth = await createAuthService(testConfig(), { kdf: FAST, now: () => new Date(clock.now), ...(vaultIdleMs === undefined ? {} : { vaultIdleMs }) });
  services.push(auth);
  return auth;
}

const input = (username: string, rememberMe: boolean) => ({ firstName: 'Test', lastName: 'User', username, email: `${username}@example.com`, password: PASSWORD, rememberMe, deviceName: 'phone' });

describe('idle-vault eviction', () => {
  it('is off without the option: a remembered diary stays open however long it idles', async () => {
    const clock = { now: Date.parse('2026-10-18T10:00:00Z') };
    const auth = await service(undefined, clock);
    expect(auth.vaultIdleMs).toBe(0);
    await auth.register(input('dana', true));
    clock.now += 48 * 60 * 60_000;
    expect(await auth.evictIdleVaults()).toBe(0);
    expect(auth.vaults.size).toBe(1);
  });

  it('closes a remembered diary after the idle time, flushing it; the next request reopens it with the wrapped key', async () => {
    const clock = { now: Date.parse('2026-10-18T10:00:00Z') };
    const auth = await service(60_000, clock);
    const { token, account } = await auth.register(input('dana', true));
    const ctx = (await auth.authenticate(token))!;
    ctx.db.run(
      "INSERT INTO entries (date, time, title, body, created_at, updated_at) VALUES ('2026-10-18', '09:00', 'before eviction', 'kept', '2026-10-18T09:00:00.000Z', '2026-10-18T09:00:00.000Z')",
    );
    const file = auth.vaults.get(account.id)!.dbPath;
    const bytesBefore = fs.readFileSync(file);
    // Not idle yet (59 s): nothing happens.
    clock.now += 59_000;
    expect(await auth.evictIdleVaults()).toBe(0);
    expect(auth.vaults.size).toBe(1);
    // Idle: closed and flushed (the file was rewritten - a fresh nonce every write), the session itself survives.
    clock.now += 2_000;
    expect(await auth.evictIdleVaults()).toBe(1);
    expect(auth.vaults.size).toBe(0);
    expect(fs.readFileSync(file).equals(bytesBefore)).toBe(false);
    expect(auth.sessions.findById(ctx.session.id)).not.toBeNull();
    // The next request reopens it transparently, with the data.
    const again = (await auth.authenticate(token))!;
    expect(again).not.toBeNull();
    expect(auth.vaults.size).toBe(1);
    expect(again.db.all<{ title: string }>('SELECT title FROM entries').map((r) => r.title)).toEqual(['before eviction']);
    // ...and that request counts as activity: a second sweep right after does nothing.
    expect(await auth.evictIdleVaults()).toBe(0);
    // Logging out the reopened session closes the diary as usual (refCount back to zero).
    await auth.logout(ctx.session.id);
    expect(auth.vaults.size).toBe(0);
  });

  it('never evicts a diary with a regular (non-remembered) session attached; evicts once that session is gone', async () => {
    const clock = { now: Date.parse('2026-10-18T10:00:00Z') };
    const auth = await service(60_000, clock);
    const remembered = await auth.register(input('dana', true));
    const regular = await auth.login({ username: 'dana', password: PASSWORD, rememberMe: false, deviceName: 'pc' });
    expect(auth.vaults.size).toBe(1);
    clock.now += 120_000;
    expect(await auth.evictIdleVaults()).toBe(0);
    expect(auth.vaults.size).toBe(1);
    await auth.logout(regular.session.id);
    // Still open (the remembered session holds it) - and now evictable.
    expect(auth.vaults.size).toBe(1);
    expect(await auth.evictIdleVaults()).toBe(1);
    expect(auth.vaults.size).toBe(0);
    expect((await auth.authenticate(remembered.token))).not.toBeNull();
  });

  it('activity resets the idle clock; several accounts are swept independently', async () => {
    const clock = { now: Date.parse('2026-10-18T10:00:00Z') };
    const auth = await service(60_000, clock);
    const a = await auth.register(input('dana', true));
    const b = await auth.register(input('ron', true));
    clock.now += 50_000;
    expect(await auth.authenticate(a.token)).not.toBeNull();
    clock.now += 20_000;
    // b idled 70 s -> evicted; a was used 20 s ago -> kept.
    expect(await auth.evictIdleVaults()).toBe(1);
    expect(auth.vaults.ids()).toEqual([a.account.id]);
    expect(auth.vaults.get(b.account.id)).toBeNull();
    clock.now += 50_000;
    expect(await auth.evictIdleVaults()).toBe(1);
    expect(auth.vaults.size).toBe(0);
    // Both reopen on demand.
    expect(await auth.authenticate(a.token)).not.toBeNull();
    expect(await auth.authenticate(b.token)).not.toBeNull();
    expect(auth.vaults.size).toBe(2);
  });
});
