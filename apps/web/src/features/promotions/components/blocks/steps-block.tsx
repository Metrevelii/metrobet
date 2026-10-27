import type { PromoBlockViewOf } from '@metrobet/contracts';
import { Card } from '@metrobet/ui';

import { BlockSection } from './block-section';

export function StepsBlock({ block }: { block: PromoBlockViewOf<'steps'> }) {
  return (
    <BlockSection title={block.title}>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {block.items.map((step, index) => (
          <li key={index}>
            <Card className="flex h-full gap-3 p-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {index + 1}
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.text}</p>
              </div>
            </Card>
          </li>
        ))}
      </ol>
    </BlockSection>
  );
}
