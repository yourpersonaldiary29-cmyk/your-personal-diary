// @vitest-environment node
/**
 * Randomised failure schedules against the VFS (mobile/core/vfs/vfs.ts) - seeded, so every run is
 * the same. A script of registry saves, diary saves, account deletions and drains (the write
 * patterns of server/src) runs on a storage that, at random,
 *
 *   - refuses a call (nothing happens),
 *   - carries a call out and reports it as timed out (what the worker sees when the main thread
 *     answers too late: mobile/core/vfs/rpc-backend.ts),
 *   - and, in the "kill" campaigns, stops answering for good at some call - once cleanly, once in
 *     the middle of a write.
 *
 * What must hold however the dice fall:
 *
 *   without a kill   once the storage works again, drain() succeeds within three calls, nothing is
 *                    out of sync, the storage holds exactly the files of the mirror (no temporary
 *                    file, no stray copy) and a restart loads exactly those;
 *   after a kill     the restart finds no temporary file; no registry is damaged, gone, or older
 *                    than a version that was reported as stored; a diary opens (`.mpd`, else
 *                    `.mpd.tmp`, else `.mpd.prev` - as security/vault.ts does) with a version that
 *                    is not older than one reported as stored; a diary whose deletion was reported
 *                    as stored does not come back.
 *
 * "Reported as stored": the fs.promises calls of the save resolved, or a drain() resolved.
 *
 * A second script (`treeScenario`) changes files AND directories at random - mkdir, rm -r, renames
 * of directories, also onto an empty directory - and is killed at a random storage call (no other
 * failures): the restart must find the whole tree, directories included, exactly as the core had it
 * at some moment, and not older than the last state a drain() reported as stored.
 */
import { describe, expect, it } from 'vitest';
import fs, { installVfs } from '../../core/vfs/node-fs';
import { Vfs } from '../../core/vfs/vfs';
import { MemoryStorage } from '../../host/storage/memory';
import { StorageError, type StorageBackend, type StorageEntry, type StorageStat } from '../../shared/storage-protocol';
import { text } from './helpers';

/** mulberry32: a small deterministic generator. */
function rng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hang<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}

interface ChaosConfig {
  /** Probability that a call is refused. */
  pFail: number;
  /** Probability that a mutating call is carried out and then reported as timed out. */
  pTimeout: number;
  /** Whether stat / list / read fail too. */
  failReads: boolean;
  /** Whether the process is killed at a random mutating call. */
  kill: boolean;
}

class ChaoticStorage implements StorageBackend {
  enabled = false;
  dead = false;
  killAt = 0;
  torn = false;
  mutations = 0;
  /** Every call with its fate, for the report of a broken invariant. */
  readonly log: string[] = [];
  private announce: () => void = () => undefined;
  readonly crashed: Promise<void>;

  constructor(
    readonly inner: MemoryStorage,
    private readonly rand: () => number,
    private readonly config: ChaosConfig,
  ) {
    this.crashed = new Promise<void>((resolve) => {
      this.announce = resolve;
    });
  }

  private async run<T>(label: string, mutating: boolean, perform: () => Promise<T>, tornWrite?: () => Promise<void>): Promise<T> {
    if (this.dead) return hang();
    if (mutating) {
      this.mutations++;
      if (this.killAt && this.mutations === this.killAt) {
        this.dead = true;
        if (this.torn && tornWrite) await tornWrite().catch(() => undefined);
        this.log.push(`KILL at ${label}`);
        this.announce();
        return hang();
      }
    }
    if (this.enabled && (mutating || this.config.failReads)) {
      const r = this.rand();
      if (r < this.config.pFail) {
        this.log.push(`REFUSED ${label}`);
        throw new StorageError('EIO', `EIO: refused (${label})`);
      }
      if (mutating && r < this.config.pFail + this.config.pTimeout) {
        await perform();
        this.log.push(`RAN, REPORTED AS TIMED OUT ${label}`);
        throw new StorageError('ETIMEDOUT', `ETIMEDOUT: no answer in time (${label})`);
      }
    }
    this.log.push(label);
    return perform();
  }

