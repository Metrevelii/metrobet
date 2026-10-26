import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  heroBannerAspect,
  Skeleton,
} from '@metrobet/ui';
import { CalendarClock, ChevronLeft, ScrollText } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { getPromotion, PromoBanner } from '@/features/promotions';
import { Link } from '@/i18n/navigation';

type Props = PageProps<'/[locale]/promotions/[slug]'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const promotion = await getPromotion(await getLocale(), slug);
  return promotion ? { title: promotion.title, description: promotion.subtitle } : {};
}

const split = (text: string, separator: RegExp) =>
  text
    .split(separator)
    .map((part) => part.trim())
    .filter(Boolean);

async function PromotionDetailView({ params }: Pick<Props, 'params'>) {
  const { slug } = await params;
  const promotion = await getPromotion(await getLocale(), slug);
  if (!promotion) notFound();

  const t = await getTranslations('Promotions');
  const format = await getFormatter();

  return (
    <>
      <PromoBanner promotion={promotion} titleAs="h1" ctaHref={promotion.ctaHref} eager />
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="flex flex-col gap-4 leading-relaxed text-muted-foreground">
            {split(promotion.content, /\n{2,}/).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <ScrollText className="size-4 text-primary" />
            <CardTitle>{t('terms')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ul className="flex list-disc flex-col gap-2 pl-4 text-sm text-muted-foreground marker:text-primary">
              {split(promotion.terms, /\n/).map((term) => (
                <li key={term}>{term}</li>
              ))}
            </ul>
            <p className="flex items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
              <CalendarClock className="size-4" />
              {promotion.endsAt
                ? t('validUntil', {
                    date: format.dateTime(new Date(promotion.endsAt), { dateStyle: 'long' }),
                  })
                : t('ongoing')}
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function PromotionDetailSkeleton() {
  return (
    <>
      <Skeleton className={cn('rounded-xl', heroBannerAspect.responsive)} />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
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
