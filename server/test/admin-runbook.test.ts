/**
 * Regression (ADMIN-TOOL fixer; three findings on docs/HOSTED-RUNBOOK.he.md chapter 9 and on the forms
 * the operator tool prints - scripts/hosted/admin.ts):
 *   - a username that starts with "-" (the username rule allows `-abc`, `--abc`, even `--help`) broke
 *     `find`, the one-line delete command `find` printed and the chapter's `--username <name>` forms, and
 *     the chapter said a username never needs any wrapping: the chapter and the tool's help now give the
 *     `=` and `--` forms, and every concrete `node /app/admin.cjs ...` line of the chapter is read back by
 *     the tool's own parser;
 *   - Hebrew in the tool's output is garbled through a Windows PowerShell 5.1 pipeline under the owner's
 *     OEM code page (850): the chapter gives the one line to run first, and (Windows only) that very line,
 *     taken from the chapter, runs through powershell.exe - a Hebrew line piped through Out-String arrives
 *     garbled before it and intact after it, and the tool's ASCII-only `list --json` parses either way;
 *   - 9.5 quoted `(answer 404)` for a stale token, while the tool - whose own Host header meets the hosted
 *     Host check first - prints `(answer 421)`: the chapter quotes the sentence the tool prints for 421
 *     (server/test/admin-api.test.ts asserts the server's 421, admin-e2e.test.ts the built tool's stderr).
 * Fictional values only; nothing contacts anything.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { USERNAME_PATTERN } from '@shared/constants';
import { asciiJson, EXIT, main, parseArgs, type CliIo } from '../../scripts/hosted/admin';
import { cleanupTempDirs, tempDataDir } from './helpers';

afterAll(cleanupTempDirs);

const ROOT = path.resolve(__dirname, '..', '..');
const RUNBOOK = path.join(ROOT, 'docs', 'HOSTED-RUNBOOK.he.md');
/** The line the chapter tells the owner to run before piping the tool's output. */
const ENCODING_LINE = '[Console]::OutputEncoding = [Text.Encoding]::UTF8';
/** What the tool prints after a list of 13 accounts (its Hebrew line). */
const HEBREW_LINE = '13 חשבונות, מהישן לחדש.';

/** Chapter 9 of the runbook, from its heading to chapter 10. */
function chapter9(): string {
  const text = fs.readFileSync(RUNBOOK, 'utf8').replace(/\r\n/g, '\n');
  const start = text.indexOf('\n## 9.');
  expect(start).toBeGreaterThan(0);
  const end = text.indexOf('\n## 10.', start + 1);
  expect(end).toBeGreaterThan(start);
  return text.slice(start, end);
}

/** A CliIo that collects the lines; its fake admin API answers every call with `status` and no X-Admin-Api header. */
function collecting(status: number): { io: CliIo; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  const io: CliIo = {
    out: (l) => out.push(l),
    err: (l) => err.push(l),
    readLine: async () => null,
    env: {},
    now: () => new Date('2026-11-02T12:00:00.000Z'),
    transport: async () => ({ status, admin: false, body: null }),
  };
  return { io, out, err };
}

