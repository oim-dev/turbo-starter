import { Injectable } from '@nestjs/common';
import * as http from 'node:http';
import * as https from 'node:https';
import { Readable } from 'node:stream';
import { Client, CopyDestinationOptions, CopySourceOptions } from 'minio';
import { ImageConfig } from '../config/image-config';
import { ImageProcessingError } from '../../modules/images/image-error';

export interface StoredObject {
  key: string;
  etag: string;
  versionId?: string | null;
}

@Injectable()
export class ImageStorage {
  private publicClient?: Client;
  private internalClient?: Client;

  constructor(private readonly config: ImageConfig) {}

  private client(internal = false): Client {
    const existing = internal ? this.internalClient : this.publicClient;
    if (existing) return existing;
    const url = new URL(
      internal ? this.config.internalEndpoint : this.config.endpoint,
    );
    if (url.pathname !== '/')
      throw new Error('S3 endpoint must not contain a path');
    const transport = url.protocol === 'https:' ? https : http;
    function request(
      options: string | URL | http.RequestOptions,
      callback?: (response: http.IncomingMessage) => void,
    ): http.ClientRequest;
    function request(
      url: string | URL,
      options: http.RequestOptions,
      callback?: (response: http.IncomingMessage) => void,
    ): http.ClientRequest;
    function request(
      options: string | URL | http.RequestOptions,
      optionsOrCallback?:
        http.RequestOptions | ((response: http.IncomingMessage) => void),
      callback?: (response: http.IncomingMessage) => void,
    ): http.ClientRequest {
      let result: http.ClientRequest;
      if (typeof optionsOrCallback === 'object') {
        if (typeof options !== 'string' && !(options instanceof URL))
          throw new Error('Invalid transport arguments');
        result = transport.request(options, optionsOrCallback, callback);
      } else result = transport.request(options, optionsOrCallback);
      result.setTimeout(30000, () =>
        result.destroy(new Error('Storage request timeout')),
      );
      return result;
    }
    const client = new Client({
      endPoint: url.hostname,
      port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
      useSSL: url.protocol === 'https:',
      region: this.config.region,
      accessKey: this.config.accessKey,
      secretKey: this.config.secretKey,
      pathStyle: true,
      // Потоковый служебный TIFF до 160 МиБ не буферизуется целиком SDK.
      partSize: 8 * 1024 * 1024,
      retryOptions: { disableRetry: true },
      transport: { ...transport, request },
    });
    if (internal) this.internalClient = client;
    else this.publicClient = client;
    return client;
  }

  // Backend работает через S3_ENDPOINT; внутренний адрес нужен imgproxy в Docker.
  // Оба адреса подписываются отдельными Client без подмены host после подписи.
  presignUpload(key: string): Promise<string> {
    return this.client().presignedPutObject(
      this.config.bucket,
      key,
      this.config.uploadTtlSeconds,
    );
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

  stat(key: string, versionId?: string | null) {
    return this.client().statObject(
      this.config.bucket,
      key,
      versionId ? { versionId } : undefined,
    );
  }

  async freeze(
    stagingKey: string,
    key: string,
    etag: string,
    versionId?: string | null,
  ): Promise<StoredObject> {
    await this.client().copyObject(
      new CopySourceOptions({
        Bucket: this.config.bucket,
        Object: stagingKey,
        MatchETag: etag,
        ...(versionId ? { VersionID: versionId } : {}),
      }),
      new CopyDestinationOptions({ Bucket: this.config.bucket, Object: key }),
    );
    const stat = await this.stat(key);
    return { key, etag: stat.etag, versionId: stat.versionId };
  }

  get(object: StoredObject): Promise<Readable> {
    return this.client().getObject(
      this.config.bucket,
      object.key,
      object.versionId ? { versionId: object.versionId } : undefined,
    );
  }

  getRange(
    object: StoredObject,
    offset: number,
    length: number,
  ): Promise<Readable> {
    return this.client().getPartialObject(
      this.config.bucket,
      object.key,
      offset,
      length,
      object.versionId ? { versionId: object.versionId } : undefined,
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

  remove(object: Pick<StoredObject, 'key' | 'versionId'>): Promise<void> {
    return this.client().removeObject(
      this.config.bucket,
      object.key,
      object.versionId ? { versionId: object.versionId } : undefined,
    );
  }
}
