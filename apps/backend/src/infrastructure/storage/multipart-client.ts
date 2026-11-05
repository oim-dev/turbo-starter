import { Client } from 'minio';

/** Узкая адаптация защищённого метода SDK: ETag и размер частей читаются из S3. */
export class MultipartClient extends Client {
  uploadedParts(
    bucket: string,
    key: string,
    uploadId: string,
  ): Promise<{ part: number; etag: string; size: number }[]> {
    return this.listParts(bucket, key, uploadId);
  }
}

export class MultipartUploadIncompleteError extends Error {
  constructor() {
    super('Multipart upload is incomplete');
  }
}
