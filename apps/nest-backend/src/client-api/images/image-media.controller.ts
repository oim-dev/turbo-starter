import {
  Controller,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Req,
  Res,
  ServiceUnavailableException,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { ImageVariant } from '../../generated/prisma/client';
import { Public } from '../../infrastructure/auth/public.decorator';
import { ImageStorage } from '../../infrastructure/storage/image-storage.service';
import { ImagesService } from '../../modules/images/images.service';

// Доставка принадлежит Client API; общедоступны только целиком готовые наборы.
@Controller('media/images')
@ApiTags('Media')
export class ImageMediaController {
  private readonly logger = new Logger(ImageMediaController.name);

  constructor(
    private readonly images: ImagesService,
    private readonly storage: ImageStorage,
  ) {}

  @Get(':publicId/:format/:widthxheight')
  @Public()
  @ApiOperation({
    operationId: 'clientImageReadableMedia',
    summary:
      'Готовый вариант по publicId, формату и фактическим widthxheight (латинская x)',
  })
  @ApiParam({
    name: 'publicId',
    schema: { type: 'string', pattern: '^[0-9A-Za-z]{8}$' },
  })
  @ApiParam({ name: 'format', example: 'avif' })
  @ApiParam({
    name: 'widthxheight',
    example: '800x600',
    description:
      'Точные размеры существующего файла, латинская x; преобразование по запросу не выполняется.',
  })
  @ApiOkResponse({
    content: {
      'image/avif': { schema: { type: 'string', format: 'binary' } },
      'image/jpeg': { schema: { type: 'string', format: 'binary' } },
      'image/png': { schema: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({
    status: 304,
    description: 'Вариант не изменился (If-None-Match).',
  })
  async readable(
    @Param('publicId') publicId: string,
    @Param('format') format: string,
    @Param('widthxheight') dimensions: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile | undefined> {
    return this.deliver(
      await this.images.publicReadableVariant(publicId, format, dimensions),
      request,
      response,
    );
  }

  @Get(':id/:variantId')
  @Public()
  @ApiOperation({
    operationId: 'clientImageMedia',
    summary:
      'Legacy UUID URL: бинарный готовый вариант без runtime-преобразований',
  })
  @ApiOkResponse({
    content: {
      'image/avif': { schema: { type: 'string', format: 'binary' } },
      'image/jpeg': { schema: { type: 'string', format: 'binary' } },
      'image/png': { schema: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({
    status: 304,
    description: 'Вариант не изменился (If-None-Match).',
  })
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile | undefined> {
    const variant = await this.images.publicVariant(id, variantId);
    return this.deliver(variant, request, response);
  }

  private async deliver(
    variant: ImageVariant,
    request: Request,
    response: Response,
  ): Promise<StreamableFile | undefined> {
    const etag = `"${variant.etag.replaceAll('"', '')}"`;
    response.setHeader('ETag', etag);
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const matches = request.headers['if-none-match']
      ?.split(',')
      .map((part) => part.trim().replace(/^W\//, ''));
    if (matches?.includes(etag) || matches?.includes('*')) {
      response.status(304);
      return;
    }
    try {
      const stream = await this.storage.get({
        key: variant.objectKey,
        etag: variant.etag,
        versionId: variant.versionId,
      });
      return new StreamableFile(stream, {
        type: variant.mimeType,
        length: variant.byteSize,
        disposition: 'inline',
      })
        .setErrorHandler(() => {
          // Не журналируем ошибки SDK: они могут содержать URL и credentials.
          this.logger.warn('Image media source stream failed.');
          stream.unpipe(response);
          stream.destroy();
          if (response.destroyed) return;
          if (response.headersSent) {
            // Оборванное изображение не должно выглядеть завершённым ответом.
            response.destroy();
            return;
          }
          this.clearImageHeaders(response);
          response.status(503);
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          // end вместо express.json: не создаём новый автоматический ETag ошибки.
          response.end(
            JSON.stringify({
              statusCode: 503,
              code: 'SERVICE_UNAVAILABLE',
              message: 'Хранилище временно недоступно.',
            }),
          );
        })
        .setErrorLogger(() =>
          this.logger.warn('Image media response stream failed.'),
        );
    } catch {
      this.clearImageHeaders(response);
      throw new ServiceUnavailableException('Хранилище временно недоступно.');
    }
  }

  private clearImageHeaders(response: Response): void {
    for (const name of [
      'ETag',
      'Content-Length',
      'Content-Type',
      'Content-Disposition',
      'Content-Range',
      'Accept-Ranges',
      'Last-Modified',
      'Expires',
      'Cache-Control',
      'Surrogate-Control',
      'CDN-Cache-Control',
    ])
      response.removeHeader(name);
    response.setHeader('Cache-Control', 'no-store');
  }
}
