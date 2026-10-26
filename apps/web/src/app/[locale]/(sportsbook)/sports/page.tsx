import { getLocale } from 'next-intl/server';

import { redirect } from '@/i18n/navigation';

/** /sports opens the most popular sport. */
export default async function SportsPage() {
  redirect({ href: '/sports/football', locale: await getLocale() });
}
