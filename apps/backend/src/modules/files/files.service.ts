import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  Prisma,
  type FileBlob,
  type FileUpload,
} from '../../generated/prisma/client';
import { FileConfig } from '../../infrastructure/config/file-config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  ObjectStorage,
  type StoredObject,
} from '../../infrastructure/storage/object-storage.service';
import {
  effectivePermissions,
  requireAdminPermission,
  type AdminPrincipal,
} from '../admin-access/admin-permissions';
import {
  CreateFileUploadDto,
  FileCompleteDto,
  FileDto,
  FileFacetDto,
  FileFacetsDto,
  FileListDto,
  FileListQueryDto,
  FileUploadPartDto,
  FileUploadDto,
  FileVersionDto,
  UpdateFileDto,
} from './file.dto';
import {
  fileFolder,
  fileContentType,
  fileFormat,
  fileName,
  filePublicId,
  fileSearchId,
  fileTags,
  fileText,
} from './file-format';
import { FileVerifier } from './file-verifier';
import { fileUploadPartSize } from './file-upload-plan';
import { MultipartUploadIncompleteError } from '../../infrastructure/storage/multipart-client';

const FILE_INCLUDE = {
  currentVersion: { include: { blob: true } },
} as const satisfies Prisma.StoredFileInclude;
type FileRecord = Prisma.StoredFileGetPayload<{ include: typeof FILE_INCLUDE }>;
type VersionRecord = Prisma.FileVersionGetPayload<{ include: { blob: true } }>;
type FileDelivery = {
  version: VersionRecord;
  filename: string;
  modifiedAt: Date;
};
type VersionInput = Pick<
  FileUpload,
  | 'filename'
  | 'extension'
  | 'contentType'
  | 'ownerId'
  | 'ownerName'
  | 'ownerLogin'
