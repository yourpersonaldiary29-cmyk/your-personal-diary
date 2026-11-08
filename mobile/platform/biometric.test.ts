/**
 * Biometric unlock (WP-9): the honest flows around the plugin and the core contract - the
 * password creates the token, the prompt stores it, an invalidated key turns the setting off,
 * and the core (not the prompt) decides whether the session is unlocked.
 */
import { describe, expect, it, vi } from 'vitest';
import { BIOMETRIC_UNLOCK_ENABLED, createBiometricUnlock, type BiometricCore, type BiometricLike } from './biometric';

function setup(options: { available?: boolean; enrollOk?: boolean; unlock?: { token: string | null; reason?: 'cancelled' | 'failed' | 'invalidated' | 'not-enrolled' }; accept?: boolean } = {}) {
  const plugin: BiometricLike = {
    isAvailable: vi.fn(async () => ({ status: options.available === false ? 'none-enrolled' : 'available', enrolled: false }) as never),
    enroll: vi.fn(async () => (options.enrollOk === false ? { ok: false, reason: 'cancelled' as const } : { ok: true })),
    unlock: vi.fn(async () => options.unlock ?? { token: 'tok' }),
    clear: vi.fn(async () => undefined),
  };
  const core: BiometricCore = {
    createToken: vi.fn(async () => 'tok'),
    unlockWithToken: vi.fn(async () => options.accept ?? true),
    revokeToken: vi.fn(async () => undefined),
  };
  const onEnabledChange = vi.fn(async () => undefined);
  const unlock = createBiometricUnlock({ plugin, core, texts: () => ({ title: 't', negative: 'n' }), onEnabledChange });
  return { plugin, core, onEnabledChange, unlock };
}

describe('createBiometricUnlock', () => {
  it('stays behind its feature flag until the core implements the contract', () => {
    expect(BIOMETRIC_UNLOCK_ENABLED).toBe(false);
  });

  it('isAvailable reflects the plugin, false on errors', async () => {
    expect(await setup().unlock.isAvailable()).toBe(true);
    expect(await setup({ available: false }).unlock.isAvailable()).toBe(false);
    const { plugin, unlock } = setup();
    vi.mocked(plugin.isAvailable).mockRejectedValueOnce(new Error('x'));
    expect(await unlock.isAvailable()).toBe(false);
  });

  it('enable: the password creates the token, the prompt stores it, the setting turns on', async () => {
    const { plugin, core, onEnabledChange, unlock } = setup();
    expect(await unlock.enable('secret')).toBe(true);
    expect(core.createToken).toHaveBeenCalledWith('secret');
    expect(plugin.enroll).toHaveBeenCalledWith({ token: 'tok', title: 't', negative: 'n' });
    expect(onEnabledChange).toHaveBeenCalledWith(true);
  });

  it('enable: a cancelled prompt revokes the fresh token and leaves the setting off', async () => {
    const { core, onEnabledChange, unlock } = setup({ enrollOk: false });
    expect(await unlock.enable('secret')).toBe(false);
    expect(core.revokeToken).toHaveBeenCalled();
    expect(onEnabledChange).not.toHaveBeenCalled();
  });

  it('enable: a wrong password (the core rejects) propagates before any prompt', async () => {
    const { plugin, core, unlock } = setup();
    vi.mocked(core.createToken).mockRejectedValueOnce(new Error('WRONG_PASSWORD'));
    await expect(unlock.enable('bad')).rejects.toThrow('WRONG_PASSWORD');
    expect(plugin.enroll).not.toHaveBeenCalled();
  });

  it('unlock: the core accepts the released token', async () => {
    const { core, unlock } = setup();
    expect(await unlock.unlock()).toBe('unlocked');
    expect(core.unlockWithToken).toHaveBeenCalledWith('tok');
  });

  it('unlock: cancelled, failed, and a core that refuses the token', async () => {
    expect(await setup({ unlock: { token: null, reason: 'cancelled' } }).unlock.unlock()).toBe('cancelled');
    expect(await setup({ unlock: { token: null, reason: 'failed' } }).unlock.unlock()).toBe('failed');
    expect(await setup({ accept: false }).unlock.unlock()).toBe('failed');
  });

  it('unlock: an invalidated key (new fingerprint enrolled) turns the setting off and clears everything', async () => {
    const { plugin, core, onEnabledChange, unlock } = setup({ unlock: { token: null, reason: 'invalidated' } });
    expect(await unlock.unlock()).toBe('not-enrolled');
    expect(plugin.clear).toHaveBeenCalled();
    expect(core.revokeToken).toHaveBeenCalled();
    expect(onEnabledChange).toHaveBeenCalledWith(false);
  });

  it('disable clears the plugin, revokes the token and turns the setting off', async () => {
    const { plugin, core, onEnabledChange, unlock } = setup();
    await unlock.disable();
    expect(plugin.clear).toHaveBeenCalled();
    expect(core.revokeToken).toHaveBeenCalled();
    expect(onEnabledChange).toHaveBeenCalledWith(false);
  });
});
