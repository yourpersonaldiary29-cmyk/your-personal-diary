// @vitest-environment node
/**
 * Crash safety of the VFS (docs/ANDROID-PLAN.md, WP-4): the "process" is killed at EVERY storage
 * call a change consists of - after the temporary file was written, before a rename, between two
 * renames, before the clean-up - once cleanly and once in the middle of a write that leaves half a
 * file behind. After each kill a new VFS boots on the same storage and must find
 *
 *   - a state the core actually produced: the files as they were after some step of the change
 *     (never a mix, never a half-written file), and
 *   - no temporary file left in the storage.
 *
 * The scenarios are the write patterns of server/src: a plain write, the JSON registries
 * (`<file>.tmp` + rename), the diary (`.mpd.tmp`, `.mpd` -> `.mpd.prev`, `.mpd.tmp` -> `.mpd`), deletes
 * and directory moves. The same patterns driven by the real server modules are in
 * server-modules.test.ts.
 */
import { describe, expect, it } from 'vitest';
import fs, { installVfs } from '../../core/vfs/node-fs';
import { Vfs } from '../../core/vfs/vfs';
import { FaultyStorage, STORAGE_KINDS, text, type StorageFixture } from './helpers';

type Snapshot = Record<string, string>;

/** Every file below /data with its text, plus `dir/` for every directory. */
function snapshot(dir = '/data', out: Snapshot = {}): Snapshot {
  for (const name of fs.readdirSync(dir) as string[]) {
    const path = `${dir}/${name}`;
    if (fs.statSync(path)?.isDirectory()) {
      out[`${path}/`] = '';
      snapshot(path, out);
    } else {
      out[path] = fs.readFileSync(path, 'utf8') as string;
    }
  }
  return out;
}

/** Long enough that half of it is recognisably not the whole. */
const content = (label: string): string => `${label}:${label.repeat(40)}:${label}`;

interface Scenario {
  name: string;
  /** Brings the storage into its starting state (stored completely before the change begins). */
  prepare(): void;
  /** The change, one step per call of the core into node:fs. */
  steps: Array<() => void>;
}

