'use client';

import { Input } from '@metrobet/ui';
import { Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Form from 'next/form';

import { getPathname } from '@/i18n/navigation';

import { SLOTS_HREF } from '../links';

/** GET form to /casino/search?q=… with client-side navigation (next/form). */
export function CasinoSearch({ defaultValue }: { defaultValue?: string }) {
  const t = useTranslations('Casino');
  const locale = useLocale();
  return (
    <search>
      <Form action={getPathname({ href: `${SLOTS_HREF}/search`, locale })} className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          name="q"
          defaultValue={defaultValue}
          minLength={2}
          maxLength={50}
          required
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          className="pl-9"
        />
      </Form>
    </search>
  );
}
