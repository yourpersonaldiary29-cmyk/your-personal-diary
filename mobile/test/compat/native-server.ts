/**
 * Loads the REAL server modules (server/src) the way the desktop runs them - Node.js, node:crypto,
 * node:fs, the Node build of sql.js - next to the shimmed copies the mobile vitest config gives a
 * test that imports them directly.
 *
 * In one test file:
 *   import * as kdf from '../../../server/src/security/kdf';        // on the mobile shims
 *   const native = await openNativeServer();
 *   const nodeKdf = await native.load<typeof kdf>('security/kdf');  // on Node
 *
 * The modules are evaluated by a Vite module runner without the mobile alias plugin (the same way
 * vitest runs the server's own tests). Nothing listens on a port.
 */
import path from 'node:path';
import { createServer, createServerModuleRunner } from 'vite';

export interface NativeServer {
  /** Imports `server/src/<module>` (with or without '.ts') under Node. */
  load<T>(module: string): Promise<T>;
  close(): Promise<void>;
}

export async function openNativeServer(projectRoot: string = process.cwd()): Promise<NativeServer> {
  const server = await createServer({
    configFile: false,
    root: path.join(projectRoot, 'server'),
    logLevel: 'error',
    appType: 'custom',
    resolve: { alias: { '@shared': path.join(projectRoot, 'shared') } },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
  return {
    load<T>(module: string): Promise<T> {
      const file = module.endsWith('.ts') ? module : `${module}.ts`;
      return runner.import(`/src/${file}`) as Promise<T>;
    },
    async close(): Promise<void> {
      await runner.close();
      await server.close();
    },
  };
}
