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
import { AdminPermissions } from '../../infrastructure/auth/admin-roles';
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
export class AdminImagesController {
  constructor(private readonly images: ImagesService) {}

  @Get()
  @AdminPermissions('images.read')
  @ApiOperation({
    operationId: 'adminImageList',
    summary: 'Галерея всех изображений',
  })
  @ApiOkResponse({ type: ImageListDto })
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ImageListQueryDto,
  ): Promise<ImageListDto> {
    return this.images.list({ id: request.user.id, realm: 'admin' }, query);
  }

  @Get('facets')
  @AdminPermissions('images.read')
  @ApiOperation({
    operationId: 'adminImageFacets',
    summary: 'Папки и теги всей галереи',
  })
  @ApiOkResponse({ type: ImageFacetsDto })
  facets(@Req() request: AuthenticatedRequest): Promise<ImageFacetsDto> {
    return this.images.facets({ id: request.user.id, realm: 'admin' });
  }

  @Post('uploads')
  @AdminPermissions('images.upload')
  @ApiOperation({
    operationId: 'adminImageCreateUpload',
    summary: 'Создать изображение и временную ссылку для PUT в MinIO',
  })
  @ApiCreatedResponse({ type: ImageUploadDto })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateImageUploadDto,
  ): Promise<ImageUploadDto> {
    return this.images.createUpload(
      { id: request.user.id, realm: 'admin' },
      dto,
    );
  }

  @Get(':id')
  @AdminPermissions('images.read')
  @ApiOperation({
    operationId: 'adminImageGet',
    summary: 'Метаданные и готовые варианты изображения',
  })
  @ApiOkResponse({ type: ImageDto })
  get(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ImageDto> {
    return this.images.get({ id: request.user.id, realm: 'admin' }, id);
  }

  @Post(':id/complete')
  @HttpCode(202)
  @AdminPermissions('images.upload')
  @ApiOperation({
    operationId: 'adminImageComplete',
    summary: 'Идемпотентно заморозить оригинал и поставить обработку в outbox',
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
      { id: request.user.id, realm: 'admin' },
      id,
    );
    response.status(['ready', 'failed'].includes(image.status) ? 200 : 202);
    return image;
  }

  @Patch(':id')
  @AdminPermissions('images.update')
  @ApiOperation({
    operationId: 'adminImageUpdate',
    summary: 'Изменить название, папку или теги',
  })
  @ApiOkResponse({ type: ImageDto })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateImageDto,
  ): Promise<ImageDto> {
    return this.images.update({ id: request.user.id, realm: 'admin' }, id, dto);
  }

  @Post(':id/retry')
  @HttpCode(202)
  @AdminPermissions('images.upload')
  @ApiOperation({
    operationId: 'adminImageRetry',
    summary: 'Повторить неудавшееся задание',
  })
  @ApiAcceptedResponse({ type: ImageDto })
  retry(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ImageDto> {
    return this.images.retry({ id: request.user.id, realm: 'admin' }, id);
  }

  @Get(':id/original')
  @AdminPermissions('images.read')
  @ApiOperation({
    operationId: 'adminImageOriginal',
    summary: 'Получить временную авторизованную ссылку на оригинал',
  })
  @ApiOkResponse({ type: ImageOriginalLinkDto })
  original(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ImageOriginalLinkDto> {
    return this.images.original({ id: request.user.id, realm: 'admin' }, id);
  }
}