const SCENARIOS: Scenario[] = [
  {
    name: 'the first write of a file',
    prepare: () => undefined,
    steps: [() => fs.writeFileSync('/data/device.key', content('key'))],
  },
  {
    name: 'replacing a file',
    prepare: () => fs.writeFileSync('/data/server-settings.json', content('old')),
    steps: [() => fs.writeFileSync('/data/server-settings.json', content('new'))],
  },
  {
    name: 'a JSON registry: <file>.tmp, then rename over the file',
    prepare: () => fs.writeFileSync('/data/accounts.json', content('v1')),
    steps: [
      () => {
        const fd = fs.openSync('/data/accounts.json.tmp', 'w', 0o600);
        fs.writeSync(fd, content('v2'), null, 'utf8');
        fs.fsyncSync(fd);
        fs.closeSync(fd);
      },
      () => fs.renameSync('/data/accounts.json.tmp', '/data/accounts.json'),
    ],
  },
  {
    name: 'a registry saved twice in a row',
    prepare: () => fs.writeFileSync('/data/sessions.json', content('v1')),
    steps: [
      () => fs.writeFileSync('/data/sessions.json.tmp', content('v2')),
      () => fs.renameSync('/data/sessions.json.tmp', '/data/sessions.json'),
      () => fs.writeFileSync('/data/sessions.json.tmp', content('v3')),
      () => fs.renameSync('/data/sessions.json.tmp', '/data/sessions.json'),
    ],
  },
  {
    name: 'the diary: .mpd.tmp, .mpd -> .mpd.prev, .mpd.tmp -> .mpd',
    prepare: () => {
      fs.mkdirSync('/data/users', { recursive: true });
      fs.writeFileSync('/data/users/u_1.mpd', content('v1'));
      fs.writeFileSync('/data/users/u_1.mpd.prev', content('v0'));
    },
    steps: [
      () => fs.writeFileSync('/data/users/u_1.mpd.tmp', content('v2')),
      () => fs.renameSync('/data/users/u_1.mpd', '/data/users/u_1.mpd.prev'),
      () => fs.renameSync('/data/users/u_1.mpd.tmp', '/data/users/u_1.mpd'),
    ],
  },
  {
    name: 'the very first save of a diary',
    prepare: () => fs.mkdirSync('/data/users', { recursive: true }),
    steps: [
      () => fs.writeFileSync('/data/users/u_1.mpd.tmp', content('v1')),
      () => fs.renameSync('/data/users/u_1.mpd.tmp', '/data/users/u_1.mpd'),
    ],
  },
  {
    name: 'deleting an account: registry first, then the diary files',
    prepare: () => {
      fs.mkdirSync('/data/users', { recursive: true });
      fs.writeFileSync('/data/accounts.json', content('two accounts'));
      fs.writeFileSync('/data/users/u_1.mpd', content('diary'));
      fs.writeFileSync('/data/users/u_1.mpd.prev', content('previous diary'));
    },
    steps: [
      () => fs.writeFileSync('/data/accounts.json.tmp', content('one account')),
      () => fs.renameSync('/data/accounts.json.tmp', '/data/accounts.json'),
      () => fs.rmSync('/data/users/u_1.mpd', { force: true }),
      () => fs.rmSync('/data/users/u_1.mpd.prev', { force: true }),
      () => fs.rmSync('/data/users/u_1.mpd.tmp', { force: true }),
    ],
  },
  {
    name: 'directories: create, fill, move, remove',
    prepare: () => fs.writeFileSync('/data/x', content('x')),
    steps: [
      () => fs.mkdirSync('/data/a/b', { recursive: true }),
      () => fs.writeFileSync('/data/a/b/y', content('y')),
      () => fs.renameSync('/data/x', '/data/a/b/x'),
      () => fs.renameSync('/data/a/b', '/data/moved'),
      () => fs.rmSync('/data/a', { recursive: true }),
      () => fs.writeFileSync('/data/moved/x', content('x2')),
    ],
  },
  {
    // The empty directory that is replaced must not be gone while the move has not happened.
    name: 'a directory renamed onto an empty directory',
    prepare: () => {
      fs.mkdirSync('/data/d1');
      fs.writeFileSync('/data/d1/a', content('a'));
      fs.mkdirSync('/data/d2');
    },
    steps: [
      () => fs.renameSync('/data/d1', '/data/d2'),
      () => fs.mkdirSync('/data/d3'),
      () => fs.renameSync('/data/d2', '/data/d3'),
      () => fs.writeFileSync('/data/d3/a', content('a2')),
    ],
  },
  {
    name: 'a file moved from a memory-only area over a stored file',
    prepare: () => fs.writeFileSync('/data/server-settings.json', content('old')),
    steps: [
      () => {
        fs.mkdirSync('/scratch', { recursive: true });
        fs.writeFileSync('/scratch/settings.new', content('new'));
        fs.renameSync('/scratch/settings.new', '/data/server-settings.json');
      },
    ],
  },
];

/** The states the core went through: before the change and after each of its steps. */
function statesOf(scenario: Scenario): Snapshot[] {
  installVfs(new Vfs());
  scenario.prepare();
  const states = [snapshot()];
  for (const step of scenario.steps) {
    step();
    states.push(snapshot());
  }
  return states;
}

async function boot(fixture: StorageFixture): Promise<{ vfs: Vfs; faulty: FaultyStorage }> {
  const faulty = new FaultyStorage(fixture.open());
  const vfs = new Vfs({ backend: faulty, log: () => undefined });
  installVfs(vfs);
  await vfs.boot();
  return { vfs, faulty };
}

