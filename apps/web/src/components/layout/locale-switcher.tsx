'use client';

import { cn } from '@metrobet/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';

import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations('Locale');
  const current = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  return (
    <fieldset
      className={cn('flex rounded-md bg-muted p-0.5', isPending && 'opacity-60', className)}
    >
      <legend className="sr-only">{t('label')}</legend>
      {routing.locales.map((locale) => (
        <button
          key={locale}
          type="button"
          title={t(locale)}
          aria-pressed={locale === current}
          onClick={() => startTransition(() => router.replace(pathname, { locale }))}
          className={cn(
            'h-7 cursor-pointer rounded-sm px-2 text-xs font-bold text-muted-foreground uppercase transition-colors hover:text-foreground',
            locale === current && 'bg-card text-foreground shadow-sm',
          )}
        >
          {locale}
        </button>
      ))}
    </fieldset>
  );
}
