import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, type ImageRealm } from '../../generated/prisma/client';
import { ImageConfig } from '../../infrastructure/config/image-config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ImageStorage } from '../../infrastructure/storage/image-storage.service';
import {
  CreateImageUploadDto,
  ImageDto,
  ImageFacetDto,
  ImageFacetsDto,
  ImageListDto,
  ImageListQueryDto,
  ImageOriginalLinkDto,
  ImageUploadDto,
  UpdateImageDto,
} from './image.dto';
import {
  normalizeFolder,
  normalizeTags,
  normalizedText,
} from './image-normalization';

export interface ImageActor {
  id: string;
  realm: ImageRealm;
}
type ImageRecord = Prisma.ImageGetPayload<{ include: { variants: true } }>;

@Injectable()
export class ImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ImageStorage,
    private readonly config: ImageConfig,
  ) {}

  private scope(actor: ImageActor): Prisma.ImageWhereInput {
    return actor.realm === 'admin'
      ? {}
      : { ownerRealm: 'client', ownerId: actor.id };
  }

  private async find(actor: ImageActor, id: string): Promise<ImageRecord> {
    const image = await this.prisma.image.findFirst({
      where: { id, ...this.scope(actor) },
      include: { variants: true },
    });
    if (!image) throw new NotFoundException('Изображение не найдено.');
    return image;
  }

  private dto(image: ImageRecord): ImageDto {
    // Узкая совместимость хранения: старые ready-наборы сохраняют UUID и байты,
    // но manifest включает только одну геометрию. Это не настройка обработки.
    const variantFamily = ['original', 'square', 'landscape'].find((family) =>
      image.variants.some((variant) => variant.preset === family),
    );
    return {
      id: image.id,
      filename: image.filename,
      title: image.title,
      folder: image.folder,
      tags: image.tags,
      status: image.status,
      createdAt: image.createdAt.toISOString(),
      updatedAt: image.updatedAt.toISOString(),
      uploadedBy: {
        id: image.ownerId,
        realm: image.ownerRealm,
        name: image.ownerName,
        login: image.ownerLogin,
      },
      original: {
        contentType: image.contentType,
        byteSize: image.byteSize,
        width: image.width,
        height: image.height,
      },
      variants:
        image.status === 'ready'
          ? image.variants
              .filter((variant) => variant.preset === variantFamily)
              .sort(
                (a, b) => a.width - b.width || a.format.localeCompare(b.format),
              )
              .map((variant) => ({
                id: variant.id,
                width: variant.width,
                height: variant.height,
                format: variant.format,
                mimeType: variant.mimeType,
                byteSize: variant.byteSize,
                url: `${this.config.publicBaseUrl}/media/images/${image.id}/${variant.id}`,
              }))
          : [],
      error: image.errorCode
        ? {
            code: image.errorCode,
            message: image.errorMessage ?? 'Обработка не завершена.',
          }
        : null,
    };
  }

  async get(actor: ImageActor, id: string): Promise<ImageDto> {
    return this.dto(await this.find(actor, id));
  }

  private filter(actor: ImageActor, query: ImageListQueryDto): Prisma.Sql {
    if (query.unfiled && query.folder)
      throw new BadRequestException(
        'Нельзя одновременно задавать folder и unfiled.',
      );
    const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (actor.realm === 'client')
      conditions.push(
        Prisma.sql`"ownerRealm" = 'client' AND "ownerId" = ${actor.id}::uuid`,
      );
    if (query.unfiled) conditions.push(Prisma.sql`folder IS NULL`);
    if (query.folder !== undefined) {
      const folder = normalizeFolder(query.folder);
      conditions.push(
        folder ? Prisma.sql`folder = ${folder}` : Prisma.sql`folder IS NULL`,
      );
    }
    if (query.status)
      conditions.push(Prisma.sql`status = ${query.status}::"ImageStatus"`);
    if (query.tag)
      conditions.push(Prisma.sql`${normalizeTags([query.tag])[0]} = ANY(tags)`);
    const search = query.search && normalizedText(query.search);
    if (search) {
      const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
      conditions.push(
        Prisma.sql`(filename ILIKE ${pattern} OR title ILIKE ${pattern} OR EXISTS (SELECT 1 FROM unnest(tags) AS t WHERE t ILIKE ${pattern}))`,
      );
    }
    return Prisma.join(conditions, ' AND ');
  }

  async list(
    actor: ImageActor,
    query: ImageListQueryDto,
  ): Promise<ImageListDto> {
    const where = this.filter(actor, query);
    return this.prisma.$transaction(
      async (tx) => {
        const [count] = await tx.$queryRaw<
          { total: number }[]
        >`SELECT count(*)::int AS total FROM "Image" WHERE ${where}`;
        const ids = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM "Image" WHERE ${where} ORDER BY "createdAt" DESC, id DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`;
        const images = await tx.image.findMany({
          where: { id: { in: ids.map((row) => row.id) } },
          include: { variants: true },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
        return {
          items: images.map((image) => this.dto(image)),
          total: count?.total ?? 0,
          page: query.page,
          pageSize: query.pageSize,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async facets(actor: ImageActor): Promise<ImageFacetsDto> {
    const where = this.filter(actor, new ImageListQueryDto());
    return this.prisma.$transaction(
      async (tx) => {
        const folders = await tx.$queryRaw<
          ImageFacetDto[]
        >`SELECT folder AS name, count(*)::int AS count FROM "Image" WHERE ${where} AND folder IS NOT NULL GROUP BY folder ORDER BY folder`;
        const tags = await tx.$queryRaw<
          ImageFacetDto[]
        >`SELECT t AS name, count(*)::int AS count FROM "Image", unnest(tags) AS t WHERE ${where} GROUP BY t ORDER BY t`;
        const [counts] = await tx.$queryRaw<
          { total: number; unfiledCount: number }[]
        >`SELECT count(*)::int AS total, count(*) FILTER (WHERE folder IS NULL)::int AS "unfiledCount" FROM "Image" WHERE ${where}`;
        return {
          folders,
          tags,
          total: counts?.total ?? 0,
          unfiledCount: counts?.unfiledCount ?? 0,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async createUpload(
    actor: ImageActor,
    dto: CreateImageUploadDto,
  ): Promise<ImageUploadDto> {
    if (dto.byteSize > this.config.maxUploadBytes)
      throw new PayloadTooLargeException(
        'Изображение превышает допустимый размер.',
      );
    const filename = normalizedText(dto.filename).replace(/.*[/\\]/, '');
    if (!filename)
      throw new BadRequestException('Имя файла не должно быть пустым.');
    const owner =
      actor.realm === 'admin'
        ? await this.prisma.adminUser.findUniqueOrThrow({
            where: { id: actor.id },
          })
        : await this.prisma.clientUser.findUniqueOrThrow({
            where: { id: actor.id },
          });
    const id = randomUUID();
    const stagingKey = `images/staging/${id}/${randomUUID()}`;
    const expiresAt = new Date(
      Date.now() + this.config.uploadTtlSeconds * 1000,
    );
    const url = await this.storage.presignUpload(stagingKey);
    const image = await this.prisma.image.create({
      data: {
        id,
        filename,
        title: normalizedText(dto.title ?? filename),
        folder: normalizeFolder(dto.folder),
        tags: normalizeTags(dto.tags ?? []),
        // Обязательный legacy-столбец; API не принимает режимы геометрии.
        presets: ['original'],
        ownerId: actor.id,
        ownerRealm: actor.realm,
        ownerName: owner.name,
        ownerLogin: owner.login,
        byteSize: dto.byteSize,
        contentType: dto.contentType,
        stagingKey,
        uploadExpiresAt: expiresAt,
      },
      include: { variants: true },
    });
    return {
      image: this.dto(image),
      upload: {
        url,
        method: 'PUT',
        headers: { 'Content-Type': dto.contentType },
        expiresAt: expiresAt.toISOString(),
      },
    };
  }

  async complete(actor: ImageActor, id: string): Promise<ImageDto> {
    const current = await this.find(actor, id);
    if (current.status !== 'uploading') return this.dto(current);
    const frozenKey = `images/originals/${id}/${randomUUID()}`;
    let frozen;
    try {
      const stat = await this.storage.stat(current.stagingKey);
      if (
        stat.size !== current.byteSize ||
        stat.size > this.config.maxUploadBytes
      )
        throw new BadRequestException({
          code: 'IMAGE_SIZE_MISMATCH',
          message: 'Размер загруженного файла не совпадает с заявленным.',
        });
      frozen = await this.storage.freeze(
        current.stagingKey,
        frozenKey,
        stat.etag,
        stat.versionId,
      );
    } catch (error) {
      // При гонке complete победитель мог уже удалить staging.
      const latest = await this.find(actor, id);
      if (latest.status !== 'uploading') return this.dto(latest);
      if (error instanceof BadRequestException) throw error;
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        ['NoSuchKey', 'NotFound', 'PreconditionFailed'].includes(
          String(error.code),
        )
      )
        throw new ConflictException({
          code: 'UPLOAD_NOT_AVAILABLE',
          message:
            'Загрузка отсутствует или изменилась. Завершите PUT и повторите подтверждение.',
        });
      throw new ServiceUnavailableException(
        'Хранилище временно недоступно. Повторите подтверждение.',
      );
    }
    // Сеть вне транзакции. У каждой попытки новый key; проигравший никогда не
    // перезаписывает оригинал, на который уже ссылается успешно созданный job.
    const result = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.image.updateMany({
        where: { id, status: 'uploading', ...this.scope(actor) },
        data: {
          status: 'queued',
          originalKey: frozen.key,
          originalEtag: frozen.etag,
          originalVersionId: frozen.versionId,
          completedAt: new Date(),
          errorCode: null,
          errorMessage: null,
        },
      });
      if (changed.count)
        await tx.imageJob.create({
          data: {
            imageId: id,
            deadlineAt: new Date(Date.now() + this.config.jobTimeoutMs),
            outbox: { create: { dispatchVersion: 1 } },
          },
        });
      return tx.image.findUniqueOrThrow({
        where: { id },
        include: { variants: true },
      });
    });
    if (result.originalKey !== frozen.key)
      await this.storage.remove(frozen).catch(() => undefined);
    else
      await this.storage
        .remove({ key: current.stagingKey })
        .catch(() => undefined);
    return this.dto(result);
  }

  async update(
    actor: ImageActor,
    id: string,
    dto: UpdateImageDto,
  ): Promise<ImageDto> {
    const result = await this.prisma.image.updateMany({
      where: { id, ...this.scope(actor) },
      data: {
        ...(dto.title !== undefined
          ? { title: normalizedText(dto.title) }
          : {}),
        ...(dto.folder !== undefined
          ? { folder: normalizeFolder(dto.folder) }
          : {}),
        ...(dto.tags !== undefined ? { tags: normalizeTags(dto.tags) } : {}),
      },
    });
    if (!result.count) throw new NotFoundException('Изображение не найдено.');
    return this.get(actor, id);
  }

  async retry(actor: ImageActor, id: string): Promise<ImageDto> {
    await this.find(actor, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ImageJob" WHERE "imageId" = ${id}::uuid FOR UPDATE`;
      const job = await tx.imageJob.findUnique({ where: { imageId: id } });
      if (!job)
        throw new ConflictException(
          'Подтверждённого задания нет. Загрузите изображение заново.',
        );
      if (job.status !== 'failed')
        throw new ConflictException(
          'Повтор доступен только для неудавшегося задания.',
        );
      const dispatchVersion = job.dispatchVersion + 1;
      await tx.imageJob.update({
        where: { id: job.id },
        data: {
          status: 'queued',
          attempts: 0,
          dispatchVersion,
          availableAt: new Date(),
          deadlineAt: new Date(Date.now() + this.config.jobTimeoutMs),
          leaseToken: null,
          leaseUntil: null,
          errorCode: null,
          outbox: { create: { dispatchVersion } },
        },
      });
      await tx.image.update({
        where: { id },
        data: { status: 'queued', errorCode: null, errorMessage: null },
      });
    });
    return this.get(actor, id);
  }

  async original(actor: ImageActor, id: string): Promise<ImageOriginalLinkDto> {
    const image = await this.find(actor, id);
    if (!image.originalKey || !image.originalEtag)
      throw new ConflictException('Оригинал ещё не подтверждён.');
    const url = await this.storage.presignOriginal(
      {
        key: image.originalKey,
        etag: image.originalEtag,
        versionId: image.originalVersionId,
      },
      image.filename,
    );
    return {
      url,
      expiresAt: new Date(
        Date.now() + this.config.originalTtlSeconds * 1000,
      ).toISOString(),
    };
  }

  async publicVariant(id: string, variantId: string) {
    const variant = await this.prisma.imageVariant.findFirst({
      where: { id: variantId, imageId: id, image: { status: 'ready' } },
    });
    if (!variant) throw new NotFoundException('Готовый вариант не найден.');
    return variant;
  }
}
