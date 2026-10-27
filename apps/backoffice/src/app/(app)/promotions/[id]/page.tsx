import { Skeleton } from '@metrobet/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { getPromotion, PromotionForm } from '@/features/promotions';

import { BackToPromotions } from '../back-link';

type Props = PageProps<'/promotions/[id]'>;

export const metadata: Metadata = { title: 'Edit promotion' };

async function EditPromotion({ params }: Pick<Props, 'params'>) {
  const promotion = await getPromotion((await params).id);
  if (!promotion) notFound();
  return (
    <>
      <PageHeader
        title={promotion.title.en}
        description={`/${promotion.slug}`}
        back={<BackToPromotions />}
      />
      <PromotionForm promotion={promotion} />
    </>
  );
}

export default function EditPromotionPage({ params }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<Skeleton className="h-[600px] rounded-lg" />}>
        <EditPromotion params={params} />
      </Suspense>
    </div>
  );
}
