/**
 * App lifecycle and the Back button (WP-9): leaving flushes and (by setting) locks; Back minimises
 * only when the back handler says 'exit'.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BackResult } from '@/utils/back-handler';
import { installLifecycle, type AppLike } from './lifecycle';
import type { PhoneOs } from './os';

function fakeApp() {
  const listeners = new Map<string, (data: never) => void>();
  const app: AppLike & { fire(name: string, data?: unknown): void; removed: string[] } = {
    removed: [],
    fire(name, data) {
      listeners.get(name)?.(data as never);
    },
    addListener: vi.fn(async (name: string, fn: (data: never) => void) => {
      listeners.set(name, fn);
      return {
        remove: async () => {
          app.removed.push(name);
          listeners.delete(name);
        },
      };
    }) as never,
    minimizeApp: vi.fn(async () => undefined),
  };
  return app;
}

function setup(options: { lockOnLeave?: boolean; back?: BackResult; controlFails?: boolean; graceMs?: number; os?: PhoneOs } = {}) {
  const app = fakeApp();
  const calls: string[] = [];
  const control = vi.fn(async (action: 'flushAll' | 'lockAll') => {
    calls.push(action);
    if (options.controlFails) throw new Error(`${action} failed`);
  });
  const onLocked = vi.fn(() => {
    calls.push('ui-locked');
  });
  const onResume = vi.fn();
  const log = vi.fn();
  const handle = installLifecycle({
    app,
    control,
    shouldLockOnLeave: () => options.lockOnLeave ?? true,
    onLocked,
    handleBack: () => options.back ?? 'navigated',
    onResume,
    log,
    deferredLockGraceMs: options.graceMs ?? 50,
    // Left out entirely unless a test asks for a phone: the Android tests pass no `os` at all.
    ...(options.os ? { os: options.os } : {}),
  });
  return { app, calls, control, onLocked, onResume, log, handle };
}

describe('installLifecycle', () => {
  it('leaving locks the UI first, then the core, and flushes', async () => {
    const { app, calls, onLocked, handle } = setup();
    await handle.ready;
    // The event handler runs `leave` itself; awaiting an explicit one makes the order observable.
    app.fire('appStateChange', { isActive: false });
    await handle.leave();
    expect(onLocked).toHaveBeenCalledTimes(2);
    expect(calls.slice(0, 3)).toEqual(['ui-locked', 'lockAll', 'flushAll']);
  });

  it('with "lock when I leave" off it only flushes', async () => {
    const { calls, onLocked, handle } = setup({ lockOnLeave: false });
    await handle.leave();
    expect(onLocked).not.toHaveBeenCalled();
    expect(calls).toEqual(['flushAll']);
  });

  it('a failing core control is logged, never thrown, and does not stop the other work', async () => {
    const { calls, onLocked, log, handle } = setup({ controlFails: true });
    await expect(handle.leave()).resolves.toBeUndefined();
    expect(onLocked).toHaveBeenCalled();
    expect(calls).toEqual(['ui-locked', 'lockAll', 'flushAll']);
    expect(log).toHaveBeenCalledTimes(2);
  });

  it('coming back calls onResume only', async () => {
    const { app, calls, onResume, handle } = setup();
    await handle.ready;
    app.fire('appStateChange', { isActive: true });
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([]);
  });

  it('Back minimises the app only when the handler answers "exit"', async () => {
    const navigated = setup({ back: 'navigated' });
    await navigated.handle.ready;
    navigated.app.fire('backButton', { canGoBack: false });
    expect(navigated.app.minimizeApp).not.toHaveBeenCalled();

    const closed = setup({ back: 'closed-dialog' });
    await closed.handle.ready;
    closed.app.fire('backButton', { canGoBack: false });
    expect(closed.app.minimizeApp).not.toHaveBeenCalled();

    const exit = setup({ back: 'exit' });
    await exit.handle.ready;
    exit.app.fire('backButton', { canGoBack: false });
    expect(exit.app.minimizeApp).toHaveBeenCalledTimes(1);
  });

  it('dispose removes both listeners', async () => {
    const { app, handle } = setup();
    await handle.ready;
    handle.dispose();
    await Promise.resolve();
    await Promise.resolve();
    expect(app.removed.sort()).toEqual(['appStateChange', 'backButton']);
  });
});

/**
 * The app's own system dialogs (save as, open, share sheet) stop the activity like another app
 * would, but the user never left: while a `suspendLock` token is held, leaving flushes only.
 */