  list(dir: string): Promise<StorageEntry[]> {
    return this.run(`list ${dir}`, false, () => this.inner.list(dir));
  }
  read(path: string): Promise<Uint8Array> {
    return this.run(`read ${path}`, false, () => this.inner.read(path));
  }
  write(path: string, bytes: Uint8Array): Promise<void> {
    return this.run(
      `write ${path}`,
      true,
      () => this.inner.write(path, bytes),
      () => this.inner.write(path, bytes.subarray(0, bytes.byteLength >> 1)),
    );
  }
  rename(from: string, to: string): Promise<void> {
    return this.run(`rename ${from} -> ${to}`, true, () => this.inner.rename(from, to));
  }
  remove(path: string): Promise<void> {
    return this.run(`remove ${path}`, true, () => this.inner.remove(path));
  }
  mkdir(path: string): Promise<void> {
    return this.run(`mkdir ${path}`, true, () => this.inner.mkdir(path));
  }
  stat(path: string): Promise<StorageStat | null> {
    return this.run(`stat ${path}`, false, () => this.inner.stat(path));
  }
}

/** A recognisable content: half of it, or a mix of two, is "damaged". */
const content = (name: string, n: number): string => `${name}#${n}#${'x'.repeat(150 + (n % 37))}#END`;

function versionOf(name: string, value: string): number | 'damaged' {
  const match = /^(.+)#(\d+)#x+#END$/.exec(value);
  if (!match || match[1] !== name) return 'damaged';
  const n = Number(match[2]);
  return content(name, n) === value ? n : 'damaged';
}

/** Every file below /data with its text, by storage path. */
function mirrorFiles(dir = '/data', out: Record<string, string> = {}): Record<string, string> {
  for (const name of fs.readdirSync(dir) as string[]) {
    const path = `${dir}/${name}`;
    if (fs.statSync(path)?.isDirectory()) mirrorFiles(path, out);
    else out[path.slice('/data/'.length)] = fs.readFileSync(path, 'utf8') as string;
  }
  return out;
}

const sorted = (files: Record<string, string>): string => JSON.stringify(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1)));

