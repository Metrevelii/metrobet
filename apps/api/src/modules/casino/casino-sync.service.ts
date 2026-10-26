import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { type Database, DRIZZLE } from '../../database/database.tokens.js';
import { GameAggregator } from './aggregator/game-aggregator.js';
import { casinoGames, casinoProviders } from './casino.schema.js';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Upserts the aggregator catalogue into our tables (by external id). Aggregator-owned fields are
 * refreshed; our curation fields (isActive, slug) are kept. Run via `db:seed` / later a cron.
 */
@Injectable()
export class CasinoSyncService {
  private readonly logger = new Logger(CasinoSyncService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(GameAggregator) private readonly aggregator: GameAggregator,
  ) {}

  async sync(): Promise<{ providers: number; games: number }> {
    const [providers, games] = await Promise.all([
      this.aggregator.listProviders(),
      this.aggregator.listGames(),
    ]);

    return this.db.transaction(async (tx) => {
      const providerRows = await tx
        .insert(casinoProviders)
        .values(
          providers.map((p) => ({ externalId: p.externalId, name: p.name, slug: slugify(p.name) })),
        )
        .onConflictDoUpdate({
          target: casinoProviders.externalId,
          set: { name: sql`excluded.name` },
        })
        .returning({
          id: casinoProviders.id,
          externalId: casinoProviders.externalId,
          slug: casinoProviders.slug,
        });
      const providerByExternalId = new Map(providerRows.map((row) => [row.externalId, row]));

      const usedSlugs = new Set<string>();
      const gameValues = games.flatMap((game) => {
        const provider = providerByExternalId.get(game.providerExternalId);
        if (!provider) return [];
        // Prefer the plain title; disambiguate with the provider when two studios share a name.
        let slug = slugify(game.name);
        if (usedSlugs.has(slug)) slug = `${slug}-${provider.slug}`;
        usedSlugs.add(slug);
        const { providerExternalId: _provider, ...fields } = game;
        return [{ ...fields, providerId: provider.id, slug }];
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
          },
        });

      const result = { providers: providerRows.length, games: gameValues.length };
      this.logger.log(`Synced ${result.providers} providers, ${result.games} games`);
      return result;
    });
  }
}
