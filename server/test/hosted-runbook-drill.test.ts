/**
 * Regression (WP-H8 fixer, finding "Runbook restore drill (6ב step 2) reads the device-key copy from
 * a path where it does not exist, and then quietly starts the server without the key"):
 * docs/HOSTED-RUNBOOK.he.md section 6ב step 2 is the PowerShell block the owner pastes to boot a
 * hosted server on a restored archive. The old block read the key copy from a fixed Documents path
 * (the owner moved it away, as the copy itself tells him to), and when it was not there the next
 * line started the server anyway - which then made itself a new random device.key, and step 3
 * "proved" a wrong key when only the path was wrong.
 *
 *   - static: the block names no fixed Documents path; the key-copy path is ONE line the owner edits
 *     (`$keyCopy = '...'`); every line is plain ASCII (pasted into a Windows PowerShell 5.1 console);
 *     no line starts the server without testing DIARY_DEVICE_KEY;
 *   - behaviour (Windows only): the block's own lines run through `powershell.exe -Command -`, which
 *     executes them ONE AT A TIME like a line-by-line paste (an error on one line does not stop the
 *     next), with only the `$keyCopy` line replaced and `deploy\hosted\dist\server-hosted.cjs` a stub
 *     that records what it was started with. A missing copy, a folder, a copy without the
 *     DIARY_DEVICE_KEY= line, and a stale key already in the window's environment never start it;
 *     a copy in the format set-secrets.ps1 writes starts it with exactly that key.
 * Fictional keys and temporary folders only; nothing reads a real key copy or a real data dir.
 */
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { cleanupTempDirs, tempDataDir } from './helpers';

afterAll(cleanupTempDirs);

const ROOT = path.resolve(__dirname, '..', '..');
const RUNBOOK = path.join(ROOT, 'docs', 'HOSTED-RUNBOOK.he.md');
const START = 'node deploy\\hosted\\dist\\server-hosted.cjs';
const KEY_LINE = /^\$keyCopy = '[^']*'$/;

