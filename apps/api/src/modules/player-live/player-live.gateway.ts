import {
  PLAYER_WS,
  PLAYER_WS_NAMESPACE,
  type PlayerBalanceMessage,
  type TicketSettledMessage,
} from '@metrobet/contracts';
import { Inject, type OnModuleDestroy } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';

import { PgListener, type PlayerEvent } from './pg-listener.js';
import { PlayerSocketPasses } from './player-socket-passes.js';

const room = (playerId: string) => `player:${playerId}`;

/**
 * The player's private live channel. Clients connect with `auth: { pass }` (a one-time pass from
 * `POST /api/player-live/pass`) and receive their balance changes and settled tickets.
 */
@WebSocketGateway({ namespace: PLAYER_WS_NAMESPACE })
export class PlayerLiveGateway implements OnGatewayInit, OnGatewayConnection, OnModuleDestroy {
  @WebSocketServer() private readonly server!: Namespace;
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(PlayerSocketPasses) private readonly passes: PlayerSocketPasses,
    @Inject(PgListener) private readonly listener: PgListener,
  ) {}

  afterInit() {
    this.unsubscribe = this.listener.on((event) => this.push(event));
  }

  onModuleDestroy() {
    this.unsubscribe?.();
  }

  async handleConnection(client: Socket) {
    const pass = (client.handshake.auth as { pass?: unknown })?.pass;
    const playerId = typeof pass === 'string' ? this.passes.consume(pass) : null;
    if (!playerId) {
      client.emit('exception', { code: 'INVALID_PASS' });
      client.disconnect(true);
      return;
    }
    await client.join(room(playerId));
  }

  private push(event: PlayerEvent) {
    const target = this.server.to(room(event.playerId));
    if (event.type === 'balance') {
      target.emit(PLAYER_WS.balance, { balance: event.balance } satisfies PlayerBalanceMessage);
      return;
    }
    const { type: _type, playerId: _playerId, ...ticket } = event;
    target.emit(PLAYER_WS.ticketSettled, ticket satisfies TicketSettledMessage);
  }
}
