import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';
import { PromotionForm } from '@/features/promotions';

import { BackToPromotions } from '../back-link';

export const metadata: Metadata = { title: 'New promotion' };

export default function NewPromotionPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="New promotion" back={<BackToPromotions />} />
      <PromotionForm />
    </div>
  );
}
