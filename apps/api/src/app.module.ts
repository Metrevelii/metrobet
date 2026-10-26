import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateEnv } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { CasinoModule } from './modules/casino/casino.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { PromotionsModule } from './modules/promotions/promotions.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    DatabaseModule,
    CasinoModule,
    HealthModule,
    MediaModule,
    PromotionsModule,
  ],
})
export class AppModule {}
