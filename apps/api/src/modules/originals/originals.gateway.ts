import {
  crashBetRequestSchema,
  type CrashGame,
  crashJoinRequestSchema,
  crashSlotRequestSchema,
  type CrashState,
  ORIGINALS_WS,
  ORIGINALS_WS_NAMESPACE,
  type OriginalsAck,
  supraSpinRequestSchema,
  type SupraSpinResult,
} from '@metrobet/contracts';
import { Inject, type OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { z } from 'zod';

import { type CrashEvent, playerKey } from './crash/crash-engine.js';
import { CrashService } from './crash/crash.service.js';
import { SupraFortuneService } from './supra-fortune/supra-fortune.service.js';
import { OriginalsWallet } from './wallet/originals-wallet.js';

type Viewer = { token: string; key: string };
const sessionSchema = z.string().min(1).max(200);
const crashRoom = (game: CrashGame) => `crash:${game}`;
const BETS_THROTTLE_MS = 200;
const playerRoom = (key: string) => `player:${key}`;
const invalid = { ok: false, code: 'INVALID_REQUEST' } as const;
const noSession = { ok: false, code: 'SESSION_NOT_FOUND' } as const;

/**
 * Metrobet Originals game server channel. Clients connect with `auth: { session }` (the token
 * from the launch URL); it is checked against the wallet before anything else. Every action is
 * acked with `OriginalsAck`. Each viewer joins `player:<key>` so all their tabs get balance and
 * bet updates.
 */
@WebSocketGateway({ namespace: ORIGINALS_WS_NAMESPACE })
export class OriginalsGateway implements OnGatewayInit, OnGatewayConnection, OnModuleDestroy {
  @WebSocketServer() private readonly server!: Namespace;
  private unsubscribe: (() => void) | null = null;
  private readonly betsTimers = new Map<CrashGame, NodeJS.Timeout>();

  constructor(
    @Inject(OriginalsWallet) private readonly wallet: OriginalsWallet,
    @Inject(SupraFortuneService) private readonly supra: SupraFortuneService,
    @Inject(CrashService) private readonly crash: CrashService,
  ) {}

  afterInit() {
    this.unsubscribe = this.crash.on((event) => void this.onCrashEvent(event));
  }

  onModuleDestroy() {
    this.unsubscribe?.();
    for (const timer of this.betsTimers.values()) clearTimeout(timer);
  }

  async handleConnection(client: Socket) {
    const token = sessionSchema.safeParse(
      (client.handshake.auth as { session?: unknown })?.session,
    );
    const balance = token.success ? await this.wallet.balance(token.data) : null;
    if (!token.success || !balance?.ok) {
      client.emit('exception', {
        code: balance && !balance.ok ? balance.code : 'SESSION_NOT_FOUND',
      });
      client.disconnect(true);
      return;
    }
    const viewer: Viewer = { token: token.data, key: playerKey(token.data) };
    client.data = viewer;
    await client.join(playerRoom(viewer.key));
    client.emit(ORIGINALS_WS.balance, { balance: balance.balance });
  }

  @SubscribeMessage(ORIGINALS_WS.supraSpin)
  async supraSpin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): Promise<OriginalsAck<SupraSpinResult>> {
    const viewer = this.viewer(client);
    const request = supraSpinRequestSchema.safeParse(body);
    if (!viewer) return noSession;
    if (!request.success) return invalid;
    const result = await this.supra.spin(viewer.token, request.data.bet);
    if (result.ok) {
      client
        .to(playerRoom(viewer.key))
        .emit(ORIGINALS_WS.balance, { balance: result.data.balance });
    }
    return result;
  }

  @SubscribeMessage(ORIGINALS_WS.crashJoin)
  async crashJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): Promise<OriginalsAck<CrashState>> {
    const viewer = this.viewer(client);
    const request = crashJoinRequestSchema.safeParse(body);
    if (!viewer) return noSession;
    if (!request.success) return invalid;
    await client.join(crashRoom(request.data.game));
    const state = this.crash.engine(request.data.game).state(viewer.key);
    return state ? { ok: true, data: state } : { ok: false, code: 'UNAVAILABLE' };
  }

  @SubscribeMessage(ORIGINALS_WS.crashBet)
  crashBet(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const viewer = this.viewer(client);
    const request = crashBetRequestSchema.safeParse(body);
    if (!viewer) return noSession;
    if (!request.success) return invalid;
    const { game, ...bet } = request.data;
    return this.crash.engine(game).placeBet(viewer.token, bet);
  }

  @SubscribeMessage(ORIGINALS_WS.crashCancel)
  crashCancel(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const viewer = this.viewer(client);
    const request = crashSlotRequestSchema.safeParse(body);
    if (!viewer) return noSession;
    if (!request.success) return invalid;
    return this.crash.engine(request.data.game).cancel(viewer.token, request.data.slot);
  }

  @SubscribeMessage(ORIGINALS_WS.crashCashout)
  crashCashout(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const viewer = this.viewer(client);
    const request = crashSlotRequestSchema.safeParse(body);
    if (!viewer) return noSession;
    if (!request.success) return invalid;
    return this.crash.engine(request.data.game).cashout(viewer.token, request.data.slot);
  }

  /** The connection's checked session, or null while the connection check is still running. */
  private viewer(client: Socket): Viewer | null {
    const data = client.data as Partial<Viewer> | undefined;
    return data?.token && data.key ? (data as Viewer) : null;
  }

  private async onCrashEvent(event: CrashEvent) {
    switch (event.type) {
      case 'phase': {
        // Each viewer gets their own state (their bets), so send per socket.
        const engine = this.crash.engine(event.game);
        for (const socket of await this.server.in(crashRoom(event.game)).fetchSockets()) {
          const key = (socket.data as Partial<Viewer>).key ?? null;
          socket.emit(ORIGINALS_WS.crashState, engine.state(key));
        }
        break;
      }
      case 'bets': {
        const { game } = event;
        if (this.betsTimers.has(game)) break;
        this.betsTimers.set(
          game,
          setTimeout(() => {
            this.betsTimers.delete(game);
            const bets = this.crash.engine(game).state(null)?.bets ?? [];
            this.server.to(crashRoom(game)).emit(ORIGINALS_WS.crashBets, { game, bets });
          }, BETS_THROTTLE_MS),
        );
        break;
      }
      case 'mine': {
        const mine = this.crash.engine(event.game).mine(event.key);
        this.server
          .to(playerRoom(event.key))
          .emit(ORIGINALS_WS.crashMine, { game: event.game, mine });
        break;
      }
      case 'balance':
        this.server
          .to(playerRoom(event.key))
          .emit(ORIGINALS_WS.balance, { balance: event.balance });
        break;
    }
  }
}
