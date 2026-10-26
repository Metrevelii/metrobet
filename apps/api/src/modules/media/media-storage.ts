import type { MediaFolder } from '@metrobet/contracts';

export type MediaFile = { buffer: Buffer; extension: string };

/** Storage port for uploaded media. Local disk today; S3/CDN later without API changes. */
export abstract class MediaStorage {
  /** Persists the file and returns its public URL. */
  abstract save(folder: MediaFolder, file: MediaFile): Promise<string>;
}
