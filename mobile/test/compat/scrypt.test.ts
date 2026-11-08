// @vitest-environment node
/**
 * scrypt of the Android core (mobile/core/shims/crypto.ts, @noble/hashes) against RFC 7914 and
 * against Node's node:crypto - the implementation the desktop uses. A diary encrypted on one
 * platform opens on the other only if both derive the same 64 bytes from the same password.
 *
 *   - the RFC 7914 test vectors through the shim;
 *   - 60 passwords (empty, long, NFKC-sensitive, Hebrew, Arabic, CJK, emoji) and 2 that are not
 *     well-formed UTF-16 (they end in unpaired lead surrogates) with the app's real
 *     parameters (N=2^15, r=8, p=1): shim === node:crypto on the raw bytes, and the app's own
 *     deriveSecret (server/src/security/kdf.ts) run on the shims === run on Node === the vectors
 *     file written by scripts/mobile/make-fixtures.mjs;
 *   - Node's argument and parameter checks;
 *   - the derivation does not block the event loop; how long it takes.
 */
import nodeCrypto from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as shimKdf from '../../../server/src/security/kdf';
import { Buffer as PolyfillBuffer } from '../../core/shims/buffer';
import * as shim from '../../core/shims/crypto';
import { loadKdfVectors, type KdfVector } from './fixtures';
import { openNativeServer, type NativeServer } from './native-server';

const APP = { N: 32768, r: 8, p: 1 };
const APP_MAXMEM = 256 * 1024 * 1024;

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('hex');
}

