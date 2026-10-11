import { imageSize } from 'image-size';
import { ImageProcessingError } from './image-error';

export interface SourceMetadata {
  width: number;
  height: number;
  mimeType: string;
  hasAlpha: boolean;
  isIndexedPng: boolean;
}

function invalid(): never {
  throw new ImageProcessingError(
    'INVALID_IMAGE',
    'Файл повреждён или не является поддерживаемым изображением.',
  );
}

// Только TIFF Orientation, без декодирования пикселей/преобразований в Node.
function exifOrientation(bytes: Buffer): number | undefined {
  const offset = bytes.subarray(0, 6).equals(Buffer.from('Exif\0\0')) ? 6 : 0;
  const data = bytes.subarray(offset);
  if (data.length < 8) return;
  const little = data.toString('ascii', 0, 2) === 'II';
  if (!little && data.toString('ascii', 0, 2) !== 'MM') return;
  const short = (position: number) =>
    little ? data.readUInt16LE(position) : data.readUInt16BE(position);
  const long = (position: number) =>
    little ? data.readUInt32LE(position) : data.readUInt32BE(position);
  if (short(2) !== 42) return;
  const ifd = long(4);
  if (ifd < 8 || ifd + 2 > data.length) return;
  const count = short(ifd);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > data.length) return;
    if (
      short(entry) === 0x112 &&
      short(entry + 2) === 3 &&
      long(entry + 4) === 1
    ) {
      const orientation = short(entry + 8);
      return orientation >= 1 && orientation <= 8 ? orientation : undefined;
    }
  }
}

function jpegOrientation(bytes: Buffer): number | undefined {
  let offset = 2; // SOI уже проверен по magic.
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) invalid();
    // JPEG допускает несколько padding-байтов FF перед маркером.
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === undefined || marker === 0x00) invalid();
    // После SOS идёт entropy-coded scan, а не последовательность metadata-сегментов.
    if (marker === 0xda || marker === 0xd9) return;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) invalid();
    const size = bytes.readUInt16BE(offset);
    if (size < 2 || offset + size > bytes.length) invalid();
    if (
      marker === 0xe1 &&
      bytes.subarray(offset + 2, offset + 8).equals(Buffer.from('Exif\0\0'))
    ) {
      // У IFD0 нет фиксированного offset: TIFF хранит его в собственном заголовке.
      const orientation = exifOrientation(
        bytes.subarray(offset + 2, offset + size),
      );
      if (orientation !== undefined) return orientation;
    }
    offset += size;
  }
}

export function sourceMetadata(
  bytes: Buffer,
  declaredType: string,
  maxPixels: number,
): SourceMetadata {
  let mimeType: string;
  let alpha = false;
  let isIndexedPng = false;
  let orientation: number | undefined;
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    mimeType = 'image/png';
    if (bytes.length < 33 || bytes.toString('ascii', 12, 16) !== 'IHDR')
      invalid();
    alpha = bytes[25] === 4 || bytes[25] === 6;
    isIndexedPng = bytes[25] === 3;
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const size = bytes.readUInt32BE(offset);
      if (offset + 12 + size > bytes.length) invalid();
      const type = bytes.toString('ascii', offset + 4, offset + 8);
      if (type === 'tRNS') alpha = true;
      if (type === 'acTL')
        throw new ImageProcessingError(
          'ANIMATION_UNSUPPORTED',
          'Анимированные изображения не поддерживаются.',
        );
      if (type === 'eXIf')
        orientation = exifOrientation(
          bytes.subarray(offset + 8, offset + 8 + size),
        );
      offset += 12 + size;
    }
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    mimeType = 'image/jpeg';
    orientation = jpegOrientation(bytes);
  } else if (
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    mimeType = 'image/webp';
    if (bytes.length < 20 || bytes.readUInt32LE(4) + 8 !== bytes.length)
      invalid();
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const type = bytes.toString('ascii', offset, offset + 4);
      const size = bytes.readUInt32LE(offset + 4);
      if (offset + 8 + size > bytes.length) invalid();
      if (type === 'VP8X') {
        if (size < 10) invalid();
        const flags = bytes[offset + 8] ?? 0;
        if (flags & 2)
          throw new ImageProcessingError(
            'ANIMATION_UNSUPPORTED',
            'Анимированные изображения не поддерживаются.',
          );
        if (flags & 16) alpha = true;
      }
      if (type === 'ALPH') alpha = true;
      if (type === 'VP8L') {
        if (size < 5) invalid();
        if ((bytes[offset + 12] ?? 0) & 16) alpha = true;
      }
      if (type === 'EXIF')
        orientation = exifOrientation(
          bytes.subarray(offset + 8, offset + 8 + size),
        );
      offset += 8 + size + (size % 2);
    }
  } else {
    throw new ImageProcessingError(
      'UNSUPPORTED_IMAGE_TYPE',
      'Поддерживаются только статичные JPEG, PNG и WebP. AVIF, HEIC, SVG и GIF не принимаются.',
    );
  }
  if (mimeType !== declaredType)
    throw new ImageProcessingError(
      'IMAGE_TYPE_MISMATCH',
      'Реальный тип файла не совпадает с заявленным Content-Type.',
    );
  let dimensions: ReturnType<typeof imageSize>;
  try {
    dimensions = imageSize(bytes);
  } catch {
    invalid();
  }
  // Orientation читаем сами: image-size предполагает для JPEG фиксированный IFD0=8.
  const swap =
    orientation !== undefined && orientation >= 5 && orientation <= 8;
  const width = swap ? dimensions.height : dimensions.width;
  const height = swap ? dimensions.width : dimensions.height;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1
  )
    invalid();
  if (width * height > maxPixels)
    throw new ImageProcessingError(
      'IMAGE_PIXEL_LIMIT',
      'Изображение превышает допустимое количество пикселей.',
    );
  return { width, height, mimeType, hasAlpha: alpha, isIndexedPng };
}
