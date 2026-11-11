import type { AdminKycChecksPage } from '@metrobet/contracts';
import {
  Badge,
  Card,
  cn,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@metrobet/ui';
import { ScanFace } from 'lucide-react';
import Link from 'next/link';

import { dateTime } from '@/lib/format';

import { KYC_REJECTION_LABELS, KYC_STATUS_VARIANTS } from '../labels';
import { KycDecision } from './kyc-decision';

/** Identity checks: what the document says next to the account. `canDecide` on checks in review. */
export function KycChecksTable({
  checks,
  showPlayer = true,
  canDecide = false,
}: {
  checks: AdminKycChecksPage;
  showPlayer?: boolean;
  canDecide?: boolean;
}) {
  if (checks.items.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <ScanFace className="size-8 text-muted-foreground" />
        <p className="font-semibold">No identity checks found</p>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Started</TableHead>
            {showPlayer && <TableHead>Player</TableHead>}
            <TableHead>Document says</TableHead>
            <TableHead>Date of birth</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {checks.items.map((check) => {
            const dobMismatch =
              check.person?.dateOfBirth &&
              check.registeredDateOfBirth &&
              check.person.dateOfBirth !== check.registeredDateOfBirth;
            return (
              <TableRow key={check.id}>
                <TableCell className="text-muted-foreground">{dateTime(check.createdAt)}</TableCell>
                {showPlayer && (
                  <TableCell>
                    <Link
                      href={`/players/${check.playerId}?tab=identity`}
                      className="hover:underline"
                    >
                      {check.playerContact ?? check.playerId}
                    </Link>
                  </TableCell>
                )}
                <TableCell>
                  {check.person ? (
                    <div className="flex flex-col">
                      <span className="font-semibold">
                        {check.person.firstName} {check.person.lastName}
                      </span>
                      <span className="text-xs text-muted-foreground tabular">
                        {check.person.personalNumber} ·{' '}
                        {check.person.documentType === 'passport' ? 'Passport' : 'ID card'}{' '}
                        {check.person.documentNumber}
                      </span>
                    </div>
                  ) : (
                    '–'
                  )}
                </TableCell>
                <TableCell className="tabular">
                  <div className="flex flex-col">
                    <span className={cn(dobMismatch && 'font-semibold text-destructive')}>
                      {check.person?.dateOfBirth ?? '–'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      account: {check.registeredDateOfBirth ?? '–'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <Badge variant={KYC_STATUS_VARIANTS[check.status]}>{check.status}</Badge>
                    {(check.rejection || check.note || check.reviewedBy) && (
                      <span className="max-w-60 text-xs text-muted-foreground">
                        {[
                          check.rejection && KYC_REJECTION_LABELS[check.rejection],
                          check.note,
                          check.reviewedBy && `by ${check.reviewedBy}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {canDecide && check.status === 'review' && <KycDecision check={check} />}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
