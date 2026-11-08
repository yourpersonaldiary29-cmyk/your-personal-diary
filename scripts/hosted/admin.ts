/**
 * The operator tool of the hosted server - /app/admin.cjs in the image (docs/HOSTED-PLAN.md 3.10,
 * docs/android-tasks/ADMIN-TOOL.md item 2). Built by scripts/build-hosted.mjs into
 * deploy/hosted/build/admin.cjs, staged next to the server bundle by scripts/hosted/stage-image.mjs.
 * It runs INSIDE the server's machine, reached with the owner's Fly login:
 *
 *   flyctl ssh console -a yourpersonaldiary -C 'node /app/admin.cjs find dana@example.com'
 *
 *   node /app/admin.cjs list [--json]                  every account, oldest first (never diary content)
 *   node /app/admin.cjs find <e-mail-or-username>      the account with exactly this e-mail address or username
 *   node /app/admin.cjs delete (--username <u> | --email <e>) [--confirm <username>]
 *   node /app/admin.cjs revoke (--username <u> | --email <e>)    sign out on every device
 *   node /app/admin.cjs unlock (--username <u> | --email <e>)    reset the failed sign-in counters
 *   node /app/admin.cjs status                         counts only
 *   node /app/admin.cjs help
 *   any command: --token-file <path>
 *
 * A deletion first shows the account's username, registration date and diary size and then needs the
 * username typed again - or `--confirm <username>` equal to it exactly, for one line through
 * `flyctl ssh console -C`. Matches are exact (upper / lower case aside); more than one account for a
 * selector (only possible in a damaged registry) is refused. Every message is printed in English and
 * then in Hebrew; `find` also prints the delete command as one line for the owner's Windows PowerShell.
 * An e-mail address with characters PowerShell or the machine's command line would change (an
 * apostrophe, `$`, quotes, spaces) is given as `b64:<base64url of its UTF-8>` (`decodeValue`).
 * A username that starts with "-" (the username rule allows `-abc`, `--abc`, even `--help`) is a value,
 * not an option: `find --abc` and `--username --abc` work; a name that spells one of the tool's own
 * options goes after `=` or `--` (`--username=--help`, `find -- --help`), and the one-line delete command
 * `find` prints uses the `=` form for any such name. `list --json` is plain ASCII (other letters as
 * \uXXXX), so a Windows PowerShell pipeline reads it right whatever the console's code page.
 *
 * The tool talks to the RUNNING server only (it owns the files, the sessions and the open diaries), over
 * its loopback admin API (server/src/routes/admin.ts): plain HTTP to 127.0.0.1 - the one host this file
 * may address (scripts/check-no-network.mjs rule 4b; scripts/hosted/bundle-audit.mjs checks the built
 * admin.cjs) - on the port and with the per-boot token the server wrote to its token file
 * (server/src/hosted/admin-token.ts). The file is found at --token-file, else $DIARY_ADMIN_TOKEN_FILE,
 * else $DIARY_DATA_DIR/.admin-token, else /data/.admin-token.
 *
 * Exit codes: 0 done (find: at least one match), 1 refused / not found / not confirmed / the server could
 * not do it, 2 wrong command line, 3 no token file or the server cannot be reached / did not accept it.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type {
  AdminAccount,
  AdminDeleteResponse,
  AdminErrorResponse,
  AdminFindResponse,
  AdminListResponse,
  AdminRevokeResponse,
  AdminStatusResponse,
  AdminUnlockResponse,
} from '../../server/src/routes/admin';

/** The only host the tool addresses. */
export const ADMIN_HOST = '127.0.0.1';
/** Header of the per-boot token (server/src/hosted/admin-token.ts ADMIN_TOKEN_HEADER). */
export const TOKEN_HEADER = 'x-admin-token';
/** Header on every answer of the admin API (server/src/routes/admin.ts ADMIN_API_HEADER). */
export const API_HEADER = 'x-admin-api';
/** The token file's name inside the data directory, and the default place in the image. */
export const TOKEN_FILE_NAME = '.admin-token';
export const DEFAULT_TOKEN_FILE = '/data/.admin-token';
/** How the tool is called in the image (help texts, the one-line delete hint). */
export const TOOL = 'node /app/admin.cjs';

export const EXIT = { ok: 0, refused: 1, usage: 2, unreachable: 3 } as const;

// Command line ------------------------------------------------------------------------------------

export type Selector = { by: 'username' | 'email'; value: string };
export type Command =
  | { kind: 'help' }
  | { kind: 'status' }
  | { kind: 'list'; json: boolean }
  | { kind: 'find'; query: string }
  | { kind: 'delete'; select: Selector; confirm: string | null }
  | { kind: 'revoke'; select: Selector }
  | { kind: 'unlock'; select: Selector };
