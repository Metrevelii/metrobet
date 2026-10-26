import { getProviders } from '../data';
import { CasinoSearch } from './casino-search';
import { type CasinoSection, CategoryNav } from './category-nav';
import { ProviderFilter } from './provider-filter';

type CasinoToolbarProps = { active?: CasinoSection; provider?: string; query?: string };

/** Search, provider filter and category chips shared by every casino page. */
export async function CasinoToolbar({ active, provider, query }: CasinoToolbarProps) {
  const providers = await getProviders();
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_16rem]">
        <CasinoSearch defaultValue={query} />
        <ProviderFilter providers={providers} value={provider} />
      </div>
      <CategoryNav active={active} />
    </div>
  );
}
