import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

/**
 * Validates and parses input with a schema from @metrobet/contracts.
 * Usage: `@Query(new ZodValidationPipe(schema)) query: Schema`.
 */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: result.error.issues.map(({ path, message }) => ({ path: path.join('.'), message })),
      });
    }
    return result.data;
  }
}
