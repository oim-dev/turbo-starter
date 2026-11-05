import { Injectable } from '@nestjs/common';
import './environment';

@Injectable()
export class StorageConfig {
  get endpoint() {
    return this.url('S3_ENDPOINT', 'http://localhost:9000');
  }
  get internalEndpoint() {
    return this.url('S3_INTERNAL_ENDPOINT', 'http://minio:9000');
  }
  get bucket() {
    return process.env.S3_BUCKET ?? 'default-bucket';
  }
  get region() {
    return process.env.S3_REGION ?? 'us-east-1';
  }
  get accessKey() {
    return process.env.S3_ACCESS_KEY ?? 'user';
  }
  get secretKey() {
    return process.env.S3_SECRET_KEY ?? 'password';
  }

  private url(name: string, fallback: string): string {
    const url = new URL(process.env[name] ?? fallback);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error(`Invalid ${name}`);
    return url.origin;
  }
}
