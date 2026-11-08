/**
 * Password operations of one account never interleave (auth-service.ts per-account lock):
 * a password reset that finishes (and closes the diary) while a slower change-password or a
 * second reset is still deriving its key must not leave the diary file encrypted under one
 * key while the registry holds the verifier of the other - that would lock the diary for good.
 * The key derivation is slowed down for one password so the interleaving is deterministic.
 */
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanupTempDirs, sampleEntry, testConfig } from './helpers';

const SLOW_PASSWORD = 'SlowNew1pass';

vi.mock('../src/security/kdf', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/security/kdf')>();
  return {
    ...real,
    deriveSecret: async (password: string, ...rest: unknown[]) => {
      if (password === SLOW_PASSWORD) await new Promise((r) => setTimeout(r, 400));
      return (real.deriveSecret as (...a: unknown[]) => Promise<Buffer>)(password, ...rest);
    },
  };
});

const { createAuthService } = await import('../src/security/auth-service');
type Service = Awaited<ReturnType<typeof createAuthService>>;

const PASSWORD = 'Passw0rd!';
const FAST = { N: 1024, r: 8, p: 1 };
const services: Service[] = [];
afterEach(async () => {
  for (const s of services.splice(0)) await s.shutdown();
});
afterAll(cleanupTempDirs);

async function setup() {
  const config = testConfig();
  const auth = await createAuthService(config, { kdf: FAST });
  services.push(auth);
  const { token, account } = await auth.register({
    firstName: 'Dana',
    lastName: 'Test',
    username: 'dana',
    email: 'dana@example.com',
    password: PASSWORD,
    rememberMe: false,
    deviceName: 'PC',
  });
  const ctx = (await auth.authenticate(token))!;
  const { createEntry, validateEntryInput } = await import('../src/db/entries-repo');
  createEntry(ctx.db, validateEntryInput(sampleEntry({ title: 'לא הולך לאיבוד' })));
  await ctx.vault.persist();
  return { config, auth, ctx, userId: account.id };
}

/** Signs in with `password` on a fresh service over the same files and returns the entry titles. */
async function titlesWith(config: ReturnType<typeof testConfig>, password: string): Promise<string[]> {
  const fresh = await createAuthService(config, { kdf: FAST });
  services.push(fresh);
  const { token } = await fresh.login({ username: 'dana', password, rememberMe: false, deviceName: 'PC' });
  const ctx = (await fresh.authenticate(token))!;
  const { listEntries } = await import('../src/db/entries-repo');
  return listEntries(ctx.db, {}).items.map((e) => e.title);
}

describe('password operations of one account are serialised', () => {
  it('a slow change-password overtaken by a reset: the diary opens with the password that won', async () => {
    const { config, auth, ctx, userId } = await setup();
    const change = auth.changePassword(ctx, PASSWORD, SLOW_PASSWORD).then(
      () => 'changed',
      (e: unknown) => `failed: ${(e as Error).message}`,
    );
    // Let the change pass its first derivation and pick up the open diary.
    await new Promise((r) => setTimeout(r, 50));
    await auth.resetPassword(userId, 'ResetNew1pass');
    const outcome = await change;
    await auth.shutdown();
    // Serialised: the change (first in) finished, then the reset re-encrypted the diary again.
    expect(outcome).toBe('changed');
    expect(await titlesWith(config, 'ResetNew1pass')).toEqual(['לא הולך לאיבוד']);
    await expect(titlesWith(config, SLOW_PASSWORD)).rejects.toMatchObject({ code: 'WRONG_PASSWORD' });
  });

  it('two resets at once: the diary opens with the password the registry kept', async () => {
    const { config, auth, userId } = await setup();
    const slow = auth.resetPassword(userId, SLOW_PASSWORD).then(
      () => 'ok',
      (e: unknown) => `failed: ${(e as Error).message}`,
    );
    await new Promise((r) => setTimeout(r, 50));
    await auth.resetPassword(userId, 'FastNew1pass');
    const outcome = await slow;
    await auth.shutdown();
    // Serialised: the slow reset (first in) finished before the fast one started, so the fast one's password is final.
    expect(outcome).toBe('ok');
    expect(await titlesWith(config, 'FastNew1pass')).toEqual(['לא הולך לאיבוד']);
    await expect(titlesWith(config, SLOW_PASSWORD)).rejects.toMatchObject({ code: 'WRONG_PASSWORD' });
  });
});