>;

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorage,
    private readonly config: FileConfig,
    private readonly verifier: FileVerifier,
  ) {}

  private url(publicId: string, filename: string): string {
    return `${this.config.publicBaseUrl}/files/${publicId}/${encodeURIComponent(filename)}`;
  }

  private dto(file: FileRecord): FileDto {
    const status =
      file.status === 'uploading' &&
      file.uploadExpiresAt.getTime() <= Date.now()
        ? 'expired'
        : file.status;
    const url =
      status === 'ready' ? this.url(file.publicId, file.publicFilename) : null;
    return {
      id: file.id,
      publicId: file.publicId,
      filename: file.filename,
      title: file.title,
      folder: file.folder,
      tags: file.tags,
      status,
      extension: file.extension,
      contentType: fileContentType(file.extension, file.contentType),
      byteSize: Number(file.byteSize),
      sha256: file.currentVersion?.blob.sha256 ?? null,
      currentVersion: file.currentVersion?.number ?? 0,
      url,
      downloadUrl: url ? `${url}?download=1` : null,
      uploadedBy: {
        id: file.ownerId,
        name: file.ownerName,
        login: file.ownerLogin,
      },
      uploadExpiresAt: file.uploadExpiresAt.toISOString(),
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
    };
  }

  private versionDto(version: VersionRecord, publicId: string): FileVersionDto {
    const url = `${this.url(publicId, version.filename)}?version=${version.number}`;
    return {
      id: version.id,
      number: version.number,
      filename: version.filename,
      extension: version.extension,
      contentType: fileContentType(version.extension, version.contentType),
      byteSize: Number(version.blob.byteSize),
      sha256: version.blob.sha256,
      url,
      downloadUrl: `${url}&download=1`,
      createdAt: version.createdAt.toISOString(),
      uploadedBy: {
        id: version.ownerId,
        name: version.ownerName,
        login: version.ownerLogin,
      },
    };
  }

  private async find(
    id: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<FileRecord> {
    const file = await tx.storedFile.findUnique({
      where: { id },
      include: FILE_INCLUDE,
    });
    if (!file) throw new NotFoundException('Файл не найден.');
    return file;
  }

  async get(id: string): Promise<FileDto> {
    return this.dto(await this.find(id));
  }

  async versions(id: string): Promise<FileVersionDto[]> {
    const file = await this.find(id);
    const versions = await this.prisma.fileVersion.findMany({
      where: { fileId: id },
      include: { blob: true },
      orderBy: { number: 'desc' },
    });
    return versions.map((version) => this.versionDto(version, file.publicId));
  }

  private filter(query: FileListQueryDto, now: Date): Prisma.Sql {
    if (query.unfiled && query.folder)
      throw new BadRequestException(
        'Нельзя одновременно задавать folder и unfiled.',
      );
    const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (query.unfiled) conditions.push(Prisma.sql`folder IS NULL`);
    if (query.folder !== undefined) {
      const folder = fileFolder(query.folder);
      conditions.push(
        folder ? Prisma.sql`folder = ${folder}` : Prisma.sql`folder IS NULL`,
      );
    }
    if (query.tag)
      conditions.push(Prisma.sql`${fileTags([query.tag])[0]} = ANY(tags)`);
    if (query.extension)
      conditions.push(Prisma.sql`extension = ${query.extension}`);
    if (query.status === 'ready') conditions.push(Prisma.sql`status = 'ready'`);
    if (query.status === 'uploading')
      conditions.push(
        Prisma.sql`status = 'uploading' AND "uploadExpiresAt" > ${now}`,
      );
    if (query.status === 'expired')
      conditions.push(
        Prisma.sql`(status = 'expired' OR (status = 'uploading' AND "uploadExpiresAt" <= ${now}))`,
      );
    const search = query.search && fileText(query.search);
    if (search) {
      const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
      const identity = fileSearchId(search);
      conditions.push(
        Prisma.sql`(filename ILIKE ${pattern} OR title ILIKE ${pattern} OR EXISTS (SELECT 1 FROM unnest(tags) AS t WHERE t ILIKE ${pattern}) OR id::text = ${identity} OR "publicId" = ${identity} OR EXISTS (SELECT 1 FROM "FileVersion" v WHERE v."fileId" = "StoredFile".id AND v.filename ILIKE ${pattern}))`,
      );
    }
    return Prisma.join(conditions, ' AND ');
  }

  async list(query: FileListQueryDto): Promise<FileListDto> {
    const where = this.filter(query, new Date());
    return this.prisma.$transaction(
      async (tx) => {
        const [count] = await tx.$queryRaw<
          { total: number }[]
        >`SELECT count(*)::int AS total FROM "StoredFile" WHERE ${where}`;
        const ids = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM "StoredFile" WHERE ${where} ORDER BY "createdAt" DESC, id DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`;
        const files = await tx.storedFile.findMany({
          where: { id: { in: ids.map((file) => file.id) } },
          include: FILE_INCLUDE,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
        return {
          items: files.map((file) => this.dto(file)),
          total: count?.total ?? 0,
          page: query.page,
          pageSize: query.pageSize,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async facets(): Promise<FileFacetsDto> {
    return this.prisma.$transaction(
      async (tx) => {
        const folders = await tx.$queryRaw<
          FileFacetDto[]
        >`SELECT folder AS name, count(*)::int AS count FROM "StoredFile" WHERE folder IS NOT NULL GROUP BY folder ORDER BY folder`;
        const tags = await tx.$queryRaw<
          FileFacetDto[]
        >`SELECT t AS name, count(*)::int AS count FROM "StoredFile", unnest(tags) AS t GROUP BY t ORDER BY t`;
        const [counts] = await tx.$queryRaw<
          { total: number; unfiledCount: number }[]
        >`SELECT count(*)::int AS total, count(*) FILTER (WHERE folder IS NULL)::int AS "unfiledCount" FROM "StoredFile"`;
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

  private async uploader(tx: Prisma.TransactionClient, actor: AdminPrincipal) {
    const owner = await requireAdminPermission(tx, actor, 'files.upload');
    if (!effectivePermissions(owner.accessRole).includes('files.read'))
      throw new ForbiddenException(
        'Для загрузки и дедупликации требуется files.read.',
      );
    return owner;
  }

  private compatible(
    blob: FileBlob,
    input: { byteSize: number | bigint },
  ): void {
    if (blob.byteSize !== BigInt(input.byteSize))
      throw new BadRequestException({
        code: 'FILE_SIZE_MISMATCH',
        message: 'Размер не соответствует содержимому с этим SHA-256.',
      });
  }

  private async publishVersion(
    tx: Prisma.TransactionClient,
    fileId: string,
    blob: FileBlob,
    input: VersionInput,
  ): Promise<VersionRecord> {
    await tx.$queryRaw`SELECT id FROM "StoredFile" WHERE id = ${fileId}::uuid FOR UPDATE`;
    const file = await this.find(fileId, tx);
    if (file.currentVersion?.blobId === blob.id) return file.currentVersion;
    const latest = await tx.fileVersion.findFirst({
      where: { fileId },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const version = await tx.fileVersion.create({
      data: {
        fileId,
        blobId: blob.id,
        number: (latest?.number ?? 0) + 1,
        ...input,
        contentType: fileContentType(input.extension, input.contentType),
      },
      include: { blob: true },
    });
    await tx.storedFile.update({
      where: { id: fileId },
      data: {
        extension: input.extension,
        contentType: version.contentType,
        byteSize: blob.byteSize,
        currentVersionId: version.id,
        status: 'ready',
        completedAt: file.completedAt ?? new Date(),
      },
    });
    return version;
  }

  async createUpload(
    actor: AdminPrincipal,
    input: CreateFileUploadDto,
    targetId?: string,
  ): Promise<FileUploadDto> {
    if (!Number.isSafeInteger(input.byteSize))
      throw new BadRequestException(
        'Размер должен быть точно представимым целым числом байтов.',
      );
    const filename = fileName(fileText(input.filename).replace(/.*[/\\]/, ''));
    const format = fileFormat(filename);
    const metadata = {
      title: fileName(input.title ?? filename),
      folder: fileFolder(input.folder),
      tags: fileTags(input.tags ?? []),
    };
    const uploadId = randomUUID();
    const stagingKey = `files/staging/${uploadId}`;
    const partSize = fileUploadPartSize(input.byteSize);
    const expiresAt = new Date(
      Date.now() + this.config.uploadTtlSeconds * 1000,
    );
    // Подпись не даёт доступа к байтам, пока API не вернул её после транзакции.
    let url: string | null = null;
    try {
      if (partSize === null)
        url = await this.storage.presignUpload(
          stagingKey,
          this.config.uploadTtlSeconds,
        );
    } catch {
      throw new ServiceUnavailableException(
        'Не удалось подготовить загрузку в хранилище.',
      );
    }
    for (let attempt = 0; attempt < 10; attempt++) {
      const publicId = filePublicId();
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const owner = await this.uploader(tx, actor);
            const versionInput = {
              filename,
              ...format,
              ownerId: owner.id,
              ownerName: owner.name,
              ownerLogin: owner.login,
            };
            let file = targetId ? await this.find(targetId, tx) : undefined;
            if (file && file.status !== 'ready')
              throw new ConflictException(
                'Сначала завершите первую загрузку документа.',
              );
            const blob = await tx.fileBlob.findUnique({
              where: { sha256: input.sha256 },
            });
            if (blob) {
              this.compatible(blob, { byteSize: input.byteSize });
              // Единый порядок блокировок: admin → upload (если есть) → blob → file.
              await tx.$queryRaw`SELECT id FROM "FileBlob" WHERE id = ${blob.id}::uuid FOR UPDATE`;
              const version = file
                ? await this.publishVersion(tx, file.id, blob, versionInput)
                : await tx.fileVersion.findFirst({
                    where: { blobId: blob.id },
                    include: { blob: true },
                    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                  });
              if (version) {
                file = await this.find(version.fileId, tx);
                return {
                  file: this.dto(file),
                  version: this.versionDto(version, file.publicId),
                  reused: true,
                  uploadId: null,
                  upload: null,
                };
              }
            }
            file ??= await tx.storedFile.create({
              data: {
                publicId,
                ...versionInput,
                ...metadata,
                filename: metadata.title,
                publicFilename: metadata.title,
                byteSize: BigInt(input.byteSize),
                uploadExpiresAt: expiresAt,
              },
              include: FILE_INCLUDE,
            });
            await tx.fileUpload.create({
              data: {
                id: uploadId,
                fileId: file.id,
                isNewFile: targetId === undefined,
                ...versionInput,
                byteSize: BigInt(input.byteSize),
                multipartPartSize: partSize === null ? null : BigInt(partSize),
                claimedSha256: input.sha256,
                stagingKey,
                expiresAt,
              },
            });
            return {
              file: this.dto(file),
              version: null,
              reused: false,
              uploadId,
              upload: {
                url,
                method: partSize === null ? 'PUT' : 'MULTIPART',
                partSize,
                headers: { 'Content-Type': format.contentType },
                expiresAt: expiresAt.toISOString(),
              },
            };
          },
          { isolationLevel: 'ReadCommitted' },
        );
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2002'
        )
          throw error;
        if (
          !(await this.prisma.storedFile.findUnique({
            where: { publicId },
            select: { id: true },
          }))
        )
          throw error;
      }
    }
    throw new ServiceUnavailableException(
      'Не удалось выделить публичный ID файла.',
    );
  }

  async part(id: string, part: number): Promise<FileUploadPartDto> {
    const current = await this.prisma.fileUpload.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Загрузка не найдена.');
    if (current.resultVersionId)
      throw new ConflictException('Загрузка уже подтверждена.');
    if (current.expiresAt.getTime() <= Date.now()) this.expired();
    const partSize = current.multipartPartSize;
    if (
      partSize === null ||
      !Number.isInteger(part) ||
      part < 1 ||
      BigInt(part) > (current.byteSize + partSize - 1n) / partSize
    )
      throw new BadRequestException('Некорректный номер части.');
    let storageId = current.multipartUploadId;
    try {
      if (storageId === null) {
        const candidate = await this.storage.startMultipart(
          current.stagingKey,
          fileContentType(current.extension, current.contentType),
        );
        // Инициализация S3 вне транзакции, CAS сохраняет единственную session.
        // При неясной записи candidate не удаляем до подтверждения результата.
        const claimed = await this.prisma.fileUpload.updateMany({
          where: {
            id,
            multipartUploadId: null,
            resultVersionId: null,
            expiresAt: { gt: new Date() },
          },
          data: { multipartUploadId: candidate },
        });
        if (claimed.count === 1) storageId = candidate;
        else {
          const latest = await this.prisma.fileUpload.findUniqueOrThrow({
            where: { id },
          });
          await this.storage
            .abortMultipart(current.stagingKey, candidate)
            .catch(() => undefined);
          storageId = latest.multipartUploadId;
          if (storageId === null || latest.expiresAt.getTime() <= Date.now())
            this.expired();
          if (latest.resultVersionId)
            throw new ConflictException('Загрузка уже подтверждена.');
        }
      }
      const uploadExpiresAt = new Date(
        Date.now() + this.config.uploadTtlSeconds * 1000,
      );
      const renewed = await this.prisma.fileUpload.updateMany({
        where: { id, resultVersionId: null, expiresAt: { gt: new Date() } },
        data: { expiresAt: uploadExpiresAt },
      });
      if (renewed.count === 0) this.expired();
      if (current.isNewFile)
        await this.prisma.storedFile.updateMany({
          where: { id: current.fileId, status: 'uploading' },
          data: { uploadExpiresAt },
        });
      const url = await this.storage.presignPart(
        current.stagingKey,
        storageId,
        part,
        this.config.partUrlTtlSeconds,
      );
      return {
        url,
        headers: {},
        expiresAt: new Date(
          Date.now() + this.config.partUrlTtlSeconds * 1000,
        ).toISOString(),
        uploadExpiresAt: uploadExpiresAt.toISOString(),
      };
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new ServiceUnavailableException(
        'Не удалось подготовить часть загрузки.',
      );
    }
  }

  private async result(upload: FileUpload): Promise<FileCompleteDto> {
    if (!upload.resultVersionId)
      throw new Error('Completed upload has no version');
    const version = await this.prisma.fileVersion.findUniqueOrThrow({
      where: { id: upload.resultVersionId },
      include: { blob: true },
    });
    const file = await this.find(version.fileId);
    return {
      file: this.dto(file),
      version: this.versionDto(version, file.publicId),
      reused: upload.reused,
    };
  }

  async complete(actor: AdminPrincipal, id: string): Promise<FileCompleteDto> {
    const current = await this.prisma.fileUpload.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Загрузка не найдена.');
    if (current.resultVersionId) return this.result(current);
    if (current.expiresAt.getTime() <= Date.now()) this.expired();
    const frozenKey = `files/objects/${randomUUID()}`;
    let frozen: StoredObject | undefined;
    let sha256: string;
    try {
      if (current.multipartPartSize !== null) {
        if (!current.multipartUploadId)
          throw new MultipartUploadIncompleteError();
        await this.storage.finishMultipart(
          current.stagingKey,
          current.multipartUploadId,
          current.byteSize,
          current.multipartPartSize,
        );
      }
      const stat = await this.storage.stat(current.stagingKey);
      if (BigInt(stat.size) !== current.byteSize)
        throw new BadRequestException({
          code: 'FILE_SIZE_MISMATCH',
          message: 'Размер файла не совпадает с заявленным.',
        });
      frozen = await this.storage.freeze(
        current.stagingKey,
        frozenKey,
        stat.etag,
        stat.versionId,
        fileContentType(current.extension, current.contentType),
      );
      sha256 = await this.verifier.verify(frozen, current);
    } catch (error) {
      await this.storage
        .remove(frozen ?? { key: frozenKey })
        .catch(() => undefined);
      const latest = await this.prisma.fileUpload.findUniqueOrThrow({
        where: { id },
      });
      if (latest.resultVersionId) return this.result(latest);
      if (latest.expiresAt.getTime() <= Date.now()) this.expired();
      if (error instanceof BadRequestException) throw error;
      if (error instanceof MultipartUploadIncompleteError)
        throw new ConflictException({
          code: 'UPLOAD_NOT_AVAILABLE',
          message: 'Переданы не все части файла. Продолжите загрузку.',
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
            'Сначала завершите передачу файла, затем повторите подтверждение.',
        });
      throw new ServiceUnavailableException(
        'Хранилище временно недоступно. Повторите подтверждение.',
      );
    }
    const object = frozen;
    // При неясном COMMIT не удаляем object: он мог стать опубликованным blob.
    const saved = await this.prisma.$transaction(
      async (tx) => {
        await this.uploader(tx, actor);
        await tx.$queryRaw`SELECT id FROM "FileUpload" WHERE id = ${id}::uuid FOR UPDATE`;
        const latest = await tx.fileUpload.findUniqueOrThrow({ where: { id } });
        if (latest.resultVersionId) {
          const version = await tx.fileVersion.findUniqueOrThrow({
            where: { id: latest.resultVersionId },
            include: { blob: true },
          });
          return { upload: latest, objectKey: version.blob.objectKey };
        }
        if (latest.expiresAt.getTime() <= Date.now()) this.expired();
        await tx.fileBlob.createMany({
          data: [
            {
              id: randomUUID(),
              sha256,
              byteSize: latest.byteSize,
              extension: latest.extension,
              objectKey: object.key,
              objectEtag: object.etag,
              objectVersionId: object.versionId,
            },
          ],
          skipDuplicates: true,
        });
        const blob = await tx.fileBlob.findUniqueOrThrow({ where: { sha256 } });
        await tx.$queryRaw`SELECT id FROM "FileBlob" WHERE id = ${blob.id}::uuid FOR UPDATE`;
        this.compatible(blob, latest);
        const existing = latest.isNewFile
          ? await tx.fileVersion.findFirst({
              where: { blobId: blob.id },
              include: { blob: true },
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            })
          : null;
        const version =
          existing ??
          (await this.publishVersion(tx, latest.fileId, blob, {
            filename: latest.filename,
            extension: latest.extension,
            contentType: latest.contentType,
            ownerId: latest.ownerId,
            ownerName: latest.ownerName,
            ownerLogin: latest.ownerLogin,
          }));
        const upload = await tx.fileUpload.update({
          where: { id },
          data: {
            fileId: version.fileId,
            resultVersionId: version.id,
            reused: blob.objectKey !== object.key,
          },
        });
        // Только собственная непубликованная карточка проигравшей первой загрузки.
        // Все последующие повторы адресуют устойчивый uploadId и найденную версию.
        if (existing && existing.fileId !== latest.fileId)
          await tx.storedFile.delete({
            where: { id: latest.fileId, AND: { currentVersionId: null } },
          });
        return { upload, objectKey: blob.objectKey };
      },
      { isolationLevel: 'ReadCommitted' },
    );
    if (saved.objectKey !== object.key)
      await this.storage.remove(object).catch(() => undefined);
    await this.storage
      .remove({ key: current.stagingKey })
      .catch(() => undefined);
    return this.result(saved.upload);
  }

  async update(
    actor: AdminPrincipal,
    id: string,
    input: UpdateFileDto,
  ): Promise<FileDto> {
    const name = input.title === undefined ? undefined : fileName(input.title);
    const data = {
      ...(name === undefined ? {} : { title: name, filename: name, publicFilename: name }),
      ...(input.folder !== undefined
        ? { folder: fileFolder(input.folder) }
        : {}),
      ...(input.tags !== undefined ? { tags: fileTags(input.tags) } : {}),
    };
    const saved = await this.prisma.$transaction(async (tx) => {
      await requireAdminPermission(tx, actor, 'files.update');
      await this.find(id, tx);
      return tx.storedFile.update({
        where: { id },
        data,
        include: FILE_INCLUDE,
      });
    });
    return this.dto(saved);
  }

  async setCurrentVersion(
    actor: AdminPrincipal,
    id: string,
    number: number,
  ): Promise<FileDto> {
    return this.prisma.$transaction(async (tx) => {
      await requireAdminPermission(tx, actor, 'files.update');
      // Общая блокировка документа сериализует выбор и публикацию новой версии.
      await tx.$queryRaw`SELECT id FROM "StoredFile" WHERE id = ${id}::uuid FOR UPDATE`;
      const file = await this.find(id, tx);
      const version = await tx.fileVersion.findUnique({
        where: { fileId_number: { fileId: id, number } },
        include: { blob: true },
      });
      if (!version) throw new NotFoundException('Версия файла не найдена.');
      if (file.currentVersionId === version.id) return this.dto(file);
      const saved = await tx.storedFile.update({
        where: { id },
        data: {
          currentVersionId: version.id,
          extension: version.extension,
          contentType: version.contentType,
          byteSize: version.blob.byteSize,
        },
        include: FILE_INCLUDE,
      });
      return this.dto(saved);
    });
  }

  async publicFile(
    publicId: string,
    number?: number,
  ): Promise<FileDelivery> {
    if (!/^[0-9A-Za-z]{8}$/.test(publicId))
      throw new NotFoundException('Файл не найден.');
    if (number === undefined) {
      const file = await this.prisma.storedFile.findUnique({
        where: { publicId, status: 'ready' },
        include: FILE_INCLUDE,
      });
      if (!file?.currentVersion)
        throw new NotFoundException('Файл или версия не найдены.');
      return {
        version: file.currentVersion,
        filename: file.publicFilename,
        modifiedAt: file.updatedAt,
      };
    }
    const version = await this.prisma.fileVersion.findFirst({
      where: {
        file: { publicId, status: 'ready' },
        number,
      },
      include: { blob: true },
    });
    if (!version) throw new NotFoundException('Файл или версия не найдены.');
    return { version, filename: version.filename, modifiedAt: version.createdAt };
  }

  private expired(): never {
    throw new ConflictException({
      code: 'UPLOAD_EXPIRED',
      message: 'Срок загрузки истёк. Создайте новую загрузку.',
    });
  }
}
