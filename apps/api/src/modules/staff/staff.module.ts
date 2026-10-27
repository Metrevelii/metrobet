import { Module } from '@nestjs/common';

import { StaffAuthController } from './staff-auth.controller.js';
import { StaffService } from './staff.service.js';

@Module({
  controllers: [StaffAuthController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
