/**
 * Node-style file system errors for the VFS: an `Error` with `code`, `errno`, `syscall`, `path`
 * (and `dest`) and the message Node itself would print, e.g.
 *
 *   ENOENT: no such file or directory, open '/data/accounts.json'
 *   ENOENT: no such file or directory, rename '/data/a.tmp' -> '/data/a'
 *
 * The server code branches on `err.code` (security/accounts.ts, sessions.ts, device-key.ts,
 * vault.ts), so the codes must be exactly Node's.
 */

const DESCRIPTIONS = {
  EPERM: 'operation not permitted',
  ENOENT: 'no such file or directory',
  EIO: 'i/o error',
  EBADF: 'bad file descriptor',
  EACCES: 'permission denied',
  EEXIST: 'file already exists',
  ENOTDIR: 'not a directory',
  EISDIR: 'illegal operation on a directory',
  EINVAL: 'invalid argument',
  ENOTEMPTY: 'directory not empty',
} as const;

/** errno values of Linux (Android), negated like libuv reports them. */
const ERRNO: Record<FsErrorCode, number> = {
  EPERM: -1,
  ENOENT: -2,
  EIO: -5,
  EBADF: -9,
  EACCES: -13,
  EEXIST: -17,
  ENOTDIR: -20,
  EISDIR: -21,
  EINVAL: -22,
  ENOTEMPTY: -39,
};

export type FsErrorCode = keyof typeof DESCRIPTIONS;

/** The shape of Node's `ErrnoException` (declared here so this module needs no Node types). */
export interface FsError extends Error {
  code: string;
  errno: number;
  syscall: string;
  path?: string;
  dest?: string;
}

/** `detail` is appended in brackets (why an EIO happened); it never contains file content. */
export function fsError(code: FsErrorCode, syscall: string, path?: string, dest?: string, detail?: string): FsError {
  let message = `${code}: ${DESCRIPTIONS[code]}, ${syscall}`;
  if (path !== undefined) message += ` '${path}'`;
  if (dest !== undefined) message += ` -> '${dest}'`;
  if (detail) message += ` (${detail})`;
  const error = new Error(message) as FsError;
  error.code = code;
  error.errno = ERRNO[code];
  error.syscall = syscall;
  if (path !== undefined) error.path = path;
  if (dest !== undefined) error.dest = dest;
  return error;
}

/** Node's error for `rmSync(directory)` without `recursive`. */
export function rmIsDirectoryError(path: string): FsError {
  const error = new Error(`Path is a directory: rm returned EISDIR (is a directory) ${path}`) as FsError;
  error.name = 'SystemError';
  error.code = 'ERR_FS_EISDIR';
  error.errno = 21;
  error.syscall = 'rm';
  error.path = path;
  return error;
}

/** Node's TypeError for an argument of the wrong type. */
export function invalidArgType(name: string, expected: string, actual: unknown): TypeError {
  const received = actual === null ? 'null' : typeof actual === 'object' ? 'an object' : `type ${typeof actual}`;
  const error = new TypeError(`The "${name}" argument must be ${expected}. Received ${received}`) as TypeError & { code: string };
  error.code = 'ERR_INVALID_ARG_TYPE';
  return error;
}

/**
 * The absolute, normalised form of a virtual path: posix separators only, `.` and `..` resolved,
 * no trailing slash; a relative path is taken from `/`. A backslash is an ordinary character -
 * the core builds its paths with posix `path` (path-browserify).
 */
export function normalizePath(input: unknown, argument = 'path'): string {
  if (typeof input !== 'string') throw invalidArgType(argument, 'of type string', input);
  if (input.includes('\0')) {
    const error = new TypeError(`The argument '${argument}' must be a string without null bytes.`) as TypeError & { code: string };
    error.code = 'ERR_INVALID_ARG_VALUE';
    throw error;
  }
  const out: string[] = [];
  for (const segment of input.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') out.pop();
    else out.push(segment);
  }
  return `/${out.join('/')}`;
}

/** The parent directory of a normalised path (`/` is its own parent). */
export function parentOf(path: string): string {
  const cut = path.lastIndexOf('/');
  return cut <= 0 ? '/' : path.slice(0, cut);
}

/** The last segment of a normalised path. */
export function baseNameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** True when `path` is `root` or lies below it (both normalised). */
export function isWithin(path: string, root: string): boolean {
  if (root === '/') return true;
  return path === root || path.startsWith(`${root}/`);
}
