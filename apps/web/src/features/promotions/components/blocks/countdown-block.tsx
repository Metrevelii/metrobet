import type { PromoBlockViewOf } from '@metrobet/contracts';
import { Card } from '@metrobet/ui';
import { Timer } from 'lucide-react';

import { Countdown } from './countdown';

/** Hidden when the promotion has no end date (the backoffice does not allow that combination). */
export function CountdownBlock({
  block,
  endsAt,
}: {
  block: PromoBlockViewOf<'countdown'>;
  endsAt: string | null;
}) {
  if (!endsAt) return null;
  return (
    <Card className="flex flex-col items-start gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Timer className="size-5 text-primary" />
        {block.title}
      </h2>
      <Countdown endsAt={endsAt} />
    </Card>
  );
}
