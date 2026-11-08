/**
 * End to end (docs/android-tasks/ADMIN-TOOL.md item 5): the BUILT hosted server (server-hosted.cjs) runs
 * as its own process on 127.0.0.1 with a temporary data directory, exactly as in the container
 * (DIARY_MODE=hosted, DIARY_DATA_DIR, PORT); three fictional people register over HTTP and write in their
 * diaries; then the BUILT operator tool (admin.cjs) is run as the owner runs it inside the machine - with
 * only DIARY_DATA_DIR in its environment, finding the per-boot token file by itself:
 *
 *   list, find, delete (typed confirmation, wrong confirmation, --confirm in one line), revoke, unlock,
 *   a stale token file, and the server stopped - with the exit codes 0 / 1 / 3 of the contract.
 *
 * Nothing here contacts anything but 127.0.0.1.
 */
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthResponse } from '@shared/types';
import { cleanupTempDirs, sampleEntry, tempDataDir } from './helpers';

const ROOT = path.resolve(__dirname, '..', '..');
const HOST = 'diary.example';
const PASSWORD = 'Passw0rd!';

let buildDir = '';
let dataDir = '';
let server: ChildProcessWithoutNullStreams | null = null;
let serverErr = '';
let port = 0;
/** The server's {"event":"listening",...} line. */
let listening: { adminApi?: boolean } = {};

/** The environment of a child: the parent's minus every DIARY_* variable, plus `extra`. */
function childEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(process.env)) if (!k.startsWith('DIARY_') && k !== 'PORT') env[k] = v;
  return { ...env, ...extra };
}

/** Starts server-hosted.cjs and resolves with its port once it printed {"event":"listening"}. */
function startServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(buildDir, 'server-hosted.cjs'), '--stdin-lifeline'], {
      cwd: buildDir,
      env: childEnv({
        DIARY_MODE: 'hosted',
        DIARY_PUBLIC_URL: `https://${HOST}`,
        DIARY_DATA_DIR: dataDir,
        DIARY_BIND: '127.0.0.1',
        PORT: '0',
        DIARY_CLIENT_IP_HEADER: 'x-forwarded-for',
        DIARY_LOGIN_PER_MINUTE: '1000',
        DIARY_MAX_GUESTS: '0',
        UV_THREADPOOL_SIZE: '8',
      }),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    server = child;
    let out = '';
    child.stderr.setEncoding('utf8').on('data', (d: string) => (serverErr += d));
    child.stdout.setEncoding('utf8').on('data', (d: string) => {
      out += d;
      for (const line of out.split('\n')) {
        try {
          const event = JSON.parse(line) as { event?: string; port?: number; adminApi?: boolean };
          if (event.event === 'listening' && typeof event.port === 'number') {
            listening = event;
            resolve(event.port);
          }
          if (event.event === 'fatal') reject(new Error(line));
        } catch {
          /* not a whole JSON line yet */
        }
      }
    });
    child.on('error', reject);
    child.on('exit', (code) => reject(new Error(`server exited (${code}): ${serverErr}`)));
  });
}

/** Ends the server the graceful way of the bundle (its stdin lifeline) and waits for the exit. */
function stopServer(): Promise<void> {
  const child = server;
  server = null;
  if (!child || child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => child.kill(), 15_000);
    child.on('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.stdin.end();
  });
}

interface CliResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

/** Runs the built tool like the owner does inside the machine: only DIARY_DATA_DIR tells it where the token is. */
function cli(args: string[], o: { input?: string; env?: Record<string, string> } = {}): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(buildDir, 'admin.cjs'), ...args], { cwd: buildDir, env: childEnv({ DIARY_DATA_DIR: dataDir, ...o.env }), stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (d: string) => (stdout += d));
    child.stderr.setEncoding('utf8').on('data', (d: string) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(o.input ?? '');
  });
}