describe('installLifecycle - lock suspended for a system dialog of the app', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function settle() {
    await vi.advanceTimersByTimeAsync(0);
  }

  it('leaving for the save-as dialog flushes but does not lock, and coming back locks nothing', async () => {
    const { app, calls, onLocked, log, handle } = setup();
    await handle.ready;
    const release = handle.suspendLock();
    app.fire('appStateChange', { isActive: false });
    await settle();
    expect(onLocked).not.toHaveBeenCalled();
    expect(calls).toEqual(['flushAll']);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('system dialog'));

    // The dialog's result arrives first (the token is released), the resume event right after.
    release();
    app.fire('appStateChange', { isActive: true });
    await vi.advanceTimersByTimeAsync(1000);
    expect(onLocked).not.toHaveBeenCalled();
    expect(calls).toEqual(['flushAll']);
  });

  it('released while the app is still in the background (another app was chosen from the share sheet): locks after the grace period', async () => {
    const { app, calls, onLocked, handle } = setup({ graceMs: 50 });
    await handle.ready;
    const release = handle.suspendLock();
    app.fire('appStateChange', { isActive: false });
    await settle();
    release();
    await vi.advanceTimersByTimeAsync(49);
    expect(onLocked).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(onLocked).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['flushAll', 'ui-locked', 'lockAll']);
  });

  it('a resume during the grace period cancels the deferred lock; a release is idempotent', async () => {
    const { app, onLocked, handle } = setup({ graceMs: 50 });
    await handle.ready;
    const release = handle.suspendLock();
    app.fire('appStateChange', { isActive: false });
    await settle();
    release();
    release();
    await vi.advanceTimersByTimeAsync(20);
    app.fire('appStateChange', { isActive: true });
    await vi.advanceTimersByTimeAsync(100);
    expect(onLocked).not.toHaveBeenCalled();
  });

  it('overlapping suspensions: the lock waits for the last token', async () => {
    const { app, onLocked, handle } = setup({ graceMs: 50 });
    await handle.ready;
    const first = handle.suspendLock();
    const second = handle.suspendLock();
    app.fire('appStateChange', { isActive: false });
    await settle();
    first();
    await vi.advanceTimersByTimeAsync(100);
    expect(onLocked).not.toHaveBeenCalled();
    second();
    await vi.advanceTimersByTimeAsync(51);
    expect(onLocked).toHaveBeenCalledTimes(1);
  });

  it('without a token, leaving locks as before - also right after a dialog was closed', async () => {
    const { app, calls, onLocked, handle } = setup();
    await handle.ready;
    const release = handle.suspendLock();
    release();
    app.fire('appStateChange', { isActive: true });
    app.fire('appStateChange', { isActive: false });
    await settle();
    expect(onLocked).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['ui-locked', 'lockAll', 'flushAll']);
  });

  it('the setting is read when the deferred lock fires, and "off" means no lock', async () => {
    const { app, onLocked, handle } = setup({ lockOnLeave: false, graceMs: 50 });
    await handle.ready;
    const release = handle.suspendLock();
    app.fire('appStateChange', { isActive: false });
    await settle();
    release();
    await vi.advanceTimersByTimeAsync(100);
    expect(onLocked).not.toHaveBeenCalled();
  });
});

/**
 * iOS (docs/APPLE-PLAN.md WP-A2): `appStateChange(isActive=false)` is willResignActive - it also
 * fires for Control Center, the notification-permission alert, a Face ID prompt - so "leaving" is
 * the `pause` event (didEnterBackground), and the app's own dialogs never trigger it.
 */
