/**
 * Creates a backoffice account:
 *   STAFF_EMAIL=… STAFF_NAME=… STAFF_ROLE=admin STAFF_PASSWORD=… pnpm --filter @metrobet/api staff:create
 * Passing the password via env keeps it out of shell history arguments.
 */
import { passwordSchema, staffRoleSchema } from '@metrobet/contracts';
import { NestFactory } from '@nestjs/core';
import { z } from 'zod';

import { AppModule } from '../app.module.js';
import { StaffService } from '../modules/staff/staff.service.js';

const input = z
  .object({
    STAFF_EMAIL: z.email(),
    STAFF_NAME: z.string().min(1),
    STAFF_ROLE: staffRoleSchema,
    STAFF_PASSWORD: passwordSchema,
  })
  .safeParse(process.env);

if (!input.success) {
  console.error(`Invalid input:\n${z.prettifyError(input.error)}`);
  process.exit(1);
}

const app = await NestFactory.createApplicationContext(AppModule, { logger: ['warn', 'error'] });
try {
  const { STAFF_EMAIL, STAFF_NAME, STAFF_ROLE, STAFF_PASSWORD } = input.data;
  const created = await app
    .get(StaffService)
    .create({ email: STAFF_EMAIL, name: STAFF_NAME, role: STAFF_ROLE, password: STAFF_PASSWORD });
  console.warn(`Created ${created.role} ${created.email}`);
} finally {
  await app.close();
}
