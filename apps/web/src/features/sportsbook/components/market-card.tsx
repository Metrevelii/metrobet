'use client';

import type { EventDetail, Market } from '@metrobet/contracts';
import { Card, cn } from '@metrobet/ui';
import { useTranslations } from 'next-intl';

import { marketLabel, selectionLabel } from '../labels';
import { OddsButton } from './odds-button';

export function MarketCard({ event, market }: { event: EventDetail; market: Market }) {
  const t = useTranslations('Sports');
  return (
    <Card className="flex flex-col gap-3 p-4">
      <h3 className="text-sm font-semibold">{marketLabel(t, market)}</h3>
      <div
        className={cn('grid gap-2', market.selections.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}
      >
        {market.selections.map((selection) => (
          <OddsButton
            key={selection.id}
            event={event}
            market={market}
            selection={selection}
            label={selectionLabel(t, market, selection, event)}
          />
        ))}
      </div>
    </Card>
  );
}