export interface ParsedArgs {
  command: Command;
  /** --token-file, when given. */
  tokenFile: string | null;
}

export class UsageError extends Error {}

/** The prefix of an encoded value (see `decodeValue`). */
export const B64_PREFIX = 'b64:';

/**
 * `b64:<base64url>` stands for the UTF-8 text it encodes - for an e-mail address with characters that
 * PowerShell or the machine's command line would change (an apostrophe, `$`, quotes, spaces): the
 * encoded form is only letters, digits, `-` and `_`. Unambiguous: a username never contains `:` and an
 * e-mail address always contains `@`, which base64url never does. Anything else is taken as it is.
 */
export function decodeValue(raw: string): string {
  if (!raw.startsWith(B64_PREFIX)) return raw;
  const payload = raw.slice(B64_PREFIX.length);
  if (!/^[A-Za-z0-9_-]+$/.test(payload)) return raw;
  return Buffer.from(payload, 'base64url').toString('utf8');
}

/** The `b64:` form of `value` (what the Server card puts into a command for an unusual address). */
export function encodeValue(value: string): string {
  return `${B64_PREFIX}${Buffer.from(value, 'utf8').toString('base64url')}`;
}

/**
 * True when `value` can go into the one-line command as it is: letters and digits of any script and
 * `. _ % + = @ -` only - nothing PowerShell (single quotes) or the machine's command line would touch.
 */
export function isPlainValue(value: string): boolean {
  return /^[\p{L}\p{M}\p{N}._%+=@-]+$/u.test(value);
}

/**
 * `--name value` - or `--name=value` when the value starts with "-" (a username such as `-abc` or `--abc`,
 * allowed by the username rule): the one form the tool reads as a value whatever the name spells.
 */
export function optionArg(name: string, value: string): string {
  return value.startsWith('-') ? `${name}=${value}` : `${name} ${value}`;
}

const VALUE_OPTIONS = new Set(['--token-file', '--username', '--email', '--confirm']);
const FLAG_OPTIONS = new Set(['--json', '--help', '-h']);

/**
 * True for one of the tool's own option words (`--username`, `--json`, `--token-file=<path>`, `--`, ...)
 * as opposed to a VALUE that merely starts with "-": the username rule (shared USERNAME_PATTERN) allows
 * `-abc`, `--abc` and even `--help`, and a throw-away account may pick such a name on purpose.
 */
function isOptionWord(arg: string): boolean {
  if (arg === '--' || FLAG_OPTIONS.has(arg) || VALUE_OPTIONS.has(arg)) return true;
  const eq = arg.startsWith('--') ? arg.indexOf('=') : -1;
  return eq > 0 && VALUE_OPTIONS.has(arg.slice(0, eq));
}
/** Options each command accepts besides --token-file. */
const ALLOWED: Record<string, readonly string[]> = {
  status: [],
  list: ['--json'],
  find: [],
  delete: ['--username', '--email', '--confirm'],
  revoke: ['--username', '--email'],
  unlock: ['--username', '--email'],
};

