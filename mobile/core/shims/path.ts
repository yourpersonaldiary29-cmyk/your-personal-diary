/**
 * `node:path` of the Android core: path-browserify (POSIX semantics). The mobile ServerConfig uses
 * virtual POSIX paths (/data/accounts.json, /data/users/<id>.mpd, /assets/fonts/...), so `join`,
 * `dirname`, `basename`, `isAbsolute` and `resolve` behave exactly as on a POSIX Node.
 *
 * Relative paths resolve against the virtual working directory '/' (./process.ts) - never against
 * `process.cwd()` of whatever runs the code (under vitest that would be a Windows directory).
 */
import pathBrowserify from 'path-browserify';
import { MOBILE_CWD } from './process';

type PosixPath = typeof pathBrowserify;

function resolve(...segments: string[]): string {
  return pathBrowserify.resolve(MOBILE_CWD, ...segments);
}

function relative(from: string, to: string): string {
  return pathBrowserify.relative(resolve(from), resolve(to));
}

const mobilePath = { ...pathBrowserify, resolve, relative } as PosixPath;
(mobilePath as { posix: PosixPath }).posix = mobilePath;

export const sep = mobilePath.sep;
export const delimiter = mobilePath.delimiter;
export const basename = mobilePath.basename;
export const dirname = mobilePath.dirname;
export const extname = mobilePath.extname;
export const format = mobilePath.format;
export const isAbsolute = mobilePath.isAbsolute;
export const join = mobilePath.join;
export const normalize = mobilePath.normalize;
export const parse = mobilePath.parse;
export const posix = mobilePath;
export { relative, resolve };

export default mobilePath;
