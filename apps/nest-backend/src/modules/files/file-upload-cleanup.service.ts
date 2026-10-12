import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ObjectStorage } from '../../infrastructure/storage/object-storage.service';

/** Очищает части истёкших multipart-попыток, не затрагивая опубликованные blobs. */
@Injectable()
export class FileUploadCleanup implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FileUploadCleanup.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorage,
  ) {}

  onModuleInit(): void {
    void this.clean();
    this.timer = setInterval(() => void this.clean(), 60000);
    this.timer.unref();
  }
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async clean(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const expired = await this.prisma.fileUpload.findMany({
        where: {
          expiresAt: { lte: now },
          resultVersionId: null,
          multipartUploadId: { not: null },
        },
        take: 100,
        orderBy: { expiresAt: 'asc' },
      });
      for (const upload of expired) {
        if (upload.multipartUploadId === null) continue;
        // CAS не даст отменить попытку, которую другой запрос уже продлил.
        const claim = await this.prisma.fileUpload.updateMany({
          where: {
            id: upload.id,
            expiresAt: { lte: now },
            resultVersionId: null,
            multipartUploadId: upload.multipartUploadId,
          },
          data: { expiresAt: new Date(0) },
        });
        if (claim.count === 0) continue;
        try {
          await this.storage.abortMultipart(
            upload.stagingKey,
            upload.multipartUploadId,
          );
        } catch (error) {
          if (!(
            error &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === 'NoSuchUpload'
          ))
            throw error;
        }
        await this.prisma.fileUpload.updateMany({
          where: {
            id: upload.id,
            resultVersionId: null,
            multipartUploadId: upload.multipartUploadId,
            expiresAt: { lte: now },
          },
          data: { multipartUploadId: null },
        });
      }
    } catch {
      this.logger.warn('File upload cleanup will be retried.');
    } finally {
      this.running = false;
    }
  }
}