/**
 * Parses the arguments after `node admin.cjs`. Options take their value as the next argument or after
 * `=` (`--username=dana`); `--` ends the options. A value may start with "-" (`--username --abc`,
 * `find -abc`) unless it spells one of the tool's own option words - then it goes after `=` or `--`
 * (`--username=--help`, `find -- --help`). Throws UsageError for anything unknown, missing, repeated or
 * out of place.
 */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const positional: string[] = [];
  let optionsEnded = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (optionsEnded) {
      positional.push(arg);
      continue;
    }
    if (arg === '--') {
      optionsEnded = true;
      continue;
    }
    // The query of `find` may start with "-" (a username such as `-abc` or `--abc`) unless it spells an option.
    if (positional.length === 1 && positional[0] === 'find' && arg.startsWith('-') && !isOptionWord(arg)) {
      positional.push(arg);
      continue;
    }
    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1;
    if (eq > 0) {
      const name = arg.slice(0, eq);
      const value = arg.slice(eq + 1);
      if (!VALUE_OPTIONS.has(name)) throw new UsageError(`unknown option ${name}`);
      if (values.has(name)) throw new UsageError(`${name} is given twice`);
      if (!value) throw new UsageError(`${name} needs a value`);
      values.set(name, value);
    } else if (VALUE_OPTIONS.has(arg)) {
      const value = argv[i + 1];
      if (value === undefined || value === '' || isOptionWord(value)) throw new UsageError(`${arg} needs a value`);
      if (values.has(arg)) throw new UsageError(`${arg} is given twice`);
      values.set(arg, value);
      i++;
    } else if (FLAG_OPTIONS.has(arg)) {
      if (flags.has(arg)) throw new UsageError(`${arg} is given twice`);
      flags.add(arg);
    } else if (arg.startsWith('-') && arg !== '-') {
      throw new UsageError(`unknown option ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  const tokenFile = values.get('--token-file') ?? null;
  if (flags.has('--help') || flags.has('-h') || positional[0] === 'help') return { command: { kind: 'help' }, tokenFile };
  const name = positional[0];
  if (!name) throw new UsageError('no command given');
  if (!Object.prototype.hasOwnProperty.call(ALLOWED, name)) throw new UsageError(`unknown command "${name}"`);
  const allowed = ALLOWED[name];
  for (const option of [...values.keys(), ...flags]) {
    if (option !== '--token-file' && !allowed.includes(option)) throw new UsageError(`${option} does not belong to "${name}"`);
  }
  const extra = positional.slice(name === 'find' ? 2 : 1);
  if (extra.length) throw new UsageError(`unexpected argument "${extra[0]}"`);

  const selector = (): Selector => {
    const username = values.get('--username');
    const email = values.get('--email');
    if (username !== undefined && email !== undefined) throw new UsageError(`"${name}" takes --username or --email, not both`);
    if (username !== undefined) return { by: 'username', value: username };
    if (email !== undefined) return { by: 'email', value: decodeValue(email) };
    throw new UsageError(`"${name}" needs --username <username> (or --email <address>)`);
  };

  let command: Command;
  switch (name) {
    case 'status':
      command = { kind: 'status' };
      break;
    case 'list':
      command = { kind: 'list', json: flags.has('--json') };
      break;
    case 'find': {
      const query = decodeValue((positional[1] ?? '').trim()).trim();
      if (!query) throw new UsageError('"find" needs an e-mail address or a username');
      command = { kind: 'find', query };
      break;
    }
    case 'delete':
      command = { kind: 'delete', select: selector(), confirm: values.get('--confirm') ?? null };
      break;
    case 'revoke':
      command = { kind: 'revoke', select: selector() };
      break;
    default:
      command = { kind: 'unlock', select: selector() };
  }
  return { command, tokenFile };
}

// The token file ----------------------------------------------------------------------------------

/** Where the token file is looked for: --token-file, $DIARY_ADMIN_TOKEN_FILE, $DIARY_DATA_DIR/.admin-token, /data/.admin-token. */
export function tokenFilePath(option: string | null, env: Readonly<Record<string, string | undefined>>): string {
  if (option) return option;
  const explicit = env.DIARY_ADMIN_TOKEN_FILE?.trim();
  if (explicit) return explicit;
  const dataDir = env.DIARY_DATA_DIR?.trim();
  if (dataDir) return path.join(dataDir, TOKEN_FILE_NAME);
  return DEFAULT_TOKEN_FILE;
}

export type TokenFileProblem = 'missing' | 'forbidden' | 'invalid';
export class TokenFileError extends Error {
  constructor(
    readonly problem: TokenFileProblem,
    readonly file: string,
  ) {
    super(`${problem}: ${file}`);
  }
}

export interface Connection {
  port: number;
  token: string;
}

/** Reads the port and the token the server wrote at its start. Throws TokenFileError. */
export function readTokenFile(file: string): Connection {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') throw new TokenFileError('missing', file);
    if (code === 'EACCES' || code === 'EPERM') throw new TokenFileError('forbidden', file);
    throw new TokenFileError('invalid', file);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new TokenFileError('invalid', file);
  }
  const p = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
  const port = p.port;
  const token = p.token;
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token) || typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new TokenFileError('invalid', file);
  }
  return { port, token };
}

// Talking to the server ---------------------------------------------------------------------------

export interface AdminRequest {
  port: number;
  token: string;
  method: 'GET' | 'POST';
  /** Path with query, e.g. /api/admin/accounts/find?q=dana%40example.com */
  path: string;
  body?: unknown;
}
export interface AdminAnswer {
  status: number;
  /** The answer came from the admin API (it carries X-Admin-Api: 1) - not the 404 / 421 of an unknown route. */
  admin: boolean;
  body: unknown;
}
export type AdminTransport = (request: AdminRequest) => Promise<AdminAnswer>;

/** HTTP to 127.0.0.1 - nothing else, ever. One connection per request (no keep-alive keeps the tool running). */
export const httpTransport: AdminTransport = (request) =>
  new Promise<AdminAnswer>((resolve, reject) => {
    const payload = request.body === undefined ? null : Buffer.from(JSON.stringify(request.body), 'utf8');
    const headers: Record<string, string | number> = { [TOKEN_HEADER]: request.token, accept: 'application/json' };
    if (payload) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = payload.length;
    }
    const req = http.request({ host: '127.0.0.1', port: request.port, path: request.path, method: request.method, headers, agent: false, timeout: 120_000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let body: unknown = null;
        try {
          body = text ? JSON.parse(text) : null;
        } catch {
          body = null;
        }
        resolve({ status: res.statusCode ?? 0, admin: res.headers[API_HEADER] === '1', body });
      });
    });
    req.on('timeout', () => req.destroy(new Error('no answer within 120 seconds')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });

class Unreachable extends Error {}
class Rejected extends Error {
  constructor(readonly status: number) {
    super(`answer ${status}`);
  }
}
class Failed extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail: string,
  ) {
    super(detail);
  }
}

/** One call of the admin API: the body of a 2xx answer, or Unreachable / Rejected / Failed. */
async function call<T>(transport: AdminTransport, conn: Connection, method: 'GET' | 'POST', urlPath: string, body?: unknown): Promise<T> {
  let answer: AdminAnswer;
  try {
    answer = await transport({ port: conn.port, token: conn.token, method, path: urlPath, ...(body === undefined ? {} : { body }) });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    throw new Unreachable(err?.code ?? err?.message ?? 'no connection');
  }
  if (!answer.admin) throw new Rejected(answer.status);
  if (answer.status < 200 || answer.status >= 300) {
    const b = (answer.body && typeof answer.body === 'object' ? answer.body : {}) as Partial<AdminErrorResponse>;
    throw new Failed(answer.status, typeof b.error === 'string' ? b.error : 'failed', typeof b.message === 'string' ? b.message : '');
  }
  return answer.body as T;
}

// Output --------------------------------------------------------------------------------------------

export interface CliIo {
  out(line: string): void;
  err(line: string): void;
  /** Prints `prompt` and reads one line (without its line break); null at the end of the input. */
  readLine(prompt: string): Promise<string | null>;
  env: Readonly<Record<string, string | undefined>>;
  transport: AdminTransport;
  now(): Date;
}

/** One message: the English line, then the Hebrew line. */
function say(write: (line: string) => void, en: string, he: string): void {
  write(en);
  write(he);
}

/** The production app (deploy/hosted/fly.toml); a Fly machine names its own in FLY_APP_NAME. */
export const DEFAULT_FLY_APP = 'yourpersonaldiary';
/** The owner's flyctl (server/src/hosted/archive.ts FLYCTL_WINDOWS_PATH - the same full path the Server card shows). */
export const FLYCTL_WINDOWS_PATH = 'C:\\Users\\AVI\\.fly\\bin\\flyctl.exe';

/**
 * `command` (run inside the machine) as one line for the owner's Windows PowerShell 5.1:
 * <flyctl> ssh console -a <app> -C '<command>' - single quotes, so PowerShell changes nothing in it
 * (`$` and backticks stay as they are; a quote inside is doubled); the full path of flyctl.exe needs
 * no `&` (it has no spaces) and works whether or not flyctl is on the PATH.
 */
export function powershellLine(env: Readonly<Record<string, string | undefined>>, command: string): string {
  const app = env.FLY_APP_NAME && /^[a-z0-9-]+$/.test(env.FLY_APP_NAME) ? env.FLY_APP_NAME : DEFAULT_FLY_APP;
  return `${FLYCTL_WINDOWS_PATH} ssh console -a ${app} -C '${command.replace(/'/g, "''")}'`;
}

