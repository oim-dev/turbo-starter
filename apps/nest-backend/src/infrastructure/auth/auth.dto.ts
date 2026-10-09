import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'user123',
    minLength: 3,
    maxLength: 64,
    pattern: '^[a-zA-Z0-9_.-]{3,64}$',
  })
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]{3,64}$/)
  login!: string;

  @ApiProperty({
    format: 'password',
    writeOnly: true,
    minLength: 1,
    maxLength: 128,
  })
  @IsString()
  @Length(1, 128)
  password!: string;
}

export class AccessTokenDto {
  @ApiProperty({
    description:
      'Bearer JWT для Authorization. Выдаётся только в JSON, не в cookie.',
  })
  accessToken!: string;

  @ApiProperty({ enum: ['Bearer'] })
  tokenType!: 'Bearer';

  @ApiProperty({
    description:
      'Фиксированный срок JWT: exp - iat = 604800 секунд (7 дней), включая вход через Keycloak. По истечении срока требуется новый вход.',
    enum: [604800],
    example: 604800,
  })
  expiresIn!: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description:
      'Фиксированный срок окончания сессии, совпадающий с exp JWT. Сессия может быть отозвана раньше при выходе, смене credentials или отзыве доступа.',
  })
  sessionExpiresAt!: Date;
}
