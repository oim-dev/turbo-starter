import type { SourceMetadata } from '../../modules/images/image-metadata';
import { ImageProcessingError } from '../../modules/images/image-error';
import type {
  ImageStorage,
  StoredObject,
} from '../storage/image-storage.service';
import { readLimited } from '../storage/read-limited';

// Palette RGB/tRNS — 8 бит на канал независимо от глубины индекса PNG.
// Запас включает IFD, strip tables и сохранённый ICC; upload limit здесь не применяется.
export const TIFF_METADATA_BYTES = 1024 * 1024;

function invalidTiff(): never {
  throw new ImageProcessingError(
    'INVALID_NORMALIZED_IMAGE',
    'Преобразователь вернул неподходящий промежуточный TIFF.',
  );
}

// TIFF хранит IFD и значения тегов по offsets, часто после полного растра.
// Читаем только небольшие bounded ranges через MinIO, а не 160-МиБ Buffer.
export async function validateNormalizedTiff(
  storage: ImageStorage,
  object: StoredObject,
  byteSize: number,
  source: SourceMetadata,
  signal: AbortSignal,
): Promise<void> {
  const range = async (offset: number, length: number): Promise<Buffer> => {
    signal.throwIfAborted();
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      length < 1 ||
      length > 4096 ||
      offset + length > byteSize
    )
      invalidTiff();
    const bytes = await readLimited(
      await storage.getRange(object, offset, length),
      length,
      signal,
    );
    if (bytes.length !== length) invalidTiff();
    return bytes;
  };
  const header = await range(0, 8);
  const order = header.toString('ascii', 0, 2);
  if (order !== 'II' && order !== 'MM') invalidTiff();
  const short = (bytes: Buffer, offset: number) =>
    order === 'II' ? bytes.readUInt16LE(offset) : bytes.readUInt16BE(offset);
  const long = (bytes: Buffer, offset: number) =>
    order === 'II' ? bytes.readUInt32LE(offset) : bytes.readUInt32BE(offset);
  if (short(header, 2) !== 42) invalidTiff();
  const ifd = long(header, 4);
  if (ifd < 8) invalidTiff();
  const count = short(await range(ifd, 2), 0);
  if (!count || count > 256) invalidTiff();
  const entries = await range(ifd + 2, count * 12 + 4);
  if (long(entries, count * 12) !== 0) invalidTiff(); // Только один кадр.
  const tags = new Map<number, Buffer>();
  for (let index = 0; index < count; index++) {
    const entry = entries.subarray(index * 12, index * 12 + 12);
    const tag = short(entry, 0);
    if (tags.has(tag)) invalidTiff();
    tags.set(tag, entry);
  }
  const values = async (
    tag: number,
    fallback?: number[],
  ): Promise<number[]> => {
    const entry = tags.get(tag);
    if (!entry) {
      if (fallback) return fallback;
      invalidTiff();
    }
    const type = short(entry, 2);
    const length = long(entry, 4);
    if (![3, 4].includes(type) || length < 1 || length > 4) invalidTiff();
    const size = type === 3 ? 2 : 4;
    const bytes =
      length * size <= 4
        ? entry.subarray(8)
        : await range(long(entry, 8), length * size);
    return Array.from({ length }, (_value, index) =>
      type === 3 ? short(bytes, index * size) : long(bytes, index * size),
    );
  };
  const scalar = async (tag: number, fallback?: number): Promise<number> => {
    const value = await values(
      tag,
      fallback === undefined ? undefined : [fallback],
    );
    if (value.length !== 1 || value[0] === undefined) invalidTiff();
    return value[0];
  };
  const width = await scalar(256);
  const height = await scalar(257);
  const channels = await scalar(277);
  const bits = await values(258);
  if (
    width !== source.width ||
    height !== source.height ||
    ![3, 4].includes(channels) ||
    (source.hasAlpha && channels !== 4) ||
    bits.length !== channels ||
    bits.some((value) => value !== 8) ||
    (await scalar(259, 1)) !== 1 ||
    (await scalar(262)) !== 2 ||
    (await scalar(274, 1)) !== 1 ||
    (await scalar(284, 1)) !== 1 ||
    tags.has(320) ||
    (channels === 4 && (await scalar(338)) !== 2) ||
    byteSize < width * height * channels ||
    byteSize > width * height * 4 + TIFF_METADATA_BYTES
  )
    invalidTiff();
}
