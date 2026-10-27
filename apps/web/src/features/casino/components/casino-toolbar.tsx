import { getProviders } from '../data';
import { CasinoSearch } from './casino-search';
import { type CasinoChip, CategoryNav } from './category-nav';
import { ProviderTabs } from './provider-tabs';

export type CasinoToolbarProps = {
  /** Active provider tab: `all`, a provider slug, or null (favorites, search). */
  tab: string | null;
  chip?: CasinoChip;
  query?: string;
};

/** Provider tabs, category chips and search, shared by every Slots page. */
export async function CasinoToolbar({ tab, chip, query }: CasinoToolbarProps) {
  const providers = await getProviders();
  return (
    <div className="flex flex-col gap-4">
      <ProviderTabs providers={providers} active={tab} />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <CategoryNav active={chip} provider={tab && tab !== 'all' ? tab : undefined} />
        <div className="md:w-72">
          <CasinoSearch defaultValue={query} />
        </div>
      </div>
    </div>
  );
}
