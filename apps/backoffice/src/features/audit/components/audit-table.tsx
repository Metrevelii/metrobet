import type { AuditPage } from '@metrobet/contracts';
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
import { ScrollText } from 'lucide-react';
import Link from 'next/link';

import { dateTime } from '@/lib/format';

/** Where an audited entity lives in the backoffice, when it has a page. */
const ENTITY_HREF: Record<string, (id: string) => string> = {
  player: (id) => `/players/${id}`,
  ticket: (id) => `/bets/${id}`,
  promotion: (id) => `/promotions/${id}`,
};

const Json = ({ value }: { value: unknown }) =>
  value === null || value === undefined ? (
    <span className="text-muted-foreground">–</span>
  ) : (
    <pre className="max-w-md overflow-x-auto rounded-md bg-muted p-2 text-xs whitespace-pre-wrap">
      {JSON.stringify(value, null, 2)}
    </pre>
  );

/** Staff actions, newest first; before/after open on demand. */
export function AuditTable({ page }: { page: AuditPage }) {
  if (page.items.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <ScrollText className="size-8 text-muted-foreground" />
        <p className="font-semibold">Nothing logged yet</p>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Who</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>Change</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.items.map((entry) => {
            const href = ENTITY_HREF[entry.entityType]?.(entry.entityId);
            return (
              <TableRow key={entry.id} className="align-top">
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {dateTime(entry.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="font-semibold">{entry.actorName ?? entry.actor}</div>
                  {entry.actorName && (
                    <div className="font-mono text-xs text-muted-foreground">{entry.actor}</div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge>{entry.action}</Badge>
                </TableCell>
                <TableCell>
                  <div className="text-xs text-muted-foreground">{entry.entityType}</div>
                  {href ? (
                    <Link href={href} className="font-mono text-xs hover:underline">
                      {entry.entityId.slice(0, 8)}
                    </Link>
                  ) : (
                    <span className="font-mono text-xs">{entry.entityId.slice(0, 8)}</span>
                  )}
                </TableCell>
                <TableCell>
                  <details>
                    <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                      Before / after
                    </summary>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <Json value={entry.before} />
                      <Json value={entry.after} />
                    </div>
                  </details>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
