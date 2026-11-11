import { cn } from '@metrobet/ui';
import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

export const ACCOUNT_TABS = [
  { key: 'profile', href: '/account' },
  { key: 'identity', href: '/account/identity' },
  { key: 'security', href: '/account/security' },
  { key: 'responsibleGaming', href: '/account/responsible-gaming' },
] as const;
export type AccountTab = (typeof ACCOUNT_TABS)[number]['key'];

/** Underlined section links; each page passes its own tab (no URL hooks needed). */
export async function AccountTabs({ active }: { active: AccountTab }) {
  const t = await getTranslations('Account.tabs');
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto border-b">
      {ACCOUNT_TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? 'page' : undefined}
          className={cn(
            '-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors',
            tab.key === active
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t(tab.key)}
        </Link>
      ))}
    </nav>
  );
}
