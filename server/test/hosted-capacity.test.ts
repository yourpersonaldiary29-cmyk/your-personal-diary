/**
 * The owner asked (2026-11-13), after the production volume grew to 20 GB: how many users is the disk
 * enough for? `ServerStatus.capacity` of GET /api/server/status answers it - the model of
 * `ServerCapacity` (shared/types.ts):
 *   usableBytes         = floor(disk.totalBytes x (100 - 15) / 100) - root's reserve   (the warning margin stays free)
 *   countedDiaryBytes   = max(mean diary or 0, 1 MiB)
 *   perUserTypicalBytes = 6 x countedDiaryBytes        (.mpd + .prev, and both again in each of the 2 archives)
 *   usersTypical        = floor(usableBytes / perUserTypicalBytes)
 *   usersAtQuota        = floor(usableBytes / (6 x maxDiaryBytes)), null without a quota
 *
 *   - the formula with the numbers of the 20 GiB volume: 2,901 typical users and 290 even at the full
 *     10 MiB quota (2,842 / 284 with the size statfs really reports on production); a mean above 1 MiB
 *     is used as it is; the blocks only root may fill (statfs bfree - bavail) are never counted;
 *   - the factor 6 is what the real archive writer costs: an archive holds every .mpd and .mpd.prev
 *     uncompressed, and 2 of them stay on the volume;
 *   - the diaries are the users/<id>.mpd files only: their .mpd.prev safety copies, .mpd.tmp files,
 *     other files and folders are not counted; a missing folder is no diaries;
 *   - the route, with a fake data dir and a known statfs result: every field, no diary is opened;
 *     a root reserve lowers the estimate and leaves `disk` as it was; no diaries -> the mean is null and
 *     the 1 MiB floor applies; no quota -> usersAtQuota null; a disk that cannot be measured -> capacity null;
 *   - the real hosted server counts the diaries its accounts write (and not their .prev copies).
 * Fictional data only.
 */
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import supertest from 'supertest';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
  SERVER_CAPACITY_COPIES,
  SERVER_DISK_LOW_PCT,
  SERVER_TYPICAL_DIARY_BYTES,
  type AuthResponse,
  type ServerCapacity,
  type ServerStatus,
} from '@shared/types';
import { loadConfig, loadHostedEnv } from '../src/config';
import { startHosted, type RunningHosted } from '../src/hosted';
import { ARCHIVE_KEEP, createArchiveController } from '../src/hosted/archive';
import { diaryFiles, serverCapacity, volumeStats } from '../src/routes/server-status';
import { TEST_ACCOUNT, cleanupTempDirs, makeTestApp, tempDataDir, testConfig, testHostedOptions } from './helpers';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const HOST = 'diary.example';
const QUOTA = 10 * MIB;
/** The fields that say how the server made its estimate (the same for every estimate of this server). */
const MODEL = { copies: 6, keptFreePct: 15 } as const;

const running: RunningHosted[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  for (const r of running.splice(0)) await r.stop();
});
afterAll(cleanupTempDirs);

/**
 * `fs.statfsSync` of `dir` answers a volume of `totalBytes` with `freeBytes` free for the server
 * (`bavail`) and `reservedBytes` more free for root only (`bfree - bavail`; 4 KiB blocks); every other
 * path the real answer.
 */
function stubVolume(dir: string, totalBytes: number, freeBytes: number, reservedBytes = 0) {
  const real = fs.statfsSync;
  const bsize = 4096;
  return vi.spyOn(fs, 'statfsSync').mockImplementation(((target: fs.PathLike) => {
    if (path.resolve(String(target)) !== path.resolve(dir)) return real(target);
    return {
      type: 0xef53,
      bsize,
      blocks: totalBytes / bsize,
      bfree: (freeBytes + reservedBytes) / bsize,
      bavail: freeBytes / bsize,
      files: 0,
      ffree: 0,
    } as fs.StatsFs;
  }) as typeof fs.statfsSync);
}

/** A file of exactly `size` bytes (zeros). */
function writeSized(file: string, size: number): void {
  fs.writeFileSync(file, Buffer.alloc(size));
}

