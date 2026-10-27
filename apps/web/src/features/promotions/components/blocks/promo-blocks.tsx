import type { PromoBlockView, PromotionDetail } from '@metrobet/contracts';

import { CountdownBlock } from './countdown-block';
import { FaqBlock } from './faq-block';
import { OptInBlock } from './opt-in-block';
import { PrizesBlock } from './prizes-block';
import { RichTextBlock } from './rich-text-block';
import { StepsBlock } from './steps-block';
import { TermsBlock } from './terms-block';
import { WheelBlock } from './wheel-block';

function PromoBlock({ block, promotion }: { block: PromoBlockView; promotion: PromotionDetail }) {
  switch (block.type) {
    case 'richText':
      return <RichTextBlock block={block} />;
    case 'steps':
      return <StepsBlock block={block} />;
    case 'countdown':
      return <CountdownBlock block={block} endsAt={promotion.endsAt} />;
    case 'prizes':
      return <PrizesBlock block={block} />;
    case 'faq':
      return <FaqBlock block={block} />;
    case 'terms':
      return <TermsBlock block={block} endsAt={promotion.endsAt} />;
    case 'optIn':
      return <OptInBlock block={block} slug={promotion.slug} />;
    case 'wheel':
      return <WheelBlock block={block} slug={promotion.slug} />;
  }
}

/** A promotion's page body: its blocks, in backoffice order. */
export function PromoBlocks({ promotion }: { promotion: PromotionDetail }) {
  return (
    <div className="flex flex-col gap-6">
      {promotion.blocks.map((block) => (
        <PromoBlock key={block.id} block={block} promotion={promotion} />
      ))}
    </div>
  );
}
