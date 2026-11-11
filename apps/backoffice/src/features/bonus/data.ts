import { type AdminBonus, adminBonusesSchema } from '@metrobet/contracts';

import { adminFetch } from '@/lib/admin-api';

/** A player's bonuses, newest first. Request-time: render inside <Suspense>. */
export function getPlayerBonuses(playerId: string): Promise<AdminBonus[]> {
  return adminFetch(`players/${encodeURIComponent(playerId)}/bonuses`, adminBonusesSchema);
}
