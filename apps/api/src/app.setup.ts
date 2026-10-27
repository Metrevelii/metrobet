import { resolve } from 'node:path';

import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { CorsIoAdapter } from './common/adapters/socket-io.adapter.js';
import type { Env } from './config/env.js';

/** Global HTTP setup shared by main.ts and e2e tests, so tests run the real configuration. */
export function configureApp(app: NestExpressApplication) {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.set('trust proxy', config.get('TRUST_PROXY', { infer: true }));
  app.setGlobalPrefix('api');
  const origins = config.get('CORS_ORIGINS', { infer: true });
  app.enableCors({ origin: origins, credentials: true });
  app.useWebSocketAdapter(new CorsIoAdapter(app, origins));
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
