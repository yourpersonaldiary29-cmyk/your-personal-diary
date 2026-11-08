/**
 * The operator tool's command line (scripts/hosted/admin.ts -> /app/admin.cjs; docs/HOSTED-PLAN.md 3.10,
 * docs/android-tasks/ADMIN-TOOL.md items 2 and 5), without a server: argument parsing, where the token
 * file is found and how it is read, the confirmation of a deletion (typed again, or --confirm exactly),
 * the refusal of ambiguous matches, the exit codes, and the English + Hebrew messages. The admin API is
 * a fake transport here; server/test/admin-e2e.test.ts runs the built admin.cjs against a real server.
 * Fictional accounts only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { USERNAME_PATTERN } from '@shared/constants';
import {
  accountTable,
  API_HEADER,
  asciiJson,
  confirms,
  decodeValue,
  DEFAULT_TOKEN_FILE,
  encodeValue,
  EXIT,
  formatBytes,
  isPlainValue,
  main,
  optionArg,
  parseArgs,
  powershellLine,
  readTokenFile,
  TOKEN_FILE_NAME,
  TOKEN_HEADER,
  TokenFileError,
  tokenFilePath,
  UsageError,
  type AdminAnswer,
  type AdminRequest,
  type CliIo,
  DEFAULT_FLY_APP as CLI_APP,
  FLYCTL_WINDOWS_PATH as CLI_FLYCTL,
} from '../../scripts/hosted/admin';
import { ADMIN_TOKEN_FILE_NAME, ADMIN_TOKEN_HEADER } from '../src/hosted/admin-token';
import { DEFAULT_FLY_APP as ARCHIVE_APP, FLYCTL_WINDOWS_PATH as ARCHIVE_FLYCTL } from '../src/hosted/archive';
import { ADMIN_API_HEADER, type AdminAccount } from '../src/routes/admin';
import { cleanupTempDirs, tempDataDir } from './helpers';

afterAll(cleanupTempDirs);

const TOKEN = 'ab'.repeat(32);

function account(overrides: Partial<AdminAccount> = {}): AdminAccount {
  return {
    id: 'u_00000000000000d1',
    username: 'dana',
    email: 'dana@example.com',
    createdAt: '2026-10-01T08:00:00.000Z',
    lastLoginAt: '2026-10-20T19:30:00.000Z',
    diaryBytes: 48_128,
    sessions: 2,
    open: true,
    locked: false,
    ...overrides,
  };
}

/** A token file for `port` in a temp dir; returns its path. */
function tokenFile(port = 47_555, token = TOKEN): string {
  const file = path.join(tempDataDir(), '.admin-token');
  fs.writeFileSync(file, JSON.stringify({ version: 1, port, token, pid: 1, startedAt: '2026-10-28T10:00:00.000Z' }) + '\n');
  return file;
}

interface Run {
  code: number;
  out: string[];
  err: string[];
  requests: AdminRequest[];
  prompts: string[];
}

/**
 * Runs main() with a fake admin API: `answers` maps "METHOD path" (path without query for POSTs, with it
 * for GETs) to the answer; anything else is the 404 of an unknown route (no X-Admin-Api).
 */
async function run(argv: string[], o: { answers?: Record<string, AdminAnswer | ((r: AdminRequest) => AdminAnswer)>; typed?: string | null; env?: Record<string, string>; transportError?: NodeJS.ErrnoException } = {}): Promise<Run> {
  const out: string[] = [];
  const err: string[] = [];
  const requests: AdminRequest[] = [];
  const prompts: string[] = [];
  const io: CliIo = {
    out: (l) => out.push(l),
    err: (l) => err.push(l),
    readLine: async (prompt) => {
      prompts.push(prompt);
      return o.typed === undefined ? null : o.typed;
    },
    env: o.env ?? {},
    now: () => new Date('2026-10-28T12:00:00.000Z'),
    transport: async (request) => {
      requests.push(request);
      if (o.transportError) throw o.transportError;
      const answer = o.answers?.[`${request.method} ${request.path}`];
      if (!answer) return { status: 404, admin: false, body: { code: 'NOT_FOUND', message: 'not found' } };
      return typeof answer === 'function' ? answer(request) : answer;
    },
  };
  const code = await main(argv, io);
  return { code, out, err, requests, prompts };
}

