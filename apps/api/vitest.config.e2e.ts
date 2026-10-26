import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Real infra is mocked in e2e tests; this only satisfies env validation.
    env: { DATABASE_URL: 'postgres://test:test@localhost:5432/test' },
  },
});
