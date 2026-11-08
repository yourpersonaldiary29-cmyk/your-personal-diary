/**
 * Vitest configuration of the mobile host/core code - `npm run mobile:test`.
 * Like the Android build it defines `__MOBILE__` as true (the root vitest config leaves it undefined).
 *
 * The alias plugin (mobile/core/alias-plugin.ts) is active as in the build of the core: a test that
 * imports a module of server/src gets it on the mobile shims (node:crypto -> shims/crypto.ts, the
 * Buffer polyfill, ...). Test files themselves are not redirected - `node:crypto` in a test is Node's.
 */
import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mobileCoreAlias } from './core/alias-plugin.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
/** The `express` of the core (WP-5): the same replacement the worker build uses (vite.config.mobile.ts). */
const expressShim = path.resolve(here, 'core', 'express-shim', 'index.ts');

export default defineConfig({
  root: projectRoot,
  plugins: [mobileCoreAlias({ projectRoot, modules: { express: expressShim } })],
  define: {
    __MOBILE__: 'true',
  },
  resolve: {
    alias: {
      '@shared': path.resolve(projectRoot, 'shared'),
      '@': path.resolve(projectRoot, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['mobile/**/*.test.ts'],
    css: false,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
