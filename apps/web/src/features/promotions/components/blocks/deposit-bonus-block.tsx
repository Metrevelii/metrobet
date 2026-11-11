import { type PromoBlockViewOf, toMajor } from '@metrobet/contracts';
import { Button, Card } from '@metrobet/ui';
import { Gift } from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

import { BlockSection } from './block-section';

/** The deposit offer in numbers, with the way to claim it (a first deposit). Static. */
export async function DepositBonusBlock({ block }: { block: PromoBlockViewOf<'depositBonus'> }) {
  const [t, format] = await Promise.all([
    getTranslations('Promotions.depositBonus'),
    getFormatter(),
  ]);
  const money = (minor: number) =>
    format.number(toMajor(minor), {
      style: 'currency',
      currency: 'GEL',
      maximumFractionDigits: 0,
    });
  const facts = [
    [t('bonus'), t('bonusValue', { percent: block.percent, max: money(block.maxBonus) })],
    [t('minDeposit'), money(block.minDeposit)],
    [t('wagering'), `${block.wageringMultiplier}×`],
    [t('valid'), t('days', { days: block.validDays })],
  ] as const;

  return (
    <BlockSection title={block.title}>
      <Card className="flex flex-col gap-5 p-5">
        <div className="flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Gift className="size-7" />
          </span>
          <p className="text-2xl font-black">
            {t('headline', { percent: block.percent, max: money(block.maxBonus) })}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {facts.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5 rounded-md bg-muted p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-bold">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted-foreground">
          {t('howItWorks', {
            wagering: block.wageringMultiplier,
            days: block.validDays,
          })}
        </p>
        <Button size="lg" className="self-start" asChild>
          <Link href="/wallet/deposit">{t('cta')}</Link>
        </Button>
      </Card>
    </BlockSection>
  );
}
