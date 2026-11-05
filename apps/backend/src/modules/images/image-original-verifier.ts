import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ImageConfig } from '../../infrastructure/config/image-config';
import {
  ImageStorage,
  type StoredObject,
} from '../../infrastructure/storage/image-storage.service';
import { readLimited } from '../../infrastructure/storage/read-limited';
import { ImageProcessingError } from './image-error';
import { sourceMetadata } from './image-metadata';

@Injectable()
export class ImageOriginalVerifier {
  constructor(
    private readonly storage: ImageStorage,
    private readonly config: ImageConfig,
  ) {}

  async verify(
    object: StoredObject,
    image: {
      byteSize: number;
      contentType: string;
      claimedSha256?: string | null;
    },
  ): Promise<string> {
    const stat = await this.storage.stat(object.key, object.versionId);
    if (
      stat.etag !== object.etag ||
      stat.size !== image.byteSize ||
      stat.size > this.config.maxUploadBytes
    )
      throw new ImageProcessingError(
        'IMAGE_SIZE_MISMATCH',
        'Размер или версия оригинала не совпадает с заявленным.',
      );
    const bytes = await readLimited(
      await this.storage.get(object),
      this.config.maxUploadBytes,
    );
    if (bytes.length !== image.byteSize)
      throw new ImageProcessingError(
        'IMAGE_SIZE_MISMATCH',
        'Размер оригинала не совпадает с заявленным.',
      );
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (image.claimedSha256 && image.claimedSha256 !== sha256)
      throw new ImageProcessingError(
        'IMAGE_HASH_MISMATCH',
        'SHA-256 загруженного файла не совпадает с заявленным.',
      );
    // Неверный MIME никогда не захватывает хеш корректного оригинала.
    // Полное декодирование остаётся у worker; повреждённые байты имеют иной SHA-256.
    sourceMetadata(bytes, image.contentType, this.config.maxSourcePixels);
    return sha256;
  }
}
