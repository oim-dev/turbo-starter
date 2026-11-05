import {
  Controller,
  Get,
  Head,
  Logger,
  Param,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  StreamableFile,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { Public } from '../../infrastructure/auth/public.decorator';
import { ObjectStorage } from '../../infrastructure/storage/object-storage.service';
import { FilesService } from '../../modules/files/files.service';
import { FileDeliveryQueryDto } from '../../modules/files/file.dto';
import { fileRange } from './file-range';
import { fileResponseContentType } from './file-response-content-type';

@Controller('files')
@ApiTags('Files')
export class FileDeliveryController {
  private readonly logger = new Logger(FileDeliveryController.name);
  constructor(
    private readonly files: FilesService,
    private readonly storage: ObjectStorage,
  ) {}

  @Head(':publicId/:filename')
  @Public()
  @ApiOperation({
    operationId: 'clientFileHead',
    summary: 'Метаданные публичного файла без тела и без раскрытия S3',
  })
  @ApiParam({ name: 'filename', type: String, example: 'Инструкция.pdf' })
  @ApiResponse({ status: 200, description: 'Заголовки выбранной версии.' })
  async head(
    @Param('publicId') publicId: string,
    @Query() query: FileDeliveryQueryDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.deliver(publicId, query, request, response, true);
  }

  @Get(':publicId/:filename')
  @Public()
  @ApiOperation({
    operationId: 'clientFileOpen',
    summary:
      'Просмотр файла inline с MIME версии; download=1 — скачивание; version=N — конкретная версия',
  })
  @ApiParam({
    name: 'publicId',
    schema: { type: 'string', pattern: '^[0-9A-Za-z]{8}$' },
  })
  @ApiParam({
    name: 'filename',
    example: 'Инструкция.pdf',
    description:
      'Читаемое имя; байты и заголовки определяются ID и версией из БД.',
  })
  @ApiResponse({
    status: 200,
    content: {
      'application/octet-stream': {
        schema: { type: 'string', format: 'binary' },
      },
      'application/pdf': { schema: { type: 'string', format: 'binary' } },
      'text/plain': { schema: { type: 'string' } },
      'video/mp4': { schema: { type: 'string', format: 'binary' } },
      'video/webm': { schema: { type: 'string', format: 'binary' } },
      'audio/mpeg': { schema: { type: 'string', format: 'binary' } },
      'image/png': { schema: { type: 'string', format: 'binary' } },
      '*/*': { schema: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({
    status: 206,
    description: 'Запрошенный диапазон байтов; Content-Range.',
  })
  @ApiResponse({ status: 304, description: 'ETag выбранной версии совпал.' })
  @ApiResponse({
    status: 416,
    description: 'Диапазон не удовлетворим; Content-Range: bytes */size.',
  })
  open(
    @Param('publicId') publicId: string,
    @Query() query: FileDeliveryQueryDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile | undefined> {
    return this.deliver(
      publicId,
      query,
      request,
      response,
      request.method === 'HEAD',
    );
  }

  private async deliver(
    publicId: string,
    query: FileDeliveryQueryDto,
    request: Request,
    response: Response,
    isHead: boolean,
  ): Promise<StreamableFile | undefined> {
    const delivery = await this.files.publicFile(publicId, query.version);
    const { version } = delivery;
    const size = Number(version.blob.byteSize);
    const object = {
      key: version.blob.objectKey,
      etag: version.blob.objectEtag,
      versionId: version.blob.objectVersionId,
    };
    const modified = delivery.modifiedAt.toUTCString();
    const inline = query.download !== '1';
    const responseContentType = fileResponseContentType(
      version.extension,
      version.contentType,
      !inline,
    );
    // Валидатор относится ко всему ответу: байтам, выбранной версии и имени.
    // updatedAt отличает повторную публикацию той же редакции по общему URL.
    const digest = createHash('sha256')
      .update(JSON.stringify([
        version.id,
        version.blob.sha256,
        delivery.filename,
        delivery.modifiedAt.toISOString(),
        inline,
        responseContentType,
      ]))
      .digest('hex');
    const etag = `"${digest}"`;
    const filename = encodeURIComponent(delivery.filename).replace(
      /['()*]/g,
      (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    const disposition = `${inline ? 'inline' : 'attachment'}; filename="file"; filename*=UTF-8''${filename}`;
    try {
      await this.storage.stat(object.key, object.versionId);
      response.setHeader('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');
      response.setHeader('Pragma', 'no-cache');
      response.setHeader('Expires', '0');
      response.setHeader('ETag', etag);
      response.setHeader('Last-Modified', modified);
      response.setHeader('Accept-Ranges', 'bytes');
      response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('Content-Type', responseContentType);
      response.setHeader('Content-Disposition', disposition);
      const matches = request.headers['if-none-match']
        ?.split(',')
        .map((tag) => tag.trim().replace(/^W\//, ''));
      if (matches?.includes(etag) || matches?.includes('*')) {
        response.status(304);
        return;
      }
      let range: ReturnType<typeof fileRange> = null;
      const ifRange = request.headers['if-range'];
      const canRange =
        ifRange === undefined || ifRange === etag ||
        // Дата с точностью до секунды не различает быстрые переключения.
        // Для изменяемого URL частичный ответ разрешает только сильный ETag.
        (query.version !== undefined && ifRange === modified);
      if (!isHead && request.headers.range !== undefined && canRange) {
        range = fileRange(request.headers.range, size);
        if (range === null) {
          response.status(416);
          response.setHeader('Content-Range', `bytes */${size}`);
          response.setHeader('Content-Length', '0');
          return;
        }
        response.status(206);
        response.setHeader(
          'Content-Range',
          `bytes ${range.start}-${range.end}/${size}`,
        );
      }
      const length = range ? range.end - range.start + 1 : size;
      response.setHeader('Content-Length', String(length));
      if (isHead || length === 0) return;
      const stream = range
        ? await this.storage.getRange(object, range.start, length)
        : await this.storage.get(object);
      // Закрытие вкладки освобождает S3-поток; файл не буферизуется в памяти API.
      const disconnect = () => stream.destroy();
      response.once('close', disconnect);
      stream.once('close', () => response.removeListener('close', disconnect));
      return new StreamableFile(stream)
        .setErrorHandler(() => {
          this.logger.warn('File delivery stream failed.');
          stream.destroy();
          if (response.destroyed) return;
          if (response.headersSent) {
            response.destroy();
            return;
          }
          this.clearHeaders(response);
          response
            .status(503)
            .setHeader('Content-Type', 'application/json; charset=utf-8');
          response.end(
            JSON.stringify({
              statusCode: 503,
              code: 'SERVICE_UNAVAILABLE',
              message: 'Хранилище временно недоступно.',
            }),
          );
        })
        .setErrorLogger(() =>
          this.logger.warn('File delivery response failed.'),
        );
    } catch {
      this.clearHeaders(response);
      throw new ServiceUnavailableException('Хранилище временно недоступно.');
    }
  }

  private clearHeaders(response: Response): void {
    for (const header of [
      'Content-Length',
      'Content-Type',
      'Content-Disposition',
      'Content-Range',
      'Accept-Ranges',
      'ETag',
      'Last-Modified',
    ])
      response.removeHeader(header);
    response.setHeader('Cache-Control', 'no-store');
  }
}
