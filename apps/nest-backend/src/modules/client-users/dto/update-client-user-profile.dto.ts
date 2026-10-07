import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length, Matches, ValidateIf } from 'class-validator';

export class UpdateClientUserProfileDto {
  @ApiProperty({
    type: String,
    required: false,
    minLength: 1,
    maxLength: 120,
    description:
      'Отображаемое имя: пробелы по краям удаляются до проверки длины, пустое имя и null запрещены. Если поле отсутствует, имя не меняется.',
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