describe('installLifecycle on iOS (os: "ios")', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function settle() {
    await vi.advanceTimersByTimeAsync(0);
  }

  it('an interruption that keeps the app on screen (isActive=false alone) neither locks nor flushes', async () => {
    const { app, calls, onLocked, onResume, handle } = setup({ os: 'ios' });
    await handle.ready;
    app.fire('appStateChange', { isActive: false });
    await settle();
    expect(onLocked).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
    // The interruption is over: the usual "came back" work, nothing else.
    app.fire('appStateChange', { isActive: true });
    await vi.advanceTimersByTimeAsync(5000);
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([]);
  });

  it('`pause` is the leave: the UI locks first, then the core, and it flushes', async () => {
    const { app, calls, onLocked, handle } = setup({ os: 'ios' });
    await handle.ready;
    app.fire('appStateChange', { isActive: false });
    app.fire('pause');
    await settle();
    expect(onLocked).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['ui-locked', 'lockAll', 'flushAll']);
  });

  it('with "lock when I leave" off, `pause` only flushes', async () => {
    const { app, calls, onLocked, handle } = setup({ os: 'ios', lockOnLeave: false });
    await handle.ready;
    app.fire('pause');
    await settle();
    expect(onLocked).not.toHaveBeenCalled();
    expect(calls).toEqual(['flushAll']);
  });

  it('a dialog of the app never fires `pause`, so a `pause` under a held token is a real leave: it locks at once, nothing is deferred', async () => {
    const { app, calls, onLocked, log, handle } = setup({ os: 'ios', graceMs: 50 });
    await handle.ready;
    const release = handle.suspendLock();
    // The picker / sheet / prompt itself: at most an isActive=false, which is not a leave here.
    app.fire('appStateChange', { isActive: false });
    await settle();
    expect(calls).toEqual([]);
    // Home pressed while the dialog is open.
    app.fire('pause');
    await settle();
    expect(onLocked).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['ui-locked', 'lockAll', 'flushAll']);
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining('system dialog'));
    // Releasing the token later locks nothing a second time, however long the app stays away.
    release();
    await vi.advanceTimersByTimeAsync(1000);
    expect(onLocked).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['ui-locked', 'lockAll', 'flushAll']);
  });

  it('a token taken and released around a dialog (no `pause`) changes nothing, and the next real leave locks', async () => {
    const { app, calls, onLocked, onResume, handle } = setup({ os: 'ios', graceMs: 50 });
    await handle.ready;
    const release = handle.suspendLock();
    app.fire('appStateChange', { isActive: false });
    release();
    release();
    app.fire('appStateChange', { isActive: true });
    await vi.advanceTimersByTimeAsync(1000);
    expect(onLocked).not.toHaveBeenCalled();
    expect(onResume).toHaveBeenCalledTimes(1);
    app.fire('pause');
    await settle();
    expect(onLocked).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['ui-locked', 'lockAll', 'flushAll']);
  });

  it('coming back after a real leave calls onResume once and locks nothing more', async () => {
    const { app, calls, onLocked, onResume, handle } = setup({ os: 'ios' });
    await handle.ready;
    app.fire('pause');
    await settle();
    app.fire('resume');
    app.fire('appStateChange', { isActive: true });
    await vi.advanceTimersByTimeAsync(5000);
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(onLocked).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['ui-locked', 'lockAll', 'flushAll']);
  });

  it('a failing core control is logged, never thrown', async () => {
    const { app, calls, log, handle } = setup({ os: 'ios', controlFails: true });
    await handle.ready;
    app.fire('pause');
    await settle();
    expect(calls).toEqual(['ui-locked', 'lockAll', 'flushAll']);
    expect(log).toHaveBeenCalledTimes(2);
  });

  it('installs the `pause` listener on iOS only, and dispose removes every listener', async () => {
    const ios = setup({ os: 'ios' });
    await ios.handle.ready;
    expect(vi.mocked(ios.app.addListener).mock.calls.map(([name]) => name).sort()).toEqual(['appStateChange', 'backButton', 'pause']);
    ios.handle.dispose();
    await vi.advanceTimersByTimeAsync(0);
    expect(ios.app.removed.sort()).toEqual(['appStateChange', 'backButton', 'pause']);

    for (const os of [undefined, 'android'] as const) {
      const android = setup(os ? { os } : {});
      await android.handle.ready;
      expect(vi.mocked(android.app.addListener).mock.calls.map(([name]) => name).sort()).toEqual(['appStateChange', 'backButton']);
      // And there a `pause` (Android fires it on every onPause) does nothing at all.
      android.app.fire('pause');
      await settle();
      expect(android.calls).toEqual([]);
    }
  });
});