function shimScrypt(password: shim.BinaryLike, salt: shim.BinaryLike, keylen: number, options: shim.ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    shim.scrypt(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/** What a call throws, as `{ name, code }` (null when it does not throw). */
function thrown(run: () => unknown): { name: string; code: string | undefined } | null {
  try {
    run();
    return null;
  } catch (e) {
    const error = e as Error & { code?: string };
    return { name: error.name, code: error.code };
  }
}

describe('scrypt: RFC 7914 test vectors (section 12)', () => {
  const vectors = [
    {
      password: '',
      salt: '',
      N: 16,
      r: 1,
      p: 1,
      expected:
        '77d6576238657b203b19ca42c18a0497f16b4844e3074ae8dfdffa3fede21442fcd0069ded0948f8326a753a0fc81f17e8d3e0fb2e0d3628cf35e20c38d18906',
    },
    {
      password: 'password',
      salt: 'NaCl',
      N: 1024,
      r: 8,
      p: 16,
      expected:
        'fdbabe1c9d3472007856e7190d01e9fe7c6ad7cbc8237830e77376634b3731622eaf30d92e22a3886ff109279d9830dac727afb94a83ee6d8360cbdfa2cc0640',
    },
    {
      password: 'pleaseletmein',
      salt: 'SodiumChloride',
      N: 16384,
      r: 8,
      p: 1,
      expected:
        '7023bdcb3afd7348461c06cd81fd38ebfda8fbba904f8e3ea9b543f6545da1f2d5432955613f0fcf62d49705242a9af9e61e85dc0d651e40dfcf017b45575887',
    },
  ];

  for (const v of vectors) {
    it(`N=${v.N}, r=${v.r}, p=${v.p} ("${v.password}", "${v.salt}"): sync and async`, async () => {
      expect(hex(shim.scryptSync(v.password, v.salt, 64, { N: v.N, r: v.r, p: v.p }))).toBe(v.expected);
      expect(hex(await shimScrypt(v.password, v.salt, 64, { N: v.N, r: v.r, p: v.p }))).toBe(v.expected);
      // The option aliases of Node.
      expect(hex(shim.scryptSync(v.password, v.salt, 64, { cost: v.N, blockSize: v.r, parallelization: v.p }))).toBe(v.expected);
    });
  }

  // The fourth vector (N=2^20) needs a 1 GiB table; run it with MPD_SCRYPT_1GB=1.
  it.skipIf(process.env.MPD_SCRYPT_1GB !== '1')(
    'N=1048576, r=8, p=1 ("pleaseletmein", "SodiumChloride")',
    async () => {
      const key = await shimScrypt('pleaseletmein', 'SodiumChloride', 64, { N: 1048576, r: 8, p: 1, maxmem: 2 * 1024 * 1024 * 1024 });
      expect(hex(key)).toBe(
        '2101cb9b6a511aaeaddbbe09cf70f881ec568d574a2ffd4dabe5ee9820adaa478e56fd8f4ba5d09ffa1c6d927c40f4c337304049e8a952fbcbf45c6fa77a41a4',
      );
    },
    180_000,
  );
});

describe('scrypt: the 60 passwords (+2 malformed ones), with the parameters of the app (N=2^15, r=8, p=1)', () => {
  const file = loadKdfVectors();
  const vectors: KdfVector[] = file.vectors;
  let native: NativeServer;
  let nodeKdf: typeof shimKdf;

  beforeAll(async () => {
    native = await openNativeServer();
    nodeKdf = await native.load<typeof shimKdf>('security/kdf');
  }, 120_000);

  afterAll(async () => {
    await native?.close();
  });

  it('the vectors file has the 60 passwords, in every group the plan names, and 2 that end in unpaired lead surrogates', () => {
    expect(file.kdf).toEqual(APP);
    expect(shimKdf.DEFAULT_KDF).toEqual(APP);
    expect(vectors).toHaveLength(62);
    expect(new Set(vectors.map((v) => v.password)).size).toBe(62);
    // Strings that end in two or more unpaired lead surrogates: the npm Buffer polyfill alone
    // encodes them with one U+FFFD too few (see buffer-node.test.ts).
    const malformedEnd = vectors.filter((v) => /[\ud800-\udbff]{2}$/.test(v.password));
    expect(malformedEnd.map((v) => v.label)).toEqual(['two lone lead surrogates at the end', 'three lone lead surrogates']);
    expect(Buffer.from(malformedEnd[0].password, 'utf8').toString('hex')).toMatch(/(efbfbd){2}$/);
    const labels = vectors.map((v) => v.label).join('\n');
    for (const group of ['empty', 'NFKC', 'hebrew', 'arabic', 'chinese', 'japanese', 'korean', 'emoji', '4096 characters']) {
      expect(labels, group).toContain(group);
    }
    expect(vectors.filter((v) => v.label.startsWith('NFKC')).length).toBeGreaterThanOrEqual(10);
    expect(Math.max(...vectors.map((v) => Buffer.byteLength(v.password, 'utf8')))).toBeGreaterThan(4096);
  });

  it('the modules under test are the two implementations: shims here, Node there', () => {
    // The shimmed kdf.ts returns polyfill Buffers; the native one returns Node Buffers.
    expect(shimKdf.newSalt()).toBeInstanceOf(PolyfillBuffer);
    expect(Buffer.isBuffer(shimKdf.newSalt())).toBe(false);
    expect(Buffer.isBuffer(nodeKdf.newSalt())).toBe(true);
    expect(nodeKdf).not.toBe(shimKdf);
  });

  it(
    'shim scrypt === node:crypto scrypt on the raw password bytes',
    () => {
      for (const v of vectors) {
        const password = Buffer.from(v.password, 'utf8');
        const salt = Buffer.from(v.saltHex, 'hex');
        const expected = nodeCrypto.scryptSync(password, salt, 64, { ...APP, maxmem: APP_MAXMEM }).toString('hex');
        // The sync form here; the async form (what the app calls) is the deriveSecret test below.
        const actual = hex(shim.scryptSync(password, salt, 64, { ...APP, maxmem: APP_MAXMEM }));
        expect(actual, v.label).toBe(expected);
      }
    },
    240_000,
  );

  it(
    "the app's deriveSecret: on the shims === on Node === the vectors file",
    async () => {
      for (const v of vectors) {
        const onShims = await shimKdf.deriveSecret(v.password, PolyfillBuffer.from(v.saltHex, 'hex'));
        const onNode = await nodeKdf.deriveSecret(v.password, Buffer.from(v.saltHex, 'hex'));
        expect(onShims, v.label).toBeInstanceOf(PolyfillBuffer);
        expect(hex(onShims), v.label).toBe(onNode.toString('hex'));
        expect(hex(onShims), v.label).toBe(v.secretHex);

        // The two halves the app uses: the diary key and the password verifier.
        const a = shimKdf.splitSecret(onShims);
        const b = nodeKdf.splitSecret(onNode);
        expect(hex(a.key), v.label).toBe(b.key.toString('hex'));
        expect(shimKdf.verifierHex(a.verifierSource), v.label).toBe(nodeKdf.verifierHex(b.verifierSource));
      }
    },
    240_000,
  );

  it('NFKC: passwords that normalise to the same text give the same secret, others do not', async () => {
    const salt = PolyfillBuffer.alloc(16, 9);
    const derive = async (password: string): Promise<string> => hex(await shimKdf.deriveSecret(password, salt));
    expect(await derive('ｐａｓｓｗｏｒｄ')).toBe(await derive('password'));
    expect(await derive('Café 123')).toBe(await derive('Café 123'));
    expect(await derive('①②③')).toBe(await derive('123'));
    expect(await derive('שׁ')).toBe(await derive('שׁ'));
    expect(await derive('password')).not.toBe(await derive('Password'));
    // On the raw bytes (no normalisation) the same pairs differ: the equality above is the NFKC step.
    const raw = (password: string): string => hex(shim.scryptSync(Buffer.from(password, 'utf8'), salt, 64, { ...APP, maxmem: APP_MAXMEM }));
    expect(raw('ｐａｓｓｗｏｒｄ')).not.toBe(raw('password'));
  }, 60_000);

  it('deriveSecret rejects what the desktop rejects', async () => {
    await expect(shimKdf.deriveSecret('x', PolyfillBuffer.alloc(15))).rejects.toMatchObject({ code: 'CRYPTO' });
    await expect(shimKdf.deriveSecret('x', PolyfillBuffer.alloc(16), { N: 1000, r: 8, p: 1 })).rejects.toMatchObject({ code: 'CRYPTO' });
  });
});

describe('scrypt: arguments and parameters like Node', () => {
  const password = Buffer.from('pw');
  const salt = Buffer.from('salt');

  it('accepts strings, Buffers, typed arrays, DataViews and ArrayBuffers alike', () => {
    const expected = nodeCrypto.scryptSync('pässword', 'sält', 32, { N: 1024, r: 8, p: 1 }).toString('hex');
    const pw = Buffer.from('pässword', 'utf8');
    const s = Buffer.from('sält', 'utf8');
    const copy = (b: Buffer): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
    expect(hex(shim.scryptSync('pässword', 'sält', 32, { N: 1024, r: 8, p: 1 }))).toBe(expected);
    expect(hex(shim.scryptSync(pw, s, 32, { N: 1024 }))).toBe(expected);
    expect(hex(shim.scryptSync(new Uint8Array(pw), new DataView(copy(s)), 32, { N: 1024 }))).toBe(expected);
    expect(hex(shim.scryptSync(copy(pw), PolyfillBuffer.from(s), 32, { N: 1024 }))).toBe(expected);
  });

  it('uses the defaults of Node (N=16384, r=8, p=1) and treats 0 as "default"', async () => {
    const expected = nodeCrypto.scryptSync(password, salt, 32).toString('hex');
    expect(hex(shim.scryptSync(password, salt, 32))).toBe(expected);
    expect(hex(shim.scryptSync(password, salt, 32, { N: 0, r: 0, p: 0, maxmem: 0 }))).toBe(expected);
    const viaCallback = await new Promise<Buffer>((resolve, reject) => shim.scrypt(password, salt, 32, (err, key) => (err ? reject(err) : resolve(key))));
    expect(hex(viaCallback)).toBe(expected);
  });

  it('derives keys of other lengths, including 0 and lengths above one PBKDF2 block', () => {
    for (const keylen of [0, 1, 16, 31, 32, 33, 64, 65, 100]) {
      const expected = nodeCrypto.scryptSync(password, salt, keylen, { N: 1024, r: 8, p: 2 }).toString('hex');
      expect(hex(shim.scryptSync(password, salt, keylen, { N: 1024, r: 8, p: 2 })), `keylen ${keylen}`).toBe(expected);
    }
  });

  it('throws synchronously, with the codes of Node, for bad parameters', () => {
    const cases: Array<[string, shim.ScryptOptions]> = [
      ['N not a power of two', { N: 1000 }],
      ['N = 1', { N: 1 }],
      ['memory above maxmem (the default 32 MiB is too small for the app parameters)', { N: 32768, r: 8, p: 1 }],
      ['memory above an explicit maxmem', { N: 1024, r: 8, p: 1, maxmem: 1024 * 1024 }],
      ['N together with cost', { N: 1024, cost: 1024 }],
      ['negative N', { N: -1 }],
    ];
    const noop = (): void => undefined;
    for (const [label, options] of cases) {
      const onNode = thrown(() => nodeCrypto.scryptSync(password, salt, 32, options));
      const onShim = thrown(() => shim.scryptSync(password, salt, 32, options));
      const onShimAsync = thrown(() => shim.scrypt(password, salt, 32, options, noop));
      expect(onNode, label).not.toBeNull();
      expect(onShim, label).toEqual(onNode);
      expect(onShimAsync, label).toEqual(onNode);
    }
    // Exactly at the limit OpenSSL computes (128*r*p + 128*r*(N+2) bytes): accepted by both.
    const exact = 128 * 8 * 1 + 128 * 8 * (1024 + 2);
    expect(thrown(() => nodeCrypto.scryptSync(password, salt, 8, { N: 1024, maxmem: exact }))).toBeNull();
    expect(thrown(() => shim.scryptSync(password, salt, 8, { N: 1024, maxmem: exact }))).toBeNull();
    expect(thrown(() => nodeCrypto.scryptSync(password, salt, 8, { N: 1024, maxmem: exact - 1 }))).not.toBeNull();
    expect(thrown(() => shim.scryptSync(password, salt, 8, { N: 1024, maxmem: exact - 1 }))).not.toBeNull();
  });

  it('throws for arguments of the wrong type, with the codes of Node', () => {
    const bad: Array<[string, () => unknown, () => unknown]> = [
      ['password', () => nodeCrypto.scryptSync(5 as never, salt, 8), () => shim.scryptSync(5 as never, salt, 8)],
      ['salt', () => nodeCrypto.scryptSync(password, null as never, 8), () => shim.scryptSync(password, null as never, 8)],
      ['keylen type', () => nodeCrypto.scryptSync(password, salt, '8' as never), () => shim.scryptSync(password, salt, '8' as never)],
      ['keylen range', () => nodeCrypto.scryptSync(password, salt, -1), () => shim.scryptSync(password, salt, -1)],
    ];
    for (const [label, onNode, onShim] of bad) {
      expect(thrown(onNode), label).not.toBeNull();
      expect(thrown(onShim), label).toEqual(thrown(onNode));
    }
    expect(thrown(() => shim.scrypt(password, salt, 8, {}, undefined as never))).toMatchObject({ code: 'ERR_INVALID_ARG_TYPE' });
  });

  it('a wiped password buffer does not change a derivation that is already running', async () => {
    const pw = Buffer.from('wipe me afterwards');
    const expected = nodeCrypto.scryptSync(pw, salt, 32, { N: 4096 }).toString('hex');
    const pending = shimScrypt(pw, salt, 32, { N: 4096 });
    pw.fill(0);
    expect(hex(await pending)).toBe(expected);
  });
});

describe('scrypt: event loop and speed', () => {
  afterAll(() => {
    shim.setScryptYieldInterval(50);
    shim.setScryptBackend(null);
  });

  it('the async derivation lets timers run while it computes (it does not block the worker)', async () => {
    shim.setScryptYieldInterval(5);
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
    }, 1);
    try {
      await shimScrypt('non-blocking', Buffer.alloc(16, 1), 64, { ...APP, maxmem: APP_MAXMEM });
      const duringAsync = ticks;
      expect(duringAsync).toBeGreaterThanOrEqual(3);
      // The sync form runs in one piece: no timer can fire in between.
      ticks = 0;
      shim.scryptSync('blocking', Buffer.alloc(16, 1), 64, { ...APP, maxmem: APP_MAXMEM });
      expect(ticks).toBe(0);
    } finally {
      clearInterval(timer);
      shim.setScryptYieldInterval(50);
    }
  }, 60_000);

  describe('on a host that has scheduler.yield() (Chromium - the Android WebView)', () => {
    /**
     * Chromium resumes the continuation of `scheduler.yield()` BEFORE the tasks that are already
     * waiting (timers, `message` events). A microtask continuation is the same thing seen from a
     * timer: it never gets a turn. @noble/hashes prefers `scheduler.yield()` when it exists, and
     * Node has no global `scheduler` - so without this fake no test here runs the path a WebView takes.
     */
    interface FakeScheduler {
      yield: ReturnType<typeof vi.fn>;
      postTask: () => void;
    }
    const scope = globalThis as unknown as { scheduler?: unknown };
    const globalPrototype = Object.getPrototypeOf(globalThis) as { scheduler?: unknown };
    const options = { ...APP, maxmem: APP_MAXMEM };

    function fakeScheduler(): FakeScheduler {
      return { yield: vi.fn(() => Promise.resolve()), postTask: () => undefined };
    }

    /** Runs one derivation with a 1 ms interval timer beside it; resolves with the key and the number of timer turns. */
    async function deriveBesideATimer(password: string): Promise<{ keyHex: string; ticks: number; seen: unknown[] }> {
      let ticks = 0;
      const seen: unknown[] = [];
      const timer = setInterval(() => {
        ticks += 1;
        seen.push(scope.scheduler);
      }, 1);
      try {
        const key = await shimScrypt(password, Buffer.alloc(16, 1), 64, options);
        return { keyHex: hex(key), ticks, seen };
      } finally {
        clearInterval(timer);
      }
    }

    beforeAll(() => {
      expect(scope.scheduler, 'Node has no global scheduler: the tests below install one').toBeUndefined();
    });

    afterEach(() => {
      delete scope.scheduler;
      delete globalPrototype.scheduler;
      shim.setScryptYieldInterval(50);
    });

    it('the derivation gives timers a turn, never calls scheduler.yield(), and leaves the scheduler in place afterwards', async () => {
      const fake = fakeScheduler();
      const descriptor = { value: fake, configurable: true, writable: true, enumerable: true };
      Object.defineProperty(scope, 'scheduler', descriptor);
      shim.setScryptYieldInterval(5);

      const { keyHex, ticks, seen } = await deriveBesideATimer('non-blocking');

      expect(keyHex).toBe(nodeCrypto.scryptSync('non-blocking', Buffer.alloc(16, 1), 64, options).toString('hex'));
      expect(ticks).toBeGreaterThanOrEqual(3);
      expect(fake.yield).not.toHaveBeenCalled();
      // While the key is derived the scheduler is hidden (that is what sends @noble/hashes to the timer) ...
      expect(seen.every((value) => value === undefined)).toBe(true);
      // ... and afterwards it is back exactly as it was.
      expect(scope.scheduler).toBe(fake);
      expect(Object.getOwnPropertyDescriptor(scope, 'scheduler')).toEqual(descriptor);
    }, 60_000);

    it('a scheduler that is an accessor (as on a WorkerGlobalScope) is hidden and restored as that accessor', async () => {
      const fake = fakeScheduler();
      const get = (): FakeScheduler => fake;
      Object.defineProperty(scope, 'scheduler', { get, set: undefined, configurable: true, enumerable: true });
      shim.setScryptYieldInterval(5);

      const { ticks } = await deriveBesideATimer('accessor');

      expect(ticks).toBeGreaterThanOrEqual(3);
      expect(fake.yield).not.toHaveBeenCalled();
      expect(Object.getOwnPropertyDescriptor(scope, 'scheduler')).toEqual({ get, set: undefined, configurable: true, enumerable: true });
    }, 60_000);

    it('a scheduler inherited from the prototype of the global object is hidden and comes back', async () => {
      const fake = fakeScheduler();
      Object.defineProperty(globalPrototype, 'scheduler', { get: () => fake, configurable: true, enumerable: true });
      expect(scope.scheduler).toBe(fake);
      shim.setScryptYieldInterval(5);

      const { ticks } = await deriveBesideATimer('inherited');

      expect(ticks).toBeGreaterThanOrEqual(3);
      expect(fake.yield).not.toHaveBeenCalled();
      expect(Object.getOwnPropertyDescriptor(scope, 'scheduler')).toBeUndefined();
      expect(scope.scheduler).toBe(fake);
    }, 60_000);

    it('two derivations at once: the scheduler comes back only when the last one is done', async () => {
      const fake = fakeScheduler();
      scope.scheduler = fake;
      shim.setScryptYieldInterval(5);
      const salt = Buffer.alloc(16, 2);

      const long = shimScrypt('first', salt, 64, options);
      const short = shimScrypt('second', salt, 32, { N: 1024, r: 8, p: 1 });
      expect(scope.scheduler).toBeUndefined();
      const shortKey = await short;
      // The short one is done, the long one still runs: still hidden.
      expect(scope.scheduler).toBeUndefined();
      const longKey = await long;

      expect(scope.scheduler).toBe(fake);
      expect(fake.yield).not.toHaveBeenCalled();
      expect(hex(shortKey)).toBe(nodeCrypto.scryptSync('second', salt, 32, { N: 1024, r: 8, p: 1 }).toString('hex'));
      expect(hex(longKey)).toBe(nodeCrypto.scryptSync('first', salt, 64, options).toString('hex'));
    }, 60_000);

    it('a scheduler installed while a key is derived is not overwritten when the derivation ends', async () => {
      scope.scheduler = fakeScheduler();
      const pending = shimScrypt('replaced', Buffer.alloc(16, 4), 32, { N: 4096, r: 8, p: 1 });
      const later = fakeScheduler();
      scope.scheduler = later;
      await pending;
      expect(scope.scheduler).toBe(later);
    });

    it('a scheduler that cannot be hidden: the key is still right (the derivation then cannot yield on such a host)', async () => {
      const fake = fakeScheduler();
      const frozenScope = {} as { scheduler?: unknown };
      Object.defineProperty(frozenScope, 'scheduler', { value: fake, configurable: false, writable: false });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      try {
        const restore = shim.hideHostScheduler(frozenScope);
        expect(frozenScope.scheduler).toBe(fake);
        expect(warn).toHaveBeenCalledTimes(1);
        restore();
        expect(frozenScope.scheduler).toBe(fake);
      } finally {
        warn.mockRestore();
      }
    });

    it('the sync form, parameter errors and a replacement backend do not touch the scheduler', async () => {
      const fake = fakeScheduler();
      scope.scheduler = fake;
      shim.scryptSync('pw', 'salt', 16, { N: 1024 });
      expect(scope.scheduler).toBe(fake);
      expect(thrown(() => shim.scrypt('pw', 'salt', 16, { N: 1000 }, () => undefined))).not.toBeNull();
      expect(scope.scheduler).toBe(fake);
      shim.setScryptBackend(async (_password, _salt, job) => {
        expect(scope.scheduler).toBe(fake);
        return new Uint8Array(job.dkLen);
      });
      try {
        await shimScrypt('pw', 'salt', 16, { N: 1024 });
      } finally {
        shim.setScryptBackend(null);
      }
      expect(scope.scheduler).toBe(fake);
    });
  });

  it('a replacement backend (the hash-wasm hook) is used by the async form and must return the right length', async () => {
    const calls: shim.ScryptJob[] = [];
    shim.setScryptBackend(async (password, salt, job) => {
      calls.push(job);
      return new Uint8Array(nodeCrypto.scryptSync(password, salt, job.dkLen, { N: job.N, r: job.r, p: job.p, maxmem: APP_MAXMEM }));
    });
    const expected = nodeCrypto.scryptSync('pw', 'salt', 64, { ...APP, maxmem: APP_MAXMEM }).toString('hex');
    expect(hex(await shimScrypt('pw', 'salt', 64, { ...APP, maxmem: APP_MAXMEM }))).toBe(expected);
    expect(calls).toEqual([{ ...APP, dkLen: 64 }]);

    shim.setScryptBackend(async () => new Uint8Array(3));
    await expect(shimScrypt('pw', 'salt', 64, { ...APP, maxmem: APP_MAXMEM })).rejects.toThrow(/wrong length/);
    shim.setScryptBackend(null);
    expect(hex(await shimScrypt('pw', 'salt', 64, { ...APP, maxmem: APP_MAXMEM }))).toBe(expected);
  }, 60_000);

  it('timing with the parameters of the app, 3 runs (reported; the phone will be slower)', async () => {
    const salt = Buffer.alloc(16, 3);
    const shimMs: number[] = [];
    const nodeMs: number[] = [];
    for (let run = 0; run < 3; run++) {
      let start = performance.now();
      await shimScrypt(`timing ${run}`, salt, 64, { ...APP, maxmem: APP_MAXMEM });
      shimMs.push(Math.round(performance.now() - start));
      start = performance.now();
      nodeCrypto.scryptSync(`timing ${run}`, salt, 64, { ...APP, maxmem: APP_MAXMEM });
      nodeMs.push(Math.round(performance.now() - start));
    }
    console.info(`[scrypt timing] N=2^15 r=8 p=1, 64 bytes - shim (@noble/hashes, async): ${shimMs.join(' / ')} ms; node:crypto: ${nodeMs.join(' / ')} ms`);
    // A sanity bound only (a loaded CI machine is slow); the real target is measured on the phone.
    expect(Math.min(...shimMs)).toBeLessThan(10_000);
  }, 120_000);
});
