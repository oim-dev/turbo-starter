import { Injectable } from '@nestjs/common';
import './environment';
import { StorageConfig } from './storage-config';

function positiveInteger(name: string, fallback: number, max: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1 || value > max)
    throw new Error(`Invalid ${name}`);
  return value;
}

function httpUrl(name: string, fallback: string): string {
  const url = new URL(process.env[name] ?? fallback);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error(`Invalid ${name}`);
  return url.toString().replace(/\/$/, '');
}

// Getter'ы ленивые: построение графа OpenAPI не открывает сеть и не читает secrets.
@Injectable()
export class ImageConfig extends StorageConfig {
  get rabbitUrl() {
    return (
      process.env.RABBITMQ_URL ??
      'amqp://image:image-password@localhost:5672/images'
    );
  }
  get imgproxyUrl() {
    return httpUrl('IMGPROXY_URL', 'http://localhost:18080');
  }
  get imgproxyKey() {
    return this.hex('IMGPROXY_KEY', '1'.repeat(64));
  }
  get imgproxySalt() {
    return this.hex('IMGPROXY_SALT', '2'.repeat(64));
  }
  get publicBaseUrl() {
    return httpUrl('IMAGE_PUBLIC_BASE_URL', 'http://localhost:4000');
  }
  get maxUploadBytes() {
    return positiveInteger('IMAGE_MAX_UPLOAD_BYTES', 20971520, 2147483647);
  }
  get maxSourcePixels() {
    return positiveInteger('IMAGE_MAX_SOURCE_PIXELS', 40000000, 1000000000);
  }
  get concurrency() {
    return positiveInteger('IMAGE_WORKER_CONCURRENCY', 2, 16);
  }
  readonly uploadTtlSeconds = 900;
  readonly originalTtlSeconds = 300;
  readonly jobTimeoutMs = 30 * 60 * 1000;
  readonly leaseMs = 120000;
  readonly maxAttempts = 3;

  private hex(name: string, fallback: string): Buffer {
    const value = process.env[name] ?? fallback;
    if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error(`Invalid ${name}`);
    return Buffer.from(value, 'hex');
  }
}
