import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

class CurrentClientPasswordDto {
  @ApiProperty({
    type: String,
    format: 'password',
    writeOnly: true,
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @Length(8, 128)
  currentPassword!: string;
}

export class ChangeClientUserLoginDto extends CurrentClientPasswordDto {
  @ApiProperty({
    type: String,
    minLength: 3,
    maxLength: 64,
    pattern: '^[a-zA-Z0-9_.-]{3,64}$',
    description:
      'Уникальный логин без учёта регистра; сохраняется в нижнем регистре.',
  })
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]{3,64}$/)
  login!: string;
}

export class ChangeClientUserPasswordDto extends CurrentClientPasswordDto {
  @ApiProperty({
    type: String,
    format: 'password',
    writeOnly: true,
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @Length(8, 128)
  newPassword!: string;
}
