import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

/** Socket.IO with the same allowed origins as HTTP CORS. Add the Redis adapter here to scale out. */
export class CorsIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly origins: string[],
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: Partial<ServerOptions>) {
    const merged: Partial<ServerOptions> = {
      ...options,
      cors: { origin: this.origins, credentials: true },
    };
    return super.createIOServer(port, merged as ServerOptions);
  }
}
