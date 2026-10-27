import type { PromoBlockViewOf } from '@metrobet/contracts';
import { Card, Skeleton } from '@metrobet/ui';
import { Suspense } from 'react';

import { getEnrollment } from '../../data';
import { OptInButton } from './opt-in-button';

async function OptInStatus({ slug }: { slug: string }) {
  return <OptInButton slug={slug} enrollment={await getEnrollment(slug)} />;
}

/** Join card. The player's state is request-time, so only the button area streams in. */
export function OptInBlock({ block, slug }: { block: PromoBlockViewOf<'optIn'>; slug: string }) {
  return (
    <Card className="flex flex-col gap-4 border-primary/40 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold">{block.title}</h2>
        <p className="text-sm text-muted-foreground">{block.body}</p>
      </div>
      <Suspense fallback={<Skeleton className="h-11 w-36 rounded-md" />}>
        <OptInStatus slug={slug} />
      </Suspense>
    </Card>
  );
}
