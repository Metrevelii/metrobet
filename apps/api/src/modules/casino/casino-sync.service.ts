import { Inject, Injectable, Logger } from '@nestjs/common';
import { inArray, not, sql } from 'drizzle-orm';

import { type Database, DRIZZLE } from '../../database/database.tokens.js';
import { WebRevalidationService } from '../web/web-revalidation.service.js';
import { GameAggregator } from './aggregator/game-aggregator.js';
import { casinoGames, casinoProviders } from './casino.schema.js';

/** Must match CASINO_CACHE_TAG in apps/web/src/features/casino/data.ts. */
export const CASINO_CACHE_TAG = 'casino';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Upserts the aggregator catalogue into our tables (by external id). Aggregator-owned fields are
 * refreshed and anything missing from the feed is marked unavailable; our curation fields
 * (isActive, slug) are kept. Run via `db:seed` / later a cron.
 */
@Injectable()
export class CasinoSyncService {
  private readonly logger = new Logger(CasinoSyncService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(GameAggregator) private readonly aggregator: GameAggregator,
    @Inject(WebRevalidationService) private readonly web: WebRevalidationService,
  ) {}

  async sync(): Promise<{ providers: number; games: number }> {
    const [providers, games] = await Promise.all([
      this.aggregator.listProviders(),
      this.aggregator.listGames(),
    ]);

    const result = await this.db.transaction(async (tx) => {
      const providerRows = await tx
        .insert(casinoProviders)
        .values(
          providers.map((p) => ({ externalId: p.externalId, name: p.name, slug: slugify(p.name) })),
        )
        .onConflictDoUpdate({
          target: casinoProviders.externalId,
          set: { name: sql`excluded.name`, isAvailable: true },
        })
        .returning({
          id: casinoProviders.id,
          externalId: casinoProviders.externalId,
          slug: casinoProviders.slug,
        });
      const providerByExternalId = new Map(providerRows.map((row) => [row.externalId, row]));

      // Slugs are unique across all rows (including unavailable ones from earlier feeds).
      const existing = await tx
        .select({ externalId: casinoGames.externalId, slug: casinoGames.slug })
        .from(casinoGames);
      const slugOwner = new Map(existing.map((row) => [row.slug, row.externalId]));
      const keptSlug = new Map(existing.map((row) => [row.externalId, row.slug]));
      const usedSlugs = new Set<string>();
      const gameValues = games.flatMap((game) => {
        const provider = providerByExternalId.get(game.providerExternalId);
        if (!provider) return [];
        // Keep an existing slug; otherwise prefer the plain title and disambiguate with the provider.
        let slug = keptSlug.get(game.externalId) ?? slugify(game.name);
        const owner = slugOwner.get(slug);
        if (usedSlugs.has(slug) || (owner !== undefined && owner !== game.externalId))
          slug = `${slug}-${provider.slug}`;
        usedSlugs.add(slug);
        const { providerExternalId: _provider, ...fields } = game;
        return [{ ...fields, providerId: provider.id, slug, isAvailable: true }];
      });

      await tx
        .insert(casinoGames)
        .values(gameValues)
        .onConflictDoUpdate({
          target: casinoGames.externalId,
          set: {
            name: sql`excluded.name`,
            type: sql`excluded.type`,
            thumbnail: sql`excluded.thumbnail`,
            tags: sql`excluded.tags`,
            rtp: sql`excluded.rtp`,
            volatility: sql`excluded.volatility`,
            hasDemo: sql`excluded.has_demo`,
            popularity: sql`excluded.popularity`,
            releasedAt: sql`excluded.released_at`,
            providerId: sql`excluded.provider_id`,
            isAvailable: true,
          },
        });

      // Whatever the feed no longer contains is hidden (e.g. after switching aggregators).
      const gameIds = gameValues.map((game) => game.externalId);
      const providerIds = providers.map((provider) => provider.externalId);
      await tx
        .update(casinoGames)
        .set({ isAvailable: false })
        .where(not(inArray(casinoGames.externalId, gameIds)));
      await tx
        .update(casinoProviders)
        .set({ isAvailable: false })
        .where(not(inArray(casinoProviders.externalId, providerIds)));

      return { providers: providerRows.length, games: gameValues.length };
    });
    this.logger.log(`Synced ${result.providers} providers, ${result.games} games`);
    // The player site caches the catalogue; refresh it now that it changed.
    await this.web.revalidate(CASINO_CACHE_TAG);
    return result;
  }
}
