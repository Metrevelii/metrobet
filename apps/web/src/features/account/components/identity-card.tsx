import { Badge, Card } from '@metrobet/ui';
import { BadgeCheck, Clock, ShieldAlert, ShieldQuestion } from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';

import { getKyc } from '../data';
import { VerifyIdentityButton } from './verify-identity-button';

const ICONS = {
  verified: BadgeCheck,
  pending: Clock,
  rejected: ShieldAlert,
  unverified: ShieldQuestion,
} as const;
const BADGES = {
  verified: 'success',
  pending: 'warning',
  rejected: 'destructive',
  unverified: 'default',
} as const;

/** Identity verification status with the way forward. Request-time: inside <Suspense>. */
export async function IdentityCard() {
  const [kyc, t, format] = await Promise.all([
    getKyc(),
    getTranslations('Account.identity'),
    getFormatter(),
  ]);
  if (!kyc) return <p className="text-sm text-muted-foreground">{t('unavailable')}</p>;
  const Icon = ICONS[kyc.status];
  const rejection = kyc.status === 'rejected' ? kyc.latest?.rejection : null;

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted">
          <Icon className="size-6" />
        </span>
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold">{t('title')}</h2>
            <Badge variant={BADGES[kyc.status]}>{t(`status.${kyc.status}`)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{t(`hint.${kyc.status}`)}</p>
        </div>
      </div>

      {kyc.status === 'verified' && (
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{t('name')}</dt>
            <dd className="font-semibold">
              {kyc.firstName} {kyc.lastName}
            </dd>
          </div>
          {kyc.verifiedAt && (
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{t('verifiedAt')}</dt>
              <dd className="font-semibold">
                {format.dateTime(new Date(kyc.verifiedAt), {
                  dateStyle: 'long',
                  timeZone: 'Asia/Tbilisi',
                })}
              </dd>
            </div>
          )}
        </dl>
      )}

      {rejection && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {t(`rejections.${rejection}`)}
        </p>
      )}

      {(kyc.status === 'unverified' || kyc.status === 'rejected') && (
        <>
          <VerifyIdentityButton retry={kyc.status === 'rejected'} />
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            <li>{t('needs.document')}</li>
            <li>{t('needs.match')}</li>
            <li>{t('needs.why')}</li>
          </ul>
        </>
      )}
    </Card>
  );
}
