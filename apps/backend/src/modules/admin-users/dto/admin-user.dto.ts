import { ApiProperty } from '@nestjs/swagger';

export class AdminUserDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, minLength: 3, maxLength: 64 })
  login!: string;

  @ApiProperty({ type: Boolean })
  isActive!: boolean;

  @ApiProperty({
    type: Boolean,
    description:
      'Есть ли локальный пароль. Для SSO-only аккаунта смена пароля недоступна.',
  })
  hasLocalPassword!: boolean;

  @ApiProperty({ type: String, description: 'Ключ назначенной роли.' })
  role!: string;

  @ApiProperty({ type: String })
  roleName!: string;

  @ApiProperty({ type: [String] })
  permissions!: string[];

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
