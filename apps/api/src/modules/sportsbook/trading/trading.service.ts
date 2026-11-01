import {
  type AdminTradingEvent,
  type AdminTradingEventDetail,
  type AdminTradingEventsPage,
  type adminTradingEventsQuerySchema,
  type Suspension,
  type SuspensionInput,
  type TradingRule,
  type TradingRuleInput,
  type TradingRuleScope,
  type TradingTargets,
} from '@metrobet/contracts';
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { z } from 'zod';

import { type Database, DRIZZLE } from '../../../database/database.tokens.js';
import { AuditService } from '../../audit/audit.service.js';
import { StaffDirectory } from '../../auth/staff-directory.js';
import { SportsbookStore } from '../sportsbook.store.js';
import { TradingRules } from './trading-rules.js';
import {
  type TradingRuleRow,
  type TradingSuspensionRow,
  tradingRules,
  tradingSuspensions,
} from './trading.schema.js';

const STAFF_ACTOR = /^staff:(.+)$/;
/** Market id `<eventId>:<type>:<line>` → event id. */
const eventIdOfMarket = (marketId: string) => marketId.split(':').slice(0, -2).join(':');

/**
 * Backoffice trading: suspensions and margin/limit rules (persisted, audit-logged, pushed to
 * `TradingRules` so players see them at once), plus the event views for the trading screens.
 * State is per API instance: move change notifications to Redis with the store.
 */
