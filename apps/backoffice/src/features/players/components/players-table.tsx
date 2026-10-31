import type { AdminPlayersPage } from '@metrobet/contracts';
import {
  Badge,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@metrobet/ui';
import { Users } from 'lucide-react';
import Link from 'next/link';

import { dateTime, money } from '@/lib/format';

import { PlayerStatusBadge } from './player-status-badge';

export function PlayersTable({ players }: { players: AdminPlayersPage }) {
  if (players.items.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <Users className="size-8 text-muted-foreground" />
        <p className="font-semibold">No players found</p>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Player</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead>Registered</TableHead>
            <TableHead>Last login</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.items.map((player) => (
            <TableRow key={player.id}>
              <TableCell>
                <Link href={`/players/${player.id}`} className="font-semibold hover:underline">
                  {player.email ?? player.phone}
                </Link>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="font-mono">{player.id.slice(0, 8)}</span>
                  {!player.verified && <Badge>Unverified</Badge>}
                </div>
              </TableCell>
              <TableCell>
                <PlayerStatusBadge status={player.status} />
              </TableCell>
              <TableCell className="text-right font-semibold tabular">
                {money(player.balance)}
              </TableCell>
              <TableCell className="text-muted-foreground">{dateTime(player.createdAt)}</TableCell>
              <TableCell className="text-muted-foreground">
                {player.lastLoginAt ? dateTime(player.lastLoginAt) : '–'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
