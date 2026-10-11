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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
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

  @Get(':id/:variantId')
  @Public()
  @ApiOperation({
    operationId: 'clientImageMedia',
    summary: 'Бинарный готовый вариант без runtime-преобразований',
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
