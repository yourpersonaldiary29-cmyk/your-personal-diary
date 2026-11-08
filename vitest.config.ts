import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(here, 'shared'),
      '@': path.resolve(here, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'shared/**/*.test.ts'],
    css: false,
    // Page tests type through whole forms with user-event in jsdom; on a busy machine
    // (parallel builds) the 5s default is not enough.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
