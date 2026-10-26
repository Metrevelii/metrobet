import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { MediaFolder } from '@metrobet/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.js';
import { type MediaFile, MediaStorage } from './media-storage.js';

@Injectable()
export class LocalMediaStorage extends MediaStorage {
  private readonly root: string;
  private readonly publicUrl: string;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    super();
    this.root = resolve(config.get('MEDIA_DIR', { infer: true }));
    this.publicUrl = config.get('MEDIA_PUBLIC_URL', { infer: true }).replace(/\/$/, '');
  }

  async save(folder: MediaFolder, { buffer, extension }: MediaFile): Promise<string> {
    const name = `${randomUUID()}.${extension}`;
    await mkdir(join(this.root, folder), { recursive: true });
    await writeFile(join(this.root, folder, name), buffer);
    return `${this.publicUrl}/${folder}/${name}`;
  }
}