export function formatBytes(n: number | null): string {
  if (n === null || !Number.isFinite(n) || n < 0) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * `value` as indented JSON in plain ASCII - every character outside printable ASCII as `\uXXXX` - for a
 * PowerShell pipeline on the owner's PC: Windows PowerShell 5.1 decodes a program's output with the
 * window's code page (850 there, not UTF-8), which garbles Hebrew usernames and addresses; escapes
 * survive any code page and ConvertFrom-Json gives the letters back.
 */
export function asciiJson(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/** The date part (UTC) of an ISO time; '-' when there is none. */
export function formatDate(iso: string | null | undefined): string {
  return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : '-';
}

function stateOf(a: AdminAccount): string {
  const parts = [a.open ? 'open' : '', a.locked ? 'locked' : ''].filter(Boolean);
  return parts.length ? parts.join(',') : '-';
}

/** The accounts as a plain table (no colours, no box drawing - it is read in a PowerShell window). */
export function accountTable(accounts: readonly AdminAccount[]): string[] {
  const header = ['USERNAME', 'E-MAIL', 'REGISTERED', 'LAST SIGN-IN', 'DIARY', 'DEVICES', 'STATE', 'ID'];
  const rows = accounts.map((a) => [a.username, a.email || '-', formatDate(a.createdAt), formatDate(a.lastLoginAt), formatBytes(a.diaryBytes), String(a.sessions), stateOf(a), a.id]);
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells: string[]) =>
    cells
      .map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i])))
      .join('  ')
      .trimEnd();
  return [line(header), ...rows.map(line)];
}

