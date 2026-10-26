import { defineConfig } from 'vitest/config';

import { E2E_ENV } from './test/e2e-env.js';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    env: E2E_ENV,
  },
});
