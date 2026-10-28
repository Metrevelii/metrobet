import { toMajor, type WalletTransaction } from '@metrobet/contracts';
import { Button, Card, cn } from '@metrobet/ui';
import { ChevronLeft, ChevronRight, Receipt } from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';

import { EmptyState } from '@/components/shared/empty-state';
import { Link } from '@/i18n/navigation';

import { getWallet, getWalletTransactions } from '../data';
import { DevDeposit } from './dev-deposit';

type Formatter = Awaited<ReturnType<typeof getFormatter>>;

const money = (format: Formatter, minor: number, signDisplay?: 'exceptZero') =>
  format.number(toMajor(minor), { style: 'currency', currency: 'GEL', signDisplay });

async function TransactionRow({ item }: { item: WalletTransaction }) {
  const [format, t] = await Promise.all([getFormatter(), getTranslations('Wallet')]);
  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold">{t(`types.${item.type}`)}</span>
        <span className="truncate text-xs text-muted-foreground">
          {format.dateTime(new Date(item.createdAt), {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'Asia/Tbilisi',
          })}
          {item.gameSlug && ` · ${item.gameSlug}`}
        </span>
      </div>
      <div className="flex flex-col items-end tabular-nums">
        <span
          className={cn(
            'text-sm font-semibold',
            item.amount > 0 ? 'text-success' : 'text-foreground',
          )}
        >
          {money(format, item.amount, 'exceptZero')}
        </span>
        <span className="text-xs text-muted-foreground">
          {t('balanceAfter', { balance: money(format, item.balanceAfter) })}
        </span>
      </div>
    </li>
  );
}

/** Balance, dev deposits and transaction history. Request-time: render inside <Suspense>. */
export async function WalletView({ page }: { page: number }) {
  const [wallet, history, format, t] = await Promise.all([
    getWallet(),
    getWalletTransactions(page),
    getFormatter(),
    getTranslations('Wallet'),
  ]);
  if (!wallet || !history) {
    return (
      <Card>
        <EmptyState icon={Receipt} title={t('unavailable')} />
      </Card>
    );
  }
  const pages = Math.max(1, Math.ceil(history.total / history.pageSize));

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-muted-foreground">{t('balance')}</span>
          <span className="text-3xl font-bold tabular-nums">{money(format, wallet.balance)}</span>
        </div>
        {process.env.NODE_ENV !== 'production' && <DevDeposit />}
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold">{t('history')}</h2>
        <Card>
          {history.items.length === 0 ? (
            <EmptyState icon={Receipt} title={t('empty')} />
          ) : (
            <ol className="divide-y">
              {history.items.map((item) => (
                <TransactionRow key={item.id} item={item} />
              ))}
            </ol>
          )}
        </Card>
        {pages > 1 && (
          <nav className="flex items-center justify-between gap-4" aria-label={t('pages')}>
            <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
              {page > 1 ? (
                <Link href={`/wallet?page=${page - 1}`}>
                  <ChevronLeft />
                  {t('newer')}
                </Link>
              ) : (
                <span>
                  <ChevronLeft />
                  {t('newer')}
                </span>
              )}
            </Button>
            <span className="text-xs text-muted-foreground">{t('page', { page, pages })}</span>
            <Button variant="outline" size="sm" disabled={page >= pages} asChild={page < pages}>
              {page < pages ? (
                <Link href={`/wallet?page=${page + 1}`}>
                  {t('older')}
                  <ChevronRight />
                </Link>
              ) : (
                <span>
                  {t('older')}
                  <ChevronRight />
                </span>
              )}
            </Button>
          </nav>
        )}
      </section>
    </div>
  );
}
