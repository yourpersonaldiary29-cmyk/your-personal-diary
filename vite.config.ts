import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const host = process.env.TAURI_DEV_HOST;
const here = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react()],
  // The desktop/browser UI is never the Android build: every `if (__MOBILE__)` branch (and the
  // Capacitor code behind it) is removed from dist/ as dead code. The Android build sets it to
  // true in mobile/vite.config.mobile.ts.
  define: {
    __MOBILE__: 'false',
  },
  resolve: {
    alias: {
      '@shared': path.resolve(here, 'shared'),
      '@': path.resolve(here, 'src'),
    },
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**', '**/server/**'],
    },
  },
  build: {
    target: 'es2021',
    sourcemap: false,
  },
}));
