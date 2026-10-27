import { hash, verify } from '@node-rs/argon2';
import { Injectable } from '@nestjs/common';

// Argon2id with OWASP-recommended parameters (19 MiB, 2 iterations).
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

@Injectable()
export class PasswordHasher {
  /** Precomputed hash used to spend the same time when an account doesn't exist. */
  private readonly dummy = hash('timing-equalizer-not-a-real-password', OPTIONS);

  hash(password: string): Promise<string> {
    return hash(password, OPTIONS);
  }

  /** Verifies against `passwordHash`, or a dummy hash when there's no account (no timing leak). */
  async verify(passwordHash: string | null, password: string): Promise<boolean> {
    const target = passwordHash ?? (await this.dummy);
    const valid = await verify(target, password).catch(() => false);
    return passwordHash !== null && valid;
  }
}