@Injectable()
export class TradingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TradingService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(TradingRules) private readonly rules: TradingRules,
    @Inject(SportsbookStore) private readonly store: SportsbookStore,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(StaffDirectory) private readonly staff: StaffDirectory,
  ) {}

  async onApplicationBootstrap() {
    const [suspensions, rules] = await Promise.all([
      this.db.select().from(tradingSuspensions),
      this.db.select().from(tradingRules),
    ]);
    this.rules.load(suspensions, rules);
    this.logger.log(`Loaded ${suspensions.length} suspensions and ${rules.length} trading rules`);
  }

  // ── Suspensions ──────────────────────────────────────────────────────────────────────────

  async suspend(actor: string, { scope, targetId, reason }: SuspensionInput): Promise<Suspension> {
    const eventId = scope === 'event' ? targetId : eventIdOfMarket(targetId);
    const event = this.store.event(eventId);
    if (!event || (scope === 'market' && !event.markets.some((m) => m.id === targetId))) {
      throw new NotFoundException(`No ${scope} ${targetId} in the feed`);
    }
    const [row] = await this.db
      .insert(tradingSuspensions)
      .values({ targetId, scope, eventId, reason, createdBy: actor, createdAt: new Date() })
      .onConflictDoUpdate({
        target: tradingSuspensions.targetId,
        set: { reason, createdBy: actor, createdAt: new Date() },
      })
      .returning();
    await this.audit.record({
      actor,
      action: 'sportsbook.suspend',
      entityType: `sportsbook_${scope}`,
      entityId: targetId,
      after: { reason },
    });
    this.rules.setSuspension(row!);
    const [suspension] = await this.toSuspensions([row!]);
    return suspension!;
  }

  async resume(actor: string, { scope, targetId, reason }: SuspensionInput): Promise<void> {
    const [row] = await this.db
      .delete(tradingSuspensions)
      .where(and(eq(tradingSuspensions.targetId, targetId), eq(tradingSuspensions.scope, scope)))
      .returning();
    if (!row) throw new NotFoundException(`${targetId} is not suspended`);
    await this.audit.record({
      actor,
      action: 'sportsbook.resume',
      entityType: `sportsbook_${scope}`,
      entityId: targetId,
      before: { reason: row.reason },
      after: { reason },
    });
    this.rules.clearSuspension(targetId);
  }

  // ── Rules ────────────────────────────────────────────────────────────────────────────────

  listRules(): TradingRule[] {
    return this.rules
      .allRules()
      .map((row) => this.toRule(row))
      .toSorted((a, b) => a.scope.localeCompare(b.scope) || a.label.localeCompare(b.label));
  }

  async setRule(actor: string, input: TradingRuleInput): Promise<TradingRule> {
    if (input.scope === 'competition' && !this.competitionName(input.key)) {
      throw new NotFoundException(`No competition ${input.key} in the feed`);
    }
    const before = this.rules
      .allRules()
      .find((r) => r.scope === input.scope && r.key === input.key);
    const values = {
      margin: input.margin,
      maxStake: input.maxStake,
      maxPayout: input.maxPayout,
      updatedBy: actor,
      updatedAt: new Date(),
    };
    const [row] = await this.db
      .insert(tradingRules)
      .values({ scope: input.scope, key: input.key, ...values })
      .onConflictDoUpdate({ target: [tradingRules.scope, tradingRules.key], set: values })
      .returning();
    await this.audit.record({
      actor,
      action: 'sportsbook.rule.set',
      entityType: 'sportsbook_rule',
      entityId: `${input.scope}:${input.key}`,
      before: before ? ruleValues(before) : null,
      after: ruleValues(row!),
    });
    this.rules.setRule(row!);
    return this.toRule(row!);
  }

  async deleteRule(actor: string, scope: TradingRuleScope, key: string): Promise<void> {
    const [row] = await this.db
      .delete(tradingRules)
      .where(and(eq(tradingRules.scope, scope), eq(tradingRules.key, key)))
      .returning();
    if (!row) throw new NotFoundException(`No ${scope} rule for ${key}`);
    await this.audit.record({
      actor,
      action: 'sportsbook.rule.delete',
      entityType: 'sportsbook_rule',
      entityId: `${scope}:${key}`,
      before: ruleValues(row),
    });
    this.rules.deleteRule(scope, key);
  }

  /** Competitions currently in the feed, for picking a rule's target. */
  targets(): TradingTargets {
    const competitions = new Map(this.store.all().map((e) => [e.competition.id, e.competition]));
    return {
      competitions: [...competitions.values()].toSorted(
        (a, b) => a.sport.localeCompare(b.sport) || a.name.localeCompare(b.name),
      ),
    };
  }

  // ── Events ───────────────────────────────────────────────────────────────────────────────

  /** Live first, then by kick-off; filters by sport, state and a name fragment. */
  events({
    sport,
    status,
    q,
    page,
    pageSize,
  }: z.output<typeof adminTradingEventsQuerySchema>): AdminTradingEventsPage {
    const needle = q?.toLowerCase();
    const rows = this.store
      .all()
      .filter((event) => !sport || event.sport === sport)
      .filter((event) =>
        status === 'suspended'
          ? this.rules.suspensionsOf(event.id).length > 0
          : !status || event.status === status,
      )
      .filter(
        (event) =>
          !needle ||
          [event.home.name, event.away.name, event.competition.name].some((name) =>
            name.toLowerCase().includes(needle),
          ),
      )
      .toSorted((a, b) => Number(b.status === 'live') - Number(a.status === 'live'));
    return {
      items: rows.slice((page - 1) * pageSize, page * pageSize).map((event) => {
        const suspended = this.rules.isEventSuspended(event.id);
        return {
          id: event.id,
          sport: event.sport,
          competition: event.competition,
          home: event.home.name,
          away: event.away.name,
          startsAt: event.startsAt,
          status: event.status,
          live: event.live,
          suspended,
          marketCount: event.markets.length,
          suspendedMarkets: suspended
            ? event.markets.length
            : this.rules.suspensionsOf(event.id).length,
          trading: this.rules.effective(event),
        } satisfies AdminTradingEvent;
      }),
      total: rows.length,
      page,
      pageSize,
    };
  }

  async event(id: string): Promise<AdminTradingEventDetail> {
    const event = this.store.event(id);
    const feed = this.store.feedEvent(id);
    if (!event || !feed) throw new NotFoundException(`No event ${id} in the feed`);
    return {
      event,
      feedOdds: Object.fromEntries(
        feed.markets.flatMap((market) => market.selections.map((s) => [s.id, s.odds])),
      ),
      suspensions: await this.toSuspensions(this.rules.suspensionsOf(id)),
      trading: this.rules.effective(event),
    };
  }

  private async toSuspensions(rows: TradingSuspensionRow[]): Promise<Suspension[]> {
    const ids = rows.flatMap((row) => STAFF_ACTOR.exec(row.createdBy)?.[1] ?? []);
    const names = await this.staff.names([...new Set(ids)]);
    return rows.map((row) => ({
      scope: row.scope,
      targetId: row.targetId,
      eventId: row.eventId,
      reason: row.reason,
      by: names.get(STAFF_ACTOR.exec(row.createdBy)?.[1] ?? '') ?? row.createdBy,
      at: row.createdAt.toISOString(),
    }));
  }

  private toRule(row: TradingRuleRow): TradingRule {
    return {
      scope: row.scope,
      key: row.key,
      label: row.scope === 'sport' ? row.key : (this.competitionName(row.key) ?? row.key),
      margin: row.margin,
      maxStake: row.maxStake,
      maxPayout: row.maxPayout,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private competitionName(id: string) {
    const competition = this.store.all().find((event) => event.competition.id === id)?.competition;
    return competition && `${competition.country} · ${competition.name}`;
  }
}

const ruleValues = ({ margin, maxStake, maxPayout }: TradingRuleRow) => ({
  margin,
  maxStake,
  maxPayout,
});
