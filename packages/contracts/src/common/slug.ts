import { z } from 'zod';

/** URL-safe identifier: lowercase letters, numbers and single dashes. */
export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes');
