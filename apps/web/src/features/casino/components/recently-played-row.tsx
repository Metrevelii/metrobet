'use client';

import { useTranslations } from 'next-intl';

import { useGameList } from '../game-lists';
import { GameRow } from './game-row';

/** Shown only when this browser has played something. */
export function RecentlyPlayedRow() {
  const t = useTranslations('Casino');
  const recent = useGameList('recent');
  if (!recent?.length) return null;
  return <GameRow title={t('recentlyPlayed')} games={recent} />;
}
