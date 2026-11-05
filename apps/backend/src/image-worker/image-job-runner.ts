import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client';
import { ImageConfig } from '../infrastructure/config/image-config';
import { ImageProcessor } from '../infrastructure/images/image-processor';
import {
  ImageStorage,
  type StoredObject,
} from '../infrastructure/storage/image-storage.service';
import { readLimited } from '../infrastructure/storage/read-limited';
import {
  ImageProcessingError,
  processingError,
} from '../modules/images/image-error';
import { sourceMetadata } from '../modules/images/image-metadata';
import { variantPlans } from '../modules/images/image-variants';
import {
  ImageJobs,
  type ClaimedJob,
  type ImageMessage,
} from './image-jobs.service';

@Injectable()
export class ImageJobRunner {
  private active = 0;
  private readonly waiters: (() => void)[] = [];

  constructor(
    private readonly jobs: ImageJobs,
    private readonly storage: ImageStorage,
    private readonly processor: ImageProcessor,
    private readonly config: ImageConfig,
  ) {}

  async run(message: ImageMessage): Promise<void> {
    // Prefetch ограничивает отдельный AMQP channel. Semaphore сохраняет общий
    // предел процесса и во время reconnect, пока старые задания ещё выполняются.
    if (this.active >= this.config.concurrency)
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    else this.active++;
    try {
      await this.runClaimed(message);
    } finally {
      const next = this.waiters.shift();
      if (next) next();
      else this.active--;
    }
  }

  private async runClaimed(message: ImageMessage): Promise<void> {
    const job = await this.jobs.claim(message);
    if (!job) return; // Подтверждённый в БД дубль/устаревшая доставка.
    const abort = new AbortController();
    let heartbeatRunning = false;
    const heartbeat = setInterval(() => {
      if (heartbeatRunning) return;
      heartbeatRunning = true;
      void this.jobs
        .heartbeat(job)
        .then((valid) => {
          if (!valid) abort.abort();
        })
        .catch(() => abort.abort())
        .finally(() => {
          heartbeatRunning = false;
        });
    }, 30000);
    const timeout = setTimeout(
      () => abort.abort(),
      Math.max(1, job.deadlineAt.getTime() - Date.now()),
    );
    try {
      await this.process(job, abort.signal);
    } catch (error) {
      await this.jobs.fail(job, processingError(error));
    } finally {
      clearInterval(heartbeat);
      clearTimeout(timeout);
    }
  }

  private async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    const image = job.image;
    if (!image.originalKey || !image.originalEtag)
      throw new ImageProcessingError(
        'ORIGINAL_MISSING',
        'Подтверждённый оригинал отсутствует.',
      );
    const original: StoredObject = {
      key: image.originalKey,
      etag: image.originalEtag,
      versionId: image.originalVersionId,
    };
    const stat = await this.storage.stat(original.key, original.versionId);
    if (
      stat.etag !== original.etag ||
      stat.size !== image.byteSize ||
      stat.size > this.config.maxUploadBytes
    )
      throw new ImageProcessingError(
        'ORIGINAL_CHANGED',
        'Оригинал изменился или имеет недопустимый размер.',
      );
    const bytes = await readLimited(
      await this.storage.get(original),
      this.config.maxUploadBytes,
      signal,
    );
    if (bytes.length !== image.byteSize)
      throw new ImageProcessingError(
        'IMAGE_SIZE_MISMATCH',
        'Размер оригинала не совпадает с заявленным.',
      );
    if (
      image.originalSha256 &&
      createHash('sha256').update(bytes).digest('hex') !== image.originalSha256
    )
      throw new ImageProcessingError(
        'ORIGINAL_CHANGED',
        'SHA-256 замороженного оригинала изменился.',
      );
    const source = sourceMetadata(
      bytes,
      image.contentType,
      this.config.maxSourcePixels,
    );
    const written: StoredObject[] = [];
    const variants: Prisma.ImageVariantCreateManyInput[] = [];
    let normalized: StoredObject | undefined;
    try {
      if (source.isIndexedPng) {
        signal.throwIfAborted();
        normalized = await this.processor.normalizeIndexedPng(
          original,
          source,
          signal,
        );
      }
      // Complete и retry всегда используют пропорции исходника после EXIF,
      // независимо от настроек, сохранённых старой версией в Image.presets.
      for (const plan of variantPlans(source)) {
        signal.throwIfAborted();
        const result = await this.processor.process(
          normalized ?? original,
          plan,
          signal,
        );
        signal.throwIfAborted();
        const id = randomUUID();
        const object = await this.storage.put(
          `images/variants/${image.id}/${id}.${result.format}`,
          result.bytes,
          result.mimeType,
        );
        written.push(object);
        variants.push({
          id,
          imageId: image.id,
          // Внутренний маркер для совместимости с существующей схемой/URL.
          preset: 'original',
          width: result.width,
          height: result.height,
          format: result.format,
          mimeType: result.mimeType,
          byteSize: result.bytes.length,
          objectKey: object.key,
          etag: object.etag,
          versionId: object.versionId,
        });
      }
      if (
        !(await this.jobs.succeed(job, variants, source.width, source.height))
      )
        throw new ImageProcessingError(
          'LEASE_LOST',
          'Задание передано другому обработчику.',
          true,
        );
    } catch (error) {
      // При неясном результате COMMIT не удаляем байты: транзакция могла завершиться.
      // Незавершённые объекты приватны; повтор пишет новые ключи, а не перезаписывает ready.
      if (error instanceof ImageProcessingError && error.code === 'LEASE_LOST')
        await Promise.allSettled(
          written.map((object) => this.storage.remove(object)),
        );
      throw error;
    } finally {
      // TIFF не referenced в БД/публичных URL; даже неясный COMMIT ready не мешает
      // его удалению. Lease heartbeat охватывает нормализацию и весь этот блок.
      if (normalized) await this.storage.removeTemporary(normalized);
    }
  }
}
