import { Global, Module } from '@nestjs/common';

import { PlayerAuthGuard, StaffAuthGuard } from './auth.guards.js';
import { PasswordHasher } from './password-hasher.js';
import { SessionService } from './session.service.js';
import { StaffDirectory } from './staff-directory.js';
import { VerificationService } from './verification.service.js';

/** Sessions, password hashing, one-time codes and guards, available to every module. */
@Global()
@Module({
  providers: [
    SessionService,
    PasswordHasher,
    VerificationService,
    StaffDirectory,
    PlayerAuthGuard,
    StaffAuthGuard,
  ],
  exports: [
    SessionService,
    PasswordHasher,
    VerificationService,
    StaffDirectory,
    PlayerAuthGuard,
    StaffAuthGuard,
  ],
})
export class AuthModule {}
