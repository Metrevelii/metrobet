import { Module } from '@nestjs/common';

import { LocalMediaStorage } from './local-media-storage.js';
import { MediaController } from './media.controller.js';
import { MediaStorage } from './media-storage.js';

@Module({
  controllers: [MediaController],
  providers: [{ provide: MediaStorage, useClass: LocalMediaStorage }],
})
export class MediaModule {}
