import { z } from 'zod';

import { signToken, verifyToken } from '../../../../common/signed-token/signed-token.js';

const sessionSchema = z.object({
  checkId: z.uuid(),
  returnUrl: z.url(),
  exp: z.number().int(),
});
export type MockKycSession = z.infer<typeof sessionSchema>;

export const signKycSession = (secret: string, session: MockKycSession) =>
  signToken(secret, 'kyc', session);

export const verifyKycSession = (secret: string, token: string, now = Date.now()) =>
  verifyToken(secret, 'kyc', token, sessionSchema, now);