/** Every path below `dir` that is opened or read through node:fs while the spies are installed. */
function watchReads(dir: string): string[] {
  const seen: string[] = [];
  const root = path.resolve(dir);
  const note = (target: unknown) => {
    const text = String(target);
    if (path.resolve(text).startsWith(root)) seen.push(text);
  };
  const realOpen = fs.promises.open;
  vi.spyOn(fs.promises, 'open').mockImplementation(((...args: Parameters<typeof fs.promises.open>) => {
    note(args[0]);
    return realOpen(...args);
  }) as typeof fs.promises.open);
  const realReadFile = fs.promises.readFile;
  vi.spyOn(fs.promises, 'readFile').mockImplementation(((...args: Parameters<typeof fs.promises.readFile>) => {
    note(args[0]);
    return realReadFile(...args);
  }) as typeof fs.promises.readFile);
  const realOpenSync = fs.openSync;
  vi.spyOn(fs, 'openSync').mockImplementation(((...args: Parameters<typeof fs.openSync>) => {
    note(args[0]);
    return realOpenSync(...args);
  }) as typeof fs.openSync);
  const realReadFileSync = fs.readFileSync;
  vi.spyOn(fs, 'readFileSync').mockImplementation(((...args: Parameters<typeof fs.readFileSync>) => {
    note(args[0]);
    return realReadFileSync(...args);
  }) as typeof fs.readFileSync);
  return seen;
}

/** The owner's GET /api/server/status of a test app on `dataDir` (fake auth: the owner is TEST_ACCOUNT). */
async function statusOf(dataDir: string, maxDiaryBytes = QUOTA): Promise<ServerStatus> {
  const app = await makeTestApp({ config: testConfig(dataDir), hosted: testHostedOptions({ ownerId: () => TEST_ACCOUNT.id, maxDiaryBytes }) });
  const res = await app.get('/api/server/status').set('Host', HOST).set('X-Forwarded-Proto', 'https');
  expect(res.status).toBe(200);
  return res.body as ServerStatus;
}

