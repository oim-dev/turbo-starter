import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class ChangeAdminPasswordDto {
  @ApiProperty({
    type: String,
    format: 'password',
    writeOnly: true,
    minLength: 1,
    maxLength: 128,
    description: 'Текущий пароль, включая первоначальный dev-пароль.',
  })
  @IsString()
  @Length(1, 128)
  currentPassword!: string;

  @ApiProperty({
    type: String,
    format: 'password',
    writeOnly: true,
    minLength: 12,
    maxLength: 128,
  })
  @IsString()
  @Length(12, 128)
  newPassword!: string;
}