function details(write: (line: string) => void, a: AdminAccount): void {
  write(`  username / שם משתמש:            ${a.username}`);
  write(`  e-mail / מייל:                   ${a.email || '-'}`);
  write(`  registered / נרשם:               ${formatDate(a.createdAt)}`);
  write(`  last sign-in / כניסה אחרונה:     ${formatDate(a.lastLoginAt)}`);
  write(`  diary size / גודל היומן:         ${formatBytes(a.diaryBytes)}`);
  write(`  signed-in devices / מכשירים:     ${a.sessions}`);
  write(`  locked / נעול:                   ${a.locked ? 'yes / כן' : 'no / לא'}`);
  write(`  id / מזהה:                       ${a.id}`);
}

const USAGE_LINES = [
  'Your Personal Diary - operator tool of the hosted server. It runs inside the server\'s machine:',
  "  flyctl ssh console -a yourpersonaldiary -C 'node /app/admin.cjs <command>'",
  '',
  `  ${TOOL} list [--json]                 every account, oldest first`,
  `  ${TOOL} find <e-mail-or-username>     the account with exactly this e-mail address or username`,
  `  ${TOOL} delete --username <u> [--confirm <u>]`,
  `  ${TOOL} delete --email <e> [--confirm <username>]`,
  '        deletes the account for good, after the username is typed again (or given with --confirm, exactly)',
  `  ${TOOL} revoke --username <u>         signs the account out on every device (--email <e> works too)`,
  `  ${TOOL} unlock --username <u>         resets its failed sign-in counters (--email <e> works too)`,
  `  ${TOOL} status                        counts only`,
  `  An address with characters PowerShell or the command line would change (' $ " \` spaces) can be given as`,
  `  ${B64_PREFIX}<its UTF-8 in base64url>, e.g. find ${encodeValue("o'brien@example.com")} (= o'brien@example.com).`,
  '  A username that starts with "-" (the username rule allows it) is a value: find --abc and --username --abc work; one that',
  '  spells an option of this tool goes after = or after --: delete --username=--help --confirm=--help, find -- --help.',
  '  list --json is plain ASCII (other letters as \\uXXXX): a Windows PowerShell pipeline reads it right in any code page.',
  '  Any command: --token-file <path> (default $DIARY_ADMIN_TOKEN_FILE, else $DIARY_DATA_DIR/.admin-token, else /data/.admin-token)',
  '  Exit codes: 0 done, 1 refused / not found / not confirmed / failed, 2 wrong command line, 3 server or token file not reachable.',
  '',
  'כלי הניהול של השרת: list – כל החשבונות; find – חשבון לפי מייל או שם משתמש מדויקים; delete – מחיקה לצמיתות',
  'אחרי הקלדה חוזרת של שם המשתמש (או --confirm); revoke – ניתוק מכל המכשירים; unlock – איפוס מוני הכניסות השגויות.',
  'שם משתמש שמתחיל במקף הוא ערך (find --abc עובד); שם שהוא בדיוק אפשרות של הכלי נכתב אחרי = או אחרי --: --username=--help, find -- --help.',
];

// The commands --------------------------------------------------------------------------------------

/** The one account `select` names - or null after printing why not (none, or an ambiguous answer). */
async function resolveOne(io: CliIo, conn: Connection, select: Selector): Promise<AdminAccount | null> {
  const found = await call<AdminFindResponse>(io.transport, conn, 'GET', `/api/admin/accounts/find?${select.by}=${encodeURIComponent(select.value)}`);
  const field = select.by === 'username' ? 'username' : 'e-mail address';
  const fieldHe = select.by === 'username' ? 'שם המשתמש' : 'כתובת המייל';
  if (found.matches.length === 0) {
    say(io.err, `No account has the ${field} "${select.value}" (exact match, upper / lower case aside). Nothing was changed.`, `אין חשבון עם ${fieldHe} "${select.value}" (התאמה מדויקת, בלי הבדל בין אותיות גדולות לקטנות). שום דבר לא שונה.`);
    return null;
  }
  if (found.matches.length > 1) {
    say(
      io.err,
      `${found.matches.length} accounts match the ${field} "${select.value}" - refusing to act on an ambiguous match. Nothing was changed.`,
      `${found.matches.length} חשבונות מתאימים ל${fieldHe} "${select.value}" – לא פועלים על התאמה לא חד-משמעית. שום דבר לא שונה.`,
    );
    return null;
  }
  return found.matches[0];
}

