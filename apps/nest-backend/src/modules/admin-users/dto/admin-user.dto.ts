import { ApiProperty } from '@nestjs/swagger';
import { AdminRole } from '../../../generated/prisma/client';

export class AdminUserDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, minLength: 3, maxLength: 64 })
  login!: string;

  @ApiProperty({ type: Boolean })
  isActive!: boolean;

  @ApiProperty({
    enum: AdminRole,
    description: 'OWNER — владелец сервиса; SUPPORT — поддержка.',
  })
  role!: AdminRole;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
