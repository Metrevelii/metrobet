/**
 * Port to the identity verification provider (Sumsub, Veriff…). The player completes the check
 * on the provider's page; the result arrives later as a signed callback (`POST /kyc/callback`).
 * Bound to `MockKycProvider` until a provider is contracted.
 */
export abstract class KycProvider {
  /** A name stored on each check (`mock`, `sumsub`…). */
  abstract readonly name: string;
  abstract startCheck(input: {
    checkId: string;
    /** Where the provider sends the browser afterwards (our identity page). */
    returnUrl: string;
  }): Promise<{ redirectUrl: string }>;
}