/** True when `given` is exactly `username` (both in Unicode NFC form). */
export function confirms(given: string | null, username: string): boolean {
  return typeof given === 'string' && given.normalize('NFC') === username.normalize('NFC');
}

async function runDelete(io: CliIo, conn: Connection, select: Selector, confirmOption: string | null): Promise<number> {
  const account = await resolveOne(io, conn, select);
  if (!account) return EXIT.refused;
  say(io.out, 'This account will be deleted for good - its diary cannot be brought back:', 'החשבון הזה יימחק לצמיתות – אי אפשר יהיה להחזיר את היומן שלו:');
  io.out(`  username / שם משתמש:        ${account.username}`);
  io.out(`  registered / נרשם:           ${formatDate(account.createdAt)}`);
  io.out(`  diary size / גודל היומן:     ${formatBytes(account.diaryBytes)}`);
  if (confirmOption !== null) {
    if (!confirms(confirmOption, account.username)) {
      say(io.err, `--confirm "${confirmOption}" is not exactly the username "${account.username}" - nothing was deleted.`, `הערך של --confirm "${confirmOption}" אינו בדיוק שם המשתמש "${account.username}" – שום דבר לא נמחק.`);
      return EXIT.refused;
    }
  } else {
    say(io.out, 'Type the username again to delete it, or just press Enter to cancel:', 'הקלידו שוב את שם המשתמש כדי למחוק, או Enter לביטול:');
    const typed = await io.readLine('> ');
    if (!confirms(typed === null ? null : typed.trim(), account.username)) {
      say(io.err, 'Not confirmed - nothing was deleted.', 'לא אושר – שום דבר לא נמחק.');
      return EXIT.refused;
    }
  }
  let result: AdminDeleteResponse;
  try {
    result = await call<AdminDeleteResponse>(io.transport, conn, 'POST', `/api/admin/accounts/${encodeURIComponent(account.id)}/delete`, { username: account.username });
  } catch (e) {
    if (e instanceof Failed && e.code === 'username-mismatch') {
      say(io.err, 'The account changed meanwhile - nothing was deleted. Look it up again.', 'החשבון השתנה בינתיים – שום דבר לא נמחק. חפשו אותו שוב.');
      return EXIT.refused;
    }
    if (e instanceof Failed && e.code === 'not-found') {
      say(io.err, 'The account no longer exists (deleted meanwhile?). Nothing was changed.', 'החשבון כבר לא קיים (נמחק בינתיים?). שום דבר לא שונה.');
      return EXIT.refused;
    }
    throw e;
  }
  const today = io.now().toISOString().slice(0, 10);
  say(
    io.out,
    `Deleted: the account "${account.username}" (registered ${formatDate(account.createdAt)}) with its diary, its sessions on every device and its pending password resets. Note today's date (${today} UTC) in your log.`,
    `נמחק: החשבון "${account.username}" (נרשם ב-${formatDate(account.createdAt)}) עם היומן, החיבורים בכל המכשירים ובקשות איפוס הסיסמה שלו. רשמו ביומן שלכם את תאריך היום (${today} UTC).`,
  );
  if (result.wasOwner) {
    say(
      io.out,
      'This was the owner account (DIARY_OWNER_ID): the owner cards stay off until DIARY_OWNER_ID names an existing account.',
      'זה היה חשבון הבעלים (DIARY_OWNER_ID): כרטיסי הבעלים כבויים עד ש-DIARY_OWNER_ID יצביע על חשבון קיים.',
    );
  }
  return EXIT.ok;
}

