import { z } from 'zod';

const secret = z.string().min(32, 'Use at least 32 random characters');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url(),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) => value.split(',').map((origin) => origin.trim())),

  /** Temporary shared key for /api/admin/* until staff auth lands (roadmap step 7). */
  ADMIN_API_KEY: secret,

  /** Uploaded files: stored under MEDIA_DIR, publicly served at MEDIA_PUBLIC_URL. */
  MEDIA_DIR: z.string().default('uploads'),
  MEDIA_PUBLIC_URL: z.url().default('http://localhost:4000/media'),

  /** The player site, asked to drop cached content after admin changes. */
  WEB_URL: z.url().default('http://localhost:3000'),
  WEB_REVALIDATE_SECRET: secret,
});

export type Env = z.infer<typeof envSchema>;

/** Used by ConfigModule: fails fast on boot when the environment is invalid. */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
