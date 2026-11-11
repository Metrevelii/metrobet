import type { AdminPlayer, LimitKind, ResponsibleGaming } from '@metrobet/contracts';
import { Card, CardContent, CardHeader, CardTitle } from '@metrobet/ui';

import { dateTime, money } from '@/lib/format';

const KINDS: Record<LimitKind, string> = { deposit: 'Deposit', loss: 'Loss', stake: 'Stake' };
const PERIODS = { day: '24 h', week: '7 days', month: '30 days' } as const;

/** The player's own limits, reality check and exclusion (read-only: only players set them). */
export function ResponsibleGamingCard({
  player,
  data,
}: {
  player: AdminPlayer;
  data: ResponsibleGaming;
}) {
  const set = data.limits.filter((limit) => limit.amount !== null || limit.pending);
  const exclusion =
    player.status !== 'self_excluded'
      ? '–'
      : player.excludedUntil
        ? `Until ${dateTime(player.excludedUntil)}`
        : 'Open-ended';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Responsible gaming</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">Exclusion</dt>
            <dd className="font-semibold">{exclusion}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">Reality check</dt>
            <dd className="font-semibold">
              {data.realityCheckMinutes ? `Every ${data.realityCheckMinutes} min` : 'Off'}
            </dd>
          </div>
        </dl>
        {set.length === 0 ? (
          <p className="text-muted-foreground">No limits set.</p>
        ) : (
          <table className="w-full text-left">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1 font-medium">Limit</th>
                <th className="py-1 font-medium">Amount</th>
                <th className="py-1 font-medium">Used</th>
                <th className="py-1 font-medium">Pending</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {set.map((limit) => (
                <tr key={`${limit.kind}:${limit.period}`}>
                  <td className="py-1.5">
                    {KINDS[limit.kind]} · {PERIODS[limit.period]}
                  </td>
                  <td className="py-1.5 tabular">
                    {limit.amount === null ? '–' : money(limit.amount)}
                  </td>
                  <td className="py-1.5 tabular">{money(limit.used)}</td>
                  <td className="py-1.5 text-xs text-muted-foreground">
                    {limit.pending
                      ? `${limit.pending.amount === null ? 'Removal' : money(limit.pending.amount)} at ${dateTime(limit.pending.effectiveAt)}`
                      : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs text-muted-foreground">
          Changes are in the audit log (player.limit, player.self_exclusion).
        </p>
      </CardContent>
    </Card>
  );
}
