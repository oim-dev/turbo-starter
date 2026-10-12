import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Matches,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { FileStatus } from '../../generated/prisma/enums';

export class UpdateFileDto {
  @ApiPropertyOptional({
    minLength: 1,
    maxLength: 255,
    description: 'Редактируемое имя документа для отображения, URL и скачивания. Имена версий не меняются.',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  folder?: string | null;

  @ApiPropertyOptional({ type: [String], maxItems: 20 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(64, { each: true })
  tags?: string[];
}

export class SetFileCurrentVersionDto {
  @ApiProperty({ minimum: 1, description: 'Номер версии для постоянной ссылки.' })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  version!: number;
}

export class CreateFileUploadDto extends UpdateFileDto {
  @ApiProperty({ maxLength: 255, example: 'Инструкция.pdf' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  filename!: string;

  @ApiProperty({
    minimum: 0,
    description:
      'Точный размер в байтах. Прикладного ограничения размера и формата нет.',
  })
  @IsInt()
  @Min(0)
  byteSize!: number;

  @ApiProperty({
    pattern: '^[0-9a-f]{64}$',
    description:
      'SHA-256 исходных байтов; новые байты всегда проверяются сервером.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsString()
  @Matches(/^[0-9a-f]{64}$/)
  sha256!: string;
}

export class CreateFileVersionUploadDto extends PickType(CreateFileUploadDto, [
  'filename',
  'byteSize',
  'sha256',
] as const) {}

export class FileListQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional({
    maxLength: 2048,
    description:
      'Имя, название, тег, полный UUID/publicId или постоянная ссылка файла.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  search?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  folder?: string;

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  tag?: string;

  @ApiPropertyOptional({ enum: FileStatus })
  @IsOptional()
  @IsEnum(FileStatus)
  status?: FileStatus;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  extension?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  unfiled?: boolean;
}

export class FileDeliveryQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    description: 'Номер неизменяемой версии. По умолчанию выбранная текущая.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  version?: number;
  @ApiPropertyOptional({
    enum: ['1'],
    description:
      'Принудительное скачивание (attachment). Без параметра — просмотр inline; текстовые исходники отдаются как text/plain.',
  })
  @IsOptional()
  @IsIn(['1'])
  download?: string;
}

export class FileUploaderDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() login!: string;
}

export class FileDto {
  @ApiProperty({
    minimum: 0,
    description: 'Номер выбранной текущей версии, 0 до первой публикации.',
  })
  currentVersion!: number;
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ pattern: '^[0-9A-Za-z]{8}$' }) publicId!: string;
  @ApiProperty({ description: 'Имя документа, не меняется при загрузке или выборе версии.' }) filename!: string;
  @ApiProperty({ description: 'Редактируемое имя документа; совпадает с filename.' }) title!: string;
  @ApiProperty({ type: String, nullable: true }) folder!: string | null;
  @ApiProperty({ type: [String] }) tags!: string[];
  @ApiProperty({ enum: FileStatus }) status!: FileStatus;
  @ApiProperty() extension!: string;
  @ApiProperty({ description: 'MIME текущей версии по исходному расширению; переименование документа его не меняет.' }) contentType!: string;
  @ApiProperty() byteSize!: number;
  @ApiProperty({ type: String, nullable: true, pattern: '^[0-9a-f]{64}$' })
  sha256!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    format: 'uri',
    description:
      'Ссылка с текущим именем документа. Версии не меняют URL; переименование меняет только сегмент имени. Старые ссылки работают. Null до ready.',
  })
  url!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'uri' }) downloadUrl!:
    string | null;
  @ApiProperty({ type: FileUploaderDto }) uploadedBy!: FileUploaderDto;
  @ApiProperty({ format: 'date-time' }) uploadExpiresAt!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class FileUploadTargetDto {
  @ApiProperty({ type: String, format: 'uri', nullable: true }) url!:
    string | null;
  @ApiProperty({ enum: ['PUT', 'MULTIPART'] }) method!: 'PUT' | 'MULTIPART';
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Размер части для multipart, не лимит файла.',
  })
  partSize!: number | null;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  headers!: Record<string, string>;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}

export class FileUploadPartDto {
  @ApiProperty({ format: 'uri' }) url!: string;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  headers!: Record<string, string>;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
  @ApiProperty({ format: 'date-time' }) uploadExpiresAt!: string;
}

export class FileVersionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() number!: number;
  @ApiProperty() filename!: string;
  @ApiProperty({ description: 'MIME исходного файла версии. Для просмотра текстовых исходников API использует text/plain.' }) contentType!: string;
  @ApiProperty() extension!: string;
  @ApiProperty() byteSize!: number;
  @ApiProperty({ pattern: '^[0-9a-f]{64}$' }) sha256!: string;
  @ApiProperty({ format: 'uri' }) url!: string;
  @ApiProperty({ format: 'uri' }) downloadUrl!: string;
  @ApiProperty({ type: FileUploaderDto }) uploadedBy!: FileUploaderDto;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class FileCompleteDto {
  @ApiProperty({ type: FileDto }) file!: FileDto;
  @ApiProperty({ type: FileVersionDto }) version!: FileVersionDto;
  @ApiProperty({ description: 'Содержимое уже было в S3.' }) reused!: boolean;
}

export class FileUploadDto {
  @ApiProperty({ type: FileDto }) file!: FileDto;
  @ApiProperty({ type: FileVersionDto, nullable: true })
  version!: FileVersionDto | null;
  @ApiProperty() reused!: boolean;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) uploadId!:
    string | null;
  @ApiProperty({ type: FileUploadTargetDto, nullable: true })
  upload!: FileUploadTargetDto | null;
}

export class FileListDto {
  @ApiProperty({ type: [FileDto] }) items!: FileDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

export class FileFacetDto {
  @ApiProperty() name!: string;
  @ApiProperty() count!: number;
}

export class FileFacetsDto {
  @ApiProperty({ type: [FileFacetDto] }) folders!: FileFacetDto[];
  @ApiProperty({ type: [FileFacetDto] }) tags!: FileFacetDto[];
  @ApiProperty() total!: number;
  @ApiProperty() unfiledCount!: number;
}
