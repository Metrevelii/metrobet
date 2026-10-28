'use client';

import type { OriginalLaunch } from '@metrobet/contracts';

import { CrashGame } from './crash/crash-game';
import { LongshotStage } from './longshot/longshot-stage';
import { JetStage } from './metro-jet/jet-stage';
import { SupraFortune } from './supra-fortune';

/** The native client for an Originals launch (rendered by the launcher instead of an iframe). */
export function OriginalGame({ launch }: { launch: OriginalLaunch }) {
  switch (launch.game) {
    case 'supra-fortune':
      return <SupraFortune launch={launch} />;
    case 'metro-jet':
      return <CrashGame launch={launch} game="metro-jet" title="Metro Jet" Stage={JetStage} />;
    case 'longshot':
      return <CrashGame launch={launch} game="longshot" title="Longshot" Stage={LongshotStage} />;
  }
}
