import { Button, Card, Chip } from '@metrobet/ui';
import { ChevronLeft, ChevronRight, Ticket as TicketIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { EmptyState } from '@/components/shared/empty-state';
import { Link } from '@/i18n/navigation';

import { LiveEvents } from '../../realtime/live-events';
import { getTickets } from '../data';
import { BETS_HREF } from '../links';
import { TicketCard } from './ticket-card';

export type BetsTab = 'open' | 'settled';

const href = (tab: BetsTab, page = 1) =>
  `${BETS_HREF}?status=${tab}${page > 1 ? `&page=${page}` : ''}`;

/** The player's tickets: Open / Settled tabs (links), newest first, paged. Request-time. */
export async function MyBets({ tab, page }: { tab: BetsTab; page: number }) {
  const [tickets, t] = await Promise.all([getTickets(tab, page), getTranslations('Bets')]);
  const pages = tickets ? Math.max(1, Math.ceil(tickets.total / tickets.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex gap-2" aria-label={t('tabs')}>
        {(['open', 'settled'] as const).map((item) => (
          <Chip key={item} asChild selected={item === tab}>
            <Link href={href(item)} aria-current={item === tab ? 'page' : undefined}>
              {t(`tab.${item}`)}
            </Link>
          </Chip>
        ))}
      </nav>

      {!tickets ? (
        <Card>
          <EmptyState icon={TicketIcon} title={t('unavailable')} />
        </Card>
      ) : tickets.items.length === 0 ? (
        <Card className="flex flex-col items-center pb-6">
          <EmptyState icon={TicketIcon} title={t(`empty.${tab}`)} description={t('emptyHint')} />
          <Button variant="secondary" asChild>
            <Link href="/sports">{t('browse')}</Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {/* Live prices for open tickets keep the cash-out offers current. */}
          {tab === 'open' && (
            <LiveEvents
              eventIds={[
                ...new Set(
                  tickets.items.flatMap((ticket) =>
                    ticket.selections
                      .filter((selection) => selection.result === null)
                      .map((selection) => selection.eventId),
                  ),
                ),
              ]}
            />
          )}
          {tickets.items.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-4" aria-label={t('pages')}>
          <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
            {page > 1 ? (
              <Link href={href(tab, page - 1)}>
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
              <Link href={href(tab, page + 1)}>
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
    </div>
  );
}
