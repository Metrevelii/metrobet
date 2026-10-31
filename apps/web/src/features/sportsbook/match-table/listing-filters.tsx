'use client';

import {
  type CompetitionSummary,
  DAY_FILTERS,
  type DayFilter,
  type Sport,
} from '@metrobet/contracts';
import { Chip } from '@metrobet/ui';
import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

import { useFavoriteLeagues } from '../favorites';
import { countryFlag } from '../flags';
import { sportHref } from '../links';

type ListingFiltersProps = {
  sport: Sport;
  day: DayFilter;
  /** Currently selected competition ids (none = all leagues). */
  selected: string[];
  competitions: CompetitionSummary[];
};

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((item) => b.includes(item));

/**
 * Day chips (all / today / tomorrow / next hour) and league chips (all, ★ favourites, each
 * league with its count). Links keep the other filter, so every view is a shareable URL.
 */
export function ListingFilters({ sport, day, selected, competitions }: ListingFiltersProps) {
  const t = useTranslations('Sports');
  const favorites = useFavoriteLeagues();
  const favoriteIds = favorites.filter((id) =>
    competitions.some((item) => item.competition.id === id),
  );
  const favoritesActive = favoriteIds.length > 0 && sameSet(selected, favoriteIds);

  return (
    <div className="flex flex-col gap-2">
      <nav aria-label={t('dayFilter')} className="flex flex-wrap gap-2">
        {DAY_FILTERS.map((item) => (
          <Chip key={item} asChild selected={item === day}>
            <Link
              href={sportHref(sport, { day: item, competitions: selected })}
              aria-current={item === day ? 'page' : undefined}
            >
              {t(`days.${item}`)}
            </Link>
          </Chip>
        ))}
      </nav>
      <nav
        aria-label={t('leagues')}
        className="-mx-4 [scrollbar-width:none] overflow-x-auto px-4 md:mx-0 md:px-0"
      >
        <ul className="flex gap-2">
          <li>
            <Chip asChild selected={selected.length === 0}>
              <Link href={sportHref(sport, { day })}>{t('allLeagues')}</Link>
            </Chip>
          </li>
          <li>
            {favoriteIds.length > 0 ? (
              <Chip asChild selected={favoritesActive}>
                <Link href={sportHref(sport, { day, competitions: favoriteIds })}>
                  <Star className="fill-warning text-warning" />
                  {t('favorites')}
                  <span className="tabular opacity-70">{favoriteIds.length}</span>
                </Link>
              </Chip>
            ) : (
              <Chip disabled title={t('favoritesHint')}>
                <Star />
                {t('favorites')}
              </Chip>
            )}
          </li>
          {competitions.map(({ competition, liveCount, upcomingCount }) => {
            const active = !favoritesActive && sameSet(selected, [competition.id]);
            return (
              <li key={competition.id}>
                <Chip asChild selected={active}>
                  <Link
                    href={sportHref(sport, { day, competitions: [competition.id] })}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span aria-hidden>{countryFlag(competition.country)}</span>
                    <span className="whitespace-nowrap">{competition.name}</span>
                    <span className="tabular opacity-70">{liveCount + upcomingCount}</span>
                  </Link>
                </Chip>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
