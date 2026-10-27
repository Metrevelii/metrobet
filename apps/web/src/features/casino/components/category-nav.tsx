import { CASINO_CATEGORIES, type CasinoCategory } from '@metrobet/contracts';
import { Chip } from '@metrobet/ui';
import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

import { SLOTS_HREF, slotsHref } from '../links';

export type CasinoChip = CasinoCategory | 'favorites';

type CategoryNavProps = {
  active?: CasinoChip;
  /** Provider tab the categories apply to (none = the "All" tab). */
  provider?: string;
};

/** Category chips within the current tab, plus favorites. Scrolls horizontally on small screens. */
export function CategoryNav({ active, provider }: CategoryNavProps) {
  const t = useTranslations('Casino');
  const items: { key: CasinoChip; href: string; label: string }[] = [
    ...CASINO_CATEGORIES.map((category) => ({
      key: category,
      href: slotsHref({ provider, category }),
      label: t(`categories.${category}`),
    })),
    { key: 'favorites', href: `${SLOTS_HREF}/favorites`, label: t('favorites') },
  ];

  return (
    <nav className="-mx-4 [scrollbar-width:none] overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
      <ul className="flex gap-2 md:flex-wrap">
        {items.map(({ key, href, label }) => (
          <li key={key}>
            <Chip asChild selected={key === active}>
              <Link href={href} aria-current={key === active ? 'page' : undefined}>
                {key === 'favorites' && <Heart />}
                {label}
              </Link>
            </Chip>
          </li>
        ))}
      </ul>
    </nav>
  );
}
