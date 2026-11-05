import { Injectable } from '@nestjs/common';
import { Readable } from 'node:stream';
import { ImageConfig } from '../config/image-config';
import { ImageProcessingError } from '../../modules/images/image-error';
import { ObjectStorage, type StoredObject } from './object-storage.service';
export type { StoredObject } from './object-storage.service';

@Injectable()
export class ImageStorage extends ObjectStorage {
  constructor(private readonly config: ImageConfig) {
    super(config);
  }

  presignOriginal(
    object: StoredObject,
    filename?: string,
    internal = false,
  ): Promise<string> {
    return this.client(internal).presignedGetObject(
      this.config.bucket,
      object.key,
      this.config.originalTtlSeconds,
      {
        ...(object.versionId ? { versionId: object.versionId } : {}),
        ...(filename
          ? {
              'response-content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
              'response-cache-control': 'private, no-store',
              'response-content-type': 'application/octet-stream',
            }
          : {}),
      },
    );
  }

  async putTemporaryTiff(
    key: string,
    stream: Readable,
    byteSize: number,
    signal: AbortSignal,
  ): Promise<StoredObject> {
    let readError: Error | undefined;
    let consumed = 0;
    const recordError = (error: unknown) => {
      readError ??=
        error instanceof Error
          ? error
          : new Error('Normalization stream failed');
    };
    const abort = () =>
      stream.destroy(new Error('Normalization upload aborted'));
    stream.on('error', recordError);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    const bounded = Readable.from(
      (async function* () {
        try {
          for await (const chunk of stream) {
            signal.throwIfAborted();
            const bytes: Buffer = Buffer.isBuffer(chunk)
              ? chunk
              : Buffer.from(chunk as Uint8Array);
            consumed += bytes.length;
            if (consumed > byteSize)
              throw new ImageProcessingError(
                'INVALID_NORMALIZED_IMAGE',
                'Размер промежуточного TIFF превышает заявленный.',
              );
            yield bytes;
          }
          if (consumed !== byteSize)
            throw new ImageProcessingError(
              'INVALID_NORMALIZED_IMAGE',
              'Промежуточный TIFF получен не полностью.',
            );
        } catch (error) {
          // minio 8 uploadStream слушает error своего chunkier, но не input stream.
          // Завершаем приватную загрузку EOF, затем обязательно отклоняем/удаляем
          // результат: ошибка источника не должна навсегда подвесить multipart.
          recordError(error);
        }
      })(),
    );
    let object: StoredObject | undefined;
    try {
      signal.throwIfAborted();
      const result = await this.client().putObject(
        this.config.bucket,
        key,
        bounded,
        byteSize,
        {
          'Content-Type': 'image/tiff',
          'Cache-Control': 'private, no-store',
        },
      );
      object = { key, etag: result.etag, versionId: result.versionId };
      if (readError) throw readError;
      signal.throwIfAborted();
      return object;
    } catch (error) {
      await this.removeTemporary(object ?? { key });
      if (readError) throw readError;
      throw error;
    } finally {
      signal.removeEventListener('abort', abort);
      stream.destroy();
      bounded.destroy();
    }
  }

  async removeTemporary(
    object: Pick<StoredObject, 'key' | 'versionId'>,
  ): Promise<void> {
    await Promise.allSettled([
      this.remove(object),
      this.client().removeIncompleteUpload(this.config.bucket, object.key),
    ]);
  }

  async put(
    key: string,
    bytes: Buffer,
    mimeType: string,
  ): Promise<StoredObject> {
    const result = await this.client().putObject(
      this.config.bucket,
      key,
      bytes,
      bytes.length,
      {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    );
    return { key, etag: result.etag, versionId: result.versionId };
  }
}
