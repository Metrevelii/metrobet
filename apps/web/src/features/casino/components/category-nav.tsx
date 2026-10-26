import { CASINO_CATEGORIES, type CasinoCategory } from '@metrobet/contracts';
import { Chip } from '@metrobet/ui';
import { Heart, LayoutGrid } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

import { categoryHref } from '../links';

export type CasinoSection = 'lobby' | 'favorites' | CasinoCategory;

/** Category chips. Scrolls horizontally on small screens. */
export function CategoryNav({ active }: { active?: CasinoSection }) {
  const t = useTranslations('Casino');
  const items: { key: CasinoSection; href: string; label: string; icon?: typeof Heart }[] = [
    { key: 'lobby', href: '/casino', label: t('lobby'), icon: LayoutGrid },
    ...CASINO_CATEGORIES.map((category) => ({
      key: category,
      href: categoryHref(category),
      label: t(`categories.${category}`),
    })),
    { key: 'favorites', href: '/casino/favorites', label: t('favorites'), icon: Heart },
  ];

  return (
    <nav className="-mx-4 [scrollbar-width:none] overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
      <ul className="flex gap-2 md:flex-wrap">
        {items.map(({ key, href, label, icon: Icon }) => (
          <li key={key}>
            <Chip asChild selected={key === active}>
              <Link href={href} aria-current={key === active ? 'page' : undefined}>
                {Icon && <Icon />}
                {label}
              </Link>
            </Chip>
          </li>
        ))}
      </ul>
    </nav>
  );
}
