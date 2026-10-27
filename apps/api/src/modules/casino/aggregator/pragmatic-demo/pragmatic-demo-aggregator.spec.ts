import { MockGameAggregator } from '../mock/mock-aggregator.js';
import { PragmaticDemoAggregator } from './pragmatic-demo-aggregator.js';

const config = { get: () => 'http://localhost:4000' } as never;

describe('PragmaticDemoAggregator', () => {
  const aggregator = new PragmaticDemoAggregator(new MockGameAggregator(config));

  it('lists Pragmatic slots plus the mock non-slot games, never mock slots', async () => {
    const games = await aggregator.listGames();
    const slots = games.filter((game) => game.type === 'slot');
    expect(slots.length).toBe(40);
    expect(slots.every((game) => game.providerExternalId === 'pragmatic-play')).toBe(true);
    expect(games.some((game) => game.type === 'crash')).toBe(true);

    const providers = (await aggregator.listProviders()).map((p) => p.externalId);
    expect(providers).toContain('pragmatic-play');
    for (const game of games) expect(providers).toContain(game.providerExternalId);
  });

  it('launches Pragmatic games on their demo server and delegates others to the mock', async () => {
    const url = new URL(
      await aggregator.launch({
        externalGameId: 'pragmatic:vs20olympgate',
        mode: 'demo',
        locale: 'ka',
        sessionId: 's',
      }),
    );
    expect(url.hostname).toBe('demogamesfree.pragmaticplay.net');
    expect(url.searchParams.get('gameSymbol')).toBe('vs20olympgate');
    expect(url.searchParams.get('lang')).toBe('ka');

    const crash = (await aggregator.listGames()).find((game) => game.type === 'crash')!;
    const mockUrl = await aggregator.launch({
      externalGameId: crash.externalId,
      mode: 'demo',
      locale: 'en',
      sessionId: 's',
    });
    expect(mockUrl).toContain('/api/casino/mock/play/');
  });
});
