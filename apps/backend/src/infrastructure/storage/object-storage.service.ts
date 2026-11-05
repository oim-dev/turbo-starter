import { Injectable } from '@nestjs/common';
import * as http from 'node:http';
import * as https from 'node:https';
import { Readable } from 'node:stream';
import { CopyDestinationOptions, CopySourceOptions } from 'minio';
import { StorageConfig } from '../config/storage-config';
import {
  MultipartClient,
  MultipartUploadIncompleteError,
} from './multipart-client';

export interface StoredObject {
  key: string;
  etag: string;
  versionId?: string | null;
}

@Injectable()
export class ObjectStorage {
  private publicClient?: MultipartClient;
  private internalClient?: MultipartClient;

  constructor(private readonly storageConfig: StorageConfig) {}

  protected client(internal = false): MultipartClient {
    const existing = internal ? this.internalClient : this.publicClient;
    if (existing) return existing;
    const url = new URL(
      internal
        ? this.storageConfig.internalEndpoint
        : this.storageConfig.endpoint,
    );
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
    const client = new MultipartClient({
      endPoint: url.hostname,
      port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
      useSSL: url.protocol === 'https:',
      region: this.storageConfig.region,
      accessKey: this.storageConfig.accessKey,
      secretKey: this.storageConfig.secretKey,
      pathStyle: true,
      partSize: 8 * 1024 * 1024,
      retryOptions: { disableRetry: true },
      transport: { ...transport, request },
    });
    if (internal) this.internalClient = client;
    else this.publicClient = client;
    return client;
  }

  presignUpload(key: string, ttl = 900): Promise<string> {
    return this.client().presignedPutObject(
      this.storageConfig.bucket,
      key,
      ttl,
    );
  }

  startMultipart(key: string, contentType: string): Promise<string> {
    return this.client().initiateNewMultipartUpload(
      this.storageConfig.bucket,
      key,
      { 'Content-Type': contentType },
    );
  }

  abortMultipart(key: string, uploadId: string): Promise<void> {
    return this.client().abortMultipartUpload(
      this.storageConfig.bucket,
      key,
      uploadId,
    );
  }

  presignPart(
    key: string,
    uploadId: string,
    part: number,
    ttl: number,
  ): Promise<string> {
    return this.client().presignedUrl(
      'PUT',
      this.storageConfig.bucket,
      key,
      ttl,
      { uploadId, partNumber: String(part) },
    );
  }

  async finishMultipart(
    key: string,
    uploadId: string,
    byteSize: bigint,
    partSize: bigint,
  ): Promise<void> {
    try {
      const parts = await this.client().uploadedParts(
        this.storageConfig.bucket,
        key,
        uploadId,
      );
      const count = Number((byteSize + partSize - 1n) / partSize);
      if (
        parts.length !== count ||
        parts.some(
          (part, index) =>
            part.part !== index + 1 ||
            BigInt(part.size) !==
              (index === count - 1
                ? byteSize - BigInt(index) * partSize
                : partSize),
        )
      )
        throw new MultipartUploadIncompleteError();
      await this.client().completeMultipartUpload(
        this.storageConfig.bucket,
        key,
        uploadId,
        parts,
      );
    } catch (error) {
      if (error instanceof MultipartUploadIncompleteError) throw error;
      // Complete мог завершиться, а ответ потеряться; собранный staging неизменяем:
      // после завершения session ID больше не принимает старые UploadPart URL.
      try {
        if (BigInt((await this.stat(key)).size) === byteSize) return;
      } catch {
        /* Исходная ошибка остаётся результатом. */
      }
      throw error;
    }
  }

  presignRead(
    object: StoredObject,
    ttl: number,
    headers: Record<string, string>,
    internal = false,
  ): Promise<string> {
    return this.client(internal).presignedGetObject(
      this.storageConfig.bucket,
      object.key,
      ttl,
      {
        ...headers,
        ...(object.versionId ? { versionId: object.versionId } : {}),
      },
    );
  }

  stat(key: string, versionId?: string | null) {
    return this.client().statObject(
      this.storageConfig.bucket,
      key,
      versionId ? { versionId } : undefined,
    );
  }

  async freeze(
    stagingKey: string,
    key: string,
    etag: string,
    versionId?: string | null,
    contentType?: string,
  ): Promise<StoredObject> {
    const source = new CopySourceOptions({
      Bucket: this.storageConfig.bucket,
      Object: stagingKey,
      MatchETag: etag,
      ...(versionId ? { VersionID: versionId } : {}),
    });
    const destination = new CopyDestinationOptions({
      Bucket: this.storageConfig.bucket,
      Object: key,
      ...(contentType ? {
        MetadataDirective: 'REPLACE',
        Headers: { 'Content-Type': contentType },
      } : {}),
    });
    const sourceStat = await this.stat(stagingKey, versionId);
    const sourceContentType: unknown = sourceStat.metaData['content-type'];
    if (sourceStat.size > 5 * 1024 ** 3) {
      await this.copyLargeObject(
        source,
        destination,
        sourceStat.size,
        contentType ?? (typeof sourceContentType === 'string' ? sourceContentType : 'application/octet-stream'),
      );
    } else await this.client().copyObject(source, destination);
    const stat = await this.stat(key);
    return { key, etag: stat.etag, versionId: stat.versionId };
  }

  private async copyLargeObject(
    source: CopySourceOptions,
    destination: CopyDestinationOptions,
    size: number,
    contentType: string,
  ): Promise<void> {
    // minio 8 composeObject повторяет partNumber и переиспользует headers при
    // разбиении одного source >5 ГиБ. Нумеруем UploadPartCopy сами через SDK,
    // сохраняя отдельные Range/ETag/versionId для каждой части.
    const partSize = Math.max(
      128 * 1024 ** 2,
      Math.ceil(size / 10000 / 1024 ** 2) * 1024 ** 2,
    );
    const uploadId = await this.client().initiateNewMultipartUpload(
      destination.Bucket,
      destination.Object,
      {
        'Content-Type': contentType,
        'Cache-Control': 'private,no-store',
      },
    );
    const parts: { part: number; etag: string }[] = [];
    try {
      for (let start = 0; start < size; start += partSize) {
        const end = Math.min(size - 1, start + partSize - 1);
        const sourcePath = `${encodeURI(`${source.Bucket}/${source.Object}`)}${source.VersionID ? `?versionId=${encodeURIComponent(source.VersionID)}` : ''}`;
        parts.push(
          await this.client().uploadPart({
            bucketName: destination.Bucket,
            objectName: destination.Object,
            uploadID: uploadId,
            partNumber: parts.length + 1,
            headers: {
              ...source.getHeaders(),
              'x-amz-copy-source': sourcePath,
              'x-amz-copy-source-range': `bytes=${start}-${end}`,
            },
          }),
        );
      }
      await this.client().completeMultipartUpload(
        destination.Bucket,
        destination.Object,
        uploadId,
        parts,
      );
    } catch (error) {
      await this.client()
        .abortMultipartUpload(destination.Bucket, destination.Object, uploadId)
        .catch(() => undefined);
      throw error;
    }
  }

  get(object: StoredObject): Promise<Readable> {
    return this.client().getObject(
      this.storageConfig.bucket,
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
      this.storageConfig.bucket,
      object.key,
      offset,
      length,
      object.versionId ? { versionId: object.versionId } : undefined,
    );
  }

  remove(object: Pick<StoredObject, 'key' | 'versionId'>): Promise<void> {
    return this.client().removeObject(
      this.storageConfig.bucket,
      object.key,
      object.versionId ? { versionId: object.versionId } : undefined,
    );
  }
}
