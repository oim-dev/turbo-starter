import { Module } from '@nestjs/common';
import { ClientUsersModule } from '../../modules/client-users/client-users.module';
import { ClientUsersController } from './client-users.controller';

@Module({
  imports: [ClientUsersModule],
  controllers: [ClientUsersController],
})
export class ClientUsersHttpModule {}
