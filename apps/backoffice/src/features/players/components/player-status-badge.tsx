import type { AdminPlayer } from '@metrobet/contracts';
import { Badge } from '@metrobet/ui';

const STATUS = {
  active: { label: 'Active', variant: 'success' },
  suspended: { label: 'Suspended', variant: 'destructive' },
  self_excluded: { label: 'Self-excluded', variant: 'warning' },
} as const;

export function PlayerStatusBadge({ status }: { status: AdminPlayer['status'] }) {
  const { label, variant } = STATUS[status];
  return <Badge variant={variant}>{label}</Badge>;
}
