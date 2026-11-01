import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import { z } from 'zod';

import type { Env } from '../../config/env.js';

/** Channels raised by triggers (migration `player_live_notify`), delivered only on commit. */
const balanceSchema = z.object({ playerId: z.uuid(), balance: z.number().int() });
const ticketSchema = z.object({
  ticketId: z.uuid(),
  playerId: z.uuid(),
  status: z.enum(['won', 'lost', 'void']),
  mode: z.enum(['single', 'combo']),
  stake: z.number().int(),
  payout: z.number().int(),
});

export type PlayerEvent =
  | ({ type: 'balance' } & z.infer<typeof balanceSchema>)
  | ({ type: 'ticket' } & z.infer<typeof ticketSchema>);

const CHANNELS = { player_balance: 'balance', ticket_settled: 'ticket' } as const;
const RECONNECT_MS = 2_000;

/**
 * Listens to Postgres NOTIFY for player-facing changes. Because Postgres only delivers a
 * notification when its transaction commits, nothing is announced that later rolls back, and
 * every API instance hears every change. One dedicated connection; reconnects on failure.
 */
@Injectable()
export class PgListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PgListener.name);
  private readonly handlers = new Set<(event: PlayerEvent) => void>();
  private client: Client | null = null;
  private stopped = false;
  private retry: NodeJS.Timeout | null = null;

  constructor(@Inject(ConfigService) private readonly config: ConfigService<Env, true>) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    this.stopped = true;
    if (this.retry) clearTimeout(this.retry);
    await this.client?.end().catch(() => undefined);
  }

  on(handler: (event: PlayerEvent) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private async connect() {
    const client = new Client({
      connectionString: this.config.get('DATABASE_URL', { infer: true }),
    });
    client.on('notification', ({ channel, payload }) => this.dispatch(channel, payload));
    client.on('error', (error) => {
      this.logger.warn(`Listener connection failed: ${error.message}`);
      this.reconnect(client);
    });
    client.on('end', () => this.reconnect(client));
    try {
      await client.connect();
      for (const channel of Object.keys(CHANNELS)) await client.query(`LISTEN ${channel}`);
      this.client = client;
    } catch (error) {
      this.logger.warn(`Listener could not connect: ${(error as Error).message}`);
      this.reconnect(client);
    }
  }

  private reconnect(client: Client) {
    if (this.stopped || this.retry || (this.client && this.client !== client)) return;
    this.client = null;
    client.removeAllListeners();
    client.end().catch(() => undefined);
    this.retry = setTimeout(() => {
      this.retry = null;
      void this.connect();
    }, RECONNECT_MS);
  }

  private dispatch(channel: string, payload: string | undefined) {
    const type = CHANNELS[channel as keyof typeof CHANNELS];
    if (!type || !payload) return;
    try {
      const json: unknown = JSON.parse(payload);
      const parsed =
        type === 'balance' ? balanceSchema.safeParse(json) : ticketSchema.safeParse(json);
      if (!parsed.success) return;
      const event = { type, ...parsed.data } as PlayerEvent;
      for (const handler of this.handlers) handler(event);
    } catch (error) {
      this.logger.warn(`Bad ${channel} payload: ${(error as Error).message}`);
    }
  }
}
