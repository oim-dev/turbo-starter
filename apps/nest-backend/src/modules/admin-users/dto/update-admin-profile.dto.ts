import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateAdminProfileDto {
  @ApiProperty({ type: String, maxLength: 120 })
  @IsString()
  @MaxLength(120)
  name!: string;
}

export class ChangeAdminLoginDto {
  @ApiProperty({ type: String, minLength: 3, maxLength: 64 })
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]{3,64}$/)
  login!: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Обязателен при наличии локального пароля.',
    maxLength: 128,
  })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  currentPassword?: string;
}
