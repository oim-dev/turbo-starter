import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AdminUsersService } from './admin-users.service';
import { AdminBootstrapService } from './admin-bootstrap.service';

@Module({
  imports: [PrismaModule],
  providers: [AdminUsersService, AdminBootstrapService],
  exports: [AdminUsersService],
})
export class AdminUsersModule {}
