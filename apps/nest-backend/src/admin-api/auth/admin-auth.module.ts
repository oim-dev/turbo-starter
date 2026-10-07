import { Module } from '@nestjs/common';
import { AdminUsersModule } from '../../modules/admin-users/admin-users.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';

@Module({
  imports: [AdminUsersModule],
  controllers: [AdminAuthController],
  providers: [AdminAuthService],
})
export class AdminAuthModule {}
