import { Injectable } from '@nestjs/common';
import './environment';

@Injectable()
export class FileConfig {
  get publicBaseUrl(): string {
    const url = new URL(
      process.env.FILE_PUBLIC_BASE_URL ?? 'http://localhost:4000',
    );
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error('Invalid FILE_PUBLIC_BASE_URL');
    return url.toString().replace(/\/$/, '');
  }
  readonly uploadTtlSeconds = 86400;
  readonly partUrlTtlSeconds = 900;
}
