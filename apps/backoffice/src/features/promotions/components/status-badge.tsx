'use client';

import { getPromotionStatus, type Promotion, type PromotionStatus } from '@metrobet/contracts';
import { Badge, type BadgeProps, Skeleton } from '@metrobet/ui';

import { useNow } from '@/hooks/use-now';

import { STATUS_LABELS } from '../form-state';

const VARIANTS: Record<PromotionStatus, BadgeProps['variant']> = {
  live: 'success',
  scheduled: 'warning',
  expired: 'default',
  inactive: 'default',
};

type StatusBadgeProps = { promotion: Pick<Promotion, 'isActive' | 'startsAt' | 'endsAt'> };

export function StatusBadge({ promotion }: StatusBadgeProps) {
  const now = useNow();
  if (now === null) return <Skeleton className="h-4.5 w-14 rounded-sm" />;
  const status = getPromotionStatus(promotion, now);
  return <Badge variant={VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>;
}
