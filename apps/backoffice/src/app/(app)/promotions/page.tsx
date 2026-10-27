import { Button, Skeleton } from '@metrobet/ui';
import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { PageHeader } from '@/components/page-header';
import { listPromotions, PromotionsTable } from '@/features/promotions';

export const metadata: Metadata = { title: 'Promotions' };

async function PromotionsList() {
  return <PromotionsTable promotions={await listPromotions()} />;
}

export default function PromotionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Promotions"
        description="Banners in the site sliders and the promotions pages. Order here = slider order."
        actions={
          <Button asChild>
            <Link href="/promotions/new">
              <Plus />
              New promotion
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
        <PromotionsList />
      </Suspense>
    </div>
  );
}
