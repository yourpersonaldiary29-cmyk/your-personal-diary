/**
 * `node:module` stub of the Android core: there is no `require` in a Web Worker. Used only by
 * server/src/util/paths.ts, which ./paths.ts replaces.
 */
import { stubFunction } from './unavailable';

export const createRequire = stubFunction('module', 'createRequire');
export const builtinModules: string[] = [];

export function isBuiltin(_name: string): boolean {
  return false;
}

export default { createRequire, builtinModules, isBuiltin };
