import type { GameCard } from '@metrobet/contracts';
import { cn, Skeleton } from '@metrobet/ui';

import { GameTile } from './game-tile';

/** Columns follow the available width (container queries), not the viewport. */
export const GAME_GRID =
  'grid grid-cols-3 gap-x-3 gap-y-4 @xl:grid-cols-4 @3xl:grid-cols-5 @5xl:grid-cols-6';

export function GameGrid({ games, className }: { games: GameCard[]; className?: string }) {
  return (
    <div className="@container">
      <div className={cn(GAME_GRID, className)}>
        {games.map((game) => (
          <GameTile key={game.slug} game={game} />
        ))}
      </div>
    </div>
  );
}

export function GameGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="@container">
      <div className={GAME_GRID}>
        {Array.from({ length: count }, (_, i) => (
          <Skeleton key={i} className="aspect-3/4 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
