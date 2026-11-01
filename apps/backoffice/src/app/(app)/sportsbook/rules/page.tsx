import { BET_LIMITS } from '@metrobet/contracts';
import { Skeleton } from '@metrobet/ui';
import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import { getCurrentStaff, hasRole } from '@/features/auth';
import { listTradingRules, tradingTargets, TradingRules } from '@/features/sportsbook';

export const metadata: Metadata = { title: 'Margins & limits' };

async function Rules() {
  if (!hasRole(await getCurrentStaff(), ['risk'])) return <NoAccess roles="risk" />;
  const [rules, targets] = await Promise.all([listTradingRules(), tradingTargets()]);
  return (
    <TradingRules
      rules={rules}
      competitions={targets.competitions}
      defaults={{ maxStake: BET_LIMITS.maxStake, maxPayout: BET_LIMITS.maxPayout }}
    />
  );
}

export default function RulesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Margins & limits"
        description="Re-price the feed at your own margin and cap stakes and wins per sport or competition. Changes reach players at once."
        back={
          <Link
            href="/sportsbook"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            Sportsbook
          </Link>
        }
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
        <Rules />
      </Suspense>
    </div>
  );
}