const api = () => supertest(`http://127.0.0.1:${port}`);
function from(ip: string) {
  const common = (r: supertest.Test) => r.set('Host', HOST).set('X-Forwarded-For', ip).set('X-Forwarded-Proto', 'https').set('Accept-Language', 'en');
  return {
    get: (url: string, token: string) => common(api().get(url)).set('Authorization', `Bearer ${token}`),
    post: (url: string, body: object, token?: string) => (token ? common(api().post(url)).set('Authorization', `Bearer ${token}`) : common(api().post(url))).send(body),
  };
}

async function register(username: string, ip: string, email = `${username}@example.com`): Promise<AuthResponse> {
  const res = await from(ip).post('/api/auth/register', {
    firstName: 'Fictional',
    lastName: 'Person',
    username,
    email,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    privacyAccepted: true,
  });
  expect(res.status).toBe(201);
  const body = res.body as AuthResponse;
  const entry = await from(ip).post('/api/entries', sampleEntry({ title: `Private-${username}`, body: 'Nobody but the owner of this diary reads this.' }), body.token);
  expect(entry.status).toBeLessThan(300);
  return body;
}

const diaryFiles = (id: string) => fs.readdirSync(path.join(dataDir, 'users')).filter((f) => f.includes(id));

afterAll(async () => {
  await stopServer();
  cleanupTempDirs();
});

beforeAll(async () => {
  buildDir = path.join(tempDataDir(), 'build');
  const built = spawnSync(process.execPath, ['scripts/build-hosted.mjs', '--no-ui', '--out', buildDir], { cwd: ROOT, encoding: 'utf8', timeout: 120_000 });
  expect({ status: built.status, stderr: built.stderr }).toMatchObject({ status: 0 });
  dataDir = path.join(tempDataDir(), 'data');
  port = await startServer();
}, 180_000);

