'use client';

import type { Provider } from '@metrobet/contracts';
import { NativeSelect } from '@metrobet/ui';
import { useTranslations } from 'next-intl';

import { useRouter } from '@/i18n/navigation';

import { providerHref, SLOTS_HREF } from '../links';

export function ProviderFilter({ providers, value }: { providers: Provider[]; value?: string }) {
  const t = useTranslations('Casino');
  const router = useRouter();
  return (
    <NativeSelect
      aria-label={t('provider')}
      value={value ?? ''}
      onChange={(event) =>
        router.push(event.target.value ? providerHref(event.target.value) : SLOTS_HREF)
      }
    >
      <option value="">{t('allProviders')}</option>
      {providers.map((provider) => (
        <option key={provider.slug} value={provider.slug}>
          {provider.name} ({provider.gameCount})
        </option>
      ))}
    </NativeSelect>
  );
}