describe('runbook chapter 9 and the tool agree', () => {
  it('every concrete command of the chapter is read by the tool; the chapter and the help give the = and -- forms for a username that starts with "-"', async () => {
    const text = chapter9();
    const commands = [...text.matchAll(/node \/app\/admin\.cjs ([^'`\n]+)/g)].map((m) => m[1].trim()).filter((c) => !c.includes('<'));
    expect(commands.length).toBeGreaterThanOrEqual(8);
    for (const command of commands) expect(() => parseArgs(command.split(/\s+/)), command).not.toThrow();
    // The premise: the username rule allows such names.
    for (const name of ['-abc', '--abc', '--help']) expect(USERNAME_PATTERN.test(name), name).toBe(true);
    // The chapter's forms ...
    expect(text).toContain('--username=--help --confirm=--help');
    expect(text).toContain('find -- --help');
    expect(text).toContain('find --abc');
    // ... are the help's forms ...
    const help = collecting(404);
    expect(await main(['help'], help.io)).toBe(EXIT.ok);
    expect(help.out.join('\n')).toContain('--username=--help --confirm=--help');
    expect(help.out.join('\n')).toContain('find -- --help');
    // ... and the parser reads them as values.
    expect(parseArgs(['delete', '--username=--help', '--confirm=--help']).command).toEqual({ kind: 'delete', select: { by: 'username', value: '--help' }, confirm: '--help' });
    expect(parseArgs(['find', '--', '--help']).command).toEqual({ kind: 'find', query: '--help' });
    expect(parseArgs(['find', '--abc']).command).toEqual({ kind: 'find', query: '--abc' });
  });

  it('9.5 quotes the sentence the tool prints for a stale token with the number the owner sees - 421 (the hosted Host check), not 404', async () => {
    const stale = collecting(421);
    const file = path.join(tempDataDir(), '.admin-token');
    fs.writeFileSync(file, JSON.stringify({ version: 1, port: 8080, token: 'ab'.repeat(32), pid: 1, startedAt: '2026-10-28T10:00:00.000Z' }));
    expect(await main(['list', '--token-file', file], stale.io)).toBe(EXIT.unreachable);
    const sentence = stale.err[0];
    const marker = '(answer 421)';
    expect(sentence).toContain(marker);
    const quoted = sentence.slice(0, sentence.indexOf(marker) + marker.length);
    const text = chapter9();
    expect(text).toContain(`\`${quoted}\``);
    expect(text).not.toContain('did not accept the admin token (answer 404)');
  });

  it('the chapter gives the encoding line, names the code page it works around, and only then suggests a PowerShell pipeline', () => {
    const text = chapter9();
    const encoding = text.indexOf(ENCODING_LINE);
    expect(encoding).toBeGreaterThan(0);
    expect(text).toContain('850');
    // The pipeline example of 9.4 comes after the line (and points back to it).
    const pipeline = text.indexOf("list --json' | Out-String | ConvertFrom-Json");
    expect(pipeline).toBeGreaterThan(encoding);
    expect(text.slice(pipeline)).toContain('[Console]::OutputEncoding');
  });
});

const POWERSHELL = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const canRun = process.platform === 'win32' && fs.existsSync(POWERSHELL);

describe.runIf(canRun)("the chapter's encoding line in Windows PowerShell 5.1", () => {
  it('piped Hebrew is garbled under code page 850 and intact after the line; the ASCII list --json parses under both', () => {
    const dir = tempDataDir();
    const stub = path.join(dir, 'tool-stub.js');
    const rows = [
      { username: 'דנה_1', email: 'dana@example.com', diaryBytes: 0 },
      { username: 'ron', email: 'ron@example.com', diaryBytes: 5 },
    ];
    // Prints what the tool prints: its Hebrew line, or (with --json) its ASCII-only JSON.
    fs.writeFileSync(stub, `process.stdout.write(process.argv[2] === '--json' ? ${JSON.stringify(asciiJson(rows))} + '\\n' : ${JSON.stringify(HEBREW_LINE)} + '\\n');\n`);
    const result = path.join(dir, 'result.txt');
    const tool = `& '${process.execPath}' '${stub}'`;
    const script = [
      "$ErrorActionPreference = 'Stop'",
      // The owner's default window: OEM code page 850, whatever this console has.
      '[Console]::OutputEncoding = [Text.Encoding]::GetEncoding(850)',
      `$before = (${tool} | Out-String).Trim()`,
      `$json850 = ((${tool} --json | Out-String | ConvertFrom-Json) | Where-Object { $_.diaryBytes -eq 0 } | ForEach-Object { $_.username }) -join ','`,
      ENCODING_LINE,
      `$after = (${tool} | Out-String).Trim()`,
      `$jsonUtf8 = ((${tool} --json | Out-String | ConvertFrom-Json)[1].username)`,
      `[IO.File]::WriteAllLines('${result}', @($before, $after, $json850, $jsonUtf8), [Text.UTF8Encoding]::new($false))`,
      '',
    ].join('\r\n');
    // powershell.exe plus four node processes: seconds alone, minutes on a machine running other suites.
    const run = spawnSync(POWERSHELL, ['-NoProfile', '-NonInteractive', '-Command', '-'], { input: script, cwd: dir, encoding: 'utf8', timeout: 240_000 });
    expect({ status: run.status, signal: run.signal, stderr: run.stderr, exists: fs.existsSync(result) }).toMatchObject({ status: 0, exists: true });
    const [before, after, json850, jsonUtf8] = fs.readFileSync(result, 'utf8').replace(/\r\n/g, '\n').split('\n');
    expect(after).toBe(HEBREW_LINE);
    expect(before).not.toBe(HEBREW_LINE);
    expect(json850).toBe('דנה_1');
    expect(jsonUtf8).toBe('ron');
  }, 300_000);
});
