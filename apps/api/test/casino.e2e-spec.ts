import type { CasinoLobby, GamePage } from '@metrobet/contracts';
import request from 'supertest';

import { eq } from 'drizzle-orm';

import { CasinoSyncService } from '../src/modules/casino/casino-sync.service.js';
import { casinoGames } from '../src/modules/casino/casino.schema.js';
import { createTestApp } from './create-app.js';

describe('casino (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  const http = () => request(ctx.app.getHttpServer());
  const games = async (query: string) =>
    (await http().get(`/api/casino/games?${query}`).expect(200)).body as GamePage;

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.app.get(CasinoSyncService).sync();
  });
  afterAll(() => ctx?.app.close());

  it('sync is idempotent', async () => {
    const before = (await games('pageSize=1')).total;
    await ctx.app.get(CasinoSyncService).sync();
    expect((await games('pageSize=1')).total).toBe(before);
  });

  it('builds the slots lobby from category rules, slots only', async () => {
    const { body } = await http().get('/api/casino/lobby').expect(200);
    const lobby = body as CasinoLobby;
    expect(lobby.sections.map((s) => s.category)).toContain('popular');
    expect(lobby.sections.flatMap((s) => s.games).every((game) => game.type === 'slot')).toBe(true);
    expect(lobby.providers.length).toBeGreaterThan(0);
  });

  it('filters by category and provider, and paginates', async () => {
    const page = await games('type=table&pageSize=5&page=1');
    expect(page.items).toHaveLength(5);
    expect(page.items.every((game) => game.type === 'table')).toBe(true);
    const next = await games('type=table&pageSize=5&page=2');
    expect(next.items.map((g) => g.slug)).not.toEqual(page.items.map((g) => g.slug));

    const provider = page.items[0]!.provider.slug;
    const byProvider = await games(`provider=${provider}`);
    expect(byProvider.items.every((game) => game.provider.slug === provider)).toBe(true);
  });

  it('searches by name, treating LIKE wildcards literally', async () => {
    const gold = await games('search=gold');
    expect(gold.total).toBeGreaterThan(0);
    expect(gold.items.every((game) => /gold/i.test(game.name))).toBe(true);
    expect((await games('search=%25%25')).total).toBe(0);
    await http().get('/api/casino/games?search=x').expect(400);
  });

  it('launches demo games and refuses real money without a session', async () => {
    const { slug } = (await games('type=crash&pageSize=1')).items[0]!;
    const { body } = await http()
      .post(`/api/casino/games/${slug}/launch`)
      .send({ mode: 'demo', locale: 'ka' })
      .expect(200);
    const url = new URL(body.url);
    expect(url.searchParams.get('lang')).toBe('ka');

    const page = await http()
      .get(url.pathname + url.search)
      .expect(200);
    expect(page.headers['content-security-policy']).toContain('frame-ancestors');

    await http()
      .post(`/api/casino/games/${slug}/launch`)
      .send({ mode: 'real', locale: 'ka' })
      .expect(401);
    await http()
      .post('/api/casino/games/nope/launch')
      .send({ mode: 'demo', locale: 'en' })
      .expect(404);
  });

  it('hides games that disappear from the aggregator feed', async () => {
    const before = (await games('type=slot&pageSize=1')).total;
    await ctx.db
      .update(casinoGames)
      .set({ isAvailable: false })
      .where(eq(casinoGames.type, 'slot'));
    expect((await games('type=slot&pageSize=1')).total).toBe(0);
    await ctx.app.get(CasinoSyncService).sync();
    expect((await games('type=slot&pageSize=1')).total).toBe(before);
  });

  it('serves mock thumbnails as locked-down SVG', async () => {
    const { thumbnail } = (await games('pageSize=1')).items[0]!;
    const response = await http().get(new URL(thumbnail).pathname).expect(200);
    expect(response.headers['content-type']).toContain('image/svg+xml');
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
  });
});
