import { Test } from '@nestjs/testing';

import { DRIZZLE } from '../../database/database.tokens.js';
import { HealthController } from './health.controller.js';

async function createController(execute: () => Promise<unknown>) {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [{ provide: DRIZZLE, useValue: { execute } }],
  }).compile();
  return moduleRef.get(HealthController);
}

describe('HealthController', () => {
  it('reports up when the database responds', async () => {
    const controller = await createController(() => Promise.resolve());
    await expect(controller.check()).resolves.toMatchObject({
      status: 'up',
      services: { database: 'up' },
    });
  });

  it('reports down when the database is unreachable', async () => {
    const controller = await createController(() => Promise.reject(new Error('ECONNREFUSED')));
    await expect(controller.check()).resolves.toMatchObject({
      status: 'down',
      services: { database: 'down' },
    });
  });
});
