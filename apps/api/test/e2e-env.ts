/** Env for e2e runs, shared by vitest.config.e2e.ts and the global setup. */
export const E2E_ENV = {
  // Separate database so e2e runs never touch dev data. CI overrides it via E2E_DATABASE_URL.
  DATABASE_URL:
    process.env.E2E_DATABASE_URL ?? 'postgres://metrobet:metrobet@localhost:5432/metrobet_test',
  AUTH_RATE_LIMIT: '1000',
  // Same catalogue locally and in CI, whatever apps/api/.env says.
  CASINO_AGGREGATOR: 'mock',
  ORIGINALS_JET_LOOP: 'off',
  SPORTSBOOK_FEED: 'simulated',
  WEB_REVALIDATE_SECRET: 'e2e-revalidate-secret-0123456789abcdef01234567',
  GAME_WALLET_SECRET: 'e2e-game-wallet-secret-0123456789abcdef0123456',
  MEDIA_DIR: '.e2e-uploads',
};