const ok = (body: unknown): AdminAnswer => ({ status: 200, admin: true, body });
const findUsername = (u: string) => `GET /api/admin/accounts/find?username=${encodeURIComponent(u)}`;

describe('constants shared with the server', () => {
  it('the header names, the token file name, the app and the owner’s flyctl are the server’s own', () => {
    expect(TOKEN_HEADER).toBe(ADMIN_TOKEN_HEADER);
    expect(API_HEADER).toBe(ADMIN_API_HEADER);
    expect(TOKEN_FILE_NAME).toBe(ADMIN_TOKEN_FILE_NAME);
    expect(DEFAULT_TOKEN_FILE).toBe('/data/.admin-token');
    expect(CLI_FLYCTL).toBe(ARCHIVE_FLYCTL);
    expect(CLI_APP).toBe(ARCHIVE_APP);
  });
});

describe('parseArgs', () => {
  it('reads every command of the brief', () => {
    expect(parseArgs(['list']).command).toEqual({ kind: 'list', json: false });
    expect(parseArgs(['list', '--json']).command).toEqual({ kind: 'list', json: true });
    expect(parseArgs(['status']).command).toEqual({ kind: 'status' });
    expect(parseArgs(['find', 'dana@example.com']).command).toEqual({ kind: 'find', query: 'dana@example.com' });
    expect(parseArgs(['delete', '--username', 'dana']).command).toEqual({ kind: 'delete', select: { by: 'username', value: 'dana' }, confirm: null });
    expect(parseArgs(['delete', '--username', 'dana', '--confirm', 'dana']).command).toEqual({ kind: 'delete', select: { by: 'username', value: 'dana' }, confirm: 'dana' });
    expect(parseArgs(['delete', '--email=dana@example.com', '--confirm=dana']).command).toEqual({ kind: 'delete', select: { by: 'email', value: 'dana@example.com' }, confirm: 'dana' });
    expect(parseArgs(['revoke', '--username', 'dana']).command).toEqual({ kind: 'revoke', select: { by: 'username', value: 'dana' } });
    expect(parseArgs(['unlock', '--email', 'dana@example.com']).command).toEqual({ kind: 'unlock', select: { by: 'email', value: 'dana@example.com' } });
    // Options before the command, and a username that starts with a dash (allowed by the username rule).
    expect(parseArgs(['--token-file', '/tmp/t', 'unlock', '--username', '-dana-']).command).toEqual({ kind: 'unlock', select: { by: 'username', value: '-dana-' } });
    expect(parseArgs(['--token-file', '/tmp/t', 'list']).tokenFile).toBe('/tmp/t');
    expect(parseArgs(['list']).tokenFile).toBeNull();
    // Hebrew usernames come through untouched.
    expect(parseArgs(['delete', '--username', 'דנה_כ', '--confirm', 'דנה_כ']).command).toMatchObject({ confirm: 'דנה_כ' });
    // `--` ends the options: a lookup for something that starts with dashes.
    expect(parseArgs(['find', '--', '--odd']).command).toEqual({ kind: 'find', query: '--odd' });
  });

  it('b64: values carry addresses PowerShell or the command line would change; anything else stays as typed', () => {
    const odd = "o'brien$x\"y z@example.com";
    const encoded = encodeValue(odd);
    expect(encoded).toMatch(/^b64:[A-Za-z0-9_-]+$/);
    expect(decodeValue(encoded)).toBe(odd);
    expect(parseArgs(['find', encoded]).command).toEqual({ kind: 'find', query: odd });
    expect(parseArgs(['delete', '--email', encoded, '--confirm', 'obrien']).command).toEqual({ kind: 'delete', select: { by: 'email', value: odd }, confirm: 'obrien' });
    expect(decodeValue(encodeValue('דנה@דוגמה.ישראל'))).toBe('דנה@דוגמה.ישראל');
    // Not an encoded value: taken literally (an address may even start with "b64:").
    for (const literal of ['b64:abc@example.com', 'b64:', 'b64:a+b', 'dana@example.com', 'dana']) expect(decodeValue(literal)).toBe(literal);
    // Usernames are never decoded (they cannot contain ":" anyway).
    expect(parseArgs(['revoke', '--username', 'b64:ZGFuYQ']).command).toEqual({ kind: 'revoke', select: { by: 'username', value: 'b64:ZGFuYQ' } });
    // What can go into the one-line command as it is.
    for (const plain of ['dana@example.com', 'dana.k+news@mail.example.co.il', 'דנה_כהן', 'a=b%c@example.com']) expect(isPlainValue(plain), plain).toBe(true);
    for (const special of ["o'brien@example.com", 'pay$day@example.com', 'a"b@example.com', 'a`b@example.com', 'a b@example.com', 'a;b@example.com', 'a&b@example.com', 'a\\b@example.com', '']) {
      expect(isPlainValue(special), special).toBe(false);
    }
  });

  it('help in every spelling', () => {
    for (const argv of [['help'], ['--help'], ['-h'], ['delete', '--help']]) expect(parseArgs(argv).command).toEqual({ kind: 'help' });
  });

  it('a username that starts with "-" is a value - as it is, after = and after -- (regression: such names broke find and --username)', () => {
    // The premise: the username rule allows such names, so a throw-away account can pick one on purpose.
    for (const name of ['-abc', '--abc', '---', '--help', '--json', '--username', '--confirm']) expect(USERNAME_PATTERN.test(name), name).toBe(true);
    for (const name of ['-abc', '--abc', '---', '--help-me']) {
      expect(parseArgs(['find', name]).command, name).toEqual({ kind: 'find', query: name });
      expect(parseArgs(['find', '--', name]).command, name).toEqual({ kind: 'find', query: name });
      expect(parseArgs(['delete', '--username', name, '--confirm', name]).command, name).toEqual({ kind: 'delete', select: { by: 'username', value: name }, confirm: name });
      expect(parseArgs(['delete', `--username=${name}`, `--confirm=${name}`]).command, name).toEqual({ kind: 'delete', select: { by: 'username', value: name }, confirm: name });
      expect(parseArgs(['unlock', '--username', name, '--token-file', '/tmp/t']), name).toEqual({ command: { kind: 'unlock', select: { by: 'username', value: name } }, tokenFile: '/tmp/t' });
      expect(parseArgs(['revoke', '--email', `${name}@example.com`]).command, name).toEqual({ kind: 'revoke', select: { by: 'email', value: `${name}@example.com` } });
    }
    // A name that spells one of the tool's own options is still that option in the plain form ...
    expect(parseArgs(['find', '--help']).command).toEqual({ kind: 'help' });
    expect(() => parseArgs(['delete', '--username', '--json'])).toThrow(/--username needs a value/);
    expect(() => parseArgs(['delete', '--username', '--confirm', 'dana'])).toThrow(/--username needs a value/);
    expect(() => parseArgs(['delete', '--username', '--token-file=/x'])).toThrow(/--username needs a value/);
    // ... and a value after = or after --.
    for (const name of ['--help', '--json', '--username', '--email', '--confirm', '--token-file']) {
      expect(parseArgs(['find', '--', name]).command, name).toEqual({ kind: 'find', query: name });
      expect(parseArgs(['delete', `--username=${name}`, `--confirm=${name}`]).command, name).toEqual({ kind: 'delete', select: { by: 'username', value: name }, confirm: name });
    }
    // find still takes one query, and its real options stay options.
    expect(() => parseArgs(['find', '--abc', 'extra'])).toThrow(/unexpected argument "extra"/);
    expect(() => parseArgs(['find', '--abc', '--json'])).toThrow(/--json does not belong to "find"/);
    expect(parseArgs(['find', '--abc', '--token-file', '/t'])).toEqual({ command: { kind: 'find', query: '--abc' }, tokenFile: '/t' });
    expect(parseArgs(['--token-file', '/t', 'find', '-abc'])).toEqual({ command: { kind: 'find', query: '-abc' }, tokenFile: '/t' });
    expect(() => parseArgs(['--abc', 'find'])).toThrow(/unknown option --abc/);
    // The form the tool prints and the help describe.
    expect(optionArg('--confirm', 'dana')).toBe('--confirm dana');
    expect(optionArg('--confirm', '-dana')).toBe('--confirm=-dana');
    expect(optionArg('--username', '--help')).toBe('--username=--help');
  });

  it('refuses anything unknown, missing, repeated or out of place', () => {
    const cases: Array<[string[], RegExp]> = [
      [[], /no command/],
      [['remove', '--username', 'dana'], /unknown command "remove"/],
      [['constructor'], /unknown command/],
      [['list', '--all'], /unknown option --all/],
      [['list', '-x'], /unknown option -x/],
      [['find'], /needs an e-mail address or a username/],
      [['find', '   '], /needs an e-mail address or a username/],
      [['find', 'a@example.com', 'b@example.com'], /unexpected argument "b@example.com"/],
      [['delete'], /needs --username/],
      [['delete', '--username'], /--username needs a value/],
      [['delete', '--username', '--confirm', 'dana'], /--username needs a value/],
      [['delete', '--username='], /--username needs a value/],
      [['delete', '--username', 'dana', '--username', 'ron'], /given twice/],
      [['delete', '--username', 'dana', '--email', 'dana@example.com'], /not both/],
      [['delete', '--username', 'dana', 'extra'], /unexpected argument "extra"/],
      [['revoke', '--username', 'dana', '--confirm', 'dana'], /--confirm does not belong to "revoke"/],
      [['list', '--username', 'dana'], /--username does not belong to "list"/],
      [['find', 'dana', '--json'], /--json does not belong to "find"/],
      [['status', '--nope=1'], /unknown option --nope/],
    ];
    for (const [argv, message] of cases) {
      expect(() => parseArgs(argv), argv.join(' ')).toThrow(UsageError);
      expect(() => parseArgs(argv), argv.join(' ')).toThrow(message);
    }
  });
});

