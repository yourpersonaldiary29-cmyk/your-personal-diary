/**
 * Placeholder for `node:fs` while the virtual file system (mobile/core/shims/fs.ts, WP-4) is not
 * in the tree: the alias plugin maps node:fs here ONLY when that file does not exist. Server
 * modules can be imported; every file operation throws "not available on mobile".
 */
import { stubFunction } from './unavailable';

const NAMES = [
  'existsSync',
  'readFileSync',
  'writeFileSync',
  'mkdirSync',
  'renameSync',
  'statSync',
  'statfsSync',
  'rmSync',
  'unlinkSync',
  'readdirSync',
  'openSync',
  'writeSync',
  'fsyncSync',
  'closeSync',
] as const;
const PROMISE_NAMES = ['readFile', 'writeFile', 'open', 'rename', 'rm', 'mkdir', 'access', 'stat', 'unlink'] as const;

type Stub = (...args: unknown[]) => never;

function stubs<T extends string>(names: readonly T[], prefix: string): Record<T, Stub> {
  const out = {} as Record<T, Stub>;
  for (const name of names) out[name] = stubFunction('fs', `${prefix}${name}`);
  return out;
}

const sync = stubs(NAMES, '');
export const promises = stubs(PROMISE_NAMES, 'promises.');

export const {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  renameSync,
  statSync,
  statfsSync,
  rmSync,
  unlinkSync,
  readdirSync,
  openSync,
  writeSync,
  fsyncSync,
  closeSync,
} = sync;

export default { ...sync, promises };
