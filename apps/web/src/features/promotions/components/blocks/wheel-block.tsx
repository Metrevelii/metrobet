import type { PromoBlockViewOf } from '@metrobet/contracts';
import { Skeleton } from '@metrobet/ui';
import { Suspense } from 'react';

import { getGame } from '@/features/casino';

import { getWheelState } from '../../data';
import { PromoWheel } from './promo-wheel';

type WheelBlockProps = { block: PromoBlockViewOf<'wheel'>; slug: string };

async function WheelLoader({ block, slug }: WheelBlockProps) {
  const [game, state] = await Promise.all([
    getGame(block.freeSpinsGame),
    getWheelState(slug, block.id),
  ]);
  return (
    <PromoWheel
      slug={slug}
      block={block}
      gameName={game?.name ?? block.freeSpinsGame}
      initialState={state}
      devTools={process.env.NODE_ENV !== 'production'}
    />
  );
}

/** Prize wheel. Player progress is request-time, so the whole block streams in. */
export function WheelBlock(props: WheelBlockProps) {
  return (
    <Suspense
      fallback={
        <div className="grid items-center gap-6 rounded-lg border bg-card p-4 md:grid-cols-[minmax(0,340px)_1fr] md:p-6">
          <Skeleton className="mx-auto aspect-square w-full max-w-80 rounded-full" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-7 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      }
    >
      <WheelLoader {...props} />
    </Suspense>
  );
}
