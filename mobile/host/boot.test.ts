import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __setApiBaseForTests, request } from '@/api/client';
import { __resetLocaleForTests, setCurrentLocale } from '@/i18n/runtime';
import type { StorageRpcRequest } from '../shared/storage-protocol';
import type { CoreAssetBytes } from '../shared/transport';
import { FakeWorker, flush, stubWorker } from '../test/fake-worker';
import { __resetMobileBootForTests, bootMobile, FRAME_FALLBACK_MS, getCoreClient, MEMORY_STORAGE_NOTICE, type BootOptions } from './boot';
import { SPLASH_ID, hideSplash, showSplashError } from './splash';
import { MemoryStorage } from './storage/memory';

// The worker module is the only one with a `?worker&inline` import (a real Worker): tests always
// pass their own `createWorker`, and this proves the default is what boot falls back to.
const createCoreWorker = vi.hoisted(() => vi.fn());
vi.mock('./core-worker', () => ({ createCoreWorker }));

/** The <body> of the real mobile/index.html (without its script), so markup and code cannot drift apart. */
function mobileBody(): string {
  const html = readFileSync(path.resolve(process.cwd(), 'mobile/index.html'), 'utf8');
  const body = /<body>([\s\S]*)<\/body>/.exec(html);
  if (!body) throw new Error('mobile/index.html has no <body>');
  return body[1].replace(/<script[\s\S]*?<\/script>/g, '');
}

function splash(): HTMLElement | null {
  return document.getElementById(SPLASH_ID);
}

/** Tiny stand-ins for the boot-time assets (the real ones are loaded by mobile/test/core). */
function fakeAssets(): CoreAssetBytes {
  return { sqlWasm: new Uint8Array([0, 0x61, 0x73, 0x6d]).buffer, fonts: { 'DejaVuSans.ttf': new Uint8Array([1, 2, 3]).buffer } };
}

/**
 * The options every boot of these tests passes: assets without a network and a memory storage,
 * so that the fetch mock below sees API requests only. Individual tests override what they probe.
 */
function offline(options: BootOptions = {}): BootOptions {
  return { loadAssets: async () => fakeAssets(), createStorage: () => new MemoryStorage(), ...options };
}