describe('the token file', () => {
  it('is found at --token-file, $DIARY_ADMIN_TOKEN_FILE, $DIARY_DATA_DIR/.admin-token, /data/.admin-token - in that order', () => {
    expect(tokenFilePath('/x/t', { DIARY_ADMIN_TOKEN_FILE: '/y/t', DIARY_DATA_DIR: '/z' })).toBe('/x/t');
    expect(tokenFilePath(null, { DIARY_ADMIN_TOKEN_FILE: '/y/t', DIARY_DATA_DIR: '/z' })).toBe('/y/t');
    expect(tokenFilePath(null, { DIARY_DATA_DIR: '/z' })).toBe(path.join('/z', '.admin-token'));
    expect(tokenFilePath(null, { DIARY_DATA_DIR: '  ', DIARY_ADMIN_TOKEN_FILE: '' })).toBe('/data/.admin-token');
    expect(tokenFilePath(null, {})).toBe('/data/.admin-token');
  });

  it('gives the port and the token, and refuses a missing, damaged or foreign file', () => {
    expect(readTokenFile(tokenFile(8080))).toEqual({ port: 8080, token: TOKEN });
    const dir = tempDataDir();
    const expectProblem = (file: string, problem: string) => {
      try {
        readTokenFile(file);
        throw new Error('no error');
      } catch (e) {
        expect(e).toBeInstanceOf(TokenFileError);
        expect((e as TokenFileError).problem).toBe(problem);
      }
    };
    expectProblem(path.join(dir, 'missing'), 'missing');
    expectProblem(dir, 'invalid'); // a directory
    for (const [name, text] of [
      ['not-json', 'port=8080 token=x'],
      ['no-port', JSON.stringify({ token: TOKEN })],
      ['bad-port', JSON.stringify({ port: 70000, token: TOKEN })],
      ['short-token', JSON.stringify({ port: 8080, token: 'abc' })],
      ['upper-token', JSON.stringify({ port: 8080, token: TOKEN.toUpperCase() })],
      ['array', '[]'],
    ] as const) {
      fs.writeFileSync(path.join(dir, name), text);
      expectProblem(path.join(dir, name), 'invalid');
    }
  });
});

