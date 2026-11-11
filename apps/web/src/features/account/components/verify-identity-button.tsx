'use client';

import { Button, toast } from '@metrobet/ui';
import { ScanFace } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';

import { useRouter } from '@/i18n/navigation';

import { startKyc } from '../actions';

/** Opens the verification provider's page (it sends the player back to /account/identity). */
export function VerifyIdentityButton({ retry = false }: { retry?: boolean }) {
  const t = useTranslations('Account.identity');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="lg"
      className="self-start"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await startKyc();
          if (result.ok) {
            window.location.assign(result.data);
            await new Promise(() => undefined);
            return;
          }
          toast.error(t(result.error === 'conflict' ? 'alreadyStarted' : 'failed'), {
            id: 'kyc-start',
          });
          router.refresh();
        })
      }
    >
      <ScanFace />
      {pending ? t('opening') : t(retry ? 'retry' : 'start')}
    </Button>
  );
}
