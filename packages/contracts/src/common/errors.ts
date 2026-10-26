import { z } from 'zod';

/** Error body returned by the API for 4xx responses. */
export const apiErrorSchema = z.object({
  message: z.union([z.string(), z.array(z.string())]),
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
