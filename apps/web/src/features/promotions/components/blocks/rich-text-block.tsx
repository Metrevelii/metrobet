import type { PromoBlockViewOf } from '@metrobet/contracts';
import { Card, CardContent } from '@metrobet/ui';

import { BlockSection } from './block-section';
import { paragraphs } from './split-text';

export function RichTextBlock({ block }: { block: PromoBlockViewOf<'richText'> }) {
  return (
    <BlockSection title={block.title}>
      <Card>
        <CardContent className="flex flex-col gap-4 leading-relaxed text-muted-foreground">
          {paragraphs(block.body).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </CardContent>
      </Card>
    </BlockSection>
  );
}
