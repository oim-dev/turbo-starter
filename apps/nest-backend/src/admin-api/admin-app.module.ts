import { Module } from '@nestjs/common';
import { AdminPermissionsGuard } from '../infrastructure/auth/admin-roles';
import { SecurityModule } from '../infrastructure/auth/security.module';
import { loadApiConfig } from '../infrastructure/config/api-config';
import { AdminAuthModule } from './auth/admin-auth.module';
import { AdminSessionStore } from './auth/admin-session.store';
import { PrismaModule } from '../infrastructure/prisma/prisma.module';
import { AdminAccessService } from '../modules/admin-access/admin-access.service';
import { AdminAccessController } from './access/admin-access.controller';
import { ImagesModule } from '../modules/images/images.module';
import { AdminImagesController } from './images/admin-images.controller';

export const adminApiConfig = loadApiConfig('admin');

@Module({
  imports: [
    SecurityModule.register(
      adminApiConfig,
      AdminSessionStore,
      AdminPermissionsGuard,
    ),
    AdminAuthModule,
    PrismaModule,
    ImagesModule,
  ],
  controllers: [AdminAccessController, AdminImagesController],
  providers: [AdminAccessService],
})
export class AdminAppModule {}
