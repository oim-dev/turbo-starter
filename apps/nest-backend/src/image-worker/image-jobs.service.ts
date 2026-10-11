import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ImageJob, Prisma } from '../generated/prisma/client';
import { ImageConfig } from '../infrastructure/config/image-config';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { ImageProcessingError } from '../modules/images/image-error';

export interface ImageMessage {
  jobId: string;
  dispatchVersion: number;
}
export type ClaimedJob = Prisma.ImageJobGetPayload<{
  include: { image: true };
}>;

@Injectable()
export class ImageJobs {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ImageConfig,
  ) {}

  async claim(message: ImageMessage): Promise<ClaimedJob | null> {
    const now = new Date();
    const leaseToken = randomUUID();
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.imageJob.updateMany({
        where: {
          id: message.jobId,
          dispatchVersion: message.dispatchVersion,
          status: 'queued',
          availableAt: { lte: now },
          deadlineAt: { gt: now },
          attempts: { lt: this.config.maxAttempts },
        },
        data: {
          status: 'processing',
          leaseToken,
          leaseUntil: new Date(Date.now() + this.config.leaseMs),
          attempts: { increment: 1 },
        },
      });
      if (!changed.count) return null;
      const job = await tx.imageJob.findUniqueOrThrow({
        where: { id: message.jobId },
        include: { image: true },
      });
      await tx.image.update({
        where: { id: job.imageId },
        data: { status: 'processing', errorCode: null, errorMessage: null },
      });
      return job;
    });
  }

  async heartbeat(job: ClaimedJob): Promise<boolean> {
    const result = await this.prisma.imageJob.updateMany({
      where: {
        id: job.id,
        status: 'processing',
        leaseToken: job.leaseToken,
        deadlineAt: { gt: new Date() },
      },
      data: { leaseUntil: new Date(Date.now() + this.config.leaseMs) },
    });
    return result.count === 1;
  }

  async succeed(
    job: ClaimedJob,
    variants: Prisma.ImageVariantCreateManyInput[],
    width: number,
    height: number,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.imageJob.updateMany({
        where: {
          id: job.id,
          status: 'processing',
          leaseToken: job.leaseToken,
          deadlineAt: { gt: new Date() },
        },
        data: {
          status: 'ready',
          leaseToken: null,
          leaseUntil: null,
          errorCode: null,
        },
      });
      if (!result.count) return false;
      await tx.imageVariant.createMany({ data: variants });
      await tx.image.update({
        where: { id: job.imageId },
        data: {
          status: 'ready',
          width,
          height,
          errorCode: null,
          errorMessage: null,
        },
      });
      return true;
    });
  }

  async fail(
    job: ImageJob,
    error: ImageProcessingError,
    recovered = false,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ImageJob" WHERE id = ${job.id}::uuid FOR UPDATE`;
      const current = await tx.imageJob.findUniqueOrThrow({
        where: { id: job.id },
      });
      if (
        current.dispatchVersion !== job.dispatchVersion ||
        current.leaseToken !== job.leaseToken ||
        !['queued', 'processing'].includes(current.status)
      )
        return;
      const now = new Date();
      if (
        recovered &&
        current.deadlineAt > now &&
        current.leaseUntil &&
        current.leaseUntil > now
      )
        return;
      const retry =
        error.retryable &&
        current.attempts < this.config.maxAttempts &&
        current.deadlineAt > now;
      const dispatchVersion = current.dispatchVersion + (retry ? 1 : 0);
      const availableAt = retry
        ? new Date(
            Date.now() +
              Math.min(300000, 10000 * 3 ** Math.max(0, current.attempts - 1)),
          )
        : now;
      await tx.imageJob.update({
        where: { id: current.id },
        data: {
          status: retry ? 'queued' : 'failed',
          dispatchVersion,
          availableAt,
          leaseToken: null,
          leaseUntil: null,
          errorCode: error.code,
          outbox: {
            create: {
              dispatchVersion,
              destination: retry ? 'work' : 'dead',
              availableAt,
            },
          },
        },
      });
      await tx.image.update({
        where: { id: current.imageId },
        data: {
          status: retry ? 'queued' : 'failed',
          errorCode: retry ? null : error.code,
          errorMessage: retry ? null : error.message.slice(0, 512),
        },
      });
    });
  }

  async recover(): Promise<void> {
    const now = new Date();
    const jobs = await this.prisma.imageJob.findMany({
      where: {
        status: { in: ['queued', 'processing'] },
        OR: [
          { deadlineAt: { lte: now } },
          { status: 'processing', leaseUntil: { lte: now } },
        ],
      },
      take: 100,
      orderBy: { updatedAt: 'asc' },
    });
    for (const job of jobs) {
      const timeout = job.deadlineAt <= now;
      await this.fail(
        job,
        new ImageProcessingError(
          timeout ? 'PROCESSING_TIMEOUT' : 'WORKER_INTERRUPTED',
          timeout
            ? 'Превышено время ожидания обработки. Повторите задание.'
            : 'Обработка прервана. Повторите задание.',
          !timeout,
        ),
        true,
      );
    }
    await this.prisma.image.updateMany({
      where: { status: 'uploading', uploadExpiresAt: { lt: now } },
      data: {
        status: 'failed',
        errorCode: 'UPLOAD_EXPIRED',
        errorMessage: 'Время загрузки истекло. Создайте новую загрузку.',
      },
    });
  }
}
