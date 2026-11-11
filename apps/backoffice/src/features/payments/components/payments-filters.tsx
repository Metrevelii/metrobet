import { PAYMENT_KINDS, PAYMENT_STATUSES } from '@metrobet/contracts';
import { Button, NativeSelect } from '@metrobet/ui';
import { Filter } from 'lucide-react';

/** GET form: filters go into the URL, so results are shareable links. */
export function PaymentsFilters({ kind, status }: { kind?: string; status?: string }) {
  return (
    <form className="flex flex-wrap items-end gap-2" action="/payments">
      <NativeSelect name="kind" defaultValue={kind ?? ''} aria-label="Kind" className="w-40">
        <option value="">Deposits and withdrawals</option>
        {PAYMENT_KINDS.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect name="status" defaultValue={status ?? ''} aria-label="Status" className="w-40">
        <option value="">Any status</option>
        {PAYMENT_STATUSES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </NativeSelect>
      <input type="hidden" name="all" value="1" />
      <Button type="submit" variant="secondary">
        <Filter />
        Filter
      </Button>
    </form>
  );
}