describe('mobile boot', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = mobileBody();
    window.localStorage.clear();
    window.sessionStorage.clear();
    __resetLocaleForTests();
    __setApiBaseForTests('');
    fetchMock = vi.fn(async () => new Response(JSON.stringify({ via: 'fetch' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    createCoreWorker.mockReset();
  });

  afterEach(() => {
    __resetMobileBootForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    __setApiBaseForTests(null);
    __resetLocaleForTests();
    document.body.innerHTML = '';
  });

  it('the page starts with a busy splash above the empty app root', () => {
    expect(splash()).not.toBeNull();
    expect(splash()?.getAttribute('aria-busy')).toBe('true');
    expect(splash()?.getAttribute('role')).toBe('status');
    expect(splash()?.querySelector('.mobile-splash__message')?.hasAttribute('hidden')).toBe(true);
    expect(document.getElementById('root')).not.toBeNull();
  });

  it('waits for the core, installs the transport, starts the app and removes the splash', async () => {
    const worker = stubWorker();
    const seen: unknown[] = [];
    const start = vi.fn(async () => {
      // The app renders with the transport already in place and the splash still covering it.
      seen.push(splash() ? 'splash' : 'no splash');
      seen.push(await request('/api/health').catch((e: { status?: number }) => e.status));
    });

    await expect(bootMobile(start, offline({ createWorker: () => worker }))).resolves.toBe(true);

    expect(start).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(['splash', 503]);
    expect(splash()).toBeNull();
    expect(getCoreClient()).not.toBeNull();
    expect(createCoreWorker).not.toHaveBeenCalled();

    // Every API request now goes to the core worker - the placeholder answers 503 "core not ready".
    await expect(request('/api/auth/login', { method: 'POST', body: { username: 'dana' }, anonymous: true })).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 503,
      code: 'OTHER',
      message: 'core not ready',
    });
    expect(worker.requests.at(-1)).toMatchObject({ method: 'POST', url: '/api/auth/login', bodyText: '{"username":"dana"}' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the splash and does not start the app until the core posts ready', async () => {
    const worker = new FakeWorker();
    const start = vi.fn();
    const booting = bootMobile(start, offline({ createWorker: () => worker }));
    await flush();
    expect(start).not.toHaveBeenCalled();
    expect(splash()?.getAttribute('aria-busy')).toBe('true');
    expect(getCoreClient()).toBeNull();

    worker.ready();
    await expect(booting).resolves.toBe(true);
    expect(start).toHaveBeenCalledTimes(1);
    expect(splash()).toBeNull();
  });

  it('uses the real core worker by default', async () => {
    const worker = stubWorker();
    createCoreWorker.mockReturnValue(worker);
    await expect(bootMobile(() => undefined, offline())).resolves.toBe(true);
    expect(createCoreWorker).toHaveBeenCalledTimes(1);
  });

  it('a core that reports fatal: no app, the splash shows a localised message, requests stay on fetch', async () => {
    setCurrentLocale('he');
    const worker = new FakeWorker();
    const start = vi.fn();
    const booting = bootMobile(start, offline({ createWorker: () => worker }));
    await flush();
    worker.emit({ type: 'event', name: 'fatal', message: 'no storage' });

    await expect(booting).resolves.toBe(false);
    expect(start).not.toHaveBeenCalled();
    expect(worker.terminated).toBe(true);
    expect(getCoreClient()).toBeNull();

    const shown = splash();
    expect(shown).not.toBeNull();
    expect(shown?.getAttribute('aria-busy')).toBe('false');
    expect(shown?.getAttribute('role')).toBe('alert');
    const message = shown?.querySelector<HTMLElement>('.mobile-splash__message');
    expect(message?.hidden).toBe(false);
    expect(message?.getAttribute('dir')).toBe('auto');
    expect(message?.textContent).toBe('השרת המקומי לא הופעל. סגרו את התוכנה ופתחו אותה מחדש.');
    // The brand line stays.
    expect(shown?.querySelector('.mobile-splash__name')?.textContent).toBe('Your Personal Diary');

    await expect(request('/api/health')).resolves.toEqual({ via: 'fetch' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a core that never becomes ready: gives up after the timeout', async () => {
    vi.useFakeTimers();
    try {
      const worker = new FakeWorker();
      const start = vi.fn();
      const booting = bootMobile(start, offline({ createWorker: () => worker, readyTimeoutMs: 3000 }));
      await vi.advanceTimersByTimeAsync(3000);
      await expect(booting).resolves.toBe(false);
      expect(start).not.toHaveBeenCalled();
      expect(splash()?.querySelector('.mobile-splash__message')?.textContent).toBe(
        'The local server did not start. Close the app and open it again.',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('a worker that cannot even be created is reported the same way', async () => {
    const start = vi.fn();
    const boom = (): never => {
      throw new Error('Worker blocked by the content security policy');
    };
    await expect(bootMobile(start, offline({ createWorker: boom }))).resolves.toBe(false);
    expect(start).not.toHaveBeenCalled();
    expect(splash()?.getAttribute('aria-busy')).toBe('false');
  });

  it('removes the splash on a hidden page too, where no animation frame ever runs', async () => {
    // A WebView / tab in the background never calls requestAnimationFrame callbacks.
    const neverRuns = vi.fn(() => 0);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.stubGlobal('requestAnimationFrame', neverRuns);
    try {
      let done = false;
      const booting = bootMobile(() => undefined, offline({ createWorker: stubWorker })).then((started) => {
        done = true;
        return started;
      });
      await vi.advanceTimersByTimeAsync(FRAME_FALLBACK_MS - 1);
      expect(neverRuns).toHaveBeenCalledTimes(1);
      expect(done).toBe(false);
      expect(splash()).not.toBeNull();

      await vi.advanceTimersByTimeAsync(1);
      await expect(booting).resolves.toBe(true);
      expect(splash()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('removes the splash even when starting the app throws', async () => {
    const start = vi.fn(() => {
      throw new Error('render failed');
    });
    await expect(bootMobile(start, offline({ createWorker: stubWorker }))).resolves.toBe(true);
    expect(splash()).toBeNull();
  });

  it('serves the storage and transfers the assets to the worker before the core is ready', async () => {
    const worker = new FakeWorker();
    const storage = new MemoryStorage();
    await storage.write('marker.txt', new TextEncoder().encode('x'));
    const start = vi.fn();
    const booting = bootMobile(start, offline({ createWorker: () => worker, createStorage: () => storage }));
    await flush();
    // The assets message went out, every buffer in its transfer list, and nothing else was posted yet.
    expect(worker.assets).toHaveLength(1);
    const index = worker.posted.indexOf(worker.assets[0]);
    expect(worker.transfers[index]).toHaveLength(2);
    expect(worker.requests).toEqual([]);
    expect(worker.controls).toEqual([]);

    // The storage is served already: the (not yet ready) core can read its files.
    const rpc: StorageRpcRequest = { type: 'storage-request', id: 1, op: 'read', path: 'marker.txt' };
    worker.emit(rpc);
    await flush();
    const answered = worker.posted.find((m) => m.type === 'storage-response' && m.id === 1);
    expect(answered).toMatchObject({ type: 'storage-response', id: 1, ok: true });
    // (bytes compared as numbers: jsdom and Node have different Uint8Array realms)
    expect([...new Uint8Array((answered as { bytes: ArrayBuffer }).bytes)]).toEqual([120]);

    worker.ready();
    await expect(booting).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('assets that cannot be loaded: no app, the splash shows the failure, the worker is stopped', async () => {
    const worker = new FakeWorker();
    const start = vi.fn();
    const loadAssets = vi.fn(async (): Promise<CoreAssetBytes> => {
      throw new Error('core asset /core-assets/sql-wasm.wasm answered HTTP 404');
    });
    await expect(bootMobile(start, offline({ createWorker: () => worker, loadAssets }))).resolves.toBe(false);
    expect(loadAssets).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();
    expect(worker.assets).toEqual([]);
    expect(worker.terminated).toBe(true);
    expect(splash()?.getAttribute('aria-busy')).toBe('false');
    expect(splash()?.querySelector('.mobile-splash__message')?.textContent).toBe('The local server did not start. Close the app and open it again.');
  });

  it('in a plain browser the storage is memory only and the console says so', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const worker = stubWorker();
    await expect(bootMobile(() => undefined, { createWorker: () => worker, loadAssets: async () => fakeAssets() })).resolves.toBe(true);
    expect(info).toHaveBeenCalledWith(MEMORY_STORAGE_NOTICE);
  });

  it('splash helpers are safe on a page without a splash', () => {
    hideSplash();
    hideSplash();
    expect(splash()).toBeNull();
    expect(() => showSplashError('anything')).not.toThrow();
  });

  it('installs the phone features after the transport and before the app starts; a failure there does not stop the app', async () => {
    const worker = stubWorker();
    const order: string[] = [];
    const installPlatform = vi.fn(async (client: unknown) => {
      order.push('platform');
      expect(client).toBe(getCoreClient());
      // The transport is already the core's: the platform wraps it.
      const response = await request<{ via?: string }>('/api/health');
      expect(response).not.toEqual({ via: 'fetch' });
    });
    const start = vi.fn(() => {
      order.push('start');
    });
    await expect(bootMobile(start, offline({ createWorker: () => worker, installPlatform }))).resolves.toBe(true);
    expect(order).toEqual(['platform', 'start']);

    __resetMobileBootForTests();
    const failing = vi.fn(async () => {
      throw new Error('no plugins here');
    });
    const started = vi.fn();
    await expect(bootMobile(started, offline({ createWorker: () => stubWorker(), installPlatform: failing }))).resolves.toBe(true);
    expect(started).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith('[mobile] the phone features did not install', expect.any(Error));
  });

  it('in a browser the default platform step installs nothing (the Capacitor runtime is absent)', async () => {
    const worker = stubWorker();
    await expect(bootMobile(() => undefined, offline({ createWorker: () => worker }))).resolves.toBe(true);
    // Nothing of mobile/platform was wired: the download seam stays empty.
    const { getPhoneFiles } = await import('@/utils/download');
    expect(getPhoneFiles()).toBeNull();
  });
});
