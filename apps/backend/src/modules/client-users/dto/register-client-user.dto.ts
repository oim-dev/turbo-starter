import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length, Matches, ValidateIf } from 'class-validator';

export class RegisterClientUserDto {
  @ApiProperty({
    type: String,
    minLength: 3,
    maxLength: 64,
    pattern: '^[a-zA-Z0-9_.-]{3,64}$',
    description: 'Логин без учёта регистра; сохраняется в нижнем регистре.',
    example: 'client.user',
  })
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]{3,64}$/)
  login!: string;

  @ApiProperty({
    type: String,
    format: 'password',
    writeOnly: true,
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @Length(8, 128)
  password!: string;

  @ApiProperty({
    type: String,
    required: false,
    minLength: 1,
    maxLength: 120,
    description:
      'Отображаемое имя: пробелы по краям удаляются до проверки длины, пустое имя запрещено. По умолчанию используется нормализованный логин.',
    example: 'Client User',
  })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 120)
  @Matches(/\S/, { message: 'name must not be blank' })
  name?: string;
}
