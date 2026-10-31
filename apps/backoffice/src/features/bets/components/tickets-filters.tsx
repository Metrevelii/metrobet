import { SPORTS, TICKET_STATUSES } from '@metrobet/contracts';
import { Button, NativeSelect } from '@metrobet/ui';
import { Filter } from 'lucide-react';

/** GET form: filters go into the URL, so results are shareable links. */
export function TicketsFilters({ status, sport }: { status?: string; sport?: string }) {
  return (
    <form className="flex flex-wrap items-end gap-2" action="/bets">
      <NativeSelect name="status" defaultValue={status ?? ''} aria-label="Status" className="w-40">
        <option value="">Any status</option>
        {TICKET_STATUSES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect name="sport" defaultValue={sport ?? ''} aria-label="Sport" className="w-40">
        <option value="">Any sport</option>
        {SPORTS.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </NativeSelect>
      <Button type="submit" variant="secondary">
        <Filter />
        Filter
      </Button>
    </form>
  );
}
