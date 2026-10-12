import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminPermissions } from '../../infrastructure/auth/admin-roles';
import type { AuthenticatedRequest } from '../../infrastructure/auth/authenticated-request';
import { FilesService } from '../../modules/files/files.service';
import {
  CreateFileUploadDto,
  CreateFileVersionUploadDto,
  FileCompleteDto,
  FileVersionDto,
  FileDto,
  FileFacetsDto,
  FileListDto,
  FileListQueryDto,
  FileUploadPartDto,
  FileUploadDto,
  UpdateFileDto,
  SetFileCurrentVersionDto,
} from '../../modules/files/file.dto';

@Controller('files')
@ApiTags('Files')
@ApiBearerAuth('access-token')
export class AdminFilesController {
  constructor(private readonly files: FilesService) {}

  @Get()
  @AdminPermissions('files.read')
  @ApiOperation({
    operationId: 'adminFileList',
    summary: 'Список документов с поиском и фильтрами',
  })
  @ApiOkResponse({ type: FileListDto })
  list(@Query() query: FileListQueryDto): Promise<FileListDto> {
    return this.files.list(query);
  }

  @Get('facets')
  @AdminPermissions('files.read')
  @ApiOperation({
    operationId: 'adminFileFacets',
    summary: 'Папки и теги документов',
  })
  @ApiOkResponse({ type: FileFacetsDto })
  facets(): Promise<FileFacetsDto> {
    return this.files.facets();
  }

  @Post('uploads')
  @AdminPermissions('files.read', 'files.upload')
  @ApiOperation({
    operationId: 'adminFileCreateUpload',
    summary: 'Создать загрузку документа и временную ссылку PUT',
  })
  @ApiCreatedResponse({ type: FileUploadDto })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateFileUploadDto,
  ): Promise<FileUploadDto> {
    return this.files.createUpload(request.user, input);
  }

  @Get(':id')
  @AdminPermissions('files.read')
  @ApiOperation({
    operationId: 'adminFileGet',
    summary: 'Метаданные документа и постоянные ссылки',
  })
  @ApiOkResponse({ type: FileDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<FileDto> {
    return this.files.get(id);
  }

  @Get(':id/versions')
  @AdminPermissions('files.read')
  @ApiOperation({
    operationId: 'adminFileVersions',
    summary: 'История неизменяемых версий, новые первыми',
  })
  @ApiOkResponse({ type: [FileVersionDto] })
  versions(@Param('id', ParseUUIDPipe) id: string): Promise<FileVersionDto[]> {
    return this.files.versions(id);
  }

  @Post(':id/versions/uploads')
  @AdminPermissions('files.read', 'files.upload')
  @ApiOperation({
    operationId: 'adminFileCreateVersionUpload',
    summary:
      'Добавить версию из существующих байтов или подготовить PUT новой версии',
  })
  @ApiCreatedResponse({ type: FileUploadDto })
  createVersion(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateFileVersionUploadDto,
  ): Promise<FileUploadDto> {
    return this.files.createUpload(request.user, input, id);
  }

  @Post('uploads/:id/complete')
  @HttpCode(200)
  @AdminPermissions('files.read', 'files.upload')
  @ApiOperation({
    operationId: 'adminFileComplete',
    summary: 'Идемпотентно проверить и опубликовать документ',
  })
  @ApiOkResponse({ type: FileCompleteDto })
  complete(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FileCompleteDto> {
    return this.files.complete(request.user, id);
  }

  @Post('uploads/:id/parts/:part')
  @HttpCode(200)
  @AdminPermissions('files.read', 'files.upload')
  @ApiOperation({
    operationId: 'adminFileUploadPart',
    summary: 'Подписать одну часть S3 multipart и продлить активную загрузку',
  })
  @ApiOkResponse({ type: FileUploadPartDto })
  part(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('part', ParseIntPipe) part: number,
  ): Promise<FileUploadPartDto> {
    return this.files.part(id, part);
  }

  @Patch(':id/current-version')
  @AdminPermissions('files.update')
  @ApiOperation({
    operationId: 'adminFileSetCurrentVersion',
    summary: 'Выбрать версию для постоянной ссылки без изменения истории',
  })
  @ApiOkResponse({ type: FileDto })
  setCurrentVersion(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SetFileCurrentVersionDto,
  ): Promise<FileDto> {
    return this.files.setCurrentVersion(request.user, id, input.version);
  }

  @Patch(':id')
  @AdminPermissions('files.update')
  @ApiOperation({
    operationId: 'adminFileUpdate',
    summary: 'Изменить название, папку и теги документа',
  })
  @ApiOkResponse({ type: FileDto })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateFileDto,
  ): Promise<FileDto> {
    return this.files.update(request.user, id, input);
  }
}
