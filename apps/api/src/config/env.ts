import { z } from 'zod';

const secret = z.string().min(32, 'Use at least 32 random characters');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url(),
  /** Public origin of this API (links handed to browsers, e.g. mock game URLs). */
  API_PUBLIC_URL: z.url().default('http://localhost:4000'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) => value.split(',').map((origin) => origin.trim())),

  /** Requests per minute per client on auth routes (login, register, codes). */
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(10),
  /**
   * Express "trust proxy": which hops may set X-Forwarded-For. The web apps call the API
   * server-side and forward the player's IP, so they must be trusted (loopback in dev).
   */
  TRUST_PROXY: z.string().default('loopback'),

  /** Uploaded files: stored under MEDIA_DIR, publicly served at MEDIA_PUBLIC_URL. */
  MEDIA_DIR: z.string().default('uploads'),
  MEDIA_PUBLIC_URL: z.url().default('http://localhost:4000/media'),

  /**
   * Game source: `mock` (fictional studios) or `pragmatic-demo` (real Pragmatic slots via their
   * public demo launcher; DEVELOPMENT ONLY, rejected in production).
   */
  CASINO_AGGREGATOR: z.enum(['mock', 'pragmatic-demo']).default('mock'),

  /** `simulated` runs the built-in odds feed; `off` disables it (e.g. in tests that don't need it). */
  SPORTSBOOK_FEED: z.enum(['simulated', 'off']).default('simulated'),

  /** The player site, asked to drop cached content after admin changes. */
  WEB_URL: z.url().default('http://localhost:3000'),
  WEB_REVALIDATE_SECRET: secret,
});

const guardedEnvSchema = envSchema.refine(
  (env) => !(env.NODE_ENV === 'production' && env.CASINO_AGGREGATOR === 'pragmatic-demo'),
  {
    path: ['CASINO_AGGREGATOR'],
    message: 'pragmatic-demo is for development only; production needs a contracted aggregator',
  },
);

export type Env = z.infer<typeof envSchema>;

/** Used by ConfigModule: fails fast on boot when the environment is invalid. */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = guardedEnvSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
