import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { type Env, validateEnv } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CasinoModule } from './modules/casino/casino.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { PlayersModule } from './modules/players/players.module.js';
import { PromotionsModule } from './modules/promotions/promotions.module.js';
import { SportsbookModule } from './modules/sportsbook/sportsbook.module.js';
import { StaffModule } from './modules/staff/staff.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    DatabaseModule,
    // Per-client limit for routes using ThrottlerGuard (auth). In-memory; use Redis storage to scale out.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => [
        { ttl: 60_000, limit: config.get('AUTH_RATE_LIMIT', { infer: true }) },
      ],
    }),
    AuthModule,
    NotificationsModule,
    CasinoModule,
    HealthModule,
    MediaModule,
    PlayersModule,
    PromotionsModule,
    SportsbookModule,
    StaffModule,
  ],
})
export class AppModule {}