describe('the model (serverCapacity)', () => {
  it('a 20 GiB volume: about 2,900 typical users and 290 even if every diary fills the 10 MiB quota', () => {
    // The model's constants, as shared/types.ts states them.
    expect([SERVER_CAPACITY_COPIES, SERVER_TYPICAL_DIARY_BYTES, SERVER_DISK_LOW_PCT]).toEqual([6, MIB, 15]);
    // The diaries of production on 2026-11-13: 53-135 KB each, far below the 1 MiB of a typical diary.
    const today = { count: 4, totalBytes: 4 * 94_000 };
    const exact: ServerCapacity = {
      usableBytes: 18_253_611_008, // floor(21,474,836,480 x 85 / 100)
      averageDiaryBytes: 94_000,
      diaries: 4,
      perUserTypicalBytes: 6_291_456, // 6 x 1 MiB
      usersTypical: 2_901, // floor(18,253,611,008 / 6,291,456) = floor(2,901.33)
      usersAtQuota: 290, // floor(18,253,611,008 / 62,914,560) = floor(290.13)
      countedDiaryBytes: MIB,
      ...MODEL,
    };
    expect(serverCapacity(20 * GIB, today, QUOTA)).toEqual(exact);
    // The size statfs reports for the production volume (20,545,068 KiB: the file system keeps the rest).
    expect(serverCapacity(20_545_068 * 1024, today, QUOTA)).toEqual({
      ...exact,
      usableBytes: 17_882_427_187, // floor(21,038,149,632 x 85 / 100) = floor(17,882,427,187.2)
      usersTypical: 2_842, // floor(2,842.34)
      usersAtQuota: 284, // floor(284.23)
    });
    // ext4's default reserve for root, 5 % (1 GiB of 20 GiB): the server can never fill it.
    expect(serverCapacity(20 * GIB, today, QUOTA, GIB)).toEqual({
      ...exact,
      usableBytes: 17_179_869_184, // 18,253,611,008 - 1,073,741,824 = 16 GiB
      usersTypical: 2_730, // floor(16 GiB / 6 MiB) = floor(2,730.67)
      usersAtQuota: 273, // floor(16 GiB / 60 MiB) = floor(273.07)
    });
    // A reserve above the usable bytes leaves nothing (never a negative estimate).
    expect(serverCapacity(GIB, today, QUOTA, 2 * GIB)).toMatchObject({ usableBytes: 0, usersTypical: 0, usersAtQuota: 0 });
  });

  it('a mean above 1 MiB counts as it is; no diaries -> null and the 1 MiB floor; no quota -> usersAtQuota null', () => {
    // Diaries of 2 and 4 MiB: each account counts 6 x 3 MiB.
    const big = serverCapacity(20 * GIB, { count: 2, totalBytes: 6 * MIB }, QUOTA);
    expect(big).toEqual({
      usableBytes: 18_253_611_008,
      averageDiaryBytes: 3 * MIB,
      diaries: 2,
      perUserTypicalBytes: 18 * MIB,
      usersTypical: 967, // floor(967.11)
      usersAtQuota: 290,
      countedDiaryBytes: 3 * MIB,
      ...MODEL,
    });
    // The mean is rounded to whole bytes.
    expect(serverCapacity(20 * GIB, { count: 2, totalBytes: 201 }, QUOTA).averageDiaryBytes).toBe(101);
    const none = serverCapacity(20 * GIB, { count: 0, totalBytes: 0 }, 0);
    expect(none).toEqual({
      usableBytes: 18_253_611_008,
      averageDiaryBytes: null,
      diaries: 0,
      perUserTypicalBytes: 6 * MIB,
      usersTypical: 2_901,
      usersAtQuota: null,
      countedDiaryBytes: MIB,
      ...MODEL,
    });
    // The old 3 GiB volume, for comparison with the runbook's careful rule at the quota (85 % of the disk / 60 MB).
    expect(serverCapacity(3 * GIB, { count: 0, totalBytes: 0 }, QUOTA)).toMatchObject({ usersTypical: 435, usersAtQuota: 43 });
  });

  it('the factor 6 is what the real archive writer costs: every .mpd and .mpd.prev again, uncompressed, in each of the 2 archives kept', async () => {
    const dataDir = tempDataDir();
    const users = path.join(dataDir, 'users');
    fs.mkdirSync(users, { recursive: true });
    // Encrypted diaries do not compress - random bytes stand in for them - and a safety copy is about as big as its diary.
    const sizes = [53_000, 90_000, 110_000, 135_000];
    sizes.forEach((size, i) => {
      fs.writeFileSync(path.join(users, `u_${i}.mpd`), randomBytes(size));
      fs.writeFileSync(path.join(users, `u_${i}.mpd.prev`), randomBytes(size));
    });
    let at = Date.parse('2026-11-13T10:00:00.000Z');
    const archive = createArchiveController({ dataDir, kdf: { N: 1024, r: 8, p: 1 }, cooldownMs: 0, now: () => at, log: () => {} });
    // One more than are kept: the oldest goes once the newest is written.
    for (let i = 0; i <= ARCHIVE_KEEP; i++) {
      await archive.create('a passphrase that is long enough');
      at += 60_000;
    }
    expect(ARCHIVE_KEEP).toBe(2);
    expect(archive.list()).toHaveLength(ARCHIVE_KEEP);
    const bytesIn = (dir: string, take: (name: string) => boolean) =>
      fs
        .readdirSync(dir)
        .filter(take)
        .reduce((sum, name) => sum + fs.statSync(path.join(dir, name)).size, 0);
    const diaries = sizes.reduce((sum, size) => sum + size, 0);
    const onVolume = bytesIn(users, (n) => n.endsWith('.mpd') || n.endsWith('.mpd.prev')) + bytesIn(path.join(dataDir, 'archive'), (n) => n.endsWith('.mpda'));
    // (diary + safety copy) x (1 + 2 archives), plus the tar headers and the encryption's few bytes.
    expect(onVolume / diaries).toBeGreaterThanOrEqual(SERVER_CAPACITY_COPIES);
    expect(onVolume / diaries).toBeLessThan(SERVER_CAPACITY_COPIES * 1.05);
  });
});

describe('the diaries on the volume (diaryFiles)', () => {
  it('counts users/<id>.mpd only - not .prev, .tmp, other files or folders - and a missing folder is none', async () => {
    const users = path.join(tempDataDir(), 'users');
    fs.mkdirSync(users);
    writeSized(path.join(users, 'u_a.mpd'), 100_000);
    writeSized(path.join(users, 'u_b.mpd'), 200_000);
    writeSized(path.join(users, 'u_c.mpd'), 300_000);
    writeSized(path.join(users, 'u_a.mpd.prev'), 3_000_000);
    writeSized(path.join(users, 'u_b.mpd.prev'), 190_000);
    writeSized(path.join(users, 'u_c.mpd.tmp'), 2_000_000);
    writeSized(path.join(users, 'device.key'), 32);
    writeSized(path.join(users, 'notes.txt'), 50);
    fs.mkdirSync(path.join(users, 'old.mpd'));
    writeSized(path.join(users, 'old.mpd', 'u_x.mpd'), 999_999);
    expect(await diaryFiles(users)).toEqual({ count: 3, totalBytes: 600_000 });
    expect(await diaryFiles(path.join(users, 'missing'))).toEqual({ count: 0, totalBytes: 0 });
  });
});

