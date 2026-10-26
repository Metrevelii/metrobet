import {
  MEDIA_MAX_BYTES,
  type MediaFolder,
  mediaFolderSchema,
  type MediaUploadResponse,
} from '@metrobet/contracts';
import {
  BadRequestException,
  Controller,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { AdminKeyGuard } from '../../common/guards/admin-key.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { MediaStorage } from './media-storage.js';
import { sniffImageExtension } from './sniff-image.js';

@Controller('admin/media')
@UseGuards(AdminKeyGuard)
export class MediaController {
  constructor(@Inject(MediaStorage) private readonly storage: MediaStorage) {}

  /** Multipart upload, field name `file`. Accepts PNG, JPEG, WebP, AVIF up to 5 MB. */
  @Post(':folder')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MEDIA_MAX_BYTES, files: 1 } }))
  async upload(
    @Param('folder', new ZodValidationPipe(mediaFolderSchema)) folder: MediaFolder,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<MediaUploadResponse> {
    if (!file) throw new BadRequestException('Missing file');
    const extension = sniffImageExtension(file.buffer);
    if (!extension)
      throw new BadRequestException('Only PNG, JPEG, WebP or AVIF images are allowed');
    return { url: await this.storage.save(folder, { buffer: file.buffer, extension }) };
  }
}