describe('main: exit codes and messages', () => {
  it('help: 0, no token file needed; a wrong command line: 2, bilingual, nothing contacted', async () => {
    const help = await run(['help']);
    expect(help.code).toBe(EXIT.ok);
    expect(help.out.join('\n')).toContain('node /app/admin.cjs delete --username <u> [--confirm <u>]');
    expect(help.out.join('\n')).toMatch(/[א-ת]/);
    expect(help.requests).toEqual([]);
    const wrong = await run(['delete']);
    expect(wrong.code).toBe(EXIT.usage);
    expect(wrong.err[0]).toMatch(/^Wrong command line: /);
    expect(wrong.err[1]).toMatch(/^שורת פקודה שגויה: /);
    expect(wrong.requests).toEqual([]);
  });

  it('3 when the token file is missing (the server is not running) - nothing contacted', async () => {
    const r = await run(['list'], { env: { DIARY_DATA_DIR: tempDataDir() } });
    expect(r.code).toBe(EXIT.unreachable);
    expect(r.err[0]).toMatch(/does not exist\. Is the server running\?/);
    expect(r.err[1]).toContain('לא קיים');
    expect(r.requests).toEqual([]);
  });

  it('3 when the server cannot be reached, or does not accept the token (the 404 / 421 of an unknown route)', async () => {
    const file = tokenFile(47_001);
    const refused = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:47001'), { code: 'ECONNREFUSED' });
    const down = await run(['list', '--token-file', file], { transportError: refused });
    expect(down.code).toBe(EXIT.unreachable);
    expect(down.err[0]).toContain('Cannot reach the server at 127.0.0.1:47001 (ECONNREFUSED)');
    // Every request goes to the token file's port with its token.
    expect(down.requests[0]).toMatchObject({ port: 47_001, token: TOKEN, method: 'GET', path: '/api/admin/accounts' });
    const stale = await run(['list', '--token-file', file]);
    expect(stale.code).toBe(EXIT.unreachable);
    expect(stale.err[0]).toContain('did not accept the admin token (answer 404)');
    const misdirected = await run(['list', '--token-file', file], { answers: { 'GET /api/admin/accounts': { status: 421, admin: false, body: null } } });
    expect(misdirected.err[0]).toContain('(answer 421)');
  });

  it('list prints a table (never more than the brief’s fields) and --json the raw rows', async () => {
    const file = tokenFile();
    const accounts = [account(), account({ id: 'u_00000000000000r2', username: 'ron', email: '', diaryBytes: null, sessions: 0, open: false, locked: true, lastLoginAt: null })];
    const r = await run(['list', '--token-file', file], { answers: { 'GET /api/admin/accounts': ok({ accounts }) } });
    expect(r.code).toBe(EXIT.ok);
    expect(r.out[0]).toMatch(/^USERNAME\s+E-MAIL\s+REGISTERED\s+LAST SIGN-IN\s+DIARY\s+DEVICES\s+STATE\s+ID$/);
    expect(r.out[1]).toMatch(/^dana\s+dana@example\.com\s+2026-10-01\s+2026-10-20\s+47\.0 KB\s+2\s+open\s+u_00000000000000d1$/);
    expect(r.out[2]).toMatch(/^ron\s+-\s+2026-10-01\s+-\s+-\s+0\s+locked\s+u_00000000000000r2$/);
    expect(r.out.slice(-2)).toEqual(['2 accounts, oldest first.', '2 חשבונות, מהישן לחדש.']);
    const json = await run(['list', '--json', '--token-file', file], { answers: { 'GET /api/admin/accounts': ok({ accounts }) } });
    expect(JSON.parse(json.out.join('\n'))).toEqual(accounts);
    const none = await run(['list', '--token-file', file], { answers: { 'GET /api/admin/accounts': ok({ accounts: [] }) } });
    expect(none.out).toEqual(['No accounts on this server.', 'אין חשבונות בשרת הזה.']);
  });

  it('list --json is plain ASCII (Hebrew as \\uXXXX) and parses back to the same rows - a PowerShell pipeline reads it in any code page', async () => {
    const accounts = [account({ username: 'דנה_1', email: 'דנה@example.co.il' }), account({ id: 'u_00000000000000r2', username: 'ron', email: 'ron@example.com' })];
    const r = await run(['list', '--json', '--token-file', tokenFile()], { answers: { 'GET /api/admin/accounts': ok({ accounts }) } });
    expect(r.code).toBe(EXIT.ok);
    const text = r.out.join('\n');
    expect(text).toMatch(/^[\x20-\x7e\n]*$/);
    expect(text).toContain('"username": "\\u05d3\\u05e0\\u05d4_1"');
    expect(JSON.parse(text)).toEqual(accounts);
    // Characters outside the BMP are escaped as their surrogate pair - still valid JSON.
    expect(asciiJson({ e: '😀', plain: 'a-b' })).toBe('{\n  "e": "\\ud83d\\ude00",\n  "plain": "a-b"\n}');
  });

  it('find prints the one-line delete command in the = form for a username that starts with "-", and that line parses back', async () => {
    const file = tokenFile();
    const dash = account({ username: '--abc', email: 'dash@example.com' });
    for (const argv of [['find', '--abc'], ['find', '--', '--abc'], ['find', 'dash@example.com']]) {
      // --token-file goes first: after `--` everything is a value, as it should be.
      const r = await run(['--token-file', file, ...argv], { answers: { 'GET /api/admin/accounts/find?q=--abc': ok({ matches: [dash] }), 'GET /api/admin/accounts/find?q=dash%40example.com': ok({ matches: [dash] }) } });
      expect({ argv, code: r.code }).toEqual({ argv, code: EXIT.ok });
      const line = r.out.find((l) => l.startsWith('To delete it in one line: '));
      expect(line, argv.join(' ')).toBe('To delete it in one line: node /app/admin.cjs delete --username=--abc --confirm=--abc');
      const words = line!.slice('To delete it in one line: node /app/admin.cjs '.length).split(' ');
      expect(parseArgs(words).command).toEqual({ kind: 'delete', select: { by: 'username', value: '--abc' }, confirm: '--abc' });
      expect(r.out.at(-1)).toBe("  C:\\Users\\AVI\\.fly\\bin\\flyctl.exe ssh console -a yourpersonaldiary -C 'node /app/admin.cjs delete --username=--abc --confirm=--abc'");
    }
    // The help names both escapes.
    const help = await run(['help']);
    expect(help.out.join('\n')).toContain('--username=--help');
    expect(help.out.join('\n')).toContain('find -- --help');
  });

  it('find: 0 with the details and the one-line delete command; 1 when nothing matches; a double match is flagged', async () => {
    const file = tokenFile();
    const q = 'GET /api/admin/accounts/find?q=dana%40example.com';
    const found = await run(['find', 'dana@example.com', '--token-file', file], { answers: { [q]: ok({ matches: [account()] }) } });
    expect(found.code).toBe(EXIT.ok);
    const text = found.out.join('\n');
    expect(text).toContain('dana@example.com');
    expect(text).toContain('2026-10-01');
    expect(text).toContain('47.0 KB');
    expect(text).toContain('To delete it in one line: node /app/admin.cjs delete --username dana --confirm dana');
    // ... and the same as one line for the owner's Windows PowerShell, for the machine's own app.
    expect(found.out.slice(-3)).toEqual([
      'From Windows PowerShell on your computer:',
      'מ-PowerShell במחשב שלכם:',
      "  C:\\Users\\AVI\\.fly\\bin\\flyctl.exe ssh console -a yourpersonaldiary -C 'node /app/admin.cjs delete --username dana --confirm dana'",
    ]);
    const staging = await run(['find', 'dana@example.com', '--token-file', file], { answers: { [q]: ok({ matches: [account()] }) }, env: { FLY_APP_NAME: 'yourpersonaldiary-staging' } });
    expect(staging.out.at(-1)).toBe("  C:\\Users\\AVI\\.fly\\bin\\flyctl.exe ssh console -a yourpersonaldiary-staging -C 'node /app/admin.cjs delete --username dana --confirm dana'");
    expect(powershellLine({ FLY_APP_NAME: 'bad name; rm' }, "x 'y'")).toBe("C:\\Users\\AVI\\.fly\\bin\\flyctl.exe ssh console -a yourpersonaldiary -C 'x ''y'''");
    // An encoded address is looked up decoded.
    const enc = await run(['find', encodeValue('dana@example.com'), '--token-file', file], { answers: { [q]: ok({ matches: [account()] }) } });
    expect(enc.code).toBe(EXIT.ok);
    const none = await run(['find', 'nobody@example.com', '--token-file', file], { answers: { 'GET /api/admin/accounts/find?q=nobody%40example.com': ok({ matches: [] }) } });
    expect(none.code).toBe(EXIT.refused);
    expect(none.out[0]).toContain('No account has the username or e-mail address "nobody@example.com"');
    const twice = await run(['find', 'dana', '--token-file', file], { answers: { 'GET /api/admin/accounts/find?q=dana': ok({ matches: [account(), account({ id: 'u_00000000000000d2' })] }) } });
    expect(twice.out.join('\n')).toContain('More than one account matches');
    expect(twice.out.join('\n')).not.toContain('To delete it in one line');
  });
});