describe('GET /api/server/status: capacity', () => {
  it('a fake data dir on a 20 GiB volume: every field, from the sizes of the diaries alone (nothing is opened)', async () => {
    const dataDir = tempDataDir();
    const users = path.join(dataDir, 'users');
    fs.mkdirSync(users);
    writeSized(path.join(users, 'u_a.mpd'), 100_000);
    writeSized(path.join(users, 'u_b.mpd'), 200_000);
    writeSized(path.join(users, 'u_c.mpd'), 300_000);
    // The safety copies would raise the mean to 900,000 if they were counted.
    writeSized(path.join(users, 'u_a.mpd.prev'), 3_000_000);
    writeSized(path.join(users, 'u_c.mpd.tmp'), 100);
    stubVolume(dataDir, 20 * GIB, 17 * GIB);
    const app = await makeTestApp({ config: testConfig(dataDir), hosted: testHostedOptions({ ownerId: () => TEST_ACCOUNT.id, maxDiaryBytes: QUOTA }) });
    const opened = watchReads(users);

    const res = await app.get('/api/server/status').set('Host', HOST).set('X-Forwarded-Proto', 'https');
    expect(res.status).toBe(200);
    const status = res.body as ServerStatus;
    expect(status.disk).toEqual({ totalBytes: 20 * GIB, freeBytes: 17 * GIB, freePct: 85 });
    expect(status.capacity).toEqual({
      usableBytes: 18_253_611_008,
      averageDiaryBytes: 200_000,
      diaries: 3,
      perUserTypicalBytes: 6 * MIB,
      usersTypical: 2_901,
      usersAtQuota: 290,
      countedDiaryBytes: MIB,
      ...MODEL,
    });
    expect(opened).toEqual([]);
    // The watch itself works: a read of a diary is seen (readFileSync opens through fs.openSync as well).
    fs.readFileSync(path.join(users, 'u_a.mpd'));
    expect(opened.length).toBeGreaterThan(0);
    expect(opened.every((p) => p.endsWith('u_a.mpd'))).toBe(true);
  });

  it('a volume that keeps blocks for root: the estimate leaves them out, the disk row stays what the server may fill', async () => {
    const dataDir = tempDataDir();
    // 20 GiB, 1 GiB of it (ext4's 5 %) free for root only, 17 GiB free for the server.
    stubVolume(dataDir, 20 * GIB, 17 * GIB, GIB);
    expect(volumeStats(dataDir)).toEqual({ disk: { totalBytes: 20 * GIB, freeBytes: 17 * GIB, freePct: 85 }, reservedBytes: GIB });
    const status = await statusOf(dataDir);
    expect(status.disk).toEqual({ totalBytes: 20 * GIB, freeBytes: 17 * GIB, freePct: 85 });
    expect(status.diskLow).toBe(false);
    expect(status.capacity).toEqual({
      usableBytes: 17_179_869_184,
      averageDiaryBytes: null,
      diaries: 0,
      perUserTypicalBytes: 6 * MIB,
      usersTypical: 2_730,
      usersAtQuota: 273,
      countedDiaryBytes: MIB,
      ...MODEL,
    });
  });

  it('no diaries: the mean is null and every account counts the 1 MiB floor - also when the users folder is missing', async () => {
    const dataDir = tempDataDir();
    stubVolume(dataDir, 20 * GIB, 20 * GIB);
    const empty = await statusOf(dataDir);
    // loadConfig creates the users folder: it is there, and empty.
    expect(fs.readdirSync(path.join(dataDir, 'users'))).toEqual([]);
    const expected: ServerCapacity = {
      usableBytes: 18_253_611_008,
      averageDiaryBytes: null,
      diaries: 0,
      perUserTypicalBytes: 6 * MIB,
      usersTypical: 2_901,
      usersAtQuota: 290,
      countedDiaryBytes: MIB,
      ...MODEL,
    };
    expect(empty.capacity).toEqual(expected);

    const app = await makeTestApp({ config: testConfig(dataDir), hosted: testHostedOptions({ ownerId: () => TEST_ACCOUNT.id, maxDiaryBytes: QUOTA }) });
    fs.rmSync(path.join(dataDir, 'users'), { recursive: true });
    const missing = await app.get('/api/server/status').set('Host', HOST).set('X-Forwarded-Proto', 'https');
    expect(missing.status).toBe(200);
    expect((missing.body as ServerStatus).capacity).toEqual(expected);
  });

  it('no quota (DIARY_MAX_DIARY_BYTES=0): only the typical estimate', async () => {
    const dataDir = tempDataDir();
    stubVolume(dataDir, 20 * GIB, 20 * GIB);
    const status = await statusOf(dataDir, 0);
    expect(status.maxDiaryBytes).toBe(0);
    expect(status.capacity).toMatchObject({ usersTypical: 2_901, usersAtQuota: null });
  });

  it('a disk that cannot be measured: capacity null (as disk)', async () => {
    const dataDir = tempDataDir();
    const real = fs.statfsSync;
    vi.spyOn(fs, 'statfsSync').mockImplementation(((target: fs.PathLike) => {
      if (path.resolve(String(target)) === path.resolve(dataDir)) throw Object.assign(new Error('not supported'), { code: 'ENOSYS' });
      return real(target);
    }) as typeof fs.statfsSync);
    const status = await statusOf(dataDir);
    expect(status.disk).toBeNull();
    expect(status.capacity).toBeNull();
  });
});

