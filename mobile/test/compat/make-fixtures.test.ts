// @vitest-environment node
/**
 * The fixtures generator (scripts/mobile/make-fixtures.mjs) never destroys a directory that is not
 * its own. It deletes its previous output before it writes, so:
 *
 *   - `--out=` without a value (it would resolve to the current directory) and unknown arguments
 *     are refused;
 *   - the target must be new, empty, or hold a manifest.json this generator wrote - anything else is
 *     refused before any work and left untouched;
 *   - in a directory it accepts, only the generator's own files are replaced.
 *
 * The helpers are tested directly (the script is imported; it only runs when Node is started with
 * it), the command line by starting the script, and one full run shows that a directory of an
 * earlier run is refreshed, that a foreign file in it survives, and that the committed
 * kdf-vectors.json is what the generator writes.
 */
import { spawnSync } from 'node:child_process';
import nodeCrypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadKdfVectors, type FixtureManifest, type KdfVectorsFile } from './fixtures';

interface Generator {
  MANIFEST_NOTE_PREFIX: string;
  GENERATED_PATHS: string[];
  FixturesUsageError: new (message: string) => Error;
  parseOutDir(args: string[]): string;
  outputDirProblem(dir: string): string | null;
  removeGeneratedFiles(dir: string): void;
}

const SCRIPT = path.join(process.cwd(), 'scripts', 'mobile', 'make-fixtures.mjs');
const COMMITTED = path.join(process.cwd(), 'mobile', 'test', 'fixtures');

let generator: Generator;
let work: string;

/** Every file below `dir` with its content (hex): what must be unchanged after a refused run. */
function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (current: string): void => {
    for (const name of fs.readdirSync(current).sort()) {
      const full = path.join(current, name);
      const relative = path.relative(dir, full).split(path.sep).join('/');
      if (fs.statSync(full).isDirectory()) {
        out[`${relative}/`] = '';
        walk(full);
      } else out[relative] = fs.readFileSync(full).toString('hex');
    }
  };
  walk(dir);
  return out;
}

/** A fresh directory below the work directory, filled with `files` (relative path -> text). */
function makeDir(name: string, files: Record<string, string> = {}): string {
  const dir = path.join(work, name);
  fs.mkdirSync(dir, { recursive: true });
  for (const [relative, text] of Object.entries(files)) {
    const file = path.join(dir, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
  return dir;
}

function run(args: string[], cwd: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8', timeout: 150_000 });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function generatorManifest(): string {
  return JSON.stringify({ note: `${generator.MANIFEST_NOTE_PREFIX} from the real server modules under Node.js. Fictional data only.` });
}

beforeAll(async () => {
  // A variable specifier: the script has no type declarations, and it is not part of any bundle.
  const url = pathToFileURL(SCRIPT).href;
  generator = (await import(/* @vite-ignore */ url)) as Generator;
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'mpd-make-fixtures-test-'));
});

afterAll(() => {
  if (work) fs.rmSync(work, { recursive: true, force: true });
});

describe('make-fixtures: the arguments', () => {
  it('no argument = the committed fixtures directory; --out=<dir> = that directory, absolute', () => {
    expect(generator.parseOutDir([])).toBe(COMMITTED);
    expect(generator.parseOutDir([`--out=${path.join(work, 'x')}`])).toBe(path.join(work, 'x'));
    expect(generator.parseOutDir(['--out=some/relative dir'])).toBe(path.resolve('some/relative dir'));
  });

  it('an empty --out and anything it does not know are refused (never a silent fallback to another directory)', () => {
    for (const args of [['--out='], ['--out=   '], ['--out', path.join(work, 'x')], ['-o=x'], ['x'], ['--out=a', '--force'], ['--help']]) {
      expect(() => generator.parseOutDir(args), args.join(' ')).toThrow(generator.FixturesUsageError);
    }
    expect(() => generator.parseOutDir(['--out='])).toThrow(/--out needs a directory/);
    expect(() => generator.parseOutDir(['--out', 'x'])).toThrow(/unknown argument "--out"/);
  });
});

