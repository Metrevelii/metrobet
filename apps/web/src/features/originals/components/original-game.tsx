'use client';

import type { OriginalLaunch } from '@metrobet/contracts';

import { MetroJet } from './metro-jet/metro-jet';
import { SupraFortune } from './supra-fortune';

/** The native client for an Originals launch (rendered by the launcher instead of an iframe). */
export function OriginalGame({ launch }: { launch: OriginalLaunch }) {
  switch (launch.game) {
    case 'supra-fortune':
      return <SupraFortune launch={launch} />;
    case 'metro-jet':
      return <MetroJet launch={launch} />;
  }
}
