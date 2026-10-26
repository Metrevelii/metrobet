import { z } from 'zod';

export const MEDIA_FOLDERS = ['promotions'] as const;
export const mediaFolderSchema = z.enum(MEDIA_FOLDERS);
export type MediaFolder = z.infer<typeof mediaFolderSchema>;

/** Raster formats only: SVG uploads are rejected (scriptable content). */
export const MEDIA_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/avif'] as const;
export const MEDIA_MAX_BYTES = 5 * 1024 * 1024;

export const mediaUploadResponseSchema = z.object({ url: z.url() });
export type MediaUploadResponse = z.infer<typeof mediaUploadResponseSchema>;
