import type { PromoBlockViewOf } from '@metrobet/contracts';
import { Card, cn } from '@metrobet/ui';
import { Trophy } from 'lucide-react';

import { BlockSection } from './block-section';

/** The first three rows are highlighted as podium places. */
const PODIUM = 3;

export function PrizesBlock({ block }: { block: PromoBlockViewOf<'prizes'> }) {
  return (
    <BlockSection title={block.title}>
      <Card className="overflow-hidden">
        <ul className="divide-y">
          {block.items.map((item, index) => (
            <li key={index} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="flex items-center gap-3 text-sm font-medium">
                <Trophy
                  className={cn(
                    'size-4',
                    index < PODIUM ? 'text-primary' : 'text-muted-foreground/40',
                  )}
                />
                {item.label}
              </span>
              <span
                className={cn(
                  'font-bold tabular-nums',
                  index < PODIUM ? 'text-primary' : 'text-foreground',
                )}
              >
                {item.prize}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </BlockSection>
  );
}
