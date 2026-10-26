import type { Sport, SportSummary } from '@metrobet/contracts';
import { Chip } from '@metrobet/ui';
import { Radio } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

import { sportHref } from '../links';

type SportTabsProps = { sports: SportSummary[]; active?: Sport | 'live' };

/** Sport chips with live counts, plus a shortcut to all live events. */
export function SportTabs({ sports, active }: SportTabsProps) {
  const t = useTranslations('Sports');
  const liveTotal = sports.reduce((sum, s) => sum + s.liveCount, 0);
  return (
    <nav className="-mx-4 [scrollbar-width:none] overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex gap-2">
        <li>
          <Chip asChild selected={active === 'live'}>
            <Link href="/live" aria-current={active === 'live' ? 'page' : undefined}>
              <Radio />
              {t('live')}
              {liveTotal > 0 && <span className="tabular opacity-70">{liveTotal}</span>}
            </Link>
          </Chip>
        </li>
        {sports.map(({ sport, liveCount, upcomingCount }) => (
          <li key={sport}>
            <Chip asChild selected={active === sport}>
              <Link href={sportHref(sport)} aria-current={active === sport ? 'page' : undefined}>
                {t(`sports.${sport}`)}
                <span className="tabular opacity-70">{liveCount + upcomingCount}</span>
              </Link>
            </Chip>
          </li>
        ))}
      </ul>
    </nav>
  );
}
