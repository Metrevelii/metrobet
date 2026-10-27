'use client';

import type { PromotionEnrollment } from '@metrobet/contracts';
import { Button, buttonVariants } from '@metrobet/ui';
import { CircleCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { Link, useRouter } from '@/i18n/navigation';

import { enrollInPromotion } from '../../actions';
import { promotionPageHref } from '../../links';

type OptInButtonProps = {
  slug: string;
  /** null = signed out. */
  enrollment: PromotionEnrollment | null;
};

export function OptInButton({ slug, enrollment: initial }: OptInButtonProps) {
  const t = useTranslations('Promotions.optIn');
  const router = useRouter();
  const [enrollment, setEnrollment] = useState(initial);
  const [signedOut, setSignedOut] = useState(initial === null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (enrollment?.enrolled) {
    return (
      <p className="flex items-center gap-2 rounded-md bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary">
        <CircleCheck className="size-4" />
        {t('joined')}
      </p>
    );
  }

  if (signedOut) {
    const next = promotionPageHref(slug);
    return (
      <Link
        href={{ pathname: '/login', query: { next } }}
        className={buttonVariants({ size: 'lg' })}
      >
        {t('login')}
      </Link>
    );
  }

  const join = () =>
    startTransition(async () => {
      setFailed(false);
      const result = await enrollInPromotion(slug);
      if (result.ok) {
        setEnrollment(result.data);
        // Mechanic blocks (wheel…) re-read the player's state now that they take part.
        router.refresh();
      } else if (result.error === 'signedOut') setSignedOut(true);
      else setFailed(true);
    });

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Button size="lg" onClick={join} disabled={pending}>
        {pending ? t('joining') : t('join')}
      </Button>
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {t('error')}
        </p>
      )}
    </div>
  );
}
