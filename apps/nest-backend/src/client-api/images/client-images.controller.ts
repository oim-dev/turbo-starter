import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../infrastructure/auth/authenticated-request';
import { ImagesService } from '../../modules/images/images.service';
import {
  CreateImageUploadDto,
  ImageDto,
  ImageFacetsDto,
  ImageListDto,
  ImageListQueryDto,
  ImageOriginalLinkDto,
  ImageUploadDto,
  UpdateImageDto,
} from '../../modules/images/image.dto';

@Controller('images')
@ApiTags('Images')
@ApiBearerAuth('access-token')
export class ClientImagesController {
  constructor(private readonly images: ImagesService) {}

  @Get()
  @ApiOperation({
    operationId: 'clientImageList',
    summary: 'Галерея собственных изображений',
  })
  @ApiOkResponse({ type: ImageListDto })
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ImageListQueryDto,
  ): Promise<ImageListDto> {
    return this.images.list({ id: request.user.id, realm: 'client' }, query);
  }

  @Get('facets')
  @ApiOperation({
    operationId: 'clientImageFacets',
    summary: 'Папки и теги собственных изображений',
  })
  @ApiOkResponse({ type: ImageFacetsDto })
  facets(@Req() request: AuthenticatedRequest): Promise<ImageFacetsDto> {
    return this.images.facets({ id: request.user.id, realm: 'client' });
  }

  @Post('uploads')
  @ApiOperation({
    operationId: 'clientImageCreateUpload',
    summary: 'Создать изображение и временную ссылку для PUT в MinIO',
  })
  @ApiCreatedResponse({ type: ImageUploadDto })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateImageUploadDto,
  ): Promise<ImageUploadDto> {
    return this.images.createUpload(
      { id: request.user.id, realm: 'client' },
      dto,
    );
  }

  @Get(':id')
  @ApiOperation({
    operationId: 'clientImageGet',
    summary: 'Метаданные и готовые варианты своего изображения',
  })
  @ApiOkResponse({ type: ImageDto })
  get(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ImageDto> {
    return this.images.get({ id: request.user.id, realm: 'client' }, id);
  }

  @Post(':id/complete')
  @HttpCode(202)
  @ApiOperation({
    operationId: 'clientImageComplete',
    summary: 'Идемпотентно подтвердить загрузку',
  })
  @ApiAcceptedResponse({ type: ImageDto })
  @ApiOkResponse({
    type: ImageDto,
    description: 'Обработка уже завершена (ready или failed).',
  })
  async complete(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ImageDto> {
    const image = await this.images.complete(
      { id: request.user.id, realm: 'client' },
      id,
    );
    response.status(['ready', 'failed'].includes(image.status) ? 200 : 202);
    return image;
  }

  @Patch(':id')
  @ApiOperation({
    operationId: 'clientImageUpdate',
    summary: 'Изменить метаданные своего изображения',
  })
  @ApiOkResponse({ type: ImageDto })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateImageDto,
  ): Promise<ImageDto> {
    return this.images.update(
      { id: request.user.id, realm: 'client' },
      id,
      dto,
    );
  }

  @Post(':id/retry')
  @HttpCode(202)
  @ApiOperation({
    operationId: 'clientImageRetry',
    summary: 'Повторить неудавшееся задание своего изображения',
  })
  @ApiAcceptedResponse({ type: ImageDto })
  retry(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ImageDto> {
    return this.images.retry({ id: request.user.id, realm: 'client' }, id);
  }

  @Get(':id/original')
  @ApiOperation({
    operationId: 'clientImageOriginal',
    summary: 'Получить временную ссылку на свой оригинал',
  })
  @ApiOkResponse({ type: ImageOriginalLinkDto })
  original(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ImageOriginalLinkDto> {
    return this.images.original({ id: request.user.id, realm: 'client' }, id);
  }
}
