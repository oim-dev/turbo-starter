import { Injectable } from '@nestjs/common';
import { createHmac, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { imageSize } from 'image-size';
import { ImageConfig } from '../config/image-config';
import {
  ImageStorage,
  type StoredObject,
} from '../storage/image-storage.service';
import { readLimited } from '../storage/read-limited';
import { ImageProcessingError } from '../../modules/images/image-error';
import type { SourceMetadata } from '../../modules/images/image-metadata';
import type { VariantPlan } from '../../modules/images/image-variants';
import { ImageProcessor, type ProcessedImage } from './image-processor';
import { TIFF_METADATA_BYTES, validateNormalizedTiff } from './normalized-tiff';

@Injectable()
export class ImgproxyProcessor extends ImageProcessor {
  constructor(
    private readonly config: ImageConfig,
    private readonly storage: ImageStorage,
  ) {
    super();
  }

  async normalizeIndexedPng(
    source: StoredObject,
    metadata: SourceMetadata,
    signal: AbortSignal,
  ): Promise<StoredObject> {
    if (!metadata.isIndexedPng || metadata.mimeType !== 'image/png')
      throw new ImageProcessingError(
        'INVALID_NORMALIZATION_SOURCE',
        'Нормализация доступна только для палитрового PNG.',
      );
    const boundedSignal = AbortSignal.any([
      signal,
      AbortSignal.timeout(120000),
    ]);
    const key = `images/normalization/${randomUUID()}.tiff`;
    let normalized: StoredObject | undefined;
    try {
      // Без resize: сбрасываем palette metadata через RGB/RGBA8 TIFF.
      // ICC сохраняется до финального scp:1, alpha не премультиплицируется.
      const response = await this.fetchImage(
        source,
        ['ar:1', 'sm:1', 'kcr:0', 'scp:0', 'ph:1', 'f:tiff'],
        boundedSignal,
      );
      const byteSizeHeader = response.headers.get('content-length') ?? '';
      const byteSize = Number(byteSizeHeader);
      const maximum =
        Math.min(
          this.config.maxSourcePixels,
          metadata.width * metadata.height,
        ) *
          4 +
        TIFF_METADATA_BYTES;
      if (
        response.status !== 200 ||
        !response.body ||
        response.headers.get('content-type')?.split(';')[0]?.trim() !==
          'image/tiff' ||
        !/^\d+$/.test(byteSizeHeader) ||
        !Number.isSafeInteger(byteSize) ||
        byteSize < 8 ||
        byteSize > maximum ||
        ![null, 'identity'].includes(
          response.headers.get('content-encoding'),
        ) ||
        Number(response.headers.get('x-result-width')) !== metadata.width ||
        Number(response.headers.get('x-result-height')) !== metadata.height
      ) {
        await response.body?.cancel();
        throw new ImageProcessingError(
          'INVALID_NORMALIZED_IMAGE',
          'Размер, тип или геометрия промежуточного TIFF недопустимы.',
        );
      }
      normalized = await this.storage.putTemporaryTiff(
        key,
        Readable.fromWeb(
          response.body as unknown as NodeReadableStream<Uint8Array>,
        ),
        byteSize,
        boundedSignal,
      );
      boundedSignal.throwIfAborted();
      const stat = await this.storage.stat(
        normalized.key,
        normalized.versionId,
      );
      if (stat.size !== byteSize || stat.etag !== normalized.etag)
        throw new ImageProcessingError(
          'INVALID_NORMALIZED_IMAGE',
          'Промежуточный TIFF записан не полностью.',
        );
      await validateNormalizedTiff(
        this.storage,
        normalized,
        byteSize,
        metadata,
        boundedSignal,
      );
      return normalized;
    } catch (error) {
      await this.storage.removeTemporary(normalized ?? { key });
      throw error;
    }
  }

  async process(
    source: StoredObject,
    plan: VariantPlan,
    signal: AbortSignal,
  ): Promise<ProcessedImage> {
    const options = [
      `resize:fit:${plan.width}:0:0`,
      'auto_rotate:1',
      'strip_metadata:1',
      'strip_color_profile:1',
      ...(plan.format === 'avif'
        ? ['quality:80']
        : plan.format === 'jpeg'
          ? ['quality:92']
          : []),
    ];
    const extension = plan.format === 'jpeg' ? 'jpg' : plan.format;
    const boundedSignal = AbortSignal.any([signal, AbortSignal.timeout(60000)]);
    const response = await this.fetchImage(
      source,
      options,
      boundedSignal,
      extension,
    );
    const mimeType = response.headers
      .get('content-type')
      ?.split(';')[0]
      ?.trim();
    if (
      !response.body ||
      !mimeType ||
      !['image/avif', 'image/jpeg', 'image/png'].includes(mimeType)
    ) {
      await response.body?.cancel();
      throw new ImageProcessingError(
        'INVALID_VARIANT',
        'Преобразователь вернул неподдерживаемый формат.',
      );
    }
    const bytes = await readLimited(
      Readable.fromWeb(
        response.body as unknown as NodeReadableStream<Uint8Array>,
      ),
      this.config.maxSourcePixels * 8 + 1048576,
      boundedSignal,
    );
    let dimensions: ReturnType<typeof imageSize>;
    try {
      dimensions = imageSize(bytes);
    } catch {
      throw new ImageProcessingError(
        'INVALID_VARIANT',
        'Не удалось проверить геометрию результата.',
      );
    }
    const format = dimensions.type === 'jpg' ? 'jpeg' : dimensions.type;
    // AVIF может содержать размеры tile в ispe; debug headers imgproxy описывают
    // фактический результат кодирования, а не первый tile BMFF-контейнера.
    const headerWidth = Number(response.headers.get('x-result-width'));
    const headerHeight = Number(response.headers.get('x-result-height'));
    const width =
      Number.isSafeInteger(headerWidth) && headerWidth > 0
        ? headerWidth
        : dimensions.width;
    const height =
      Number.isSafeInteger(headerHeight) && headerHeight > 0
        ? headerHeight
        : dimensions.height;
    if (
      !format ||
      `image/${format}` !== mimeType ||
      format !== plan.format ||
      width !== plan.width ||
      Math.abs(height - plan.height) > 1
    )
      throw new ImageProcessingError(
        'INVALID_VARIANT',
        'Формат или геометрия результата не совпадает с заданием.',
      );
    return { bytes, width, height, format, mimeType };
  }

  private async fetchImage(
    source: StoredObject,
    options: string[],
    signal: AbortSignal,
    extension?: string,
  ): Promise<Response> {
    const sourceUrl = await this.storage.presignOriginal(
      source,
      undefined,
      true,
    );
    const path = `/${options.join('/')}/${Buffer.from(sourceUrl).toString('base64url')}${extension ? `.${extension}` : ''}`;
    const signature = createHmac('sha256', this.config.imgproxyKey)
      .update(this.config.imgproxySalt)
      .update(path)
      .digest('base64url');
    const response = await fetch(
      `${this.config.imgproxyUrl}/${signature}${path}`,
      { signal, redirect: 'error' },
    );
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw new ImageProcessingError(
        'CONVERTER_ERROR',
        'Преобразователь не смог обработать изображение.',
        response.status >= 500 || response.status === 429,
      );
    }
    return response;
  }
}
