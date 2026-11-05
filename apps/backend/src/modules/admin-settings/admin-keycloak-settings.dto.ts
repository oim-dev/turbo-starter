import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class UpdateKeycloakSettingsDto {
  @ApiProperty({ type: Boolean }) @IsBoolean() enabled!: boolean;
  @ApiProperty({ type: String, maxLength: 512 })
  @IsString()
  @Length(0, 512)
  issuer!: string;
  @ApiProperty({ type: String, maxLength: 255 })
  @IsString()
  @Length(0, 255)
  clientId!: string;
  @ApiPropertyOptional({
    type: String,
    minLength: 1,
    maxLength: 4096,
    description: 'Только запись; отсутствие сохраняет прежний secret.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 4096)
  clientSecret?: string;
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  clearSecret?: boolean;
  @ApiProperty({ type: String, maxLength: 2048 })
  @IsString()
  @Length(0, 2048)
  callbackUrl!: string;
  @ApiProperty({ type: String, maxLength: 2048 })
  @IsString()
  @Length(0, 2048)
  frontendCallbackUrl!: string;
  @ApiProperty({ type: Number, minimum: 0 }) @IsInt() @Min(0) version!: number;
}

export class KeycloakSettingsDto {
  @ApiProperty({ type: Boolean }) enabled!: boolean;
  @ApiProperty({ type: String }) issuer!: string;
  @ApiProperty({ type: String }) clientId!: string;
  @ApiProperty({ type: String }) callbackUrl!: string;
  @ApiProperty({ type: String }) frontendCallbackUrl!: string;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: Boolean }) hasSecret!: boolean;
  @ApiProperty({ type: Boolean }) canStoreSecret!: boolean;
}
