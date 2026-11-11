import {
  EXCLUSION_PERIOD_MS,
  type ExclusionInput,
  LIMIT_PERIOD_MS,
  LIMIT_PERIODS,
  type LimitExceeded,
  type LimitKind,
  type LimitPeriod,
  type PlayActivity,
  type RealityCheckMinutes,
  type RealityCheckSettings,
  type ResponsibleGaming,
  type SetLimitInput,
} from '@metrobet/contracts';
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { type Database, DRIZZLE } from '../../database/database.tokens.js';
import { AuditService } from '../audit/audit.service.js';
import { playerActor, PlayersService } from '../players/players.service.js';
import { type PlayerActivityTotals, WalletService } from '../wallet/wallet.service.js';
import {
  ALL_LIMITS,
  changeLimit,
  firstExceeded,
  type InForce,
  type LimitState,
  NO_LIMIT,
  resolveLimit,
  usedOf,
} from './limits.js';
import { rgLimits, rgSettings } from './responsible-gaming.schema.js';

/** A bet or deposit the player's own limits don't allow. Callers map it to their error format. */
export class LimitExceededError extends Error {
  constructor(readonly limit: LimitExceeded) {
    super(`The player's ${limit.period} ${limit.kind} limit is reached`);
  }
}

const limitKey = (kind: LimitKind, period: LimitPeriod) => `${kind}:${period}`;

/**
 * Player-set limits, the reality check and self-exclusion (rules in this module's CLAUDE.md).
 * Betting, the game wallet and deposits call `assertCanStake` / `assertCanDeposit`.
 */
@Injectable()
export class ResponsibleGamingService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(WalletService) private readonly wallet: WalletService,
    @Inject(PlayersService) private readonly players: PlayersService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async overview(playerId: string): Promise<ResponsibleGaming> {
    const now = new Date();
    const [states, usage, { minutes }] = await Promise.all([
      this.states(playerId, now),
      this.usage(playerId, now, LIMIT_PERIODS),
      this.realityCheck(playerId),
    ]);
    return {
      limits: ALL_LIMITS.map(({ kind, period }) => {
        const state = states.get(limitKey(kind, period)) ?? NO_LIMIT;
        return {
          kind,
          period,
          amount: state.amount,
          used: usedOf(kind, usage.get(period)!),
          pending: state.pendingAt
            ? { amount: state.pendingAmount, effectiveAt: state.pendingAt.toISOString() }
            : null,
        };
      }),
      realityCheckMinutes: minutes,
    };
  }

  async setLimit(playerId: string, { kind, period, amount }: SetLimitInput) {
    const now = new Date();
    const before = (await this.states(playerId, now)).get(limitKey(kind, period)) ?? NO_LIMIT;
    const after = changeLimit(before, amount, now);
    await this.db
      .insert(rgLimits)
      .values({ playerId, kind, period, ...after })
      .onConflictDoUpdate({
        target: [rgLimits.playerId, rgLimits.kind, rgLimits.period],
        set: after,
      });
    await this.audit.record({
      actor: playerActor(playerId),
      action: 'player.limit',
      entityType: 'player',
      entityId: playerId,
      before: { kind, period, ...before },
      after: { kind, period, requested: amount, ...after },
    });
    return this.overview(playerId);
  }

  async realityCheck(playerId: string): Promise<RealityCheckSettings> {
    const [row] = await this.db
      .select({ minutes: rgSettings.realityCheckMinutes })
      .from(rgSettings)
      .where(eq(rgSettings.playerId, playerId));
    return { minutes: (row?.minutes ?? null) as RealityCheckMinutes };
  }

  async setRealityCheck(playerId: string, minutes: RealityCheckMinutes) {
    await this.db
      .insert(rgSettings)
      .values({ playerId, realityCheckMinutes: minutes })
      .onConflictDoUpdate({ target: rgSettings.playerId, set: { realityCheckMinutes: minutes } });
    return { minutes };
  }

  /** Stakes and returns since `since` (the reality check's summary). */
  async activity(playerId: string, since: Date): Promise<PlayActivity> {
    const [totals] = await this.wallet.playerActivity(playerId, [since]);
    return {
      since: since.toISOString(),
      stakes: totals!.stakes,
      returns: totals!.returns,
      net: totals!.returns - totals!.stakes,
    };
  }

  /** Takes effect at once and can't be undone early. The password is checked first (403). */
  async exclude(playerId: string, { period, password }: ExclusionInput): Promise<void> {
    if (!(await this.players.checkPassword(playerId, password))) {
      throw new ForbiddenException('The password is wrong');
    }
    const duration = EXCLUSION_PERIOD_MS[period];
    const until = duration === null ? null : new Date(Date.now() + duration);
    await this.players.exclude(playerId, until);
    await this.audit.record({
      actor: playerActor(playerId),
      action: 'player.self_exclusion',
      entityType: 'player',
      entityId: playerId,
      after: { period, until: until?.toISOString() ?? null },
    });
  }

  /** Throws LimitExceededError when `amount` more staked would break a stake or loss limit. */
  async assertCanStake(playerId: string, amount: number): Promise<void> {
    await this.assert(playerId, ['stake', 'loss'], amount);
  }

  /** Throws LimitExceededError when depositing `amount` would break a deposit limit. */
  async assertCanDeposit(playerId: string, amount: number): Promise<void> {
    await this.assert(playerId, ['deposit'], amount);
  }

  private async assert(playerId: string, kinds: LimitKind[], amount: number) {
    const now = new Date();
    const inForce: InForce[] = [];
    for (const [key, state] of await this.states(playerId, now)) {
      const [kind, period] = key.split(':') as [LimitKind, LimitPeriod];
      if (state.amount !== null && kinds.includes(kind)) {
        inForce.push({ kind, period, amount: state.amount });
      }
    }
    // Most players have no limits: no ledger query for them.
    if (inForce.length === 0) return;
    const usage = await this.usage(playerId, now, [
      ...new Set(inForce.map((limit) => limit.period)),
    ]);
    const exceeded = firstExceeded(inForce, usage, kinds, amount);
    if (exceeded) throw new LimitExceededError(exceeded);
  }

  /** The player's limits with due pending changes applied, by `kind:period`. */
  private async states(playerId: string, now: Date): Promise<Map<string, LimitState>> {
    const rows = await this.db.select().from(rgLimits).where(eq(rgLimits.playerId, playerId));
    return new Map(rows.map((row) => [limitKey(row.kind, row.period), resolveLimit(row, now)]));
  }

  private async usage(
    playerId: string,
    now: Date,
    periods: readonly LimitPeriod[],
  ): Promise<Map<LimitPeriod, PlayerActivityTotals>> {
    const totals = await this.wallet.playerActivity(
      playerId,
      periods.map((period) => new Date(now.getTime() - LIMIT_PERIOD_MS[period])),
    );
    return new Map(periods.map((period, index) => [period, totals[index]!]));
  }
}
