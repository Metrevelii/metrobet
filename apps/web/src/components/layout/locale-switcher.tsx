'use client';

import type { Locale } from '@metrobet/contracts';
import { cn } from '@metrobet/ui';
import { useLocale, useTranslations } from 'next-intl';
import { Suspense, useTransition } from 'react';

import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

type LocaleButtonsProps = {
  className?: string;
  /** Undefined while the current pathname is not known yet (prerendered shell). */
  onSelect?: (locale: Locale) => void;
  pending?: boolean;
};

function LocaleButtons({ className, onSelect, pending }: LocaleButtonsProps) {
  const t = useTranslations('Locale');
  const current = useLocale();
  return (
    <fieldset className={cn('flex rounded-md bg-muted p-0.5', pending && 'opacity-60', className)}>
      <legend className="sr-only">{t('label')}</legend>
      {routing.locales.map((locale) => (
        <button
          key={locale}
          type="button"
          title={t(locale)}
          aria-pressed={locale === current}
          disabled={!onSelect}
          onClick={() => onSelect?.(locale)}
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

function InteractiveLocaleButtons({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  return (
    <LocaleButtons
      className={className}
      pending={pending}
      onSelect={(locale) => startTransition(() => router.replace(pathname, { locale }))}
    />
  );
}

export function LocaleSwitcher({ className }: { className?: string }) {
  return (
    <Suspense fallback={<LocaleButtons className={className} />}>
      <InteractiveLocaleButtons className={className} />
    </Suspense>
  );
}
