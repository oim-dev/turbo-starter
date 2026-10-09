import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

export class AdminPermissionDto {
  @ApiProperty({ type: String }) key!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: Boolean }) system!: boolean;
}
export class AdminAccessRoleDto {
  @ApiProperty({ type: String }) key!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: [String] }) permissions!: string[];
  @ApiProperty({ type: Boolean }) isBuiltin!: boolean;
  @ApiProperty({ type: Number }) version!: number;
}
export class CreateAdminRoleDto {
  @ApiProperty({ type: String, pattern: '^[A-Z][A-Z0-9_]{2,63}$' })
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{2,63}$/)
  key!: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 120 })
  @IsString()
  @Length(1, 120)
  name!: string;
  @ApiProperty({ type: [String], maxItems: 100 })
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  permissions!: string[];
}
export class UpdateAdminRoleDto {
  @ApiProperty({ type: String, minLength: 1, maxLength: 120 })
  @IsString()
  @Length(1, 120)
  name!: string;
  @ApiProperty({ type: [String], maxItems: 100 })
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  permissions!: string[];
  @ApiProperty({ type: Number, minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;
}
export class AdminAccountIdentityDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String }) issuer!: string;
  @ApiProperty({ type: String }) subject!: string;
}

export class BindAdminIdentityDto {
  @ApiProperty({ type: String, maxLength: 512 })
  @IsString()
  @Length(1, 512)
  issuer!: string;
  @ApiProperty({
    type: String,
    maxLength: 255,
    description:
      'Точный неизменяемый sub пользователя Keycloak, не email или username.',
  })
  @IsString()
  @Length(1, 255)
  subject!: string;
}

export class AdminAccountDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String }) login!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) role!: string;
  @ApiProperty({ type: Boolean }) isActive!: boolean;
  @ApiProperty({ type: Boolean }) hasLocalPassword!: boolean;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: [AdminAccountIdentityDto] })
  identities!: AdminAccountIdentityDto[];
}
export class CreateAdminAccountDto {
  @ApiProperty({ type: String })
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]{3,64}$/)
  login!: string;
  @ApiProperty({ type: String, minLength: 12, maxLength: 128 })
  @IsString()
  @Length(12, 128)
  password!: string;
  @ApiProperty({ type: String })
  @IsString()
  @Length(1, 64)
  role!: string;
  @ApiPropertyOptional({ type: String, maxLength: 120 })
  @IsOptional()
  @IsString()
  @Length(0, 120)
  name?: string;
}
export class UpdateAdminAccountDto {
  @ApiProperty({ type: String })
  @IsString()
  @Length(1, 64)
  role!: string;
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  isActive!: boolean;
  @ApiProperty({ type: Number, minimum: 0 })
  @IsInt()
  @Min(0)
  version!: number;
}