describe('admin.cjs against a running hosted server on 127.0.0.1', () => {
  it('list, find, delete, revoke, unlock - with the exit codes of the contract', async () => {
    const alice = await register('alice', '198.51.100.11');
    const bob = await register('bob', '198.51.100.12');
    const carol = await register('carol', '198.51.100.13');
    // A username that starts with "-" - allowed by the username rule, and what a throw-away account may pick.
    const dash = await register('--abc', '198.51.100.14', 'dash@example.com');
    expect(listening.adminApi).toBe(true);
    expect(fs.existsSync(path.join(dataDir, '.admin-token'))).toBe(true);

    // list: everybody, oldest first; no diary content.
    const list = await cli(['list']);
    expect({ code: list.code, stderr: list.stderr }).toEqual({ code: 0, stderr: '' });
    const lines = list.stdout.trim().split(/\r?\n/);
    expect(lines[0]).toMatch(/^USERNAME\s+E-MAIL\s+REGISTERED/);
    expect(lines.slice(1, 5).map((l) => l.split(/\s+/)[0])).toEqual(['alice', 'bob', 'carol', '--abc']);
    expect(list.stdout).toContain('carol@example.com');
    expect(list.stdout).toContain('4 accounts, oldest first.');
    expect(list.stdout).toContain('4 חשבונות, מהישן לחדש.');
    expect(list.stdout).not.toContain('Private-');
    expect(list.stdout).not.toContain('Fictional');
    const json = await cli(['list', '--json']);
    // Plain ASCII, so a Windows PowerShell pipeline decodes it right in any console code page.
    expect(json.stdout).toMatch(/^[\x20-\x7e\r\n]*$/);
    expect((JSON.parse(json.stdout) as Array<{ username: string; diaryBytes: number }>).map((a) => [a.username, a.diaryBytes > 0])).toEqual([
      ['alice', true],
      ['bob', true],
      ['carol', true],
      ['--abc', true],
    ]);

    // find by the requester's address: the details and the ready one-line delete command.
    const found = await cli(['find', 'CAROL@example.com']);
    expect(found.code).toBe(0);
    expect(found.stdout).toContain('Found one account:');
    expect(found.stdout).toContain(carol.user.id);
    expect(found.stdout).toContain('To delete it in one line: node /app/admin.cjs delete --username carol --confirm carol');
    const nobody = await cli(['find', 'nobody@example.com']);
    expect(nobody.code).toBe(1);

    // delete, typed: a wrong name and an empty input delete nothing (exit 1) ...
    for (const input of ['caroline\n', '']) {
      const refused = await cli(['delete', '--email', 'carol@example.com'], { input });
      expect({ input, code: refused.code }).toEqual({ input, code: 1 });
      expect(refused.stdout).toMatch(/username \/ שם משתמש:\s+carol/);
      expect(refused.stdout).toMatch(/registered \/ נרשם:\s+\d{4}-\d{2}-\d{2}/);
      expect(refused.stdout).toMatch(/diary size \/ גודל היומן:\s+\d+\.\d (KB|MB)/);
      expect(refused.stderr).toContain('Not confirmed - nothing was deleted.');
      expect(diaryFiles(carol.user.id).length).toBeGreaterThan(0);
    }
    // ... the right name typed again deletes.
    const typed = await cli(['delete', '--email', 'carol@example.com'], { input: 'carol\n' });
    expect({ code: typed.code, stderr: typed.stderr }).toEqual({ code: 0, stderr: '' });
    expect(typed.stdout).toContain('Deleted: the account "carol"');
    expect(diaryFiles(carol.user.id)).toEqual([]);
    expect((await from('198.51.100.13').get('/api/auth/me', carol.token)).status).toBe(401);

    // delete in one line (flyctl ssh console -C): --confirm must be exactly the username.
    const mismatch = await cli(['delete', '--username', 'alice', '--confirm', 'Alice']);
    expect(mismatch.code).toBe(1);
    expect(diaryFiles(alice.user.id).length).toBeGreaterThan(0);
    const oneLine = await cli(['delete', '--username', 'alice', '--confirm', 'alice']);
    expect({ code: oneLine.code, stderr: oneLine.stderr }).toEqual({ code: 0, stderr: '' });
    expect(diaryFiles(alice.user.id)).toEqual([]);
    expect(fs.readFileSync(path.join(dataDir, 'accounts.json'), 'utf8')).not.toContain('alice');
    // Bob - the account nobody asked to delete - is untouched.
    expect((await from('198.51.100.12').get('/api/entries?limit=5', bob.token)).body.total).toBe(1);

    // revoke: Bob is signed out everywhere; his diary stays.
    const revoked = await cli(['revoke', '--username', 'bob']);
    expect(revoked.code).toBe(0);
    expect(revoked.stdout).toContain('Signed out on every device: "bob" (1 session ended).');
    expect((await from('198.51.100.12').get('/api/auth/me', bob.token)).status).toBe(401);

    // unlock: ten wrong passwords from one network lock it there; unlock lets it in at once.
    for (let i = 0; i < 10; i++) await from('192.0.2.99').post('/api/auth/login', { username: 'bob', password: `Wrong${i}pass` });
    expect((await from('192.0.2.99').post('/api/auth/login', { username: 'bob', password: PASSWORD })).status).toBe(429);
    const unlocked = await cli(['unlock', '--username', 'bob']);
    expect(unlocked.code).toBe(0);
    expect(unlocked.stdout).toContain('Unlocked: "bob"');
    const back = await from('192.0.2.99').post('/api/auth/login', { username: 'bob', password: PASSWORD });
    expect(back.status).toBe(200);
    expect((await from('192.0.2.99').get('/api/entries?limit=5', (back.body as AuthResponse).token)).body.total).toBe(1);

    // A selector nobody has: exit 1, nothing changed.
    expect((await cli(['revoke', '--username', 'nobody'])).code).toBe(1);
    // A wrong command line: exit 2.
    expect((await cli(['delete', '--username'])).code).toBe(2);

    // The "--abc" account (regression: `find --abc` was "unknown option", and the one-line delete command
    // that `find` printed for it failed with "--username needs a value"): find takes the name as it is, by
    // its address and after `--`; the printed one-liner uses the = form, and that very line deletes.
    const foundDash = await cli(['find', '--abc']);
    expect({ code: foundDash.code, stderr: foundDash.stderr }).toEqual({ code: 0, stderr: '' });
    expect(foundDash.stdout).toContain('Found one account:');
    expect(foundDash.stdout).toContain(dash.user.id);
    const oneLiner = /^To delete it in one line: node \/app\/admin\.cjs (.+)$/m.exec(foundDash.stdout);
    expect(oneLiner?.[1]).toBe('delete --username=--abc --confirm=--abc');
    expect((await cli(['find', '--', '--abc'])).code).toBe(0);
    expect((await cli(['find', 'dash@example.com'])).stdout).toContain('To delete it in one line: node /app/admin.cjs delete --username=--abc --confirm=--abc');
    expect((await cli(['unlock', '--username', '--abc'])).code).toBe(0);
    // A wrong confirmation still deletes nothing - in both forms.
    expect((await cli(['delete', '--username', '--abc', '--confirm', '-abc'])).code).toBe(1);
    expect((await cli(['delete', '--username=--abc', '--confirm=abc'])).code).toBe(1);
    expect(diaryFiles(dash.user.id).length).toBeGreaterThan(0);
    const dashDeleted = await cli(oneLiner![1].split(' '));
    expect({ code: dashDeleted.code, stderr: dashDeleted.stderr }).toEqual({ code: 0, stderr: '' });
    expect(dashDeleted.stdout).toContain('Deleted: the account "--abc"');
    expect(diaryFiles(dash.user.id)).toEqual([]);
    expect((await from('198.51.100.14').get('/api/auth/me', dash.token)).status).toBe(401);

    // The server's log: the actions, never a name, an address or an id.
    const adminLog = serverErr.split(/\r?\n/).filter((l) => l.includes('admin:'));
    expect(adminLog.filter((l) => l.endsWith('admin: account deleted (1)'))).toHaveLength(3);
    expect(adminLog.some((l) => l.endsWith('admin: sessions revoked (1)'))).toBe(true);
    expect(adminLog.some((l) => l.endsWith('admin: account unlocked (1)'))).toBe(true);
    for (const trace of ['alice', 'bob', 'carol', '--abc', 'dash@', 'example.com', alice.user.id, bob.user.id, carol.user.id, dash.user.id]) expect(adminLog.join('\n')).not.toContain(trace);
    // Four registrations and ~20 runs of the built tool, each its own node process: ~2 minutes alone, more
    // on a machine running other suites.
  }, 360_000);

  it('a token file from another boot: exit 3, nothing done; the server stopped: exit 3 (its token file is gone)', async () => {
    const real = JSON.parse(fs.readFileSync(path.join(dataDir, '.admin-token'), 'utf8')) as { port: number; token: string };
    const stale = path.join(tempDataDir(), 'stale-token');
    fs.writeFileSync(stale, JSON.stringify({ version: 1, port: real.port, token: 'ab'.repeat(32), pid: 1, startedAt: '2026-10-01T00:00:00.000Z' }));
    const rejected = await cli(['list', '--token-file', stale]);
    expect(rejected.code).toBe(3);
    // The number the owner sees: the tool's own Host (127.0.0.1:<port>) meets the hosted Host check, whose
    // answer is 421 - what the runbook's chapter 9.5 quotes (server/test/admin-runbook.test.ts).
    expect(rejected.stderr).toContain('The server did not accept the admin token (answer 421)');
    expect(rejected.stdout).toBe('');

    await stopServer();
    expect(fs.existsSync(path.join(dataDir, '.admin-token'))).toBe(false);
    const down = await cli(['list']);
    expect(down.code).toBe(3);
    expect(down.stderr).toContain('does not exist. Is the server running?');
    const unreachable = await cli(['list', '--token-file', stale]);
    expect(unreachable.code).toBe(3);
    expect(unreachable.stderr).toContain(`Cannot reach the server at 127.0.0.1:${real.port}`);
  }, 120_000);
});
