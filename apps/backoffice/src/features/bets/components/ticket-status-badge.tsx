import type { TicketStatus } from '@metrobet/contracts';
import { Badge } from '@metrobet/ui';

const VARIANT = { open: 'default', won: 'success', lost: 'destructive', void: 'warning' } as const;

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return <Badge variant={VARIANT[status]}>{status}</Badge>;
}