describe('make-fixtures: which directory it may write to', () => {
  it('a directory that does not exist yet, an empty one, and an earlier output of the generator', () => {
    expect(generator.outputDirProblem(path.join(work, 'absent'))).toBeNull();
    expect(generator.outputDirProblem(path.join(work, 'absent', 'nested', 'deeper'))).toBeNull();
    expect(generator.outputDirProblem(makeDir('empty'))).toBeNull();
    expect(generator.outputDirProblem(makeDir('earlier', { 'manifest.json': generatorManifest(), 'kdf-vectors.json': '{}', 'my-notes.txt': 'x' }))).toBeNull();
    // The committed snapshot is such a directory.
    expect(generator.outputDirProblem(COMMITTED)).toBeNull();
    expect(fs.existsSync(path.join(work, 'absent'))).toBe(false);
  });

  it('nothing else: other files, a manifest.json of something else, a file, the project itself', () => {
    const refused: Array<[string, string]> = [
      ['files of someone else', makeDir('victim-a', { 'notes.txt': 'my notes', 'docs/a.txt': 'a' })],
      ['a single hidden file', makeDir('victim-b', { '.keep': '' })],
      ['a manifest.json of a web app', makeDir('victim-c', { 'manifest.json': '{"name":"some web app","note":"hello"}', 'desktop-data/real.txt': 'real data' })],
      ['a manifest.json that is not JSON', makeDir('victim-d', { 'manifest.json': 'Generated by scripts/mobile/make-fixtures.mjs' })],
      ['a manifest.json without a note', makeDir('victim-e', { 'manifest.json': '[]', 'kdf-vectors.json': '{}' })],
      ['fixture-like files without the manifest', makeDir('victim-f', { 'kdf-vectors.json': '{}', 'desktop-data/device.key': 'k' })],
      ['the project root', process.cwd()],
      ['mobile/test (the parent of the fixtures)', path.join(process.cwd(), 'mobile', 'test')],
      ['the work directory (it has sub-directories)', work],
    ];
    for (const [label, dir] of refused) {
      const problem = generator.outputDirProblem(dir);
      expect(problem, label).toMatch(/is not empty and is not a fixtures directory of this generator/);
      expect(problem, label).toContain(dir);
    }
    const file = path.join(makeDir('has-a-file', { 'target.txt': 'x' }), 'target.txt');
    expect(generator.outputDirProblem(file)).toMatch(/exists and is not a directory/);
  });

  it('only the generator\'s own files are removed, and its manifest stays until the new one replaces it', () => {
    expect(generator.GENERATED_PATHS).toEqual(['desktop-data', 'backup-account-password.mpd.fixture', 'backup-own-password.mpd.fixture', 'kdf-vectors.json', 'manifest.json']);
    const dir = makeDir('to-clean', {
      'manifest.json': generatorManifest(),
      'kdf-vectors.json': '{}',
      'backup-account-password.mpd.fixture': 'old',
      'backup-own-password.mpd.fixture': 'old',
      'desktop-data/users/u_old.mpd.fixture': 'old',
      'desktop-data/accounts.json': '{}',
      'my-notes.txt': 'keep me',
      'other/dir/file.bin': 'keep me too',
    });
    generator.removeGeneratedFiles(dir);
    expect(Object.keys(snapshot(dir))).toEqual(['manifest.json', 'my-notes.txt', 'other/', 'other/dir/', 'other/dir/file.bin']);
    // Nothing to remove is fine too (a new directory).
    generator.removeGeneratedFiles(path.join(work, 'never-created'));
    expect(fs.existsSync(path.join(work, 'never-created'))).toBe(false);
  });
});

describe('make-fixtures: the command line', () => {
  it('--out=<a directory with other files> exits with 2 and leaves every file as it was', () => {
    const victim = makeDir('cli-victim', { 'notes.txt': 'my notes', 'docs/a.txt': 'a', 'manifest.json': '{"name":"not ours"}' });
    const before = snapshot(victim);
    const result = run([`--out=${victim}`], work);
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/is not empty and is not a fixtures directory of this generator/);
    expect(result.stderr).toContain('Usage: node scripts/mobile/make-fixtures.mjs');
    expect(snapshot(victim)).toEqual(before);
  }, 60_000);

  it('--out= (no value) exits with 2 instead of working on the current directory', () => {
    const cwd = makeDir('cli-cwd', { 'sentinel.txt': 'still here', 'sub/file.txt': 'x' });
    const before = snapshot(cwd);
    const result = run(['--out='], cwd);
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/--out needs a directory/);
    expect(snapshot(cwd)).toEqual(before);
  }, 60_000);

  it(
    'a full run into a directory of an earlier run replaces the fixtures, keeps a foreign file, and writes the committed vectors',
    () => {
      const target = makeDir('cli-rerun', {
        'manifest.json': generatorManifest(),
        'kdf-vectors.json': '{"stale":true}',
        'backup-own-password.mpd.fixture': 'stale',
        'desktop-data/users/u_stale.mpd.fixture': 'stale',
        'my-notes.txt': 'keep me',
      });
      const result = run([`--out=${target}`], work);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toMatch(/\[make-fixtures\] \d+ entries/);

      const read = <T>(relative: string): T => JSON.parse(fs.readFileSync(path.join(target, relative), 'utf8')) as T;
      const manifest = read<FixtureManifest & { note: string }>('manifest.json');
      expect(manifest.note.startsWith(generator.MANIFEST_NOTE_PREFIX)).toBe(true);
      // The foreign file is still there, the stale diary is gone, everything else is the new set.
      expect(fs.readFileSync(path.join(target, 'my-notes.txt'), 'utf8')).toBe('keep me');
      expect(Object.keys(snapshot(target)).sort()).toEqual(
        [
          'backup-account-password.mpd.fixture',
          'backup-own-password.mpd.fixture',
          'desktop-data/',
          'desktop-data/accounts.json',
          'desktop-data/device.key',
          'desktop-data/sessions.json',
          'desktop-data/users/',
          `desktop-data/users/${manifest.account.dbFile}.fixture`,
          'kdf-vectors.json',
          'manifest.json',
          'my-notes.txt',
        ].sort(),
      );
      const sha256 = (relative: string): string => nodeCrypto.createHash('sha256').update(fs.readFileSync(path.join(target, relative))).digest('hex');
      expect(sha256(manifest.files.diary)).toBe(manifest.diary.fileSha256);
      expect(sha256(manifest.files.backupOwnPassword)).toBe(manifest.backups.ownPassword.fileSha256);

      // The vectors are deterministic (fixed salts): the committed file is exactly what the generator writes.
      const vectors = read<KdfVectorsFile>('kdf-vectors.json');
      const committed = loadKdfVectors();
      expect(vectors.vectors).toHaveLength(62);
      expect(vectors.kdf).toEqual(committed.kdf);
      expect(vectors.vectors).toEqual(committed.vectors);
      // The directory is accepted again by the next run.
      expect(generator.outputDirProblem(target)).toBeNull();
    },
    180_000,
  );
});
