import { MockGameAggregator } from '../mock/mock-aggregator.js';
import { DEMO_SOURCES, PublicDemoAggregator } from './public-demo-aggregator.js';

const config = { get: () => 'http://localhost:4000' } as never;

describe('PublicDemoAggregator', () => {
  const aggregator = new PublicDemoAggregator(new MockGameAggregator(config));

  it('lists every demo source as a provider with only its slots, plus mock non-slot games', async () => {
    const games = await aggregator.listGames();
    const providers = (await aggregator.listProviders()).map((p) => p.externalId);
    for (const source of DEMO_SOURCES) {
      expect(providers).toContain(source.providerId);
      const own = games.filter((game) => game.providerExternalId === source.providerId);
      expect(own).toHaveLength(source.games.length);
      expect(own.every((game) => game.type === 'slot' && game.thumbnail.startsWith('http'))).toBe(
        true,
      );
    }
    expect(
      games
        .filter((game) => game.type === 'slot')
        .every((g) => DEMO_SOURCES.some((s) => s.providerId === g.providerExternalId)),
    ).toBe(true);
    expect(games.some((game) => game.type === 'crash')).toBe(true);
    for (const game of games) expect(providers).toContain(game.providerExternalId);
  });

  it('has unique game codes per source', () => {
    for (const source of DEMO_SOURCES) {
      const codes = source.games.map((game) => game.code);
      expect(new Set(codes).size).toBe(codes.length);
    }
  });

  it('launches each source on its own demo server and delegates others to the mock', async () => {
    const pragmatic = new URL(
      await aggregator.launch({
        externalGameId: 'pragmatic:vs20olympgate',
        mode: 'demo',
        locale: 'ka',
        sessionId: 's',
      }),
    );
    expect(pragmatic.hostname).toBe('demogamesfree.pragmaticplay.net');
    expect(pragmatic.searchParams.get('lang')).toBe('ka');

    const bgaming = new URL(
      await aggregator.launch({
        externalGameId: 'bgaming:DigDigDigger',
        mode: 'demo',
        locale: 'en',
        sessionId: 's',
      }),
    );
    expect(bgaming.hostname).toBe('demo.bgaming-network.com');
    expect(bgaming.pathname).toBe('/play/DigDigDigger/FUN');

    const crash = (await aggregator.listGames()).find((game) => game.type === 'crash')!;
    expect(
      await aggregator.launch({
        externalGameId: crash.externalId,
        mode: 'demo',
        locale: 'en',
        sessionId: 's',
      }),
    ).toContain('/api/casino/mock/play/');
  });
});