describe.each(STORAGE_KINDS)('crash safety on the $name', ({ create }) => {
  describe.each(SCENARIOS)('$name', (scenario) => {
    it.each([false, true])('survives a kill at every storage call (torn write: %s)', async (torn) => {
      const states = statesOf(scenario);
      const final = states[states.length - 1];
      const reached = new Set<number>();
      let kills = 0;
      for (let k = 1; ; k++) {
        const fixture = create();
        const { vfs, faulty } = await boot(fixture);
        scenario.prepare();
        await vfs.drain();

        faulty.crashAt(k, { torn });
        for (const step of scenario.steps) step();
        const outcome = await Promise.race([faulty.crashed.then(() => 'killed'), vfs.drain().then(() => 'completed')]);
        if (outcome === 'completed') {
          // The change needs fewer than k storage calls: it went through; every kill point was tried.
          expect(snapshot()).toEqual(final);
          expect(k).toBeGreaterThan(1);
          break;
        }
        kills++;

        // The app starts again on what the dead process left behind.
        await boot(fixture);
        const found = snapshot();
        const index = states.findIndex((state) => JSON.stringify(state) === JSON.stringify(found));
        expect(index, `kill at storage call ${k}: found ${JSON.stringify(found, null, 1)}`).toBeGreaterThanOrEqual(0);
        reached.add(index);
        // The storage itself is clean, and holds exactly what the mirror shows.
        const stored = fixture.files();
        expect([...stored.keys()].filter((path) => /\.(tmp|old)-\d+$/.test(path))).toEqual([]);
        for (const [path, bytes] of stored) expect(text(bytes), path).toBe(found[`/data/${path}`]);
        fixture.verify();

        // And it is usable: the interrupted change can simply be made again.
        const again = await boot(fixture);
        for (const step of scenario.steps.slice(index)) step();
        await again.vfs.drain();
        expect(snapshot()).toEqual(final);
        await boot(fixture);
        expect(snapshot()).toEqual(final);
      }
      // The kills really landed in different places: both "nothing happened" and later states were seen.
      expect(kills).toBeGreaterThanOrEqual(scenario.steps.length);
      expect(reached.has(0)).toBe(true);
      if (scenario.steps.length > 1) expect(reached.size).toBeGreaterThan(1);
    });
  });

  it('the diary is readable after a kill at any point: .mpd, else .mpd.tmp, else .mpd.prev holds a whole version', async () => {
    const scenario = SCENARIOS.find((s) => s.name.startsWith('the diary')) as Scenario;
    const whole = new Set([content('v0'), content('v1'), content('v2')]);
    for (const torn of [false, true]) {
      for (let k = 1; ; k++) {
        const fixture = create();
        const { vfs, faulty } = await boot(fixture);
        scenario.prepare();
        await vfs.drain();
        faulty.crashAt(k, { torn });
        for (const step of scenario.steps) step();
        const outcome = await Promise.race([faulty.crashed.then(() => 'killed'), vfs.drain().then(() => 'completed')]);
        if (outcome === 'completed') break;
        await boot(fixture);
        // What security/vault.ts does when it opens a diary (readAndDecrypt).
        const candidates = ['/data/users/u_1.mpd', '/data/users/u_1.mpd.tmp', '/data/users/u_1.mpd.prev'];
        const first = candidates.find((path) => fs.existsSync(path)) as string;
        expect(first, `kill at ${k}`).toBeDefined();
        const opened = fs.readFileSync(first, 'utf8') as string;
        expect(whole.has(opened), `kill at ${k}: ${first}`).toBe(true);
        // Never older than the version that was current when the save began.
        expect(opened === content('v1') || opened === content('v2'), `kill at ${k}: ${first}`).toBe(true);
        for (const path of candidates) if (fs.existsSync(path)) expect(whole.has(fs.readFileSync(path, 'utf8') as string)).toBe(true);
      }
    }
  });
});
