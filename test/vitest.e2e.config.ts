import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [swc.vite(), tsconfigPaths()],
  resolve: {
    extensions: ['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx', '.json'],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    testTimeout: 90_000,
    hookTimeout: 90_000,
    pool: 'forks',
    maxConcurrency: 1,
    globalSetup: ['./test/e2e-global-setup.ts'],
    setupFiles: ['./test/setup.ts'],
  },
});
