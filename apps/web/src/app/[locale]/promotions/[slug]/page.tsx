import { cn, heroBannerAspect, Skeleton } from '@metrobet/ui';
import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { getPromotion, PromoBanner, PromoBlocks } from '@/features/promotions';
import { Link } from '@/i18n/navigation';

type Props = PageProps<'/[locale]/promotions/[slug]'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const promotion = await getPromotion(await getLocale(), slug);
  return promotion ? { title: promotion.title, description: promotion.subtitle } : {};
}

async function PromotionDetailView({ params }: Pick<Props, 'params'>) {
  const { slug } = await params;
  const promotion = await getPromotion(await getLocale(), slug);
  if (!promotion) notFound();

  return (
    <>
      <PromoBanner promotion={promotion} titleAs="h1" ctaHref={promotion.ctaHref} eager />
      <PromoBlocks promotion={promotion} />
    </>
  );
}

function PromotionDetailSkeleton() {
  return (
    <>
      <Skeleton className={cn('rounded-xl', heroBannerAspect.responsive)} />
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-40 rounded-lg" />
    </>
  );
}

export default async function PromotionPage({ params }: Props) {
  const t = await getTranslations('Promotions');
  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/promotions"
        className="flex items-center gap-1 self-start text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        {t('allPromotions')}
      </Link>
      <Suspense fallback={<PromotionDetailSkeleton />}>
        <PromotionDetailView params={params} />
      </Suspense>
    </div>
  );
}
