import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { ClientUsersService } from './client-users.service';

@Module({
  imports: [PrismaModule],
  providers: [ClientUsersService],
  exports: [ClientUsersService],
})
export class ClientUsersModule {}
