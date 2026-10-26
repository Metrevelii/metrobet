import { z } from 'zod';

export const serviceStatusSchema = z.enum(['up', 'down']);

export const healthResponseSchema = z.object({
  status: serviceStatusSchema,
  uptime: z.number(),
  services: z.record(z.string(), serviceStatusSchema),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
