import { SPORTS } from '@metrobet/contracts';
import { Button, Input, NativeSelect } from '@metrobet/ui';
import { Filter } from 'lucide-react';

/** GET form: filters go into the URL, so views are shareable. */
export function TradingFilters({
  sport,
  status,
  q,
}: {
  sport?: string;
  status?: string;
  q?: string;
}) {
  return (
    <form className="flex flex-wrap items-end gap-2" action="/sportsbook">
      <Input
        name="q"
        defaultValue={q ?? ''}
        placeholder="Team or league"
        aria-label="Search"
        className="w-56"
      />
      <NativeSelect name="sport" defaultValue={sport ?? ''} aria-label="Sport" className="w-40">
        <option value="">Any sport</option>
        {SPORTS.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect name="status" defaultValue={status ?? ''} aria-label="State" className="w-40">
        <option value="">Live and upcoming</option>
        <option value="live">Live</option>
        <option value="scheduled">Upcoming</option>
        <option value="suspended">With suspensions</option>
      </NativeSelect>
      <Button type="submit" variant="secondary">
        <Filter />
        Filter
      </Button>
    </form>
  );
}
