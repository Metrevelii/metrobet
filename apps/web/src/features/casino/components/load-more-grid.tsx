'use client';

import type { GameListQuery, GamePage } from '@metrobet/contracts';
import { Button } from '@metrobet/ui';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { loadMoreGames } from '../actions';
import { GameGrid } from './game-grid';

type LoadMoreGridProps = { initial: GamePage; query: Omit<GameListQuery, 'page'> };

/** First page is server-rendered; further pages are appended via a Server Action. */
export function LoadMoreGrid({ initial, query }: LoadMoreGridProps) {
  const t = useTranslations('Casino');
  const [games, setGames] = useState(initial.items);
  const [page, setPage] = useState(initial.page);
  const [pending, startTransition] = useTransition();
  const hasMore = games.length < initial.total;

  const loadMore = () =>
    startTransition(async () => {
      const next = await loadMoreGames({ ...query, page: page + 1, pageSize: initial.pageSize });
      if (!next) return;
      setGames((current) => [...current, ...next.items]);
      setPage(next.page);
    });

  return (
    <div className="flex flex-col gap-6">
      <GameGrid games={games} />
      {hasMore && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-muted-foreground">
            {t('showing', { shown: games.length, total: initial.total })}
          </p>
          <Button variant="secondary" onClick={loadMore} disabled={pending}>
            {t('loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}