async function runCommand(io: CliIo, conn: Connection, command: Exclude<Command, { kind: 'help' }>): Promise<number> {
  switch (command.kind) {
    case 'status': {
      const s = await call<AdminStatusResponse>(io.transport, conn, 'GET', '/api/admin/status');
      io.out(`version ${s.version}; accounts ${s.accounts}; open diaries ${s.openDiaries}; live sessions ${s.liveSessions}; registration ${s.registration}; owner configured ${s.ownerConfigured ? 'yes' : 'no'}`);
      io.out(`גרסה ${s.version}; חשבונות ${s.accounts}; יומנים פתוחים ${s.openDiaries}; חיבורים פעילים ${s.liveSessions}; הרשמה ${s.registration}; בעלים מוגדר ${s.ownerConfigured ? 'כן' : 'לא'}`);
      return EXIT.ok;
    }
    case 'list': {
      const { accounts } = await call<AdminListResponse>(io.transport, conn, 'GET', '/api/admin/accounts');
      if (command.json) {
        io.out(asciiJson(accounts));
        return EXIT.ok;
      }
      if (!accounts.length) {
        say(io.out, 'No accounts on this server.', 'אין חשבונות בשרת הזה.');
        return EXIT.ok;
      }
      for (const line of accountTable(accounts)) io.out(line);
      say(
        io.out,
        accounts.length === 1 ? '1 account.' : `${accounts.length} accounts, oldest first.`,
        accounts.length === 1 ? 'חשבון אחד.' : `${accounts.length} חשבונות, מהישן לחדש.`,
      );
      return EXIT.ok;
    }
    case 'find': {
      const { matches } = await call<AdminFindResponse>(io.transport, conn, 'GET', `/api/admin/accounts/find?q=${encodeURIComponent(command.query)}`);
      if (!matches.length) {
        say(
          io.out,
          `No account has the username or e-mail address "${command.query}" (exact match, upper / lower case aside).`,
          `אין חשבון ששם המשתמש או כתובת המייל שלו "${command.query}" (התאמה מדויקת, בלי הבדל בין אותיות גדולות לקטנות).`,
        );
        return EXIT.refused;
      }
      say(io.out, matches.length === 1 ? 'Found one account:' : `Found ${matches.length} accounts:`, matches.length === 1 ? 'נמצא חשבון אחד:' : `נמצאו ${matches.length} חשבונות:`);
      for (const a of matches) details(io.out, a);
      if (matches.length === 1) {
        const u = matches[0].username;
        const inside = `${TOOL} delete ${optionArg('--username', u)} ${optionArg('--confirm', u)}`;
        say(io.out, `To delete it in one line: ${inside}`, `למחיקה בשורה אחת: ${inside}`);
        // The same as one line for the owner's own Windows PowerShell (a username never holds a quote).
        say(io.out, 'From Windows PowerShell on your computer:', 'מ-PowerShell במחשב שלכם:');
        io.out(`  ${powershellLine(io.env, inside)}`);
      } else {
        say(
          io.out,
          'More than one account matches - the registry may be damaged; delete, revoke and unlock refuse such a match.',
          'יותר מחשבון אחד מתאים – ייתכן שרשימת החשבונות פגומה; delete, revoke ו-unlock מסרבים להתאמה כזו.',
        );
      }
      return EXIT.ok;
    }
    case 'delete':
      return runDelete(io, conn, command.select, command.confirm);
    case 'revoke': {
      const account = await resolveOne(io, conn, command.select);
      if (!account) return EXIT.refused;
      const r = await call<AdminRevokeResponse>(io.transport, conn, 'POST', `/api/admin/accounts/${encodeURIComponent(account.id)}/revoke-sessions`);
      say(
        io.out,
        `Signed out on every device: "${account.username}" (${r.revoked} session${r.revoked === 1 ? '' : 's'} ended). The account and its diary stay.`,
        `נותק מכל המכשירים: "${account.username}" (${r.revoked} חיבורים הסתיימו). החשבון והיומן נשארים.`,
      );
      return EXIT.ok;
    }
    case 'unlock': {
      const account = await resolveOne(io, conn, command.select);
      if (!account) return EXIT.refused;
      const r = await call<AdminUnlockResponse>(io.transport, conn, 'POST', `/api/admin/accounts/${encodeURIComponent(account.id)}/unlock`);
      if (r.wasLocked) {
        say(
          io.out,
          `Unlocked: "${account.username}" - its failed sign-in counters were reset; it can sign in right away.`,
          `שוחרר: "${account.username}" – מוני הכניסות השגויות אופסו; אפשר להיכנס מיד.`,
        );
      } else {
        say(io.out, `"${account.username}" was not locked; its counters were reset anyway.`, `"${account.username}" לא היה נעול; המונים אופסו בכל זאת.`);
      }
      return EXIT.ok;
    }
  }
}

