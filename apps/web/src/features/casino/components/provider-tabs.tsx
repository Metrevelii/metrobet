import type { Provider } from '@metrobet/contracts';
import { cn } from '@metrobet/ui';
import { LayoutGrid } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

import { providerHref, SLOTS_HREF } from '../links';

type ProviderTabsProps = {
  providers: Provider[];
  /** `all`, a provider slug, or null when no tab applies (favorites, search). */
  active: string | null;
};

function Tab({
  href,
  active,
  label,
  count,
  icon,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  icon?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex h-11 items-center gap-2 px-3 text-sm font-semibold whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground',
        active &&
          'text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary',
      )}
    >
      {icon && <LayoutGrid className="size-4" />}
      {label}
      <span
        className={cn(
          'rounded-sm px-1.5 py-0.5 text-[11px] leading-none tabular',
          active ? 'bg-primary text-primary-foreground' : 'bg-muted',
        )}
      >
        {count}
      </span>
    </Link>
  );
}

/**
 * Provider tabs: "All" plus one tab per provider that has slots (built from the catalogue, so a
 * newly synced provider such as EGT appears automatically). Biggest catalogues first.
 */
export function ProviderTabs({ providers, active }: ProviderTabsProps) {
  const t = useTranslations('Casino');
  const sorted = providers.toSorted(
    (a, b) => b.gameCount - a.gameCount || a.name.localeCompare(b.name),
  );
  const total = providers.reduce((sum, provider) => sum + provider.gameCount, 0);

  return (
    <nav
      aria-label={t('providers')}
      className="-mx-4 [scrollbar-width:none] overflow-x-auto border-b px-4 md:mx-0 md:px-0"
    >
      <ul className="flex gap-1">
        <li>
          <Tab
            href={SLOTS_HREF}
            active={active === 'all'}
            label={t('allGames')}
            count={total}
            icon
          />
        </li>
        {sorted.map((provider) => (
          <li key={provider.slug}>
            <Tab
              href={providerHref(provider.slug)}
              active={active === provider.slug}
              label={provider.name}
              count={provider.gameCount}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}
