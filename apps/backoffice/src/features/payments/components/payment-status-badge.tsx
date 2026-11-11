import type { PaymentStatus } from '@metrobet/contracts';
import { Badge } from '@metrobet/ui';

const VARIANTS = {
  pending: 'warning',
  succeeded: 'success',
  failed: 'destructive',
  rejected: 'destructive',
  cancelled: 'default',
  expired: 'default',
} as const satisfies Record<PaymentStatus, 'warning' | 'success' | 'destructive' | 'default'>;

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge variant={VARIANTS[status]}>{status}</Badge>;
}
