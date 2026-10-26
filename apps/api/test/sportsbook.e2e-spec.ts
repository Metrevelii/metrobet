import {
  type EventUpdate,
  SPORTSBOOK_WS,
  SPORTSBOOK_WS_NAMESPACE,
  type SportOverview,
} from '@metrobet/contracts';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';

import { createTestApp } from './create-app.js';

describe('sportsbook (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let socket: Socket | undefined;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.app.listen(0);
  });
  afterAll(async () => {
    socket?.disconnect();
    await ctx?.app.close();
  });

  it('lists sports with counts and a per-sport overview', async () => {
    const { body: sports } = await http().get('/api/sportsbook/sports').expect(200);
    expect(sports.map((s: { sport: string }) => s.sport)).toEqual([
      'football',
      'basketball',
      'tennis',
    ]);

    const { body } = await http().get('/api/sportsbook/sports/football').expect(200);
    const overview = body as SportOverview;
    const first = overview.upcoming[0]!.events[0]!;
    expect(first.sport).toBe('football');
    expect(first.mainMarket?.type).toBe('1x2');

    await http().get('/api/sportsbook/sports/curling').expect(400);
  });

  it('returns full event detail, 404 for unknown events', async () => {
    const { body: overview } = await http().get('/api/sportsbook/sports/football').expect(200);
    const id = (overview as SportOverview).upcoming[0]!.events[0]!.id;
    const { body } = await http().get(`/api/sportsbook/events/${id}`).expect(200);
    expect(body.markets.length).toBeGreaterThan(3);
    await http().get('/api/sportsbook/events/nope').expect(404);
  });

  it('acks a socket subscription with the current state of each event', async () => {
    const { body: overview } = await http().get('/api/sportsbook/sports/football').expect(200);
    const ids = (overview as SportOverview).upcoming[0]!.events.slice(0, 2).map((e) => e.id);
    const { port } = ctx.app.getHttpServer().address() as { port: number };

    socket = io(`http://127.0.0.1:${port}${SPORTSBOOK_WS_NAMESPACE}`, {
      transports: ['websocket'],
    });
    const snapshot = (await socket
      .timeout(5000)
      .emitWithAck(SPORTSBOOK_WS.subscribe, { eventIds: ids })) as EventUpdate[];
    expect(snapshot.map((u) => u.eventId)).toEqual(ids);
    expect(snapshot[0]!.markets.length).toBeGreaterThan(0);
  });
});
