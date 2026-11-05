import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, type ImageRealm } from '../../generated/prisma/client';
import { ImageConfig } from '../../infrastructure/config/image-config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  ImageStorage,
  type StoredObject,
} from '../../infrastructure/storage/image-storage.service';
import { effectivePermissions } from '../admin-access/admin-permissions';
import {
  CreateImageUploadDto,
  ImageCompleteDto,
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
import {
  claimImageHash,
  imageHashScope,
  imageSearchId,
  manifestFamily,
  newImagePublicId,
} from './image-identity';
import { ImageOriginalVerifier } from './image-original-verifier';
import { ImageProcessingError } from './image-error';

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
    private readonly verifier: ImageOriginalVerifier,
  ) {}

  private scope(actor: ImageActor): Prisma.ImageWhereInput {
    return actor.realm === 'admin'
      ? {}
      : { ownerRealm: 'client', ownerId: actor.id };
  }

  private async canRead(
    actor: ImageActor,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<boolean> {
    if (actor.realm === 'client') return true;
    const user = await tx.adminUser.findUnique({
      where: { id: actor.id },
      include: { accessRole: true },
    });
    return (
      !!user?.isActive &&
      effectivePermissions(user.accessRole).includes('images.read')
    );
  }

  private async findRecord(
    actor: ImageActor,
    id: string,
    uploadAccess = false,
  ): Promise<ImageRecord> {
    const scope =
      uploadAccess && actor.realm === 'admin' && !(await this.canRead(actor))
        ? { ownerRealm: actor.realm, ownerId: actor.id }
        : this.scope(actor);
    const image = await this.prisma.image.findFirst({
      where: { id, ...scope },
      include: { variants: true },
    });
    if (!image) throw new NotFoundException('Изображение не найдено.');
    return image;
  }

  private async canonical(
    actor: ImageActor,
    image: ImageRecord,
  ): Promise<ImageRecord> {
    if (!image.canonicalId) return image;
    if (!(await this.canRead(actor)))
      throw new ForbiddenException(
        'Для получения переиспользованного изображения необходимо images.read.',
      );
    return this.findRecord(actor, image.canonicalId);
  }

  private async find(actor: ImageActor, id: string): Promise<ImageRecord> {
    return this.canonical(actor, await this.findRecord(actor, id));
  }

  private async completion(
    actor: ImageActor,
    image: ImageRecord,
  ): Promise<ImageCompleteDto> {
    return {
      ...this.dto(await this.canonical(actor, image)),
      reused: image.canonicalId !== null,
    };
  }

  private dto(image: ImageRecord): ImageDto {
    // Узкая совместимость хранения: старые ready-наборы сохраняют UUID и байты,
    // но manifest включает только одну геометрию. Это не настройка обработки.
    const variantFamily = manifestFamily(image.variants);
    return {
      id: image.id,
      publicId: image.publicId,
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
        sha256: image.originalSha256,
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
                url: `${this.config.publicBaseUrl}/media/images/${image.publicId}/${variant.format}/${variant.width}x${variant.height}`,
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
    const conditions: Prisma.Sql[] = [Prisma.sql`"canonicalId" IS NULL`];
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
      const identity = imageSearchId(search);
      conditions.push(
        Prisma.sql`(filename ILIKE ${pattern} OR title ILIKE ${pattern} OR EXISTS (SELECT 1 FROM unnest(tags) AS t WHERE t ILIKE ${pattern})
          OR id::text = ${identity} OR "publicId" = ${identity}
          OR id IN (SELECT a."canonicalId" FROM "Image" a WHERE a.id::text = ${identity} OR a."publicId" = ${identity}))`,
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
    const sha256 = dto.sha256?.toLowerCase();
    if (sha256 && (await this.canRead(actor))) {
      const claim = await this.prisma.imageHashClaim.findUnique({
        where: {
          scope_sha256: {
            scope: imageHashScope({
              ownerRealm: actor.realm,
              ownerId: actor.id,
            }),
            sha256,
          },
        },
        include: { image: { include: { variants: true } } },
      });
      const existing = claim?.image;
      if (
        existing &&
        existing.originalSha256 === sha256 &&
        existing.originalKey &&
        existing.originalEtag &&
        existing.status !== 'uploading' &&
        existing.byteSize === dto.byteSize &&
        existing.contentType === dto.contentType
      )
        return { image: this.dto(existing), reused: true, upload: null };
    }
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
    let image: ImageRecord | undefined;
    for (let attempt = 0; attempt < 10; attempt++) {
      const publicId = newImagePublicId();
      try {
        image = await this.prisma.image.create({
          data: {
            id,
            publicId,
            claimedSha256: sha256,
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
        break;
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2002'
        )
          throw error;
        // Prisma 7 driver adapters не гарантируют meta.target. Подтверждаем
        // коллизию именно выбранного publicId, остальные UNIQUE не повторяем.
        const collision = await this.prisma.image.findUnique({
          where: { publicId },
          select: { id: true },
        });
        if (!collision) throw error;
      }
    }
    if (!image)
      throw new ServiceUnavailableException(
        'Не удалось выделить публичный ID. Повторите загрузку.',
      );
    return {
      image: this.dto(image),
      reused: false,
      upload: {
        url,
        method: 'PUT',
        headers: { 'Content-Type': dto.contentType },
        expiresAt: expiresAt.toISOString(),
      },
    };
  }

  async complete(actor: ImageActor, id: string): Promise<ImageCompleteDto> {
    const current = await this.findRecord(actor, id, true);
    if (current.canonicalId || current.status !== 'uploading')
      return this.completion(actor, current);
    const frozenKey = `images/originals/${id}/${randomUUID()}`;
    let frozen: StoredObject | undefined;
    let sha256: string;
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
      sha256 = await this.verifier.verify(frozen, current);
    } catch (error) {
      // Транзакция ещё не начиналась: этот уникальный key не может быть опубликован.
      await this.storage
        .remove(frozen ?? { key: frozenKey })
        .catch(() => undefined);
      // При гонке complete победитель мог уже удалить staging.
      const latest = await this.findRecord(actor, id, true);
      if (latest.canonicalId || latest.status !== 'uploading')
        return this.completion(actor, latest);
      if (error instanceof BadRequestException) throw error;
      if (error instanceof ImageProcessingError)
        throw new BadRequestException({
          code: error.code,
          message: error.message,
        });
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
    const verifiedOriginal = frozen;
    const result = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Image" WHERE id = ${id}::uuid FOR UPDATE`;
        const latest = await tx.image.findUniqueOrThrow({
          where: { id },
          include: { variants: true },
        });
        if (latest.canonicalId || latest.status !== 'uploading') return latest;
        const canonicalId = await claimImageHash(
          tx,
          imageHashScope(latest),
          sha256,
          id,
        );
        if (canonicalId !== id) {
          return tx.image.update({
            where: { id },
            data: {
              canonicalId,
              originalSha256: sha256,
              status: 'queued',
              completedAt: new Date(),
            },
            include: { variants: true },
          });
        }
        const accepted = await tx.image.update({
          where: { id },
          data: {
            status: 'queued',
            originalSha256: sha256,
            originalKey: verifiedOriginal.key,
            originalEtag: verifiedOriginal.etag,
            originalVersionId: verifiedOriginal.versionId,
            completedAt: new Date(),
            errorCode: null,
            errorMessage: null,
          },
          include: { variants: true },
        });
        await tx.imageJob.create({
          data: {
            imageId: id,
            deadlineAt: new Date(Date.now() + this.config.jobTimeoutMs),
            outbox: { create: { dispatchVersion: 1 } },
          },
        });
        return accepted;
      },
      { isolationLevel: 'ReadCommitted' },
    );
    if (result.originalKey !== frozen.key)
      await this.storage.remove(frozen).catch(() => undefined);
    await this.storage
      .remove({ key: current.stagingKey })
      .catch(() => undefined);
    return this.completion(actor, result);
  }

  async update(
    actor: ImageActor,
    id: string,
    dto: UpdateImageDto,
  ): Promise<ImageDto> {
    const data = {
      ...(dto.title !== undefined ? { title: normalizedText(dto.title) } : {}),
      ...(dto.folder !== undefined
        ? { folder: normalizeFolder(dto.folder) }
        : {}),
      ...(dto.tags !== undefined ? { tags: normalizeTags(dto.tags) } : {}),
    };
    const result = await this.prisma.$transaction(
      async (tx) => {
        // Только Image locks: не берём job после Image (backfill: job → Image).
        // canonicalId читаем после ожидания lock, чтобы не записать скрытый alias.
        while (true) {
          await tx.$queryRaw`SELECT id FROM "Image" WHERE id = ${id}::uuid FOR UPDATE`;
          const image = await tx.image.findFirst({
            where: { id, ...this.scope(actor) },
            select: { canonicalId: true },
          });
          if (!image) throw new NotFoundException('Изображение не найдено.');
          if (image.canonicalId) {
            if (!(await this.canRead(actor, tx)))
              throw new ForbiddenException(
                'Для получения переиспользованного изображения необходимо images.read.',
              );
            id = image.canonicalId;
            continue;
          }
          return tx.image.update({
            where: { id, AND: this.scope(actor) },
            data,
            include: { variants: true },
          });
        }
      },
      { isolationLevel: 'ReadCommitted' },
    );
    return this.dto(result);
  }

  async retry(actor: ImageActor, id: string): Promise<ImageDto> {
    id = (await this.canonical(actor, await this.findRecord(actor, id, true)))
      .id;
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ImageJob" WHERE "imageId" = ${id}::uuid FOR UPDATE`;
      const job = await tx.imageJob.findUnique({ where: { imageId: id } });
      const current = await tx.image.findUniqueOrThrow({ where: { id } });
      if (current.canonicalId)
        throw new ConflictException(
          'Изображение объединено при backfill. Обновите метаданные и повторите retry канонического изображения.',
        );
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

  async publicReadableVariant(
    publicId: string,
    format: string,
    dimensions: string,
  ) {
    if (
      !/^[0-9A-Za-z]{8}$/.test(publicId) ||
      !/^[a-z0-9]{1,20}$/.test(format) ||
      !/^[1-9][0-9]{0,8}x[1-9][0-9]{0,8}$/.test(dimensions)
    )
      throw new NotFoundException('Готовый вариант не найден.');
    const image = await this.prisma.image.findUnique({
      where: { publicId },
      include: { variants: true },
    });
    const [width, height] = dimensions.split('x').map(Number);
    const family = image && manifestFamily(image.variants);
    const variant =
      image?.status === 'ready' &&
      image.variants.find(
        (item) =>
          item.preset === family &&
          item.format === format &&
          item.width === width &&
          item.height === height,
      );
    if (!variant) throw new NotFoundException('Готовый вариант не найден.');
    return variant;
  }
}
