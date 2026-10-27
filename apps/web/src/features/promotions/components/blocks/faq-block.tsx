import type { PromoBlockViewOf } from '@metrobet/contracts';
import { Card } from '@metrobet/ui';
import { ChevronDown } from 'lucide-react';

import { BlockSection } from './block-section';

export function FaqBlock({ block }: { block: PromoBlockViewOf<'faq'> }) {
  return (
    <BlockSection title={block.title}>
      <Card className="divide-y overflow-hidden">
        {block.items.map((item, index) => (
          <details key={index} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-semibold transition-colors hover:bg-accent [&::-webkit-details-marker]:hidden">
              {item.question}
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
          </details>
        ))}
      </Card>
    </BlockSection>
  );
}
