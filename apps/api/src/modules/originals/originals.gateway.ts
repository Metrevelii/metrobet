import {
  type JetState,
  jetBetRequestSchema,
  jetSlotRequestSchema,
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

import { type JetEvent, MetroJetService, playerKey } from './metro-jet/metro-jet.service.js';
import { SupraFortuneService } from './supra-fortune/supra-fortune.service.js';
import { OriginalsWallet } from './wallet/originals-wallet.js';

type Viewer = { token: string; key: string };
const sessionSchema = z.string().min(1).max(200);
const JET_ROOM = 'jet';
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
  private betsTimer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(OriginalsWallet) private readonly wallet: OriginalsWallet,
    @Inject(SupraFortuneService) private readonly supra: SupraFortuneService,
    @Inject(MetroJetService) private readonly jet: MetroJetService,
  ) {}

  afterInit() {
    this.unsubscribe = this.jet.on((event) => void this.onJetEvent(event));
  }

  onModuleDestroy() {
    this.unsubscribe?.();
    if (this.betsTimer) clearTimeout(this.betsTimer);
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

  @SubscribeMessage(ORIGINALS_WS.jetJoin)
  async jetJoin(@ConnectedSocket() client: Socket): Promise<OriginalsAck<JetState>> {
    const viewer = this.viewer(client);
    if (!viewer) return noSession;
    await client.join(JET_ROOM);
    const state = this.jet.state(viewer.key);
    return state ? { ok: true, data: state } : { ok: false, code: 'UNAVAILABLE' };
  }

  @SubscribeMessage(ORIGINALS_WS.jetBet)
  jetBet(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const viewer = this.viewer(client);
    const request = jetBetRequestSchema.safeParse(body);
    if (!viewer) return noSession;
    return request.success ? this.jet.placeBet(viewer.token, request.data) : invalid;
  }

  @SubscribeMessage(ORIGINALS_WS.jetCancel)
  jetCancel(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const viewer = this.viewer(client);
    const request = jetSlotRequestSchema.safeParse(body);
    if (!viewer) return noSession;
    return request.success ? this.jet.cancel(viewer.token, request.data.slot) : invalid;
  }

  @SubscribeMessage(ORIGINALS_WS.jetCashout)
  jetCashout(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const viewer = this.viewer(client);
    const request = jetSlotRequestSchema.safeParse(body);
    if (!viewer) return noSession;
    return request.success ? this.jet.cashout(viewer.token, request.data.slot) : invalid;
  }

  /** The connection's checked session, or null while the connection check is still running. */
  private viewer(client: Socket): Viewer | null {
    const data = client.data as Partial<Viewer> | undefined;
    return data?.token && data.key ? (data as Viewer) : null;
  }

  private async onJetEvent(event: JetEvent) {
    switch (event.type) {
      case 'phase': {
        // Each viewer gets their own state (their bets), so send per socket.
        for (const socket of await this.server.in(JET_ROOM).fetchSockets()) {
          const key = (socket.data as Partial<Viewer>).key ?? null;
          socket.emit(ORIGINALS_WS.jetState, this.jet.state(key));
        }
        break;
      }
      case 'bets': {
        this.betsTimer ??= setTimeout(() => {
          this.betsTimer = null;
          this.server.to(JET_ROOM).emit(ORIGINALS_WS.jetBets, this.jet.state(null)?.bets ?? []);
        }, BETS_THROTTLE_MS);
        break;
      }
      case 'mine':
        this.server.to(playerRoom(event.key)).emit(ORIGINALS_WS.jetMine, this.jet.mine(event.key));
        break;
      case 'balance':
        this.server
          .to(playerRoom(event.key))
          .emit(ORIGINALS_WS.balance, { balance: event.balance });
        break;
    }
  }
}
