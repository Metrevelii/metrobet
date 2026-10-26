import { Badge, Button, Card, Skeleton } from '@metrobet/ui';
import { getTranslations } from 'next-intl/server';

import { Section } from '@/components/shared/section';
import { Link } from '@/i18n/navigation';

export default async function HomePage() {
  const t = await getTranslations('Home');
  return (
    <div className="flex flex-col gap-8">
      <Card className="relative overflow-hidden border-primary/20 bg-glow p-6 sm:p-10">
        <div className="flex max-w-xl flex-col gap-4">
          <h1 className="text-3xl font-black tracking-tight text-balance sm:text-4xl">
            {t('heroTitle')}
          </h1>
          <p className="text-muted-foreground">{t('heroSubtitle')}</p>
          <Button size="lg" className="self-start shadow-glow" asChild>
            <Link href="/sports">{t('heroCta')}</Link>
          </Button>
        </div>
      </Card>

      <Section
        title={
          <>
            <Badge variant="live">Live</Badge>
            {t('liveNow')}
          </>
        }
        action={{ href: '/live', label: t('viewAll') }}
      >
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </Section>

      <Section title={t('popularGames')} action={{ href: '/casino', label: t('viewAll') }}>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="aspect-3/4 rounded-lg" />
          ))}
        </div>
      </Section>
    </div>
  );
}
