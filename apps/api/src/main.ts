import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

async function bootstrap() {
  // rawBody: the game wallet API verifies HMAC signatures over the exact request bytes.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const config = configureApp(app);
  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
