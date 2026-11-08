import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __setApiBaseForTests, setApiTransport } from '@/api/client';
import { __resetConnectionForTests, getConnectionState, reportConnectionLost, reportServerReached } from '@/api/connection';
import { ConnectivityMonitor, DRAINED_SHOW_MS, OFFLINE_SHOW_MS, PROBE_SCHEDULE_S, PROBE_STEADY_S, SYNCING_MIN_MS, probeHealth } from './connectivity';
import { notifyResume, __resetOfflinePlatformForTests } from './seams';
import { __resetSyncStatusForTests, getSyncStatus } from './status';

describe('connectivity monitor (section 4.2)', () => {
  let probe: ReturnType<typeof vi.fn<() => Promise<boolean>>>;
  let monitor: ConnectivityMonitor;
  let pending = 0;
  let reconnected = 0;

  beforeEach(() => {
    vi.useFakeTimers();
    __resetConnectionForTests();
    __resetSyncStatusForTests();
    probe = vi.fn<() => Promise<boolean>>().mockResolvedValue(false);
    pending = 0;
    reconnected = 0;
    monitor = new ConnectivityMonitor({ probe, now: () => Date.now(), random: () => 0.5, visible: () => true, pendingCount: () => pending, onReconnected: () => reconnected++ });
    monitor.start();
  });

  afterEach(() => {
    monitor.stop();
    vi.useRealTimers();
    __resetOfflinePlatformForTests();
  });

  it('a 300 ms blip is never shown; the data layer still switched at the first failure', async () => {
    reportConnectionLost();
    expect(monitor.state).toBe('suspect');
    expect(monitor.dataOffline).toBe(true);
    expect(getSyncStatus().showOffline).toBe(false);
    await vi.advanceTimersByTimeAsync(300);
    reportServerReached();
    expect(monitor.state).toBe('online');
    expect(monitor.dataOffline).toBe(false);
    await vi.advanceTimersByTimeAsync(OFFLINE_SHOW_MS + 100);
    expect(getSyncStatus().showOffline).toBe(false);
    expect(probe).not.toHaveBeenCalled();
  });

  it('shows the bar after 1.5 s of continuous failure and then probes on the schedule with jitter', async () => {
    reportConnectionLost();
    await vi.advanceTimersByTimeAsync(OFFLINE_SHOW_MS - 1);
    expect(getSyncStatus().showOffline).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(monitor.state).toBe('offline');
    expect(getSyncStatus()).toMatchObject({ phase: 'offline', showOffline: true });
    // random 0.5 -> jitter factor 1: the schedule is exact.
    for (const s of PROBE_SCHEDULE_S) {
      const before = probe.mock.calls.length;
      await vi.advanceTimersByTimeAsync(s * 1000 - 1);
      expect(probe.mock.calls.length).toBe(before);
      await vi.advanceTimersByTimeAsync(1);
      expect(probe.mock.calls.length).toBe(before + 1);
    }
    const before = probe.mock.calls.length;
    await vi.advanceTimersByTimeAsync(PROBE_STEADY_S * 1000);
    expect(probe.mock.calls.length).toBe(before + 1);
  });

  it('keeps the jitter inside +-20 %', async () => {
    monitor.stop();
    for (const r of [0, 1]) {
      const p = vi.fn<() => Promise<boolean>>().mockResolvedValue(false);
      const m = new ConnectivityMonitor({ probe: p, now: () => Date.now(), random: () => r, visible: () => true });
      m.start();
      __resetConnectionForTests();
      reportConnectionLost();
      await vi.advanceTimersByTimeAsync(OFFLINE_SHOW_MS);
      const expected = 2000 * (r === 0 ? 0.8 : 1.2);
      await vi.advanceTimersByTimeAsync(expected - 5);
      expect(p).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(10);
      expect(p).toHaveBeenCalledTimes(1);
      m.stop();
    }
  });

  it('pauses the schedule while hidden and probes at once on resume / visibility / online', async () => {
    let visible = false;
    monitor.stop();
    monitor = new ConnectivityMonitor({ probe, now: () => Date.now(), random: () => 0.5, visible: () => visible, pendingCount: () => pending });
    monitor.start();
    reportConnectionLost();
    await vi.advanceTimersByTimeAsync(OFFLINE_SHOW_MS + 5000);
    expect(probe).not.toHaveBeenCalled();
    expect(getSyncStatus().nextProbeAt).toBeNull();
    visible = true;
    notifyResume();
    await vi.advanceTimersByTimeAsync(0);
    expect(probe).toHaveBeenCalledTimes(1);
    // Immediate probes are throttled to one every 2 s.
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(probe).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2100);
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(probe.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('a failed probe shows the bar at once (before 1.5 s), e.g. a captive portal answering HTML', async () => {
    reportConnectionLost();
    await monitor.probeNow('offline-event');
    expect(monitor.state).toBe('offline');
    expect(getSyncStatus().showOffline).toBe(true);
  });

  it('a successful probe goes back online, tells the app to reconnect and the replayer to run', async () => {
    reportConnectionLost();
    await vi.advanceTimersByTimeAsync(OFFLINE_SHOW_MS);
    probe.mockResolvedValue(true);
    const attempts = getConnectionState().attempt;
    await vi.advanceTimersByTimeAsync(2000);
    expect(monitor.state).toBe('online');
    expect(getSyncStatus()).toMatchObject({ phase: 'online', showOffline: false, nextProbeAt: null });
    expect(getConnectionState().attempt).toBe(attempts + 1);
    expect(reconnected).toBe(1);
  });

  it('with changes waiting the reconnect shows SYNCING for at least 1 s, then "all saved" for 2.5 s', async () => {
    pending = 3;
    reportConnectionLost();
    await vi.advanceTimersByTimeAsync(OFFLINE_SHOW_MS);
    reportServerReached();
    expect(monitor.state).toBe('syncing');
    expect(getSyncStatus().phase).toBe('syncing');
    pending = 0;
    monitor.drained();
    await vi.advanceTimersByTimeAsync(SYNCING_MIN_MS - 10);
    expect(monitor.state).toBe('syncing');
    await vi.advanceTimersByTimeAsync(10);
    expect(monitor.state).toBe('online');
    expect(getSyncStatus().showDrained).toBe(true);
    await vi.advanceTimersByTimeAsync(DRAINED_SHOW_MS);
    expect(getSyncStatus().showDrained).toBe(false);
  });

  it('navigator.onLine=false only triggers a probe: nothing changes while requests keep working', async () => {
    probe.mockResolvedValue(true);
    window.dispatchEvent(new Event('offline'));
    await vi.advanceTimersByTimeAsync(0);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(monitor.state).toBe('online');
    expect(getSyncStatus().showOffline).toBe(false);
  });

  it('a reconnect noticed by an ordinary request kicks the replayer and re-runs what gave up; later focus probes kick it too', async () => {
    pending = 1;
    reportConnectionLost();
    await vi.advanceTimersByTimeAsync(OFFLINE_SHOW_MS);
    expect(monitor.state).toBe('offline');
    const attempts = getConnectionState().attempt;
    reportServerReached(); // e.g. me() succeeded: no probe involved
    expect(monitor.state).toBe('syncing');
    expect(reconnected).toBe(1);
    expect(getConnectionState().attempt).toBe(attempts + 1);
    // Still waiting (the upload did not finish yet): a focus probe while online kicks again.
    probe.mockResolvedValue(true);
    await vi.advanceTimersByTimeAsync(2100);
    expect(probe).not.toHaveBeenCalled(); // the schedule stopped at the reconnect
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(0);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(reconnected).toBe(2);
    expect(getConnectionState().attempt).toBe(attempts + 1); // not a reconnect: the server was reachable
  });

  it("while a probe is in flight its own request's store flips do not count: a portal's answer keeps the bar, no reconnect", async () => {
    monitor.stop();
    const portal = vi.fn(async () => {
      // The client saw a 200 (reached), then the probe found it was not the server's JSON.
      reportServerReached();
      reportConnectionLost();
      return false;
    });
    monitor = new ConnectivityMonitor({ probe: portal, now: () => Date.now(), random: () => 0.5, visible: () => true, pendingCount: () => 1, onReconnected: () => reconnected++ });
    monitor.start();
    reportConnectionLost();
    await monitor.probeNow('offline-event');
    expect(monitor.state).toBe('offline');
    expect(getSyncStatus().showOffline).toBe(true);
    expect(reconnected).toBe(0);
    expect(getConnectionState().attempt).toBe(0);
  });
});

describe('probeHealth (section 4.2: only the diary server itself counts as reachable)', () => {
  function answer(status: number, body: string, contentType: string) {
    setApiTransport(async () => new Response(body, { status, headers: { 'content-type': contentType } }));
  }

  beforeEach(() => {
    __resetConnectionForTests();
    __setApiBaseForTests('');
  });

  afterEach(() => {
    setApiTransport(null);
    __setApiBaseForTests(null);
    __resetConnectionForTests();
  });

  it("a captive portal's HTML 200 is unreachable, and the connection store is told so", async () => {
    answer(200, '<html><body>Hotel Wi-Fi: please sign in</body></html>', 'text/html');
    expect(await probeHealth()).toBe(false);
    expect(getConnectionState().offline).toBe(true);
  });

  it('a portal or proxy status without the server JSON (HTML 511 / 403 / 502) is unreachable', async () => {
    for (const status of [511, 403, 502]) {
      __resetConnectionForTests();
      answer(status, '<html><body>Network login required</body></html>', 'text/html');
      expect(await probeHealth()).toBe(false);
      expect(getConnectionState().offline).toBe(true);
    }
  });

  it('a JSON 200 that is not ok:true is unreachable', async () => {
    answer(200, '{}', 'application/json');
    expect(await probeHealth()).toBe(false);
  });

  it("the server's own answers count: 200 ok:true, and a refusal with its JSON error body", async () => {
    answer(200, JSON.stringify({ ok: true, version: '0.1.0', mode: 'hosted' }), 'application/json');
    expect(await probeHealth()).toBe(true);
    expect(getConnectionState().offline).toBe(false);
    answer(503, JSON.stringify({ code: 'IO', message: 'Starting up.' }), 'application/json');
    expect(await probeHealth()).toBe(true);
  });

  it('a network failure is unreachable', async () => {
    setApiTransport(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await probeHealth()).toBe(false);
    expect(getConnectionState().offline).toBe(true);
  });
});