describe('main: delete needs the username again', () => {
  const answersFor = (deleted: AdminRequest[]) => ({
    [findUsername('dana')]: ok({ matches: [account()] }),
    'POST /api/admin/accounts/u_00000000000000d1/delete': (request: AdminRequest) => {
      deleted.push(request);
      return ok({ deleted: true, wasOwner: false });
    },
  });

  it('shows username, registration date and diary size, then deletes when the username is typed again', async () => {
    const deleted: AdminRequest[] = [];
    const r = await run(['delete', '--username', 'dana', '--token-file', tokenFile()], { answers: answersFor(deleted), typed: 'dana' });
    expect(r.code).toBe(EXIT.ok);
    expect(r.prompts).toEqual(['> ']);
    const text = r.out.join('\n');
    expect(text).toContain('This account will be deleted for good');
    expect(text).toMatch(/username \/ שם משתמש:\s+dana/);
    expect(text).toMatch(/registered \/ נרשם:\s+2026-10-01/);
    expect(text).toMatch(/diary size \/ גודל היומן:\s+47\.0 KB/);
    expect(text).toContain('Type the username again');
    // The server is told which username the operator confirmed (it checks it against the id once more).
    expect(deleted).toHaveLength(1);
    expect(deleted[0].body).toEqual({ username: 'dana' });
    expect(text).toContain('Deleted: the account "dana" (registered 2026-10-01)');
    expect(text).toContain("Note today's date (2026-10-28 UTC)");
    expect(text).toContain('רשמו ביומן שלכם את תאריך היום (2026-10-28 UTC)');
  });

  it('nothing is deleted when the typed name differs, differs in case, is empty, or the input ends', async () => {
    for (const typed of ['ron', 'Dana', '', null]) {
      const deleted: AdminRequest[] = [];
      const r = await run(['delete', '--username', 'dana', '--token-file', tokenFile()], { answers: answersFor(deleted), typed });
      expect({ typed, code: r.code, deleted: deleted.length }).toEqual({ typed, code: EXIT.refused, deleted: 0 });
      expect(r.err).toEqual(['Not confirmed - nothing was deleted.', 'לא אושר – שום דבר לא נמחק.']);
    }
    // Surrounding spaces of a typed line (and its CR) do not matter.
    const deleted: AdminRequest[] = [];
    expect((await run(['delete', '--username', 'dana', '--token-file', tokenFile()], { answers: answersFor(deleted), typed: '  dana ' })).code).toBe(EXIT.ok);
    expect(deleted).toHaveLength(1);
  });

  it('--confirm must equal the username exactly - one line for flyctl ssh console -C, no prompt', async () => {
    const deleted: AdminRequest[] = [];
    const good = await run(['delete', '--username', 'DANA', '--confirm', 'dana', '--token-file', tokenFile()], {
      answers: { [findUsername('DANA')]: ok({ matches: [account()] }), 'POST /api/admin/accounts/u_00000000000000d1/delete': () => (deleted.push({} as AdminRequest), ok({ deleted: true, wasOwner: true })) },
    });
    expect(good.code).toBe(EXIT.ok);
    expect(good.prompts).toEqual([]);
    expect(deleted).toHaveLength(1);
    expect(good.out.join('\n')).toContain('This was the owner account (DIARY_OWNER_ID)');
    for (const confirm of ['DANA', 'dana ', 'ron']) {
      const none: AdminRequest[] = [];
      const r = await run(['delete', '--username', 'dana', '--confirm', confirm, '--token-file', tokenFile()], { answers: answersFor(none) });
      expect({ confirm, code: r.code, deleted: none.length, prompts: r.prompts.length }).toEqual({ confirm, code: EXIT.refused, deleted: 0, prompts: 0 });
      expect(r.err[0]).toContain('is not exactly the username "dana" - nothing was deleted');
    }
    // NFC and NFD spellings of the same Hebrew name are the same name.
    expect(confirms('שָׁלוֹם'.normalize('NFD'), 'שָׁלוֹם'.normalize('NFC'))).toBe(true);
    expect(confirms(null, 'dana')).toBe(false);
  });

  it('refuses an unknown and an ambiguous selector, and a server that saw a different name', async () => {
    const file = tokenFile();
    const missing = await run(['delete', '--email', 'nobody@example.com', '--confirm', 'x', '--token-file', file], { answers: { 'GET /api/admin/accounts/find?email=nobody%40example.com': ok({ matches: [] }) } });
    expect(missing.code).toBe(EXIT.refused);
    expect(missing.err[0]).toContain('No account has the e-mail address "nobody@example.com"');
    const deleted: AdminRequest[] = [];
    const ambiguous = await run(['delete', '--username', 'dana', '--confirm', 'dana', '--token-file', file], {
      answers: { [findUsername('dana')]: ok({ matches: [account(), account({ id: 'u_00000000000000d2' })] }), 'POST /api/admin/accounts/u_00000000000000d1/delete': () => (deleted.push({} as AdminRequest), ok({ deleted: true })) },
    });
    expect(ambiguous.code).toBe(EXIT.refused);
    expect(ambiguous.err[0]).toContain('2 accounts match the username "dana" - refusing to act on an ambiguous match');
    expect(deleted).toEqual([]);
    for (const verb of ['revoke', 'unlock']) {
      const r = await run([verb, '--username', 'dana', '--token-file', file], { answers: { [findUsername('dana')]: ok({ matches: [account(), account({ id: 'u_00000000000000d2' })] }) } });
      expect({ verb, code: r.code, posts: r.requests.filter((q) => q.method === 'POST').length }).toEqual({ verb, code: EXIT.refused, posts: 0 });
    }
    const mismatch = await run(['delete', '--username', 'dana', '--confirm', 'dana', '--token-file', file], {
      answers: { [findUsername('dana')]: ok({ matches: [account()] }), 'POST /api/admin/accounts/u_00000000000000d1/delete': { status: 409, admin: true, body: { error: 'username-mismatch', message: 'x' } } },
    });
    expect(mismatch.code).toBe(EXIT.refused);
    expect(mismatch.err[0]).toContain('The account changed meanwhile - nothing was deleted');
    const broken = await run(['delete', '--username', 'dana', '--confirm', 'dana', '--token-file', file], {
      answers: { [findUsername('dana')]: ok({ matches: [account()] }), 'POST /api/admin/accounts/u_00000000000000d1/delete': { status: 500, admin: true, body: { error: 'failed', message: 'The account registry could not be written.' } } },
    });
    expect(broken.code).toBe(EXIT.refused);
    expect(broken.err[0]).toBe('The server could not do it (answer 500): The account registry could not be written.');
  });
});