const REGISTRIES = ['accounts.json', 'sessions.json', 'resets.json'];
const DIARIES = ['u_1', 'u_2'];
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs one seeded schedule; returns the broken invariants (empty: all held). */
async function scenario(seed: number, config: ChaosConfig): Promise<string[]> {
  const problems: string[] = [];
  const rand = rng(seed);
  const store = new MemoryStorage();
  const chaos = new ChaoticStorage(store, rand, config);
  const vfs = new Vfs({ backend: chaos, log: () => undefined });
  installVfs(vfs);
  await vfs.boot();
  fs.mkdirSync('/data/users', { recursive: true });
  await vfs.drain();
  chaos.enabled = true;
  chaos.mutations = 0;
  if (config.kill) {
    chaos.killAt = 1 + Math.floor(rand() * 60);
    chaos.torn = rand() < 0.5;
  }

  /** The newest version the core wrote, the newest reported as stored, and the same for deletions. */
  const written: Record<string, number> = {};
  const stored: Record<string, number> = {};
  const deleted: Record<string, boolean> = {};
  const deletionStored: Record<string, boolean> = {};
  const trace: string[] = [];

  const diaryPath = (id: string): string => `/data/users/${id}.mpd`;
  const openedVersion = (id: string): number | 'absent' | 'damaged' => {
    for (const file of [diaryPath(id), `${diaryPath(id)}.tmp`, `${diaryPath(id)}.prev`]) {
      if (fs.existsSync(file)) return versionOf(id, fs.readFileSync(file, 'utf8') as string);
    }
    return 'absent';
  };
  /** The facade may only ever fail with EIO. */
  const expectEio = (e: unknown, where: string): void => {
    const code = (e as { code?: string }).code;
    if (code !== 'EIO') problems.push(`seed ${seed}: ${where} threw ${code}: ${(e as Error).message}`);
  };

  /** security/accounts.ts: <file>.tmp, fsync, rename over the file - all synchronous. */
  function saveRegistry(name: string): void {
    const n = (written[name] = (written[name] ?? 0) + 1);
    trace.push(`save ${name} v${n}`);
    try {
      const fd = fs.openSync(`/data/${name}.tmp`, 'w', 0o600);
      try {
        fs.writeSync(fd, content(name, n), null, 'utf8');
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      fs.renameSync(`/data/${name}.tmp`, `/data/${name}`);
    } catch (e) {
      expectEio(e, `save ${name}`);
    }
  }

  /** security/vault.ts: .mpd.tmp + fsync, .mpd -> .mpd.prev, .mpd.tmp -> .mpd. */
  async function saveDiary(id: string): Promise<void> {
    if (deleted[id]) return;
    const n = (written[id] = (written[id] ?? 0) + 1);
    trace.push(`save ${id} v${n}`);
    const file = diaryPath(id);
    try {
      let handle: Awaited<ReturnType<typeof fs.promises.open>> | null = null;
      try {
        handle = await fs.promises.open(`${file}.tmp`, 'w', 0o600);
        await handle.writeFile(content(id, n));
        await handle.sync();
      } finally {
        await handle?.close();
      }
      let there = true;
      try {
        await fs.promises.access(file);
      } catch {
        there = false;
      }
      if (there) await fs.promises.rename(file, `${file}.prev`);
      await fs.promises.rename(`${file}.tmp`, file);
      if (!chaos.dead) {
        stored[id] = Math.max(stored[id] ?? 0, n);
        trace.push(`save ${id} v${n} resolved`);
      }
    } catch (e) {
      expectEio(e, `save ${id}`);
      trace.push(`save ${id} v${n} failed`);
    }
  }

  /** deleteVaultFiles() of security/vault.ts. */
  async function deleteDiary(id: string): Promise<void> {
    if (deleted[id] || !written[id]) return;
    deleted[id] = true;
    trace.push(`delete ${id}`);
    const file = diaryPath(id);
    try {
      for (const path of [file, `${file}.prev`, `${file}.tmp`]) await fs.promises.rm(path, { force: true });
      if (!chaos.dead) {
        deletionStored[id] = true;
        trace.push(`delete ${id} resolved`);
      }
    } catch (e) {
      expectEio(e, `delete ${id}`);
    }
  }

  async function drain(): Promise<void> {
    const seen: Record<string, number> = {};
    for (const name of REGISTRIES) {
      if (!fs.existsSync(`/data/${name}`)) continue;
      const v = versionOf(name, fs.readFileSync(`/data/${name}`, 'utf8') as string);
      if (typeof v === 'number') seen[name] = v;
    }
    const gone: string[] = [];
    for (const id of DIARIES) {
      const v = openedVersion(id);
      if (typeof v === 'number') seen[id] = v;
      if (deleted[id] && v === 'absent') gone.push(id);
    }
    trace.push('drain');
    try {
      await vfs.drain();
      if (chaos.dead) return;
      trace.push('drain resolved');
      for (const [key, v] of Object.entries(seen)) stored[key] = Math.max(stored[key] ?? 0, v);
      for (const id of gone) deletionStored[id] = true;
    } catch (e) {
      expectEio(e, 'drain');
      trace.push('drain rejected');
    }
  }

  const pick = <T>(list: T[]): T => list[Math.floor(rand() * list.length)];
  const script = async (): Promise<void> => {
    for (let step = 0; step < 45; step++) {
      if (chaos.dead) return;
      const r = rand();
      if (r < 0.3) saveRegistry(pick(REGISTRIES));
      else if (r < 0.55) await saveDiary(pick(DIARIES));
      else if (r < 0.6) await deleteDiary(pick(DIARIES));
      else if (r < 0.7) {
        // A registry is saved while a diary save is under way (two requests at once).
        const id = pick(DIARIES);
        const name = pick(REGISTRIES);
        await Promise.all([saveDiary(id), Promise.resolve().then(() => saveRegistry(name))]);
      } else if (r < 0.9) await drain();
      else await sleep(0);
    }
  };
  await Promise.race([script(), chaos.crashed]);

  const report = (what: string): void => {
    problems.push(`seed ${seed}: ${what}\n   core: ${trace.slice(-14).join(' | ')}\n   storage: ${chaos.log.slice(-18).join(' | ')}`);
  };

  if (chaos.dead) {
    // The app starts again on what the dead process left behind.
    const fresh = new Vfs({ backend: store, log: () => undefined });
    installVfs(fresh);
    try {
      await fresh.boot();
    } catch (e) {
      report(`boot after the kill failed: ${(e as Error).message}`);
      return problems;
    }
    const leftovers = [...store.files().keys()].filter((path) => /\.(tmp|old)-\d+$/.test(path));
    if (leftovers.length) report(`temporary files after the boot: ${leftovers.join(', ')}`);
    for (const name of REGISTRIES) {
      const path = `/data/${name}`;
      if (!fs.existsSync(path)) {
        if (stored[name]) report(`${name} is gone although v${stored[name]} was stored`);
        continue;
      }
      const v = versionOf(name, fs.readFileSync(path, 'utf8') as string);
      if (v === 'damaged') report(`${name} is damaged`);
      else if (v < (stored[name] ?? 0)) report(`${name} went back to v${v}; v${stored[name]} was stored`);
    }
    for (const id of DIARIES) {
      const file = diaryPath(id);
      for (const path of [file, `${file}.tmp`, `${file}.prev`]) {
        if (fs.existsSync(path) && versionOf(id, fs.readFileSync(path, 'utf8') as string) === 'damaged') report(`${path} is damaged`);
      }
      const opened = openedVersion(id);
      if (deletionStored[id]) {
        if (opened !== 'absent') report(`the deleted diary ${id} is back (v${String(opened)})`);
        continue;
      }
      if (deleted[id] || !stored[id]) continue;
      if (opened === 'absent') report(`diary ${id} is gone although v${stored[id]} was stored`);
      else if (typeof opened === 'number' && opened < stored[id]) report(`diary ${id} opens v${opened}; v${stored[id]} was stored`);
    }
    return problems;
  }

  // No kill: the storage works again, everything must end up stored.
  chaos.enabled = false;
  let drained = false;
  for (let i = 0; i < 3 && !drained; i++) {
    try {
      await vfs.drain();
      drained = true;
    } catch {
      /* reports the failure from before; the next call stores */
    }
  }
  if (!drained) report('drain() still rejects after three calls on a healthy storage');
  if (vfs.outOfSync().length) report(`still out of sync: ${vfs.outOfSync().join(', ')}`);
  const mirror = mirrorFiles();
  const disk: Record<string, string> = {};
  for (const [path, bytes] of store.files()) disk[path] = text(bytes);
  if (sorted(disk) !== sorted(mirror)) {
    const onlyDisk = Object.keys(disk).filter((k) => !(k in mirror));
    const onlyMirror = Object.keys(mirror).filter((k) => !(k in disk));
    const differ = Object.keys(mirror).filter((k) => k in disk && disk[k] !== mirror[k]);
    report(`storage != mirror after a clean drain: only stored [${onlyDisk.join(', ')}], only in the mirror [${onlyMirror.join(', ')}], different [${differ.join(', ')}]`);
  }
  const fresh = new Vfs({ backend: store, log: () => undefined });
  installVfs(fresh);
  await fresh.boot();
  const after = mirrorFiles();
  if (sorted(after) !== sorted(mirror)) {
    const extra = Object.keys(after).filter((k) => !(k in mirror));
    const missing = Object.keys(mirror).filter((k) => !(k in after));
    const differ = Object.keys(mirror).filter((k) => k in after && after[k] !== mirror[k]);
    report(`a restart loads other files: extra [${extra.join(', ')}], missing [${missing.join(', ')}], different [${differ.join(', ')}]`);
  }
  return problems;
}

/** A block of consecutive seeds, plus seeds that broke an invariant before the fix they are named after. */
function seeds(from: number, count: number, pinned: number[] = []): number[] {
  return [...Array.from({ length: count }, (_, i) => from + i), ...pinned];
}

const CAMPAIGNS: Array<{ name: string; config: ChaosConfig; seeds: number[] }> = [
  { name: 'kills only', config: { pFail: 0, pTimeout: 0, failReads: false, kill: true }, seeds: seeds(1000, 40) },
  { name: 'refused mutating calls', config: { pFail: 0.12, pTimeout: 0, failReads: false, kill: false }, seeds: seeds(2000, 40) },
  { name: 'refused calls of every kind', config: { pFail: 0.12, pTimeout: 0, failReads: true, kill: false }, seeds: seeds(3000, 40, PINNED_REFUSED()) },
  { name: 'refused calls, then a kill', config: { pFail: 0.1, pTimeout: 0, failReads: true, kill: true }, seeds: seeds(4000, 40, PINNED_REFUSED_KILL()) },
  { name: 'calls that ran but were reported as timed out', config: { pFail: 0, pTimeout: 0.1, failReads: false, kill: false }, seeds: seeds(5000, 40) },
  { name: 'timed-out calls, then a kill', config: { pFail: 0, pTimeout: 0.1, failReads: false, kill: true }, seeds: seeds(6000, 40, PINNED_TIMEOUT_KILL()) },
  { name: 'refused and timed-out calls mixed, then a kill', config: { pFail: 0.07, pTimeout: 0.07, failReads: true, kill: true }, seeds: seeds(7000, 40) },
];

/** Function declarations are hoisted: the pinned seeds can be listed below the table. */
function PINNED_REFUSED(): number[] {
  return [];
}
function PINNED_REFUSED_KILL(): number[] {
  return [];
}
function PINNED_TIMEOUT_KILL(): number[] {
  return [];
}

/** Everything below /data as one string: `dir/` for a directory, `path=content` for a file, sorted. */
function treeOf(dir = '/data', out: string[] = []): string {
  for (const name of fs.readdirSync(dir) as string[]) {
    const path = `${dir}/${name}`;
    if (fs.statSync(path)?.isDirectory()) {
      out.push(`${path}/`);
      treeOf(path, out);
    } else {
      out.push(`${path}=${fs.readFileSync(path, 'utf8') as string}`);
    }
  }
  return dir === '/data' ? JSON.stringify(out.sort()) : '';
}

/** Every name in the storage (files and directories) that the VFS uses for its temporary files. */
async function storedLeftovers(store: MemoryStorage, dir = '', out: string[] = []): Promise<string[]> {
  for (const entry of await store.list(dir)) {
    const path = dir ? `${dir}/${entry.name}` : entry.name;
    if (/\.(tmp|old)-\d+$/.test(entry.name)) out.push(path);
    if (entry.type === 'directory') await storedLeftovers(store, path, out);
  }
  return out;
}

const TREE_DIRS = ['d1', 'd2', 'd3', 'd1/s', 'd2/s'];
const TREE_FILES = ['a', 'b'];

/**
 * Files AND directories: random writes, renames, deletes, mkdir, rm -r and directory renames (also
 * onto an empty directory), killed at a random storage call. The restart must find the tree exactly
 * as the core had it at some moment - directories included - and not older than the last state a
 * drain() reported as stored. Returns the broken invariants (empty: all held).
 */
async function treeScenario(seed: number): Promise<string[]> {
  const problems: string[] = [];
  const rand = rng(seed);
  const store = new MemoryStorage();
  const chaos = new ChaoticStorage(store, rand, { pFail: 0, pTimeout: 0, failReads: false, kill: true });
  const vfs = new Vfs({ backend: chaos, log: () => undefined });
  installVfs(vfs);
  await vfs.boot();
  fs.mkdirSync('/data/d1');
  fs.writeFileSync('/data/d1/a', content('d1/a', 0));
  fs.mkdirSync('/data/d2');
  await vfs.drain();
  chaos.mutations = 0;
  chaos.killAt = 1 + Math.floor(rand() * 40);
  chaos.torn = rand() < 0.5;

  /** The trees the core went through, and the index of the last one a drain() reported as stored. */
  const states = [treeOf()];
  let storedIndex = 0;
  const trace: string[] = [];
  const pick = <T>(list: T[]): T => list[Math.floor(rand() * list.length)];
  const file = (): string => `/data/${pick(TREE_DIRS)}/${pick(TREE_FILES)}`;
  const directory = (): string => `/data/${pick(TREE_DIRS)}`;
  /** One change of the core. What Node would refuse too (ENOENT, ENOTEMPTY, ...) is simply not done. */
  const change = (what: string, run: () => void): void => {
    try {
      run();
      trace.push(what);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (!code || code === 'EIO') problems.push(`seed ${seed}: ${what} threw ${String(code)}: ${(e as Error).message}`);
    }
    states.push(treeOf());
  };

  let version = 0;
  for (let step = 0; step < 30 && !chaos.dead; step++) {
    const r = rand();
    if (r < 0.2) {
      const path = file();
      change(`write ${path}`, () => fs.writeFileSync(path, content(path.slice('/data/'.length), ++version)));
    } else if (r < 0.3) {
      const [from, to] = [file(), file()];
      change(`rename ${from} -> ${to}`, () => fs.renameSync(from, to));
    } else if (r < 0.38) {
      const path = file();
      change(`rm ${path}`, () => fs.rmSync(path));
    } else if (r < 0.58) {
      const path = directory();
      change(`mkdir ${path}`, () => fs.mkdirSync(path));
    } else if (r < 0.66) {
      const path = directory();
      change(`rm -r ${path}`, () => fs.rmSync(path, { recursive: true }));
    } else if (r < 0.9) {
      const [from, to] = [directory(), directory()];
      change(`rename dir ${from} -> ${to}`, () => fs.renameSync(from, to));
    } else if (r < 0.95) {
      const index = states.length - 1;
      const outcome = await Promise.race([vfs.drain().then(() => 'stored'), chaos.crashed.then(() => 'killed')]);
      if (outcome === 'stored' && !chaos.dead) storedIndex = index;
      trace.push(`drain (${outcome})`);
    } else {
      // The queue gets a few turns: the next changes are made while earlier ones are on their way.
      for (let turns = 1 + Math.floor(rand() * 8); turns > 0; turns--) await Promise.resolve();
    }
  }
  if (!chaos.dead) {
    const index = states.length - 1;
    const outcome = await Promise.race([vfs.drain().then(() => 'stored'), chaos.crashed.then(() => 'killed')]);
    if (outcome === 'stored' && !chaos.dead) storedIndex = index;
  }

  // The app starts again on what the process left behind (killed, or simply stopped after its last drain).
  const fresh = new Vfs({ backend: store, log: () => undefined });
  installVfs(fresh);
  const report = (what: string): void => {
    problems.push(`seed ${seed}: ${what}\n   core: ${trace.slice(-10).join(' | ')}\n   storage: ${chaos.log.slice(-10).join(' | ')}`);
  };
  try {
    await fresh.boot();
  } catch (e) {
    report(`boot after the kill failed: ${(e as Error).message}`);
    return problems;
  }
  const found = treeOf();
  if (!states.includes(found)) report(`the restart finds a tree the core never had: ${found}`);
  else if (!states.slice(storedIndex).includes(found)) report(`the restart finds a tree older than the one reported as stored: ${found}`);
  const leftovers = await storedLeftovers(store);
  if (leftovers.length) report(`temporary names after the boot: ${leftovers.join(', ')}`);
  return problems;
}

describe('VFS under random storage failures (seeded)', () => {
  it.each(CAMPAIGNS)('$name', async ({ config, seeds: list }) => {
    const problems: string[] = [];
    for (const seed of list) problems.push(...(await scenario(seed, config)));
    expect(problems.join('\n')).toBe('');
  }, 120_000);

  // Among these seeds 8014, 8066, 8132, 8233, 8236 and 8331 lost the empty target of a directory rename
  // while the VFS still deleted that directory before the rename instead of moving it aside.
  it('files and directories, killed at a random storage call: the restart finds a tree the core had', async () => {
    const problems: string[] = [];
    for (const seed of seeds(8000, 400)) problems.push(...(await treeScenario(seed)));
    expect(problems.join('\n')).toBe('');
  }, 120_000);

  // For hunting: TREE_SEEDS=1-5000
  it.runIf(process.env.TREE_SEEDS)('files and directories: a range of seeds from the environment', async () => {
    const [from, to] = (process.env.TREE_SEEDS as string).split('-').map(Number);
    const problems: string[] = [];
    for (let seed = from; seed <= to; seed++) problems.push(...(await treeScenario(seed)));
    expect(problems.join('\n')).toBe('');
  }, 600_000);

  // For hunting: CHAOS_SEEDS=20000-25000 CHAOS_CONFIG='{"pFail":0.1,"pTimeout":0,"failReads":true,"kill":true}'
  it.runIf(process.env.CHAOS_SEEDS)('a range of seeds from the environment', async () => {
    const config = JSON.parse(process.env.CHAOS_CONFIG as string) as ChaosConfig;
    const [from, to] = (process.env.CHAOS_SEEDS as string).split('-').map(Number);
    const problems: string[] = [];
    for (let seed = from; seed <= to; seed++) problems.push(...(await scenario(seed, config)));
    expect(problems.join('\n')).toBe('');
  }, 600_000);
});
