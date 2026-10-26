'use client';

import { useEffect } from 'react';

import { useRouter } from '@/i18n/navigation';

import { onLiveChanged, subscribeEvents } from './socket';

type LiveEventsProps = {
  eventIds: string[];
  /** Re-render the page when matches go live or finish (lists of live/upcoming events). */
  refreshOnLiveChange?: boolean;
};

/** Keeps the given events updated in real time. Renders nothing. */
export function LiveEvents({ eventIds, refreshOnLiveChange = false }: LiveEventsProps) {
  const router = useRouter();
  const key = eventIds.join(',');

  useEffect(() => {
    if (!key) return;
    return subscribeEvents(key.split(','));
  }, [key]);

  useEffect(() => {
    if (!refreshOnLiveChange) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = onLiveChanged(() => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 1000);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [refreshOnLiveChange, router]);

  return null;
}