describe('main: revoke, unlock, status', () => {
  it('revoke and unlock act on the one account and say what happened', async () => {
    const file = tokenFile();
    const revoked = await run(['revoke', '--username', 'dana', '--token-file', file], {
      answers: { [findUsername('dana')]: ok({ matches: [account()] }), 'POST /api/admin/accounts/u_00000000000000d1/revoke-sessions': ok({ revoked: 2 }) },
    });
    expect(revoked.code).toBe(EXIT.ok);
    expect(revoked.out).toEqual(['Signed out on every device: "dana" (2 sessions ended). The account and its diary stay.', 'נותק מכל המכשירים: "dana" (2 חיבורים הסתיימו). החשבון והיומן נשארים.']);
    const unlocked = await run(['unlock', '--email', 'dana@example.com', '--token-file', file], {
      answers: { 'GET /api/admin/accounts/find?email=dana%40example.com': ok({ matches: [account({ locked: true })] }), 'POST /api/admin/accounts/u_00000000000000d1/unlock': ok({ unlocked: true, wasLocked: true }) },
    });
    expect(unlocked.code).toBe(EXIT.ok);
    expect(unlocked.out[0]).toBe('Unlocked: "dana" - its failed sign-in counters were reset; it can sign in right away.');
    const status = await run(['status', '--token-file', file], { answers: { 'GET /api/admin/status': ok({ ok: true, version: '1.0.0', accounts: 3, openDiaries: 1, liveSessions: 4, registration: 'open', ownerConfigured: true }) } });
    expect(status.code).toBe(EXIT.ok);
    expect(status.out[0]).toBe('version 1.0.0; accounts 3; open diaries 1; live sessions 4; registration open; owner configured yes');
  });
});

describe('formatting', () => {
  it('sizes and the table', () => {
    expect([formatBytes(null), formatBytes(0), formatBytes(1023), formatBytes(1024), formatBytes(5 * 1024 * 1024 + 1)]).toEqual(['-', '0 B', '1023 B', '1.0 KB', '5.0 MB']);
    const table = accountTable([account({ username: 'a' }), account({ username: 'a-much-longer-name', id: 'u_2' })]);
    // Columns line up: the e-mail column starts at the same place in every row.
    const starts = table.map((line) => line.indexOf(line.includes('E-MAIL') ? 'E-MAIL' : 'dana@'));
    expect(new Set(starts).size).toBe(1);
  });
});
