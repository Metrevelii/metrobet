import type { GameListQuery } from '@metrobet/contracts';
import { getTranslations } from 'next-intl/server';

import { getGames } from '../data';
import { GamesUnavailable } from './games-unavailable';
import { LoadMoreGrid } from './load-more-grid';

/** Count + paginated grid for any games query. Render inside <Suspense>. */
export async function GamesListing({ query }: { query: Omit<GameListQuery, 'page'> }) {
  const [page, t] = await Promise.all([getGames({ ...query, page: 1 }), getTranslations('Casino')]);
  if (!page) return <GamesUnavailable reason="error" />;
  if (page.total === 0) return <GamesUnavailable reason="empty" />;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t('gamesCount', { count: page.total })}</p>
      <LoadMoreGrid initial={page} query={query} />
    </div>
  );
}
