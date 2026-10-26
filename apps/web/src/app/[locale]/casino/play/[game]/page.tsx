import { Button, Card, Skeleton } from '@metrobet/ui';
import { TriangleAlert } from 'lucide-react';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { GameFrame, getGame, launchGame } from '@/features/casino';
import { Link } from '@/i18n/navigation';

type Props = PageProps<'/[locale]/casino/play/[game]'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const game = await getGame((await params).game);
  return game ? { title: game.name, robots: { index: false } } : {};
}

async function Launcher({ params }: Pick<Props, 'params'>) {
  const game = await getGame((await params).game);
  if (!game) notFound();

  // A new provider session per visit: never cached.
  const url = await launchGame(game.slug, 'demo', await getLocale());
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
          <Link href="/casino">{t('back')}</Link>
        </Button>
      </Card>
    );
  }
  return <GameFrame game={game} url={url} />;
}

export default function PlayGamePage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="aspect-video rounded-xl" />
        </div>
      }
    >
      <Launcher params={params} />
    </Suspense>
  );
}