describe('the real hosted server', () => {
  it('counts the diaries its accounts write in users/, not their .prev safety copies', async () => {
    const dataDir = tempDataDir();
    const env = loadHostedEnv({ DIARY_MODE: 'hosted', DIARY_PUBLIC_URL: `https://${HOST}`, DIARY_BIND: '127.0.0.1' });
    const config = loadConfig(['--data-dir', dataDir], { DIARY_MODE: 'hosted' });
    let ownerId = '';
    const srv = await startHosted(config, env, { port: 0, quiet: true, auth: { kdf: { N: 1024, r: 8, p: 1 } }, ownerId: () => ownerId });
    running.push(srv);
    const agent = supertest(srv.localUrl);
    const register = async (username: string, ip: string) => {
      const password = 'Passw0rd!';
      const res = await agent
        .post('/api/auth/register')
        .set('Host', HOST)
        .set('X-Forwarded-Proto', 'https')
        .set('X-Forwarded-For', ip)
        .set('Accept-Language', 'en')
        .send({ firstName: 'Test', lastName: 'User', username, email: `${username}@example.com`, password, confirmPassword: password, privacyAccepted: true, termsAccepted: true });
      expect(res.status).toBe(201);
      return res.body as AuthResponse;
    };
    const owner = await register('capowner', '203.0.113.7');
    await register('capother', '203.0.113.8');
    ownerId = owner.user.id;

    // The new diaries are saved once more with their language a moment later: wait for both .prev copies.
    const users = path.join(dataDir, 'users');
    const settled = () => {
      const names = fs.readdirSync(users);
      return names.filter((n) => n.endsWith('.mpd.prev')).length === 2 && !names.some((n) => n.endsWith('.tmp'));
    };
    for (let i = 0; i < 100 && !settled(); i++) await new Promise((r) => setTimeout(r, 50));
    expect(settled()).toBe(true);

    const res = await agent.get('/api/server/status').set('Host', HOST).set('X-Forwarded-Proto', 'https').set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    const status = res.body as ServerStatus;
    const sizes = fs
      .readdirSync(users)
      .filter((n) => n.endsWith('.mpd'))
      .map((n) => fs.statSync(path.join(users, n)).size);
    expect(sizes).toHaveLength(2);
    expect(status.disk).not.toBeNull();
    // The real volume of the test machine, with whatever it keeps for root (a constant of the file system).
    const volume = volumeStats(config.dataDir);
    expect(volume?.disk.totalBytes).toBe(status.disk!.totalBytes);
    expect(status.capacity).toEqual(serverCapacity(status.disk!.totalBytes, { count: 2, totalBytes: sizes[0] + sizes[1] }, 10 * MIB, volume!.reservedBytes));
    expect(status.capacity).toMatchObject({ diaries: 2, perUserTypicalBytes: 6 * MIB, countedDiaryBytes: MIB, ...MODEL });
  });
});
