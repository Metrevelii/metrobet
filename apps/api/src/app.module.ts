import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { type Env, validateEnv } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { ActivityModule } from './modules/activity/activity.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BettingModule } from './modules/betting/betting.module.js';
import { BonusModule } from './modules/bonus/bonus.module.js';
import { CasinoModule } from './modules/casino/casino.module.js';
import { GameWalletModule } from './modules/game-wallet/game-wallet.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { KycModule } from './modules/kyc/kyc.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { PlayerLiveModule } from './modules/player-live/player-live.module.js';
import { PlayersModule } from './modules/players/players.module.js';
import { PromotionsModule } from './modules/promotions/promotions.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { ResponsibleGamingModule } from './modules/responsible-gaming/responsible-gaming.module.js';
import { SportsbookModule } from './modules/sportsbook/sportsbook.module.js';
import { StaffModule } from './modules/staff/staff.module.js';
import { WalletModule } from './modules/wallet/wallet.module.js';

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
    ActivityModule,
    AuthModule,
    BettingModule,
    BonusModule,
    NotificationsModule,
    CasinoModule,
    GameWalletModule,
    HealthModule,
    KycModule,
    MediaModule,
    PaymentsModule,
    PlayerLiveModule,
    PlayersModule,
    PromotionsModule,
    ReportsModule,
    ResponsibleGamingModule,
    SportsbookModule,
    StaffModule,
    WalletModule,
  ],
})
export class AppModule {}
