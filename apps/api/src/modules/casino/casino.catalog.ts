import type {
  CasinoCategory,
  GameCard,
  GameDetail,
  GamePage,
  GameType,
  Provider,
} from '@metrobet/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, arrayContains, asc, count, desc, eq, ilike, type SQL } from 'drizzle-orm';

import { type Database, DRIZZLE } from '../../database/database.tokens.js';
import { casinoGames, casinoProviders } from './casino.schema.js';

/** How each category selects and orders games. Single source for lobby and listings. */
const CATEGORY_RULES: Record<CasinoCategory, { where?: SQL; orderBy: SQL[] }> = {
  popular: { orderBy: [desc(casinoGames.popularity)] },
  new: { where: arrayContains(casinoGames.tags, ['new']), orderBy: [desc(casinoGames.releasedAt)] },
  jackpots: {
    where: arrayContains(casinoGames.tags, ['jackpot']),
    orderBy: [desc(casinoGames.popularity)],
  },
};

export type GameFilter = {
  type?: GameType;
  category?: CasinoCategory;
  provider?: string;
  search?: string;
  slug?: string;
};

const cardColumns = {
  slug: casinoGames.slug,
  name: casinoGames.name,
  type: casinoGames.type,
  thumbnail: casinoGames.thumbnail,
  tags: casinoGames.tags,
  hasDemo: casinoGames.hasDemo,
  providerSlug: casinoProviders.slug,
  providerName: casinoProviders.name,
};

type CardRow = { [K in keyof typeof cardColumns]: (typeof cardColumns)[K]['_']['data'] };

const toCard = ({ providerSlug, providerName, ...row }: CardRow): GameCard => ({
  ...row,
  provider: { slug: providerSlug, name: providerName },
});

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

/** Read side of the casino catalogue. Only active + available games of active + available providers are visible. */
@Injectable()
export class CasinoCatalog {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listGames(filter: GameFilter, page: number, pageSize: number): Promise<GamePage> {
    const where = this.where(filter);
    const rule = CATEGORY_RULES[filter.category ?? 'popular'];

    const [items, [{ total } = { total: 0 }]] = await Promise.all([
      this.db
        .select(cardColumns)
        .from(casinoGames)
        .innerJoin(casinoProviders, eq(casinoGames.providerId, casinoProviders.id))
        .where(where)
        .orderBy(...rule.orderBy, asc(casinoGames.name))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ total: count() })
        .from(casinoGames)
        .innerJoin(casinoProviders, eq(casinoGames.providerId, casinoProviders.id))
        .where(where),
    ]);

    return { items: items.map(toCard), total, page, pageSize };
  }

  async findGame(slug: string): Promise<(GameDetail & { externalId: string }) | null> {
    const [row] = await this.db
      .select({
        ...cardColumns,
        externalId: casinoGames.externalId,
        rtp: casinoGames.rtp,
        volatility: casinoGames.volatility,
      })
      .from(casinoGames)
      .innerJoin(casinoProviders, eq(casinoGames.providerId, casinoProviders.id))
      .where(this.where({ slug }));
    if (!row) return null;
    const { externalId, rtp, volatility, ...card } = row;
    return { ...toCard(card), externalId, rtp, volatility };
  }

  /** Providers with at least one visible game (optionally of one type). */
  async listProviders(type?: GameType): Promise<Provider[]> {
    return this.db
      .select({
        slug: casinoProviders.slug,
        name: casinoProviders.name,
        gameCount: count(casinoGames.id),
      })
      .from(casinoProviders)
      .innerJoin(
        casinoGames,
        and(
          eq(casinoGames.providerId, casinoProviders.id),
          eq(casinoGames.isActive, true),
          eq(casinoGames.isAvailable, true),
          type ? eq(casinoGames.type, type) : undefined,
        ),
      )
      .where(and(eq(casinoProviders.isActive, true), eq(casinoProviders.isAvailable, true)))
      .groupBy(casinoProviders.id)
      .orderBy(asc(casinoProviders.name));
  }

  private where({ type, category, provider, search, slug }: GameFilter): SQL | undefined {
    return and(
      eq(casinoGames.isActive, true),
      eq(casinoGames.isAvailable, true),
      eq(casinoProviders.isActive, true),
      eq(casinoProviders.isAvailable, true),
      type ? eq(casinoGames.type, type) : undefined,
      category && CATEGORY_RULES[category].where,
      provider ? eq(casinoProviders.slug, provider) : undefined,
      search ? ilike(casinoGames.name, `%${escapeLike(search)}%`) : undefined,
      slug ? eq(casinoGames.slug, slug) : undefined,
    );
  }
}
