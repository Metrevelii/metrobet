import {
  type EventUpdate,
  SPORTSBOOK_WS,
  SPORTSBOOK_WS_NAMESPACE,
  subscriptionSchema,
} from '@metrobet/contracts';
import { Inject, type OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';

import { SportsbookStore } from './sportsbook.store.js';

const room = (eventId: string) => `event:${eventId}`;

/**
 * Public real-time channel. Clients subscribe to the events on screen and receive `update`
 * messages with changed markets / score; everyone gets `live-changed` when live lists change.
 */
@WebSocketGateway({ namespace: SPORTSBOOK_WS_NAMESPACE })
export class SportsbookGateway implements OnGatewayInit, OnModuleDestroy {
  @WebSocketServer() private readonly server!: Namespace;
  private readonly unsubscribers: (() => void)[] = [];

  constructor(@Inject(SportsbookStore) private readonly store: SportsbookStore) {}

  afterInit() {
    this.unsubscribers.push(
      this.store.on('update', (update) =>
        this.server.to(room(update.eventId)).emit(SPORTSBOOK_WS.update, update),
      ),
      this.store.on('live-changed', () => this.server.emit(SPORTSBOOK_WS.liveChanged)),
    );
  }

  onModuleDestroy() {
    for (const unsubscribe of this.unsubscribers) unsubscribe();
  }

  /** Joins the events' rooms and acks with their current state (closes the snapshot gap). */
  @SubscribeMessage(SPORTSBOOK_WS.subscribe)
  async subscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): Promise<EventUpdate[]> {
    const parsed = subscriptionSchema.safeParse(body);
    if (!parsed.success) return [];
    await client.join(parsed.data.eventIds.map(room));
    return this.store.snapshot(parsed.data.eventIds);
  }

  @SubscribeMessage(SPORTSBOOK_WS.unsubscribe)
  async unsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const parsed = subscriptionSchema.safeParse(body);
    if (!parsed.success) return;
    await Promise.all(parsed.data.eventIds.map((eventId) => client.leave(room(eventId))));
  }
}
