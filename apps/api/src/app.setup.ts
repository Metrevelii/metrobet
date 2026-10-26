import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from './config/env.js';

/** Global HTTP setup shared by main.ts and e2e tests, so tests run the real configuration. */
export function configureApp(app: INestApplication) {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.get('CORS_ORIGINS', { infer: true }), credentials: true });
  app.enableShutdownHooks();

  return config;
}