/** The fenced PowerShell block of section 6ב step 2, dedented, one entry per line. */
function drillBlock(): string[] {
  const text = fs.readFileSync(RUNBOOK, 'utf8').replace(/\r\n/g, '\n');
  const start = text.indexOf('\n## 6ב.');
  expect(start).toBeGreaterThan(0);
  const end = text.indexOf('\n## ', start + 1);
  const section = text.slice(start, end === -1 ? undefined : end);
  const step = section.indexOf('\n2. **');
  expect(step).toBeGreaterThan(0);
  const open = section.indexOf('```', step);
  const close = section.indexOf('```', open + 3);
  expect(open).toBeGreaterThan(step);
  expect(close).toBeGreaterThan(open);
  return section
    .slice(open + 3, close)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

const POWERSHELL = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const canRun = process.platform === 'win32' && fs.existsSync(POWERSHELL);

interface Started {
  key: string | null;
  mode: string | null;
  dataDir: string | null;
}

/**
 * Runs the runbook's block in a fresh temporary folder (its `$PWD`) with `keyCopy` in the one line
 * the owner edits. `inherited` is a DIARY_DEVICE_KEY already in the window's environment.
 */
function runDrill(keyCopy: string, inherited?: string): { started: Started | null; out: string } {
  const cwd = tempDataDir();
  const stub = path.join(cwd, 'deploy', 'hosted', 'dist', 'server-hosted.cjs');
  fs.mkdirSync(path.dirname(stub), { recursive: true });
  fs.writeFileSync(
    stub,
    "const e = process.env; require('fs').writeFileSync(require('path').join(process.cwd(), 'started.json'), " +
      'JSON.stringify({ key: e.DIARY_DEVICE_KEY ?? null, mode: e.DIARY_MODE ?? null, dataDir: e.DIARY_DATA_DIR ?? null }));\n',
  );
  const lines = drillBlock().map((line) => (KEY_LINE.test(line) ? `$keyCopy = '${keyCopy.replace(/'/g, "''")}'` : line));
  const env: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(process.env)) if (!/^DIARY_/i.test(name)) env[name] = value;
  const pathName = Object.keys(env).find((name) => name.toLowerCase() === 'path') ?? 'PATH';
  env[pathName] = `${path.dirname(process.execPath)}${path.delimiter}${env[pathName] ?? ''}`;
  if (inherited !== undefined) env.DIARY_DEVICE_KEY = inherited;
  const r = spawnSync(POWERSHELL, ['-NoProfile', '-NonInteractive', '-Command', '-'], {
    cwd,
    env,
    input: `${lines.join('\n')}\n`,
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
  });
  const marker = path.join(cwd, 'started.json');
  const started = fs.existsSync(marker) ? (JSON.parse(fs.readFileSync(marker, 'utf8')) as Started) : null;
  return { started, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/** A key copy in the exact layout scripts/hosted/set-secrets.ps1 writes (BOM-less UTF-8, CRLF). */
function keyCopyFile(dir: string, keyB64: string | null): string {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'yourpersonaldiary-device-key-yourpersonaldiary.txt');
  const lines = [
    "Your Personal Diary - DIARY_DEVICE_KEY of the Fly app 'yourpersonaldiary' (created 2026-10-01T12:00:00; source: generated)",
    'Keep this file in your password manager or offline and delete it from here afterwards.',
    'Whoever holds it together with a copy of the server volume can open every diary; without it a copy of the volume opens nothing.',
    ...(keyB64 === null ? [] : [`DIARY_DEVICE_KEY=${keyB64}`]),
  ];
  fs.writeFileSync(file, `${lines.join('\r\n')}\r\n`, 'utf8');
  return file;
}

describe('HOSTED-RUNBOOK.he.md 6ב step 2: the restore drill finds the key copy or stops', () => {
  it('the key-copy path is one line the owner edits; no fixed Documents path; no unguarded server start; plain ASCII', () => {
    const block = drillBlock();
    expect(block.filter((line) => KEY_LINE.test(line))).toHaveLength(1);
    expect(block.join('\n')).not.toMatch(/MyDocuments|Documents\\/i);
    expect(fs.readFileSync(RUNBOOK, 'utf8')).not.toMatch(/GetFolderPath\('MyDocuments'\)/);
    const starts = block.filter((line) => line.includes(START));
    expect(starts).toHaveLength(1);
    expect(starts[0]).toMatch(/^if \(\$env:DIARY_DEVICE_KEY\) \{ node /);
    for (const line of block) expect([line, /^[\x20-\x7e]*$/.test(line)]).toEqual([line, true]);
    // The data dir is the drill folder of step 1; the read line clears any earlier key first.
    expect(block.join('\n')).toContain("$env:DIARY_DATA_DIR='C:\\drill\\data'");
    expect(block.some((line) => line.startsWith('$env:DIARY_DEVICE_KEY = $null;'))).toBe(true);
  });

  it.skipIf(!canRun)('pasted line by line: never starts the server without the key; starts it with exactly the key of the copy', () => {
    const base = tempDataDir();
    const key = randomBytes(32).toString('base64');

    // The copy is not where the line says (moved away, or the line was not edited).
    const missing = runDrill(path.join(base, 'moved-away', 'yourpersonaldiary-device-key-yourpersonaldiary.txt'));
    expect(missing.started).toBeNull();
    expect(missing.out).toContain('STOP - the server was NOT started');
    // The line exactly as printed in the runbook (the owner forgot to edit it).
    const unedited = drillBlock().find((line) => KEY_LINE.test(line))!.slice("$keyCopy = '".length, -1);
    expect(runDrill(unedited).started).toBeNull();
    // A folder, and a file without the DIARY_DEVICE_KEY= line.
    expect(runDrill(path.join(base, 'a folder')).started).toBeNull();
    fs.mkdirSync(path.join(base, 'a folder'), { recursive: true });
    expect(runDrill(path.join(base, 'a folder')).started).toBeNull();
    const noKeyLine = runDrill(keyCopyFile(path.join(base, 'no key line'), null));
    expect(noKeyLine.started).toBeNull();
    expect(noKeyLine.out).toContain('STOP');
    // A key left in the window from an earlier attempt is not used for a copy that is not found.
    const stale = runDrill(path.join(base, 'moved-away', 'x.txt'), randomBytes(32).toString('base64'));
    expect(stale.started).toBeNull();

    // The right path (with spaces) in the set-secrets.ps1 format: started with exactly that key.
    const good = runDrill(keyCopyFile(path.join(base, 'offline copy', 'keys'), key));
    expect(good.out).not.toContain('STOP');
    expect(good.started).toEqual({ key, mode: 'hosted', dataDir: 'C:\\drill\\data' });
  }, 120_000);
});