/** The whole tool: parses `argv`, reads the token file, runs the command. Returns the exit code. */
export async function main(argv: readonly string[], io: CliIo): Promise<number> {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(argv);
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    say(io.err, `Wrong command line: ${e.message}. Help: ${TOOL} help`, `שורת פקודה שגויה: ${e.message}. הסבר: ${TOOL} help`);
    return EXIT.usage;
  }
  const command = parsed.command;
  if (command.kind === 'help') {
    for (const line of USAGE_LINES) io.out(line);
    return EXIT.ok;
  }
  const file = tokenFilePath(parsed.tokenFile, io.env);
  let conn: Connection;
  try {
    conn = readTokenFile(file);
  } catch (e) {
    if (!(e instanceof TokenFileError)) throw e;
    if (e.problem === 'missing') {
      say(io.err, `The admin token file ${file} does not exist. Is the server running? It writes this file every time it starts.`, `קובץ אסימון הניהול ${file} לא קיים. האם השרת פועל? הוא כותב את הקובץ בכל הפעלה.`);
    } else if (e.problem === 'forbidden') {
      say(
        io.err,
        `No permission to read ${file}. Run the tool inside the server's machine (flyctl ssh console), as root or as the server's user.`,
        `אין הרשאה לקרוא את ${file}. מריצים את הכלי בתוך המכונה של השרת (flyctl ssh console), כ-root או כמשתמש של השרת.`,
      );
    } else {
      say(io.err, `${file} is not an admin token file of this server (damaged, or written by something else).`, `${file} אינו קובץ אסימון ניהול של השרת הזה (פגום, או שנכתב על ידי משהו אחר).`);
    }
    return EXIT.unreachable;
  }
  try {
    return await runCommand(io, conn, command);
  } catch (e) {
    if (e instanceof Unreachable) {
      say(
        io.err,
        `Cannot reach the server at ${ADMIN_HOST}:${conn.port} (${e.message}). Is it running? Check with: flyctl status`,
        `אין חיבור לשרת בכתובת ${ADMIN_HOST}:${conn.port} (${e.message}). האם הוא פועל? בודקים עם: flyctl status`,
      );
      return EXIT.unreachable;
    }
    if (e instanceof Rejected) {
      say(
        io.err,
        `The server did not accept the admin token (answer ${e.status}). The token changes every time the server starts - if it restarted just now, run the command again.`,
        `השרת לא קיבל את אסימון הניהול (תשובה ${e.status}). האסימון מתחלף בכל הפעלה של השרת – אם הוא הופעל מחדש עכשיו, מריצים את הפקודה שוב.`,
      );
      return EXIT.unreachable;
    }
    if (e instanceof Failed) {
      const detail = e.detail || e.code;
      say(io.err, `The server could not do it (answer ${e.status}): ${detail}`, `השרת לא הצליח לבצע את הפעולה (תשובה ${e.status}): ${detail}`);
      return EXIT.refused;
    }
    throw e;
  }
}

// The process ----------------------------------------------------------------------------------------

/** Reads one line of the standard input (the typed confirmation); null at its end. */
function readLineFromStdin(prompt: string): Promise<string | null> {
  process.stdout.write(prompt);
  return new Promise<string | null>((resolve) => {
    const stdin = process.stdin;
    let buffered = '';
    let done = false;
    const finish = (value: string | null) => {
      if (done) return;
      done = true;
      stdin.off('data', onData);
      stdin.off('end', onEnd);
      stdin.off('error', onEnd);
      stdin.pause();
      (stdin as { unref?: () => void }).unref?.();
      resolve(value);
    };
    const onData = (chunk: string) => {
      buffered += chunk;
      const nl = buffered.indexOf('\n');
      if (nl >= 0) finish(buffered.slice(0, nl).replace(/\r$/, ''));
    };
    const onEnd = () => finish(buffered.length ? buffered.replace(/\r?\n?$/, '') : null);
    stdin.setEncoding('utf8');
    stdin.on('data', onData);
    stdin.on('end', onEnd);
    stdin.on('error', onEnd);
    stdin.resume();
  });
}

export function processIo(): CliIo {
  return {
    out: (line) => {
      process.stdout.write(`${line}\n`);
    },
    err: (line) => {
      process.stderr.write(`${line}\n`);
    },
    readLine: readLineFromStdin,
    env: process.env,
    transport: httpTransport,
    now: () => new Date(),
  };
}

// Set to true by scripts/build-hosted.mjs (esbuild `define`) for admin.cjs only: importing this file
// (the tests) runs nothing.
declare const __ADMIN_CLI__: boolean | undefined;
if (typeof __ADMIN_CLI__ !== 'undefined' && __ADMIN_CLI__) {
  main(process.argv.slice(2), processIo())
    .then(
      (code) => {
        process.exitCode = code;
      },
      (e: unknown) => {
        process.stderr.write(`Unexpected error / שגיאה לא צפויה: ${(e as Error)?.message ?? String(e)}\n`);
        process.exitCode = EXIT.refused;
      },
    )
    .finally(() => {
      // Nothing should keep the tool alive now; should a terminal input do so, leave anyway.
      setTimeout(() => process.exit(process.exitCode ?? 0), 2_000).unref();
    });
}
