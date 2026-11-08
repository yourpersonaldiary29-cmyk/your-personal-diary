/**
 * `node:os` stub of the Android core. Only server/src/config.ts imports it from a module the core
 * loads, and only `defaultDataDir()` (the Windows %APPDATA% location, never used on mobile - the
 * core builds its ServerConfig with virtual paths) calls `homedir()`.
 */
import { stubFunction } from './unavailable';

export const EOL = '\n';

export function platform(): string {
  return 'android';
}

export const homedir = stubFunction('os', 'homedir');
export const tmpdir = stubFunction('os', 'tmpdir');
export const hostname = stubFunction('os', 'hostname');
export const networkInterfaces = stubFunction('os', 'networkInterfaces');
export const userInfo = stubFunction('os', 'userInfo');
export const cpus = stubFunction('os', 'cpus');
export const totalmem = stubFunction('os', 'totalmem');
export const freemem = stubFunction('os', 'freemem');

export default { EOL, platform, homedir, tmpdir, hostname, networkInterfaces, userInfo, cpus, totalmem, freemem };
