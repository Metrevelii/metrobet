import { Button, Card, Skeleton } from '@metrobet/ui';
import { TriangleAlert } from 'lucide-react';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { getCurrentPlayer } from '@/features/auth';
import { GameFrame, getGame, launchGame, openRealSession, SLOTS_HREF } from '@/features/casino';
import { Link } from '@/i18n/navigation';

type Props = PageProps<'/[locale]/slots/play/[game]'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const game = await getGame((await params).game);
  return game ? { title: game.name, robots: { index: false } } : {};
}

async function Launcher({ params, searchParams }: Props) {
  const game = await getGame((await params).game);
  if (!game) notFound();

  // Real money by default for signed-in players when the game supports it; `?mode=demo` opts out.
  const signedIn = game.hasRealMoney && (await getCurrentPlayer()) !== null;
  const mode = signedIn && (await searchParams).mode !== 'demo' ? 'real' : 'demo';
  const locale = await getLocale();
  // A new provider session per visit: never cached.
  const url =
    mode === 'real'
      ? await openRealSession(game.slug, locale)
      : await launchGame(game.slug, 'demo', locale);
  if (!url) {
    const t = await getTranslations('Casino.launcher');
    return (
      <Card className="flex flex-col items-center pb-8">
        <EmptyState
          icon={TriangleAlert}
          title={t('unavailable')}
          description={t('unavailableHint')}
        />
        <Button variant="secondary" asChild>
          <Link href={SLOTS_HREF}>{t('back')}</Link>
        </Button>
      </Card>
    );
  }
  return <GameFrame game={game} url={url} mode={mode} signedIn={signedIn} />;
}

export default function PlayGamePage({ params, searchParams }: Props) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="aspect-video rounded-xl" />
        </div>
      }
    >
      <Launcher params={params} searchParams={searchParams} />
    </Suspense>
  );
}
