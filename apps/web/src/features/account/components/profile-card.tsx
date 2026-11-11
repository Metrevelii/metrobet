import { Badge, Button, Card } from '@metrobet/ui';
import { getFormatter, getTranslations } from 'next-intl/server';

import { getCurrentPlayer } from '@/features/auth';
import { Link } from '@/i18n/navigation';

/** The player's account details. Request-time: render inside <Suspense>. */
export async function ProfileCard() {
  const [player, t, format] = await Promise.all([
    getCurrentPlayer(),
    getTranslations('Account.profile'),
    getFormatter(),
  ]);
  if (!player) return null;
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: 'long', timeZone: 'Asia/Tbilisi' });
  const rows = [
    [player.email ? t('email') : t('phone'), player.email ?? player.phone],
    [t('dateOfBirth'), date(`${player.dateOfBirth}T12:00:00Z`)],
    [t('memberSince'), date(player.createdAt)],
    [t('currency'), player.currency],
  ] as const;

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold">{t('title')}</h2>
        {player.verified ? (
          <Badge variant="success">{t('verified')}</Badge>
        ) : (
          <Button size="sm" asChild>
            <Link href="/verify?next=/account">{t('verify')}</Link>
          </Button>
        )}
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-semibold break-all">{value}</dd>
          </div>
        ))}
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">{t('kyc')}</dt>
          <dd className="font-semibold">{t(`kycStatus.${player.kycStatus}`)}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">{t('contactSupport')}</p>
    </Card>
  );
}
