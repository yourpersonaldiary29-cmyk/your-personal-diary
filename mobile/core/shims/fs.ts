/**
 * `node:fs` for the mobile diary core: the alias plugin (mobile/core/alias-plugin.ts) maps
 * `node:fs` and `fs`, imported from server/src, to this file. It is only a door: the
 * implementation is the VFS facade in mobile/core/vfs/node-fs.ts.
 */
export * from '../vfs/node-fs';
export { default } from '../vfs/node-fs';
