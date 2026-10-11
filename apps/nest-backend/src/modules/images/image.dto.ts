import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ImageRealm, ImageStatus } from '../../generated/prisma/enums';

export const IMAGE_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export class CreateImageUploadDto {
  @ApiProperty({ maxLength: 255, example: 'cover.png' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  filename!: string;

  @ApiProperty({ enum: IMAGE_CONTENT_TYPES })
  @IsIn(IMAGE_CONTENT_TYPES)
  contentType!: string;

  @ApiProperty({
    minimum: 1,
    description: 'Точный размер файла; серверный лимит по умолчанию 20 МиБ.',
  })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  byteSize!: number;

  @ApiPropertyOptional({ maxLength: 255 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 255,
    example: 'Каталог/Обложки',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  folder?: string | null;

  @ApiPropertyOptional({
    type: [String],
    maxItems: 20,
    description:
      'До 20 тегов, каждый до 64 символов; trim, NFC, нижний регистр, dedup.',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(64, { each: true })
  tags?: string[];
}

export class UpdateImageDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
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

export class ImageListQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 24;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
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

  @ApiPropertyOptional({ enum: ImageStatus })
  @IsOptional()
  @IsEnum(ImageStatus)
  status?: ImageStatus;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Только изображения без папки.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  unfiled?: boolean;
}

export class ImageUploaderDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ImageRealm }) realm!: ImageRealm;
  @ApiProperty() name!: string;
  @ApiProperty() login!: string;
}

export class ImageOriginalDto {
  @ApiProperty() contentType!: string;
  @ApiProperty() byteSize!: number;
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Ширина исходника после EXIF orientation, известна в ready.',
  })
  width!: number | null;
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Высота исходника после EXIF orientation, известна в ready.',
  })
  height!: number | null;
}

export class ImageVariantDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() width!: number;
  @ApiProperty() height!: number;
  @ApiProperty({ example: 'png' }) format!: string;
  @ApiProperty({ example: 'image/png' }) mimeType!: string;
  @ApiProperty() byteSize!: number;
  @ApiProperty({ format: 'uri' }) url!: string;
}

export class ImageErrorDto {
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
}

export class ImageDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() filename!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ type: String, nullable: true }) folder!: string | null;
  @ApiProperty({ type: [String] }) tags!: string[];
  @ApiProperty({ enum: ImageStatus }) status!: ImageStatus;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: ImageUploaderDto }) uploadedBy!: ImageUploaderDto;
  @ApiProperty({ type: ImageOriginalDto }) original!: ImageOriginalDto;
  @ApiProperty({
    type: [ImageVariantDto],
    description:
      'Однородный по пропорциям набор готовых вариантов, пуст до ready. Выбор по (width,format). Новая обработка сохраняет пропорции исходника; для старых записей без таких вариантов возвращается одна ранее опубликованная семья.',
  })
  variants!: ImageVariantDto[];
  @ApiProperty({ type: ImageErrorDto, nullable: true })
  error!: ImageErrorDto | null;
}

export class ImageUploadTargetDto {
  @ApiProperty({ format: 'uri' }) url!: string;
  @ApiProperty({ enum: ['PUT'] }) method!: 'PUT';
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { 'Content-Type': 'image/png' },
  })
  headers!: Record<string, string>;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}

export class ImageUploadDto {
  @ApiProperty({ type: ImageDto }) image!: ImageDto;
  @ApiProperty({ type: ImageUploadTargetDto }) upload!: ImageUploadTargetDto;
}

export class ImageListDto {
  @ApiProperty({ type: [ImageDto] }) items!: ImageDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

export class ImageFacetDto {
  @ApiProperty() name!: string;
  @ApiProperty() count!: number;
}

export class ImageFacetsDto {
  @ApiProperty({ type: [ImageFacetDto] }) folders!: ImageFacetDto[];
  @ApiProperty({ type: [ImageFacetDto] }) tags!: ImageFacetDto[];
  @ApiProperty() total!: number;
  @ApiProperty() unfiledCount!: number;
}

export class ImageOriginalLinkDto {
  @ApiProperty({ format: 'uri' }) url!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}
