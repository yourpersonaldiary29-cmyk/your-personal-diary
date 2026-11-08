import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname, '..'),
  resolve: { alias: { '@shared': path.resolve(__dirname, '../../shared') } },
  test: { environment: 'node', include: ['zz-verify-h10a-tmp/**/*.test.ts'], testTimeout: 120000, hookTimeout: 120000 },
});
