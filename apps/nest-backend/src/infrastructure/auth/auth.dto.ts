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
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ enum: ['Bearer'] })
  tokenType!: 'Bearer';

  @ApiProperty({
    description:
      'Целое число секунд между iat и exp JWT, не больше настроенного access TTL. Из-за округления секундной границы может превышать фактический остаток жизни сессии; доступ дополнительно ограничен точным sessionExpiresAt.',
    example: 900,
  })
  expiresIn!: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description:
      'Точный фиксированный срок окончания сессии с миллисекундной точностью; ротация токенов не продлевает его. После этого момента доступ и refresh запрещены, даже если exp JWT ещё не наступил.',
  })
  sessionExpiresAt!: Date;
}
