import { Module } from '@nestjs/common';
import { ClientUsersModule } from '../../modules/client-users/client-users.module';
import { ClientAuthController } from './client-auth.controller';
import { ClientAuthService } from './client-auth.service';

@Module({
  imports: [ClientUsersModule],
  controllers: [ClientAuthController],
  providers: [ClientAuthService],
})
export class ClientAuthModule {}
