import type { PaymentProvider } from '@metrobet/contracts';

export type StartDeposit = {
  paymentId: string;
  provider: PaymentProvider;
  amount: number;
  /** Where the bank sends the player's browser afterwards (our wallet page). */
  returnUrl: string;
};

export type Payout = {
  paymentId: string;
  provider: PaymentProvider;
  amount: number;
  /** A saved card's bank token. */
  cardToken: string;
};

export type PayoutResult = { ok: true; providerReference: string } | { ok: false; reason: string };

/** The bank did not answer: the outcome is unknown, the payment must stay as it is. */
export class GatewayUnavailableError extends Error {}

/**
 * Port to a bank's payment gateway (TBC, Bank of Georgia). Deposits are hosted card pages whose
 * outcome arrives later as a signed callback (`POST /payments/callback`); payouts answer at once.
 * Bound to `MockPaymentGateway` until the bank contracts are signed.
 */
export abstract class PaymentGateway {
  abstract startDeposit(input: StartDeposit): Promise<{ redirectUrl: string }>;
  /** Pays to a saved card; idempotent by `paymentId`. Throws GatewayUnavailableError. */
  abstract payout(input: Payout): Promise<PayoutResult>;
}
