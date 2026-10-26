import { resolve } from 'node:path';

import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';

import type { Env } from './config/env.js';

/** Global HTTP setup shared by main.ts and e2e tests, so tests run the real configuration. */
export function configureApp(app: NestExpressApplication) {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.get('CORS_ORIGINS', { infer: true }), credentials: true });
  app.enableShutdownHooks();

  // Uploaded media (LocalMediaStorage). A CDN replaces this in production.
  app.useStaticAssets(resolve(config.get('MEDIA_DIR', { infer: true })), {
    prefix: '/media',
    maxAge: '365d',
    immutable: true,
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  });

  return config;
}
