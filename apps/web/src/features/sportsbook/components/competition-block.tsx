import type { CompetitionEvents } from '@metrobet/contracts';
import { Card } from '@metrobet/ui';

import { EventRow } from './event-row';

export function CompetitionBlock({ group }: { group: CompetitionEvents }) {
  return (
    <Card className="overflow-hidden">
      <h3 className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold">
        <span className="text-muted-foreground">{group.competition.country}</span>
        <span aria-hidden className="text-muted-foreground">
          ·
        </span>
        {group.competition.name}
      </h3>
      <div className="divide-y">
        {group.events.map((event) => (
          <EventRow key={event.id} event={event} />
        ))}
      </div>
    </Card>
  );
}
