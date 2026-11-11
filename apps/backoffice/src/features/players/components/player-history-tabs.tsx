import { Chip } from '@metrobet/ui';
import Link from 'next/link';

export const PLAYER_TABS = [
  { id: 'transactions', label: 'Transactions' },
  { id: 'payments', label: 'Payments' },
  { id: 'tickets', label: 'Sports tickets' },
  { id: 'rounds', label: 'Game rounds' },
] as const;
export type PlayerTab = (typeof PLAYER_TABS)[number]['id'];

/** History tabs as links (`?tab=`), so each view is a shareable URL. */
export function PlayerHistoryTabs({ playerId, active }: { playerId: string; active: PlayerTab }) {
  return (
    <nav className="flex gap-2" aria-label="Player history">
      {PLAYER_TABS.map((tab) => (
        <Chip key={tab.id} asChild selected={tab.id === active}>
          <Link
            href={`/players/${playerId}?tab=${tab.id}`}
            aria-current={tab.id === active ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        </Chip>
      ))}
    </nav>
  );
}
