import { PLAYER_STATUSES } from '@metrobet/contracts';
import { Button, Input, NativeSelect } from '@metrobet/ui';
import { Search } from 'lucide-react';

const LABELS = { active: 'Active', suspended: 'Suspended', self_excluded: 'Self-excluded' };

/** GET form: filters go into the URL, so results are shareable links. */
export function PlayersFilters({ search, status }: { search?: string; status?: string }) {
  return (
    <form className="flex flex-wrap items-end gap-2" action="/players">
      <Input
        name="search"
        defaultValue={search}
        placeholder="Email, phone or player id"
        aria-label="Search players"
        className="w-72"
      />
      <NativeSelect name="status" defaultValue={status ?? ''} aria-label="Status" className="w-44">
        <option value="">Any status</option>
        {PLAYER_STATUSES.map((value) => (
          <option key={value} value={value}>
            {LABELS[value]}
          </option>
        ))}
      </NativeSelect>
      <Button type="submit" variant="secondary">
        <Search />
        Search
      </Button>
    </form>
  );
}
