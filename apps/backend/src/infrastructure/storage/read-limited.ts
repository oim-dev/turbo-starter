import type { Readable } from 'node:stream';
import { ImageProcessingError } from '../../modules/images/image-error';

export async function readLimited(
  stream: Readable,
  limit: number,
  signal?: AbortSignal,
): Promise<Buffer> {
  const abort = () => stream.destroy(new Error('Image read aborted'));
  if (signal?.aborted) {
    stream.destroy();
    throw new Error('Image read aborted');
  }
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(
    () => stream.destroy(new Error('Image read timeout')),
    60000,
  );
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for await (const chunk of stream) {
      const bytes: Buffer = Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk as Uint8Array);
      total += bytes.length;
      if (total > limit) {
        stream.destroy();
        throw new ImageProcessingError(
          'IMAGE_SIZE_LIMIT',
          'Файл превышает допустимый размер.',
        );
      }
      chunks.push(bytes);
    }
    return Buffer.concat(chunks, total);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
